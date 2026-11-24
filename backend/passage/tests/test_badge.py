"""Tests du badge tournant (D1)."""
import time
import uuid

import pytest

from passage.models import Badge, Eleve, NonceConsomme
from passage.services.badge import generer_code, verifier_et_consommer

pytestmark = pytest.mark.django_db


@pytest.fixture
def badge():
    eleve = Eleve.objects.create(nom="E1", classe="6e A", etablissement="X")
    return Badge.objects.create(eleve=eleve, secret="x" * 32, etat="ACTIF")


def test_code_valide_consomme_nonce(badge):
    code = generer_code(badge)
    assert verifier_et_consommer(badge, code) is True
    assert NonceConsomme.objects.filter(badge=badge).count() == 1


def test_code_rejoue_refuse(badge):
    """Scénario §3.4 : photographier le badge et le présenter depuis un autre appareil."""
    code = generer_code(badge)
    assert verifier_et_consommer(badge, code) is True   # scan légitime
    assert verifier_et_consommer(badge, code) is False  # rejeu (photo)


def test_code_tronque_refuse(badge):
    assert verifier_et_consommer(badge, "abc") is False
    assert verifier_et_consommer(badge, "") is False


def test_code_signature_invalide_refuse(badge):
    code = generer_code(badge)
    # Corrompt la signature
    parts = code.split(":")
    parts[2] = "X" * len(parts[2])
    assert verifier_et_consommer(badge, ":".join(parts)) is False


def test_code_timestamp_trop_vieux_refuse(badge):
    """Un code généré il y a 30 s (au-delà de ±1 pas de 5 s) est refusé."""
    vieux = int(time.time()) - 30
    code = generer_code(badge, maintenant=vieux)
    assert verifier_et_consommer(badge, code) is False
