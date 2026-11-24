"""
Notification des parents pour chaque anomalie (§3.3).

- Chaque anomalie produit un message au parent (neutre, sans donnée sensible).
- Le plafond PARENT_MSG_DAILY_CAP limite le nombre de messages par élève et par jour.
  Au-delà, l'anomalie est enregistrée mais le message n'est pas émis, et le motif
  est conservé dans `MessageSortant.motif_non_envoi`.
- L'envoi réel est isolé derrière `NotificationProvider` : on peut brancher un
  vrai service SMS sans toucher au reste. Le `ConsoleProvider` par défaut ne
  fait que logger.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import date
from typing import Iterable

from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from passage.models import Anomalie, MessageSortant, ParentEleve

logger = logging.getLogger(__name__)


class NotificationProvider(ABC):
    """Interface d'envoi. Implémenter `envoyer` pour un vrai service SMS."""

    @abstractmethod
    def envoyer(self, destinataire: str, texte: str) -> bool:
        ...


class ConsoleProvider(NotificationProvider):
    """Implémentation par défaut : log uniquement."""

    def envoyer(self, destinataire: str, texte: str) -> bool:
        logger.info("[NOTIF -> %s] %s", destinataire, texte)
        return True


def _texte_pour(anomalie: Anomalie) -> str:
    """Message neutre, sans donnée sensible, compréhensible hors application."""
    prenom = anomalie.eleve.nom  # pas d'autre donnée nominative
    date_str = anomalie.date.strftime("%d/%m/%Y")
    if anomalie.type == Anomalie.Type.ABSENCE:
        return f"Nous n'avons pas enregistré le passage attendu de {prenom} le {date_str}."
    if anomalie.type == Anomalie.Type.HORS_FENETRE:
        return f"Le passage de {prenom} le {date_str} a eu lieu en dehors de la plage horaire prévue."
    if anomalie.type == Anomalie.Type.DOUBLE_SCAN:
        return f"Le badge de {prenom} a été scanné deux fois de suite le {date_str}."
    if anomalie.type == Anomalie.Type.POINT_INATTENDU:
        return f"Le badge de {prenom} a été scanné à un point de contrôle inattendu le {date_str}."
    if anomalie.type == Anomalie.Type.HORLOGE_SUSPECTE:
        return f"Un passage de {prenom} le {date_str} a été enregistré avec une heure suspecte."
    return f"Une anomalie a été détectée sur le passage de {prenom} le {date_str}."


def _messages_du_jour(parent_id: int, jour: date) -> int:
    """Nombre de messages liés à des anomalies du jour, pour ce parent.

    On compte par `anomalie__date` (et non par `MessageSortant.date`) :
    ce qui compte pour le plafond, c'est le nombre de notifications
    envoyées pour les anomalies du jour concerné, peu importe quand
    elles ont été insérées en base.
    """
    return MessageSortant.objects.filter(
        parent_id=parent_id, anomalie__date=jour,
    ).count()


def notifier_anomalies(
    jour: date | None = None,
    *,
    provider: NotificationProvider | None = None,
    plafond: int | None = None,
) -> dict:
    jour = jour or timezone.localdate()
    provider = provider or ConsoleProvider()
    plafond = plafond if plafond is not None else getattr(settings, "PARENT_MSG_DAILY_CAP", 3)

    rapport = {"crees": 0, "bloques": 0, "ignores": 0}

    anomalies = Anomalie.objects.filter(date=jour).select_related("eleve")
    for anomalie in anomalies:
        parents = ParentEleve.objects.filter(eleve=anomalie.eleve).select_related("parent")
        for pe in parents:
            parent = pe.parent
            # Déjà notifié ?
            if MessageSortant.objects.filter(parent=parent, anomalie=anomalie).exists():
                rapport["ignores"] += 1
                continue

            texte = _texte_pour(anomalie)
            deja = _messages_du_jour(parent.id, jour)
            if deja >= plafond:
                MessageSortant.objects.create(
                    parent=parent, anomalie=anomalie, texte=texte,
                    etat=MessageSortant.Etat.BLOQUE,
                    motif_non_envoi=f"Plafond quotidien atteint ({plafond})",
                )
                rapport["bloques"] += 1
                continue

            msg = MessageSortant.objects.create(
                parent=parent, anomalie=anomalie, texte=texte,
                etat=MessageSortant.Etat.EN_ATTENTE,
            )
            try:
                ok = provider.envoyer(parent.identifiant, texte)
            except Exception:  # pragma: no cover - défensif
                ok = False
            if ok:
                msg.etat = MessageSortant.Etat.ENVOYE
                msg.save(update_fields=["etat"])
                rapport["crees"] += 1
            else:
                msg.etat = MessageSortant.Etat.ECHEC
                msg.motif_non_envoi = "Échec du fournisseur"
                msg.save(update_fields=["etat", "motif_non_envoi"])
                rapport["bloques"] += 1

    return rapport
