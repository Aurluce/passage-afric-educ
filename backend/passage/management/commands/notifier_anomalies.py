"""Commande : python manage.py notifier_anomalies [--date YYYY-MM-DD]"""
from datetime import datetime

from django.core.management.base import BaseCommand

from passage.services.notification import notifier_anomalies


class Command(BaseCommand):
    help = "Envoie les notifications parent pour les anomalies du jour."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, default=None)

    def handle(self, *args, **options):
        jour = (
            datetime.strptime(options["date"], "%Y-%m-%d").date()
            if options["date"] else None
        )
        rapport = notifier_anomalies(jour)
        self.stdout.write(self.style.SUCCESS(
            f"Notifications : {rapport['crees']} créées, "
            f"{rapport['bloques']} bloquées, {rapport['ignores']} ignorées."
        ))
