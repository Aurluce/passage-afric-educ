"""
Commande de seed reproductible pour la démo et les tests.

Idempotente : `python manage.py seed_demo` peut être relancée sans créer
de doublons (get_or_create sur des clés naturelles).

Ne crée AUCUNE anomalie : celles-ci sont produites par `detect_anomalies`
à partir des passages. Voir DECISIONS.md (D7).
"""
import secrets
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from passage.models import (
    Badge,
    Eleve,
    Itineraire,
    ParentEleve,
    Passage,
    PointControle,
    Utilisateur,
)

TZ = ZoneInfo("Africa/Douala")
DATE_HISTORIQUE = date(2025, 1, 15)  # mercredi — voir D8


def _dt(day: date, h: int, m: int, s: int = 0) -> datetime:
    """Construit un datetime aware en heure locale Douala."""
    return datetime.combine(day, time(h, m, s), tzinfo=TZ)


class Command(BaseCommand):
    help = "Crée les données de démo (utilisateurs, élèves, badges, itinéraires, passages)."

    @transaction.atomic
    def handle(self, *args, **options):
        # --- Utilisateurs ---------------------------------------------------
        responsable = self._user("responsable", "Responsable!2026", "RESPONSABLE", "Mme Ngo")
        agent = self._user("agent01", "Agent!2026", "AGENT", "M. Mbarga")
        parent1 = self._user("parent1", "Parent1!2026", "PARENT", "M. Fotso")
        parent2 = self._user("parent2", "Parent2!2026", "PARENT", "Mme Tchoua")

        # --- Élèves --------------------------------------------------------
        e1 = self._eleve("E1", "6e A")
        e2 = self._eleve("E2", "6e A")  # fratrie avec E1
        e3 = self._eleve("E3", "5e B")
        e4 = self._eleve("E4", "4e C")
        e5 = self._eleve("E5", "4e C")

        # Rattachements parents (2 parents, 2 fratries côté parent1)
        for p, e in [(parent1, e1), (parent1, e2), (parent2, e3)]:
            ParentEleve.objects.get_or_create(parent=p, eleve=e)

        # --- Points de contrôle --------------------------------------------
        portail_entree = self._point("Collège de la Cité", "Portail entrée", "PORTAIL")
        portail_sortie = self._point("Collège de la Cité", "Portail sortie", "PORTAIL")

        # --- Itinéraires (Lun–Ven) -----------------------------------------
        for eleve in [e1, e2, e3, e4, e5]:
            self._itineraire(eleve, portail_entree, ordre=1, debut=time(7, 0), fin=time(7, 45))
            self._itineraire(eleve, portail_sortie, ordre=2, debut=time(15, 30), fin=time(16, 15))

        # --- Badges --------------------------------------------------------
        badges = {e.id: self._badge(e) for e in [e1, e2, e3, e4, e5]}

        # --- Passages historiques (DATE_HISTORIQUE) ------------------------
        # E1 : entrée OK + sortie HORS FENÊTRE (14:10) -> anomalie HORS_FENETRE
        self._passage(badges[e1.id], portail_entree, _dt(DATE_HISTORIQUE, 7, 15), "dev-agent-01")
        self._passage(badges[e1.id], portail_sortie, _dt(DATE_HISTORIQUE, 14, 10), "dev-agent-01")

        # E2 : entrée OK, RIEN sur la sortie -> anomalie ABSENCE (détectée à la clôture)
        self._passage(badges[e2.id], portail_entree, _dt(DATE_HISTORIQUE, 7, 20), "dev-agent-01")

        # E3 : entrée OK, double scan à 30 s d'écart -> anomalie DOUBLE_SCAN
        self._passage(badges[e3.id], portail_entree, _dt(DATE_HISTORIQUE, 7, 15, 0), "dev-agent-01")
        self._passage(badges[e3.id], portail_entree, _dt(DATE_HISTORIQUE, 7, 15, 30), "dev-agent-01")
        self._passage(badges[e3.id], portail_sortie, _dt(DATE_HISTORIQUE, 15, 45), "dev-agent-01")

        # E4, E5 : journée normale, aucune anomalie
        for e in [e4, e5]:
            self._passage(badges[e.id], portail_entree, _dt(DATE_HISTORIQUE, 7, 10), "dev-agent-01")
            self._passage(badges[e.id], portail_sortie, _dt(DATE_HISTORIQUE, 15, 40), "dev-agent-01")

        self.stdout.write(self.style.SUCCESS("Seed terminé."))
        self.stdout.write(f"Comptes de test (mot de passe documenté dans le README) :")
        self.stdout.write(f"  responsable / Responsable!2026")
        self.stdout.write(f"  agent01     / Agent!2026")
        self.stdout.write(f"  parent1     / Parent1!2026  (élèves E1 et E2)")
        self.stdout.write(f"  parent2     / Parent2!2026  (élève E3)")

    # ------------------------------------------------------------------
    # Helpers idempotents
    # ------------------------------------------------------------------
    def _user(self, identifiant, password, role, nom):
        user, created = Utilisateur.objects.get_or_create(
            identifiant=identifiant,
            defaults={"role": role, "nom": nom},
        )
        if created:
            user.set_password(password)
            user.save()
        return user

    def _eleve(self, nom, classe):
        eleve, _ = Eleve.objects.get_or_create(
            nom=nom, defaults={"classe": classe, "etablissement": "Collège de la Cité"},
        )
        return eleve

    def _point(self, etablissement, libelle, type_):
        point, _ = PointControle.objects.get_or_create(
            etablissement=etablissement, libelle=libelle, defaults={"type": type_},
        )
        return point

    def _itineraire(self, eleve, point, ordre, debut, fin):
        Itineraire.objects.get_or_create(
            eleve=eleve, point=point,
            defaults={"ordre": ordre, "heure_debut": debut, "heure_fin": fin,
                      "jours_application": "1111100"},
        )

    def _badge(self, eleve):
        # Un badge actif par élève ; si réémission, l'ancien doit être révoqué.
        badge = Badge.objects.filter(eleve=eleve, etat="ACTIF").first()
        if badge:
            return badge
        return Badge.objects.create(
            eleve=eleve, secret=secrets.token_hex(32), etat="ACTIF",
        )

    def _passage(self, badge, point, dt_local, appareil_id):
        # Idempotent via (badge, event_id_local) ; l'UUID est déterministe
        # dans le seed pour qu'un rejeu produise la même clé.
        event_id = _uuid5(badge.id, point.id, dt_local.isoformat())
        Passage.objects.get_or_create(
            badge=badge, event_id_local=event_id,
            defaults={
                "point": point,
                "heure_locale": dt_local,
                "heure_serveur": dt_local,
                "appareil_id": appareil_id,
            },
        )


def _uuid5(*parts):
    import uuid
    return uuid.uuid5(uuid.NAMESPACE_URL, "|".join(str(p) for p in parts))
