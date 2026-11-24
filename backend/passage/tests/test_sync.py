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

import pytest
from django.utils import timezone

from passage.models import Anomalie, Badge, Eleve, Passage, PointControle
from passage.services.sync import synchroniser_passages

pytestmark = pytest.mark.django_db


@pytest.fixture
def contexte():
    eleve = Eleve.objects.create(nom="E1", classe="6e A", etablissement="Collège test")
    badge = Badge.objects.create(eleve=eleve, secret="x" * 32, etat="ACTIF")
    point = PointControle.objects.create(
        etablissement="Collège test", libelle="Portail entrée", type="PORTAIL",
    )
    return {"eleve": eleve, "badge": badge, "point": point}


from passage.services.badge import generer_code

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


def test_horloge_fausse_rejetee(contexte):
    maintenant = timezone.now()
    lot = [{
        "event_id_local": uuid.uuid4(),
        "badge_id": contexte["badge"].id,
        "point_id": contexte["point"].id,
        "badge_code": generer_code(contexte["badge"]),
        "heure_locale": maintenant - timedelta(hours=2),
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
