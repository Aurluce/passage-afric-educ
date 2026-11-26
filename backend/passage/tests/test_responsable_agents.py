import uuid

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from passage.models import PointControle, Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def contexte():
    responsable = Utilisateur.objects.create_user(
        identifiant="responsable-agents",
        password="Responsable!2026",
        role=Utilisateur.Role.RESPONSABLE,
        nom="Responsable",
    )
    agent = Utilisateur.objects.create_user(
        identifiant="agent-point",
        password="Agent!2026",
        role=Utilisateur.Role.AGENT,
        nom="Agent Portail",
    )
    autre_agent = Utilisateur.objects.create_user(
        identifiant="agent-autre",
        password="Agent!2026",
        role=Utilisateur.Role.AGENT,
        nom="Agent Autobus",
    )
    point_entree = PointControle.objects.create(
        etablissement="Collège test",
        libelle="Portail entrée",
        type=PointControle.Type.PORTAIL,
    )
    point_autobus = PointControle.objects.create(
        etablissement="Collège test",
        libelle="Autobus",
        type=PointControle.Type.AUTOBUS,
    )
    return {
        "responsable": responsable,
        "agent": agent,
        "autre_agent": autre_agent,
        "point_entree": point_entree,
        "point_autobus": point_autobus,
    }


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _scan(point_id):
    return {
        "event_id_local": str(uuid.uuid4()),
        "badge_id": 1,
        "badge_code": "code-invalide",
        "point_id": point_id,
        "heure_locale": timezone.now().isoformat(),
    }


def test_responsable_affecte_plusieurs_points_et_agent_ne_voit_que_ceux_ci(contexte):
    responsable_client = _client(contexte["responsable"])
    listing = responsable_client.get("/api/responsable/agents")
    update = responsable_client.patch(
        f"/api/responsable/agents/{contexte['agent'].id}",
        {"point_controle_ids": [
            contexte["point_entree"].id,
            contexte["point_autobus"].id,
        ]},
        format="json",
    )

    assert listing.status_code == 200
    assert len(listing.data) == 2
    assert update.status_code == 200
    assert set(update.data["point_controle_ids"]) == {
        contexte["point_entree"].id,
        contexte["point_autobus"].id,
    }

    contexte["agent"].refresh_from_db()
    points = _client(contexte["agent"]).get("/api/agent/points")
    assert points.status_code == 200
    assert {point["id"] for point in points.data} == {
        contexte["point_entree"].id,
        contexte["point_autobus"].id,
    }


def test_agent_non_affecte_ne_peut_pas_synchroniser(contexte):
    client = _client(contexte["agent"])

    points = client.get("/api/agent/points")
    response = client.post(
        "/api/passages/sync",
        {"appareil_id": "agent-test", "passages": [_scan(contexte["point_entree"].id)]},
        format="json",
    )

    assert points.status_code == 200
    assert points.data == []
    assert response.status_code == 400
    assert "point" in str(response.data).lower()


def test_agent_ne_peut_pas_synchroniser_un_autre_point(contexte):
    contexte["agent"].points_controle.add(contexte["point_entree"])
    client = _client(contexte["agent"])

    response = client.post(
        "/api/passages/sync",
        {"appareil_id": "agent-test", "passages": [_scan(contexte["point_autobus"].id)]},
        format="json",
    )

    assert response.status_code == 400
    assert "affecté" in str(response.data)


def test_seul_le_responsable_peut_gerer_les_affectations(contexte):
    client = _client(contexte["agent"])

    response = client.patch(
        f"/api/responsable/agents/{contexte['autre_agent'].id}",
        {"point_controle_ids": [contexte["point_entree"].id]},
        format="json",
    )

    assert response.status_code == 403
