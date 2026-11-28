"""
Détection des anomalies de passage.

Ce module est volontairement pur : il ne dépend ni de la commande CLI
ni de la requête HTTP. Testable directement via `detecter_anomalies`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from django.conf import settings
from django.utils import timezone

from passage.models import Anomalie, Eleve, Itineraire, Passage

DOUBLE_SCAN_WINDOW_SECONDS = 60
HORLOGE_TOLERANCE_MINUTES = 30


@dataclass
class RapportDetection:
    date: date
    anomalies_creees: list[Anomalie] = field(default_factory=list)
    anomalies_existantes: list[Anomalie] = field(default_factory=list)

    @property
    def total_creees(self) -> int:
        return len(self.anomalies_creees)


def detecter_anomalies(jour: date | None = None) -> RapportDetection:
    jour = jour or timezone.localdate()
    rapport = RapportDetection(date=jour)

    for eleve in Eleve.objects.filter(etat=Eleve.Etat.ACTIF):
        itineraires = list(
            Itineraire.objects.filter(eleve=eleve).select_related("point")
        )
        if not itineraires:
            continue
        _detecter_absences(eleve, itineraires, jour, rapport)
        _detecter_hors_fenetre_et_point_inattendu(eleve, itineraires, jour, rapport)
        _detecter_doubles_scans(eleve, jour, rapport)
        _detecter_horloges_suspectes(eleve, jour, rapport)
    return rapport


def _detecter_absences(eleve, itineraires, jour, rapport):
    maintenant = timezone.localtime()
    itineraires_entree = [
        itin for itin in itineraires
        if itin.point.type == "PORTAIL" and itin.jours_application[jour.weekday()] == "1"
    ]
    if not itineraires_entree:
        return

    itin = min(itineraires_entree, key=lambda item: item.ordre)
    fin_fenetre = datetime.combine(jour, itin.heure_fin, tzinfo=maintenant.tzinfo)
    grace_sync = getattr(settings, "PASSAGE_SYNC_MAX_DELAY_MINUTES", 10)
    fin_fenetre += timedelta(minutes=grace_sync)
    if fin_fenetre >= maintenant:
        return

    # Tout passage reçu à un portail confirme la présence à l'école, même
    # si l'élève a utilisé un autre portail ou est arrivé hors fenêtre.
    passage_portail = Passage.objects.filter(
        badge__eleve=eleve,
        point__type="PORTAIL",
        heure_locale__date=jour,
        sync_etat=Passage.SyncEtat.RECU,
    ).exists()
    if passage_portail:
        return

    anomalie, creee = Anomalie.objects.get_or_create(
        eleve=eleve,
        type=Anomalie.Type.ABSENCE,
        date=jour,
        passage=None,
        defaults={"traite": False},
    )
    if creee:
        rapport.anomalies_creees.append(anomalie)
    else:
        rapport.anomalies_existantes.append(anomalie)


def _detecter_hors_fenetre_et_point_inattendu(eleve, itineraires, jour, rapport):
    itineraires_par_point = {it.point_id: it for it in itineraires}
    passages = Passage.objects.filter(
        badge__eleve=eleve,
        heure_locale__date=jour,
        sync_etat=Passage.SyncEtat.RECU,
    ).select_related("point", "badge")
    for p in passages:
        itin = itineraires_par_point.get(p.point_id)
        if itin is None:
            _creer_ou_signaler(Anomalie.Type.POINT_INATTENDU, eleve, jour, p, rapport)
            continue
        heure = timezone.localtime(p.heure_locale).time()
        if not (itin.heure_debut <= heure <= itin.heure_fin):
            _creer_ou_signaler(Anomalie.Type.HORS_FENETRE, eleve, jour, p, rapport)


def _detecter_doubles_scans(eleve, jour, rapport):
    passages = list(
        Passage.objects.filter(
            badge__eleve=eleve,
            heure_locale__date=jour,
            sync_etat=Passage.SyncEtat.RECU,
        ).order_by("heure_locale")
    )
    precedent = None
    for p in passages:
        if precedent is not None and precedent.point_id == p.point_id:
            delta = (p.heure_locale - precedent.heure_locale).total_seconds()
            if 0 <= delta < DOUBLE_SCAN_WINDOW_SECONDS:
                _creer_ou_signaler(Anomalie.Type.DOUBLE_SCAN, eleve, jour, p, rapport)
        precedent = p


def _detecter_horloges_suspectes(eleve, jour, rapport):
    seuil = timedelta(minutes=HORLOGE_TOLERANCE_MINUTES)
    for p in Passage.objects.filter(badge__eleve=eleve, heure_serveur__date=jour):
        if abs(p.heure_locale - p.heure_serveur) > seuil:
            _creer_ou_signaler(Anomalie.Type.HORLOGE_SUSPECTE, eleve, jour, p, rapport)


def _creer_ou_signaler(type_, eleve, jour, passage, rapport):
    anomalie, creee = Anomalie.objects.get_or_create(
        eleve=eleve, type=type_, date=jour, passage=passage,
        defaults={"traite": False},
    )
    if creee:
        rapport.anomalies_creees.append(anomalie)
    else:
        rapport.anomalies_existantes.append(anomalie)
