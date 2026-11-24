"""Commande : python manage.py synthese_jour --classe 6e_A [--date YYYY-MM-DD]"""
from datetime import datetime

from django.core.management.base import BaseCommand

from passage.services.synthese import generer_synthese


class Command(BaseCommand):
    help = "Génère la synthèse d'une classe pour un jour."

    def add_arguments(self, parser):
        parser.add_argument("--classe", required=True, type=str)
        parser.add_argument("--date", type=str, default=None)

    def handle(self, *args, **options):
        jour = (
            datetime.strptime(options["date"], "%Y-%m-%d").date()
            if options["date"] else None
        )
        resultat = generer_synthese(options["classe"], jour)
        self.stdout.write(self.style.SUCCESS(
            f"[{resultat.origine}] {resultat.synthese.texte}"
        ))
