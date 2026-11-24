"""Tests du cloisonnement parent (D15, §2.2 éliminatoire)."""
import pytest
from rest_framework.test import APIClient

from passage.models import Eleve, ParentEleve, Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def donnees():
    parent1 = Utilisateur.objects.create_user(
        identifiant="p1", password="Parent!2026", role="PARENT", nom="P1",
    )
    parent2 = Utilisateur.objects.create_user(
        identifiant="p2", password="Parent!2026", role="PARENT", nom="P2",
    )
    e1 = Eleve.objects.create(nom="E1", classe="6e A", etablissement="X")
    e2 = Eleve.objects.create(nom="E2", classe="6e A", etablissement="X")
    ParentEleve.objects.create(parent=parent1, eleve=e1)
    ParentEleve.objects.create(parent=parent2, eleve=e2)
    return {"parent1": parent1, "parent2": parent2, "e1": e1, "e2": e2}


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_parent_voit_ses_enfants(donnees):
    c = _client(donnees["parent1"])
    r = c.get("/api/parent/enfants/")
    assert r.status_code == 200
    assert [e["nom"] for e in r.data] == ["E1"]


def test_parent_accede_a_son_enfant(donnees):
    c = _client(donnees["parent1"])
    r = c.get(f"/api/parent/enfants/{donnees['e1'].id}/")
    assert r.status_code == 200
    assert r.data["nom"] == "E1"


def test_parent_change_id_dans_url_refuse_404(donnees):
    """Scénario §3.4 : un parent qui change l'id renvoie 404 (pas 403)."""
    c = _client(donnees["parent1"])
    r = c.get(f"/api/parent/enfants/{donnees['e2'].id}/")  # E2 = autre parent
    assert r.status_code == 404


def test_agent_interdit_sur_endpoint_parent(donnees):
    agent = Utilisateur.objects.create_user(
        identifiant="a1", password="Agent!2026", role="AGENT", nom="A1",
    )
    c = _client(agent)
    r = c.get("/api/parent/enfants/")
    assert r.status_code == 403
