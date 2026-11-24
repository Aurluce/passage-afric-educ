"""Tests de la gestion du compte responsable et de sa politique de mot de passe."""
import pytest
from rest_framework.test import APIClient

from passage.models import Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def responsable():
    return Utilisateur.objects.create_user(
        identifiant="responsable-compte",
        password="Responsable!2026",
        role="RESPONSABLE",
        nom="Responsable test",
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_responsable_consulte_et_modifie_son_profil_sans_exposer_le_mot_de_passe(responsable):
    client = _client(responsable)

    profile = client.get("/api/responsable/compte")
    update = client.patch(
        "/api/responsable/compte",
        {"nom": "Nouveau nom", "identifiant": "responsable-nouveau"},
        format="json",
    )

    assert profile.status_code == 200
    assert profile.data == {
        "id": responsable.id,
        "identifiant": "responsable-compte",
        "nom": "Responsable test",
        "role": "RESPONSABLE",
    }
    assert "password" not in profile.data
    assert update.status_code == 200
    responsable.refresh_from_db()
    assert responsable.nom == "Nouveau nom"
    assert responsable.identifiant == "responsable-nouveau"
    assert responsable.role == "RESPONSABLE"


def test_le_role_ne_peut_pas_etre_modifie(responsable):
    response = _client(responsable).patch(
        "/api/responsable/compte",
        {"role": "AGENT"},
        format="json",
    )

    assert response.status_code == 400
    responsable.refresh_from_db()
    assert responsable.role == "RESPONSABLE"


def test_responsable_change_son_mot_de_passe_avec_confirmation(responsable):
    response = _client(responsable).post(
        "/api/responsable/compte/mot-de-passe",
        {
            "mot_de_passe_actuel": "Responsable!2026",
            "nouveau_mot_de_passe": "Nouveau-Secret-2026!",
            "confirmation_mot_de_passe": "Nouveau-Secret-2026!",
        },
        format="json",
    )

    assert response.status_code == 200
    responsable.refresh_from_db()
    assert responsable.check_password("Nouveau-Secret-2026!")
    assert not responsable.check_password("Responsable!2026")


@pytest.mark.parametrize(
    "nouveau_mot_de_passe",
    [
        "court",
        "password",
        "12345678",
        "responsable-compte!",
    ],
)
def test_refuse_les_mots_de_passe_qui_ne_respectent_pas_les_validateurs_django(
    responsable,
    nouveau_mot_de_passe,
):
    response = _client(responsable).post(
        "/api/responsable/compte/mot-de-passe",
        {
            "mot_de_passe_actuel": "Responsable!2026",
            "nouveau_mot_de_passe": nouveau_mot_de_passe,
            "confirmation_mot_de_passe": nouveau_mot_de_passe,
        },
        format="json",
    )

    assert response.status_code == 400
    responsable.refresh_from_db()
    assert responsable.check_password("Responsable!2026")


def test_refuse_un_mot_de_passe_actuel_incorrect_ou_une_confirmation_differente(responsable):
    client = _client(responsable)
    wrong_current = client.post(
        "/api/responsable/compte/mot-de-passe",
        {
            "mot_de_passe_actuel": "mauvais",
            "nouveau_mot_de_passe": "Nouveau-Secret-2026!",
            "confirmation_mot_de_passe": "Nouveau-Secret-2026!",
        },
        format="json",
    )
    mismatch = client.post(
        "/api/responsable/compte/mot-de-passe",
        {
            "mot_de_passe_actuel": "Responsable!2026",
            "nouveau_mot_de_passe": "Nouveau-Secret-2026!",
            "confirmation_mot_de_passe": "Nouveau-Secret-2027!",
        },
        format="json",
    )

    assert wrong_current.status_code == 400
    assert mismatch.status_code == 400
    responsable.refresh_from_db()
    assert responsable.check_password("Responsable!2026")


@pytest.mark.parametrize("role", ["AGENT", "PARENT"])
def test_seuls_les_responsables_peuvent_gerer_leur_compte(role):
    user = Utilisateur.objects.create_user(
        identifiant=f"compte-{role.lower()}",
        password="MotDePasse!2026",
        role=role,
        nom="Utilisateur test",
    )
    client = _client(user)

    responses = [
        client.get("/api/responsable/compte"),
        client.patch("/api/responsable/compte", {"nom": "Autre"}, format="json"),
        client.post(
            "/api/responsable/compte/mot-de-passe",
            {
                "mot_de_passe_actuel": "MotDePasse!2026",
                "nouveau_mot_de_passe": "Nouveau-Secret-2026!",
                "confirmation_mot_de_passe": "Nouveau-Secret-2026!",
            },
            format="json",
        ),
    ]

    assert [response.status_code for response in responses] == [403, 403, 403]
