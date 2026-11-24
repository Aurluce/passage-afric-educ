"""
Génération et vérification du code de badge tournant (D1).

Le code affiché par le client est :
    base64url( HMAC-SHA256(secret, f"{nonce}:{timestamp}") )

- `nonce`    : UUID aléatoire, généré côté client à chaque affichage ;
- `timestamp` : epoch secondes, arrondi au pas de temps (5 s par défaut) ;
- `secret`    : secret partagé entre le badge et le serveur, stocké dans
                `Badge.secret`. Aucune donnée nominative sur le support.

Le serveur vérifie :
1. la signature HMAC (constant-time compare) ;
2. que `timestamp` est dans la fenêtre ±1 pas (tolérance pour dérive d'horloge) ;
3. que le `nonce` n'a pas déjà été consommé (anti-rejeu, table NonceConsomme).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import time
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from passage.models import Badge, NonceConsomme

TIME_STEP_SECONDS = getattr(settings, "BADGE_TIME_STEP_SECONDS", 5)
TOLERANCE_STEPS = getattr(settings, "BADGE_TOLERANCE_STEPS", 1)


def _hmac(secret: str, nonce: str, ts: int) -> str:
    msg = f"{nonce}:{ts}".encode()
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


@dataclass
class CodeBadge:
    nonce: str
    timestamp: int
    signature: str


def generer_code(badge: Badge, *, maintenant: int | None = None) -> str:
    """Construit le code affichable par le client (format compact 'nonce:ts:sig')."""
    ts = int((maintenant if maintenant is not None else time.time()) // TIME_STEP_SECONDS * TIME_STEP_SECONDS)
    nonce = str(uuid.uuid4())
    sig = _hmac(badge.secret, nonce, ts)
    return f"{nonce}:{ts}:{sig}"

def verifier_et_consommer(badge: Badge, code: str, *, maintenant: int | None = None) -> bool:
    """
    Vérifie la signature, la fenêtre temporelle, et consomme le nonce.
    Retourne True si le code est valide et n'avait jamais été utilisé.

    Tout refus (mal formé, signature invalide, hors fenêtre, rejeu)
    retourne False — l'appelant n'a pas à distinguer les cas.
    """
    if not isinstance(code, str):
        return False

    parts = code.split(":")
    if len(parts) != 3:
        return False
    nonce_str, ts_str, sig_recu = parts

    try:
        ts = int(ts_str)
    except ValueError:
        return False

    # 1. Fenêtre temporelle (±TOLERANCE_STEPS pas)
    now_ts = int((maintenant if maintenant is not None else time.time()))
    if abs(now_ts - ts) > TOLERANCE_STEPS * TIME_STEP_SECONDS:
        return False

    # 2. Signature (constant-time)
    sig_attendu = _hmac(badge.secret, nonce_str, ts)
    if not hmac.compare_digest(sig_attendu, sig_recu):
        return False

    # 3. Anti-rejeu : consommation atomique du nonce
    try:
        with transaction.atomic():
            NonceConsomme.objects.create(
                badge=badge, nonce=uuid.UUID(nonce_str), consomme_le=timezone.now(),
            )
    except (IntegrityError, ValueError):
        return False

    return True