"""Vérifie les présences du jour et notifie les parents des anomalies."""
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from passage.services.anomalies import detecter_anomalies
from passage.services.notification import notifier_anomalies


class Command(BaseCommand):
    help = "Détecte les absences après les fenêtres d'entrée et notifie les parents."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="Date au format YYYY-MM-DD (défaut : aujourd'hui).",
        )

    def handle(self, *args, **options):
        jour = (
            datetime.strptime(options["date"], "%Y-%m-%d").date()
            if options["date"]
            else timezone.localdate()
        )
        detection = detecter_anomalies(jour)
        notifications = notifier_anomalies(jour)
        self.stdout.write(
            self.style.SUCCESS(
                f"Présences du {jour} vérifiées : "
                f"{detection.total_creees} anomalie(s) créée(s), "
                f"{notifications['crees']} notification(s) parent créée(s), "
                f"{notifications['ignores']} déjà envoyée(s), "
                f"{notifications['bloques']} bloquée(s)."
            )
        )
