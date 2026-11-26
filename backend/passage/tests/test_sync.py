"""
Tests de la synchronisation idempotente.

Couvre les scénarios §3.4 :
- 20 passages envoyés → 20 en base ;
- rejeu du même lot → toujours 20 (idempotence) ;
- horloge fausse (2 h d'écart) → sync_etat=REJETE_HORLOGE + anomalie HORLOGE_SUSPECTE ;
- badge suspendu → refusé.
"""
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient
from django.utils import timezone

from passage.models import Anomalie, Badge, Eleve, Passage, PointControle, Utilisateur
from passage.services.sync import RapportSync, synchroniser_passages

pytestmark = pytest.mark.django_db


@pytest.fixture
def contexte():
    eleve = Eleve.objects.create(nom="E1", classe="6e A", etablissement="Collège test")
    badge = Badge.objects.create(eleve=eleve, secret="x" * 32, etat="ACTIF")
    point = PointControle.objects.create(
        etablissement="Collège test", libelle="Portail entrée", type="PORTAIL",
    )
    return {"eleve": eleve, "badge": badge, "point": point}


from passage.services.badge import generer_code, generer_code_secours

def _lot(badge, point, n=20):
    maintenant = timezone.now()
    return [
        {
            "event_id_local": uuid.uuid4(),
            "badge_id": badge.id,
            "badge_code": generer_code(badge),
            "point_id": point.id,
            "heure_locale": maintenant,
        }
        for _ in range(n)
    ]

def test_20_passages_20_en_base(contexte):
    lot = _lot(contexte["badge"], contexte["point"], n=20)
    rapport = synchroniser_passages("dev-test-01", lot)
    assert rapport.created == 20
    assert Passage.objects.count() == 20


def test_rejeu_idempotent(contexte):
    lot = _lot(contexte["badge"], contexte["point"], n=20)
    synchroniser_passages("dev-test-01", lot)
    rapport2 = synchroniser_passages("dev-test-01", lot)
    assert rapport2.created == 0
    assert rapport2.ignored == 20
    assert Passage.objects.count() == 20


def test_scan_hors_ligne_synchronise_dans_les_10_minutes(contexte):
    heure_locale = timezone.now() - timedelta(minutes=9)
    code = generer_code(
        contexte["badge"],
        maintenant=int((heure_locale - timedelta(seconds=1)).timestamp()),
    )
    lot = [{
        "event_id_local": uuid.uuid4(),
        "badge_id": contexte["badge"].id,
        "point_id": contexte["point"].id,
        "badge_code": code,
        "heure_locale": heure_locale,
    }]

    rapport = synchroniser_passages("dev-test-01", lot)

    assert rapport.created == 1
    assert rapport.rejected_signature == 0
    assert Passage.objects.get().heure_locale == heure_locale


def test_code_secours_enregistre_un_scan_sans_identifiant_de_badge(contexte):
    agent = Utilisateur.objects.create_user(
        identifiant="agent-code-secours",
        password="Agent!2026",
        role="AGENT",
        nom="Agent",
    )
    agent.points_controle.add(contexte["point"])
    code_badge = generer_code(contexte["badge"])
    code_secours = generer_code_secours(contexte["badge"], code_badge)
    client = APIClient()
    client.force_authenticate(user=agent)
    passage = {
        "event_id_local": str(uuid.uuid4()),
        "badge_id": None,
        "badge_code": None,
        "code_secours": code_secours,
        "point_id": contexte["point"].id,
        "heure_locale": timezone.now().isoformat(),
    }

    response = client.post(
        "/api/passages/sync/",
        {"appareil_id": "agent-secours", "passages": [passage]},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["created"] == 1
    assert Passage.objects.get().badge == contexte["badge"]

    replay = {**passage, "event_id_local": str(uuid.uuid4())}
    replay_response = client.post(
        "/api/passages/sync/",
        {"appareil_id": "agent-secours", "passages": [replay]},
        format="json",
    )
    assert replay_response.data["rejected_signature"] == 1
    assert Passage.objects.count() == 1


def test_code_secours_expire_apres_120_secondes(contexte):
    heure_locale = timezone.now()
    code_badge = generer_code(
        contexte["badge"],
        maintenant=int(heure_locale.timestamp()) - 121,
    )
    code_secours = generer_code_secours(contexte["badge"], code_badge)
    rapport = synchroniser_passages("agent-secours", [{
        "event_id_local": uuid.uuid4(),
        "code_secours": code_secours,
        "point_id": contexte["point"].id,
        "heure_locale": heure_locale,
    }])

    assert rapport.rejected_signature == 1
    assert rapport.created == 0
    assert Passage.objects.count() == 0


def test_horloge_fausse_rejetee(contexte):
    maintenant = timezone.now()
    heure_locale = maintenant - timedelta(hours=2)
    lot = [{
        "event_id_local": uuid.uuid4(),
        "badge_id": contexte["badge"].id,
        "point_id": contexte["point"].id,
        "badge_code": generer_code(
            contexte["badge"],
            maintenant=int((heure_locale - timedelta(seconds=1)).timestamp()),
        ),
        "heure_locale": heure_locale,
    }]
    rapport = synchroniser_passages("dev-test-01", lot)
    assert rapport.rejected_clock == 1
    assert rapport.created == 0
    p = Passage.objects.get()
    assert p.sync_etat == Passage.SyncEtat.REJETE_HORLOGE
    assert Anomalie.objects.filter(
        type=Anomalie.Type.HORLOGE_SUSPECTE, passage=p,
    ).exists()


def test_badge_suspendu_refuse(contexte):
    contexte["badge"].etat = Badge.Etat.SUSPENDU
    contexte["badge"].save()
    lot = _lot(contexte["badge"], contexte["point"], n=3)
    rapport = synchroniser_passages("dev-test-01", lot)
    assert rapport.rejected_badge == 3
    assert Passage.objects.count() == 0


def test_endpoint_sync_retourne_le_nombre_de_signatures_rejetees():
    point = PointControle.objects.create(
        etablissement="Collège test",
        libelle="Portail entrée",
        type=PointControle.Type.PORTAIL,
    )
    agent = Utilisateur.objects.create_user(
        identifiant="agent-sync", password="MotDePasse!123", role="AGENT", nom="Agent",
    )
    agent.points_controle.add(point)
    client = APIClient()
    client.force_authenticate(user=agent)
    event_id = uuid.uuid4()
    rapport = RapportSync(
        rejected_signature=1,
        details=[{"event_id_local": str(event_id), "statut": "REJETE_SIGNATURE"}],
    )
    payload = {
        "appareil_id": "dev-test-01",
        "passages": [{
            "event_id_local": str(event_id),
            "badge_id": 1,
            "badge_code": "code-invalide",
            "point_id": point.id,
            "heure_locale": timezone.now().isoformat(),
        }],
    }

    with patch("passage.views_sync.synchroniser_passages", return_value=rapport):
        response = client.post("/api/passages/sync/", payload, format="json")

    assert response.status_code == 200
    assert response.data["rejected_signature"] == 1
