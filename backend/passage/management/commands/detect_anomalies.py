"""Commande planifiable par cron : détecte les anomalies d'une journée."""
from datetime import date, datetime

from django.core.management.base import BaseCommand

from passage.services.anomalies import detecter_anomalies


class Command(BaseCommand):
    help = "Détecte les anomalies (absence, hors fenêtre, point inattendu, double scan, horloge suspecte)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date", type=str, default=None,
            help="Date au format YYYY-MM-DD (défaut : aujourd'hui).",
        )

    def handle(self, *args, **options):
        jour = (
            datetime.strptime(options["date"], "%Y-%m-%d").date()
            if options["date"]
            else None
        )
        rapport = detecter_anomalies(jour)
        self.stdout.write(
            f"Date : {rapport.date} — "
            f"{rapport.total_creees} anomalie(s) créée(s), "
            f"{len(rapport.anomalies_existantes)} déjà présente(s)."
        )
        for a in rapport.anomalies_creees:
            self.stdout.write(f"  + {a.type} — élève {a.eleve.nom} (id {a.eleve_id})")
        for a in rapport.anomalies_existantes:
            self.stdout.write(f"  = {a.type} — élève {a.eleve.nom} (id {a.eleve_id})")
