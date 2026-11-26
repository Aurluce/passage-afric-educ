"""
Génération et vérification du code de badge tournant (D1).

Le code affiché par le client est :
    base64url( HMAC-SHA256(secret, f"{nonce}:{timestamp}") )

- `nonce`    : UUID aléatoire, généré côté client à chaque affichage ;
- `timestamp` : instant d'émission en secondes Unix ;
- `secret`    : secret partagé entre le badge et le serveur, stocké dans
                `Badge.secret`. Aucune donnée nominative sur le support.

Le serveur vérifie :
1. la signature HMAC (constant-time compare) ;
2. que le code n'a pas dépassé sa durée de vie de 120 secondes ;
3. que le `nonce` n'a pas déjà été consommé (anti-rejeu, table NonceConsomme).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from passage.models import Badge, BadgeCodeSecours, NonceConsomme

CODE_TTL_SECONDS = getattr(settings, "BADGE_CODE_TTL_SECONDS", 120)
CODE_SECOURS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_SECOURS_LENGTH = 12


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
    ts = int(maintenant if maintenant is not None else time.time())
    nonce = str(uuid.uuid4())
    sig = _hmac(badge.secret, nonce, ts)
    return f"{nonce}:{ts}:{sig}"


def _normaliser_code_secours(code: str) -> str | None:
    normalise = code.replace("-", "").replace(" ", "").upper()
    if len(normalise) != CODE_SECOURS_LENGTH or any(
        caractere not in CODE_SECOURS_ALPHABET for caractere in normalise
    ):
        return None
    return normalise


def generer_code_secours(badge: Badge, badge_code: str) -> str:
    """Crée un code manuel aléatoire lié au code tournant, valable pour un seul scan."""
    code = "".join(
        secrets.choice(CODE_SECOURS_ALPHABET)
        for _ in range(CODE_SECOURS_LENGTH)
    )
    code_hash = hashlib.sha256(code.encode("ascii")).hexdigest()
    BadgeCodeSecours.objects.create(
        badge=badge,
        code_hash=code_hash,
        badge_code=badge_code,
    )
    return "-".join(code[index:index + 4] for index in range(0, CODE_SECOURS_LENGTH, 4))


def retrouver_code_secours(code: str) -> BadgeCodeSecours | None:
    normalise = _normaliser_code_secours(code)
    if normalise is None:
        return None
    code_hash = hashlib.sha256(normalise.encode("ascii")).hexdigest()
    return (
        BadgeCodeSecours.objects.select_related("badge")
        .filter(code_hash=code_hash)
        .first()
    )


def verifier_et_consommer(badge: Badge, code: str, *, maintenant: int | None = None) -> bool:
    """
    Vérifie la signature, la durée de vie, et consomme le nonce.
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

    # 1. Durée de vie du code
    now_ts = int((maintenant if maintenant is not None else time.time()))
    age = now_ts - ts
    if age < 0 or age > CODE_TTL_SECONDS:
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