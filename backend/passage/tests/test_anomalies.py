"""
Tests de la détection d'anomalies.
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from passage.models import (
    Anomalie, Badge, Eleve, Itineraire, Passage, PointControle,
)
from passage.services.anomalies import detecter_anomalies

pytestmark = pytest.mark.django_db
TZ = ZoneInfo("Africa/Douala")
JOUR = date(2025, 1, 15)  # mercredi


def _dt(h, m, s=0):
    return datetime.combine(JOUR, time(h, m, s), tzinfo=TZ)


def _passage(badge, point, dt, appareil="test-device"):
    return Passage.objects.create(
        badge=badge, point=point,
        heure_locale=dt, heure_serveur=dt,
        appareil_id=appareil,
    )


@pytest.fixture
def jeu_de_donnees():
    """Reproduit le même jeu que seed_demo, en base de test."""
    etab = "Collège test"
    e1 = Eleve.objects.create(nom="E1", classe="6e A", etablissement=etab)
    e2 = Eleve.objects.create(nom="E2", classe="6e A", etablissement=etab)
    e3 = Eleve.objects.create(nom="E3", classe="5e B", etablissement=etab)
    e4 = Eleve.objects.create(nom="E4", classe="4e C", etablissement=etab)
    e5 = Eleve.objects.create(nom="E5", classe="4e C", etablissement=etab)

    pe = PointControle.objects.create(etablissement=etab, libelle="Portail entree", type="PORTAIL")
    ps = PointControle.objects.create(etablissement=etab, libelle="Portail sortie", type="PORTAIL")

    for e in [e1, e2, e3, e4, e5]:
        Itineraire.objects.create(eleve=e, point=pe, ordre=1,
            heure_debut=time(7, 0), heure_fin=time(7, 45), jours_application="1111100")
        Itineraire.objects.create(eleve=e, point=ps, ordre=2,
            heure_debut=time(15, 30), heure_fin=time(16, 15), jours_application="1111100")

    badges = {e.id: Badge.objects.create(eleve=e, secret="x"*32, etat="ACTIF")
              for e in [e1, e2, e3, e4, e5]}

    _passage(badges[e1.id], pe, _dt(7, 15))
    _passage(badges[e1.id], ps, _dt(14, 10))
    _passage(badges[e2.id], pe, _dt(7, 20))
    _passage(badges[e3.id], pe, _dt(7, 15, 0))
    _passage(badges[e3.id], pe, _dt(7, 15, 30))
    _passage(badges[e3.id], ps, _dt(15, 45))
    for e in [e4, e5]:
        _passage(badges[e.id], pe, _dt(7, 10))
        _passage(badges[e.id], ps, _dt(15, 40))

    return {"e1": e1, "e2": e2, "e3": e3, "e4": e4, "e5": e5,
            "pe": pe, "ps": ps, "badges": badges}


def test_detecter_anomalies_historique(jeu_de_donnees):
    rapport = detecter_anomalies(JOUR)
    assert rapport.total_creees == 3

    anomalies = list(Anomalie.objects.all().values_list("eleve__nom", "type"))
    assert sorted(anomalies) == sorted([
        ("E1", "HORS_FENETRE"),
        ("E2", "ABSENCE"),
        ("E3", "DOUBLE_SCAN"),
    ])


def test_detection_idempotente(jeu_de_donnees):
    detecter_anomalies(JOUR)
    rapport2 = detecter_anomalies(JOUR)
    assert rapport2.total_creees == 0
    assert len(rapport2.anomalies_existantes) == 3


def test_horloge_suspecte(jeu_de_donnees):
    Passage.objects.create(
        badge=jeu_de_donnees["badges"][jeu_de_donnees["e4"].id],
        point=jeu_de_donnees["pe"],
        heure_locale=_dt(7, 10),
        heure_serveur=_dt(7, 10) + timedelta(hours=2),
        appareil_id="horloge-folle",
    )
    detecter_anomalies(JOUR)
    assert Anomalie.objects.filter(type=Anomalie.Type.HORLOGE_SUSPECTE).exists()


def test_point_inattendu(jeu_de_donnees):
    autobus = PointControle.objects.create(
        etablissement="College test", libelle="Autobus", type="AUTOBUS",
    )
    _passage(jeu_de_donnees["badges"][jeu_de_donnees["e5"].id], autobus, _dt(7, 20))
    detecter_anomalies(JOUR)
    assert Anomalie.objects.filter(type=Anomalie.Type.POINT_INATTENDU).exists()
