"""Tests de la gestion des élèves réservée au responsable."""
import pytest
from rest_framework.test import APIClient

from passage.models import Eleve, Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def responsable():
    return Utilisateur.objects.create_user(
        identifiant="responsable",
        password="Responsable!2026",
        role="RESPONSABLE",
        nom="Responsable test",
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_responsable_cree_un_eleve(responsable):
    response = _client(responsable).post(
        "/api/responsable/eleves",
        {
            "nom": "Élève test",
            "classe": "6e A",
            "etablissement": "Collège test",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["etat"] == Eleve.Etat.ACTIF
    assert Eleve.objects.get(pk=response.data["id"]).nom == "Élève test"


def test_responsable_liste_et_modifie_un_eleve(responsable):
    eleve = Eleve.objects.create(
        nom="Élève test",
        classe="6e A",
        etablissement="Collège test",
    )
    client = _client(responsable)

    listing = client.get("/api/responsable/eleves")
    update = client.patch(
        f"/api/responsable/eleves/{eleve.id}",
        {"etat": Eleve.Etat.INACTIF},
        format="json",
    )

    assert listing.status_code == 200
    assert listing.data[0]["id"] == eleve.id
    assert update.status_code == 200
    assert update.data["etat"] == Eleve.Etat.INACTIF
    assert Eleve.objects.filter(pk=eleve.id).exists()


@pytest.mark.parametrize("role", ["AGENT", "PARENT"])
def test_autres_roles_ne_peuvent_pas_gerer_les_eleves(role):
    user = Utilisateur.objects.create_user(
        identifiant=role.lower(),
        password="MotDePasse!2026",
        role=role,
        nom="Utilisateur test",
    )

    response = _client(user).get("/api/responsable/eleves")

    assert response.status_code == 403


def test_visiteur_non_connecte_ne_peut_pas_lister_les_eleves():
    response = APIClient().get("/api/responsable/eleves")

    assert response.status_code == 401
