from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pytest

from passage.management.commands.seed_demo import Command, _date_demo
from passage.models import Badge, Eleve, Passage, PointControle

pytestmark = pytest.mark.django_db
TZ = ZoneInfo("Africa/Douala")


def test_date_demo_choisit_le_dernier_jour_ouvrable(monkeypatch):
    monkeypatch.setattr(
        "passage.management.commands.seed_demo.timezone.localdate",
        lambda: date(2026, 11, 29),
    )

    assert _date_demo() == date(2026, 11, 27)


def test_seed_met_a_jour_ses_passages_sans_doublon():
    eleve = Eleve.objects.create(nom="E1", classe="6e A", etablissement="X")
    point = PointControle.objects.create(etablissement="X", libelle="Entrée", type="PORTAIL")
    badge = Badge.objects.create(eleve=eleve, secret="x" * 32, etat="ACTIF")
    command = Command()

    command._passage(
        badge, point, datetime.combine(date(2026, 11, 26), time(7, 15), tzinfo=TZ), "seed",
    )
    command._passage(
        badge, point, datetime.combine(date(2026, 11, 27), time(7, 15), tzinfo=TZ), "seed",
    )

    passages = Passage.objects.filter(badge=badge)
    assert passages.count() == 1
    assert passages.get().heure_locale.date() == date(2026, 11, 27)
