"""Tests des points critiques de sécurité de l'authentification."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from passage.models import Utilisateur

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def agent():
    return Utilisateur.objects.create_user(
        identifiant="agent01", password="MotDePasse!123", role="AGENT", nom="Agent 1",
    )


def test_login_ok(client, agent):
    r = client.post(reverse("auth-login"), {"identifiant": "agent01", "password": "MotDePasse!123"})
    assert r.status_code == 200
    assert "access" in r.data and "refresh" in r.data
    assert r.data["user"]["role"] == "AGENT"


def test_login_message_identique_identifiant_inexistant_ou_mdp_faux(client, agent):
    """Exigence §2.2 : le message ne doit pas révéler si l'identifiant existe."""
    r1 = client.post(reverse("auth-login"), {"identifiant": "agent01", "password": "MauvaisMdp!123"})
    r2 = client.post(reverse("auth-login"), {"identifiant": "inconnu", "password": "MauvaisMdp!123"})
    assert r1.status_code == r2.status_code == 400
    # On compare uniquement le message "detail", pas les champs annexes.
    assert r1.data.get("detail") == r2.data.get("detail") == ["Identifiants invalides."]


def test_login_throttle_5_par_minute(client, agent):
    """Exigence §2.2 : nombre de tentatives limité."""
    for _ in range(5):
        client.post(reverse("auth-login"), {"identifiant": "agent01", "password": "MauvaisMdp!123"})
    r = client.post(reverse("auth-login"), {"identifiant": "agent01", "password": "MauvaisMdp!123"})
    assert r.status_code == 429


def test_logout_blackliste_le_refresh(client, agent):
    r = client.post(reverse("auth-login"), {"identifiant": "agent01", "password": "MotDePasse!123"})
    refresh = r.data["refresh"]
    access = r.data["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    r_logout = client.post(reverse("auth-logout"), {"refresh": refresh}, format="json")
    assert r_logout.status_code == 205

    # Le refresh est blacklisté : impossible de le réutiliser pour obtenir un access
    r_refresh = client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert r_refresh.status_code in (400, 401)