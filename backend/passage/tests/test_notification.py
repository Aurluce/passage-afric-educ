"""Tests de la notification parent (§3.3)."""
from datetime import date

import pytest
from django.conf import settings

from passage.models import (
    Anomalie, Eleve, MessageSortant, ParentEleve, Utilisateur,
)
from passage.services.notification import notifier_anomalies

pytestmark = pytest.mark.django_db
JOUR = date(2025, 1, 15)


@pytest.fixture
def contexte():
    parent = Utilisateur.objects.create_user(
        identifiant="p1", password="Parent!2026", role="PARENT", nom="Parent",
    )
    eleve = Eleve.objects.create(nom="E1", classe="6e A", etablissement="X")
    ParentEleve.objects.create(parent=parent, eleve=eleve)
    a1 = Anomalie.objects.create(eleve=eleve, type=Anomalie.Type.ABSENCE, date=JOUR)
    return {"parent": parent, "eleve": eleve, "a1": a1}


def test_notification_cree_un_message(contexte):
    rapport = notifier_anomalies(JOUR)
    assert rapport["crees"] == 1
    msg = MessageSortant.objects.get()
    assert msg.parent == contexte["parent"]
    assert msg.anomalie == contexte["a1"]
    assert msg.etat == MessageSortant.Etat.ENVOYE
    assert "E1" in msg.texte


def test_notification_idempotente(contexte):
    notifier_anomalies(JOUR)
    notifier_anomalies(JOUR)
    assert MessageSortant.objects.count() == 1


def test_plafond_quotidien(contexte, settings):
    settings.PARENT_MSG_DAILY_CAP = 1
    # 2 anomalies sur le même élève, même jour
    a2 = Anomalie.objects.create(eleve=contexte["eleve"], type=Anomalie.Type.DOUBLE_SCAN, date=JOUR)
    rapport = notifier_anomalies(JOUR)
    assert rapport["crees"] == 1
    assert rapport["bloques"] == 1
    # Un message a été bloqué avec un motif
    bloque = MessageSortant.objects.get(etat=MessageSortant.Etat.BLOQUE)
    assert "Plafond" in bloque.motif_non_envoi
