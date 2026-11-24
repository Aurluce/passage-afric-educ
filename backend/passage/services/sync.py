"""
Synchronisation idempotente des passages (D2 + D13).

Le client (agent hors ligne) envoie un lot de passages. Chaque passage
porte un `event_id_local` (UUID généré au scan) qui rend l'insertion
idempotente : rejouer le même lot ne crée pas de doublon.

Un passage dont l'horloge locale diverge de plus de 30 min de l'heure
serveur est enregistré avec `sync_etat=REJETE_HORLOGE` (D13), et une
anomalie HORLOGE_SUSPECTE est créée.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from passage.services.badge import verifier_et_consommer

from passage.models import Anomalie, Badge, Passage, PointControle

HORLOGE_TOLERANCE_MINUTES = 30


@dataclass
class RapportSync:
    created: int = 0
    ignored: int = 0
    rejected_clock: int = 0
    rejected_badge: int = 0
    rejected_signature: int = 0
    details: list[dict] = field(default_factory=list)


def synchroniser_passages(appareil_id: str, passages: list[dict]) -> RapportSync:
    """
    `passages` : liste de dicts {event_id_local, badge_id, point_id, heure_locale}.
    Retourne un RapportSync.
    """
    rapport = RapportSync()
    seuil = timedelta(minutes=HORLOGE_TOLERANCE_MINUTES)

    with transaction.atomic():


        for data in passages:
            # 1. Résolution du badge
            badge = Badge.objects.filter(id=data["badge_id"]).first()
            if badge is None or not badge.est_valide():
                rapport.rejected_badge += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "REJETE_BADGE"}
                )
                continue

            # 2. Déjà vu ? (idempotence AVANT consommation du nonce — D14)
            if Passage.objects.filter(
                badge=badge, event_id_local=data["event_id_local"],
            ).exists():
                rapport.ignored += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "IGNORE"}
                )
                continue

            # 3. Signature du badge (consomme le nonce)
            if not verifier_et_consommer(badge, data["badge_code"]):
                rapport.rejected_signature += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "REJETE_SIGNATURE"}
                )
                continue

            # 4. Point valide ?
            point = PointControle.objects.filter(id=data["point_id"]).first()
            if point is None:
                rapport.rejected_badge += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "REJETE_POINT"}
                )
                continue

            # 5. Création (avec D13 horloge)
            heure_locale = data["heure_locale"]
            heure_serveur = timezone.now()
            horloge_suspecte = abs(heure_locale - heure_serveur) > seuil
            sync_etat = (
                Passage.SyncEtat.REJETE_HORLOGE
                if horloge_suspecte
                else Passage.SyncEtat.RECU
            )
            passage, creee = Passage.objects.get_or_create(
                badge=badge,
                event_id_local=data["event_id_local"],
                defaults={
                    "point": point,
                    "heure_locale": heure_locale,
                    "heure_serveur": heure_serveur,
                    "appareil_id": appareil_id,
                    "sync_etat": sync_etat,
                },
            )
            if not creee:
                rapport.ignored += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "IGNORE"}
                )
                continue

            if horloge_suspecte:
                rapport.rejected_clock += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "REJETE_HORLOGE"}
                )
                Anomalie.objects.get_or_create(
                    eleve=badge.eleve,
                    type=Anomalie.Type.HORLOGE_SUSPECTE,
                    date=heure_locale.date(),
                    passage=passage,
                    defaults={"traite": False},
                )
            else:
                rapport.created += 1
                rapport.details.append(
                    {"event_id_local": str(data["event_id_local"]), "statut": "CREE"}
                )

    return rapport
