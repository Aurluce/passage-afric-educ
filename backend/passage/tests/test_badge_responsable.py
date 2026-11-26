"""Tests du cycle de vie des badges administré par le responsable."""
import uuid

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from passage.models import Badge, Eleve, Passage, PointControle, Utilisateur
from passage.services.badge import CODE_TTL_SECONDS, generer_code, verifier_et_consommer
from passage.services.sync import synchroniser_passages

pytestmark = pytest.mark.django_db


@pytest.fixture
def contexte():
    responsable = Utilisateur.objects.create_user(
        identifiant="responsable-badges",
        password="Responsable!2026",
        role="RESPONSABLE",
        nom="Responsable test",
    )
    eleve = Eleve.objects.create(
        nom="Élève test",
        classe="6e A",
        etablissement="Collège test",
    )
    point = PointControle.objects.create(
        etablissement="Collège test",
        libelle="Portail entrée",
        type="PORTAIL",
    )
    return {"responsable": responsable, "eleve": eleve, "point": point}


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_responsable_emet_un_badge_sans_exposer_le_secret(contexte):
    response = _client(contexte["responsable"]).post(
        f"/api/responsable/eleves/{contexte['eleve'].id}/badge",
    )

    assert response.status_code == 201
    assert response.data["etat"] == Badge.Etat.ACTIF
    assert "secret" not in response.data
    assert len(Badge.objects.get(pk=response.data["id"]).secret) == 64


def test_responsable_emet_un_qr_temporaire_sans_donnee_nominative(contexte):
    badge = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="e" * 64,
        etat=Badge.Etat.ACTIF,
    )

    response = _client(contexte["responsable"]).post(
        f"/api/responsable/badges/{badge.id}/code",
    )

    assert response.status_code == 200
    assert set(response.data) == {"badge_id", "code", "code_secours", "expire_dans"}
    assert response.data["badge_id"] == badge.id
    assert len(response.data["code_secours"].replace("-", "")) == 12
    assert response.data["expire_dans"] == CODE_TTL_SECONDS == 120
    assert response["Cache-Control"] == "no-store"
    assert verifier_et_consommer(badge, response.data["code"]) is True


@pytest.mark.parametrize("role", ["AGENT", "PARENT"])
def test_seul_le_responsable_peut_emettre_un_qr(role, contexte):
    user = Utilisateur.objects.create_user(
        identifiant=f"qr-{role.lower()}",
        password="MotDePasse!2026",
        role=role,
        nom="Utilisateur test",
    )
    badge = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="f" * 64,
        etat=Badge.Etat.ACTIF,
    )

    response = _client(user).post(f"/api/responsable/badges/{badge.id}/code")

    assert response.status_code == 403


def test_badge_inactif_ne_peut_pas_produire_de_qr(contexte):
    badge = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="g" * 64,
        etat=Badge.Etat.SUSPENDU,
    )

    response = _client(contexte["responsable"]).post(
        f"/api/responsable/badges/{badge.id}/code",
    )

    assert response.status_code == 404


def test_un_eleve_ne_peut_pas_recevoir_deux_badges_initiaux(contexte):
    client = _client(contexte["responsable"])
    url = f"/api/responsable/eleves/{contexte['eleve'].id}/badge"
    first = client.post(url)
    second = client.post(url)

    assert first.status_code == 201
    assert second.status_code == 409
    assert Badge.objects.filter(eleve=contexte["eleve"], etat=Badge.Etat.ACTIF).count() == 1


def test_reemission_revoque_immediatement_ancien_badge(contexte):
    client = _client(contexte["responsable"])
    old = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="a" * 64,
        etat=Badge.Etat.ACTIF,
    )
    old_code = generer_code(old)

    response = client.post(f"/api/responsable/badges/{old.id}/reemettre")

    old.refresh_from_db()
    new = Badge.objects.get(pk=response.data["id"])
    assert response.status_code == 201
    assert old.etat == Badge.Etat.REVOQUE
    assert new.badge_remplace_id == old.id
    assert new.secret != old.secret
    assert "secret" not in response.data
    assert Badge.objects.filter(eleve=contexte["eleve"], etat=Badge.Etat.ACTIF).count() == 1

    report = synchroniser_passages(
        "dev-test-01",
        [{
            "event_id_local": uuid.uuid4(),
            "badge_id": old.id,
            "badge_code": old_code,
            "point_id": contexte["point"].id,
            "heure_locale": timezone.now(),
        }],
    )
    assert report.rejected_badge == 1
    assert Passage.objects.count() == 0


def test_badge_perdu_ne_peut_pas_etre_reactive_et_peut_etre_reemis(contexte):
    client = _client(contexte["responsable"])
    badge = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="b" * 64,
        etat=Badge.Etat.ACTIF,
    )

    lost = client.patch(
        f"/api/responsable/badges/{badge.id}",
        {"etat": Badge.Etat.PERDU},
        format="json",
    )
    reactivate = client.patch(
        f"/api/responsable/badges/{badge.id}",
        {"etat": Badge.Etat.ACTIF},
        format="json",
    )
    reissue = client.post(f"/api/responsable/badges/{badge.id}/reemettre")

    assert lost.status_code == 200
    assert reactivate.status_code == 400
    assert reissue.status_code == 201
    badge.refresh_from_db()
    assert badge.etat == Badge.Etat.REVOQUE


def test_secret_ne_peut_pas_etre_modifie_par_la_route_detat(contexte):
    client = _client(contexte["responsable"])
    badge = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="c" * 64,
        etat=Badge.Etat.ACTIF,
    )

    response = client.patch(
        f"/api/responsable/badges/{badge.id}",
        {"etat": Badge.Etat.SUSPENDU, "secret": "secret-controle"},
        format="json",
    )

    badge.refresh_from_db()
    assert response.status_code == 400
    assert badge.etat == Badge.Etat.ACTIF
    assert badge.secret == "c" * 64


@pytest.mark.parametrize("role", ["AGENT", "PARENT"])
def test_seuls_les_responsables_peuvent_gerer_les_badges(contexte, role):
    user = Utilisateur.objects.create_user(
        identifiant=f"badge-{role.lower()}",
        password="MotDePasse!2026",
        role=role,
        nom="Utilisateur test",
    )
    badge = Badge.objects.create(
        eleve=contexte["eleve"],
        secret="d" * 64,
        etat=Badge.Etat.ACTIF,
    )

    client = _client(user)
    responses = [
        client.get("/api/responsable/badges"),
        client.post(f"/api/responsable/eleves/{contexte['eleve'].id}/badge"),
        client.post(f"/api/responsable/badges/{badge.id}/reemettre"),
        client.patch(
            f"/api/responsable/badges/{badge.id}",
            {"etat": Badge.Etat.SUSPENDU},
            format="json",
        ),
    ]

    assert [response.status_code for response in responses] == [403, 403, 403, 403]
