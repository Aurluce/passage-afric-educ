"""
Abstraction du fournisseur LLM pour la synthèse (D16 + D18).

- `OpenAIProvider` : appel réel, utilisé si AI_API_KEY est présente.
  Compatible OpenAI et tout fournisseur OpenAI-compatible (Groq, Together,
  Mistral…) grâce au paramètre `base_url`.
- `GabaritProvider` : fallback exact, utilisé si pas de clé ou si l'appel échoue.

Le contrat du provider est strict : il reçoit des chiffres déjà calculés
et un gabarit, et retourne une phrase en français SANS inventer de chiffres.
"""
from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import BaseModel, Field, ValidationError


class SortieSynthese(BaseModel):
    """Schéma strict de la sortie attendue du modèle (D18)."""
    texte: str = Field(..., min_length=10, max_length=500)


@dataclass
class ReponseModele:
    texte: str
    volume_entree: int
    volume_sortie: int
    cout_estime: float  # en euros
    modele: str


class SyntheseProvider(ABC):
    @abstractmethod
    def reformuler(self, gabarit: str, chiffres: dict) -> ReponseModele:
        ...


class GabaritProvider(SyntheseProvider):
    """Retourne le gabarit tel quel, sans appel réseau. Exact, sec, utilisable."""

    def reformuler(self, gabarit: str, chiffres: dict) -> ReponseModele:
        return ReponseModele(
            texte=gabarit,
            volume_entree=0,
            volume_sortie=0,
            cout_estime=0.0,
            modele="gabarit",
        )


class OpenAIProvider(SyntheseProvider):
    """
    Appel réel — compatible OpenAI et tout fournisseur OpenAI-compatible
    (Groq, Together, Mistral…). Le `base_url` est injecté par `get_provider`.

    Coût estimé : tarifs GPT-4o-mini par défaut, convertis en euros.
    """

    PRIX_ENTREE_USD_PAR_MILLION = 0.15
    PRIX_SORTIE_USD_PAR_MILLION = 0.60
    USD_VERS_EUR = 0.92

    def __init__(self, api_key: str, modele: str = "gpt-4o-mini", base_url: str | None = None):
        self.api_key = api_key
        self.modele = modele
        self.base_url = base_url

    def reformuler(self, gabarit: str, chiffres: dict) -> ReponseModele:
        # Import local pour ne pas exiger openai si le mode dégradé est actif
        from openai import OpenAI

        client = OpenAI(api_key=self.api_key, base_url=self.base_url) if self.base_url \
                 else OpenAI(api_key=self.api_key)

        system = (
            "Tu reformules une synthèse de présences scolaires en français, "
            "en 2 phrases maximum. Tu ne dois JAMAIS modifier, ajouter ou retirer "
            "un chiffre. Tu réponds STRICTEMENT en JSON : {\"texte\": \"...\"}."
        )
        user = (
            f"Chiffres calculés (ne pas modifier) : {json.dumps(chiffres, ensure_ascii=False)}\n"
            f"Gabarit à reformuler : {gabarit}\n"
            "Réponds uniquement en JSON."
        )

        resp = client.chat.completions.create(
            model=self.modele,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        contenu = resp.choices[0].message.content or "{}"
        volume_entree = resp.usage.prompt_tokens if resp.usage else 0
        volume_sortie = resp.usage.completion_tokens if resp.usage else 0
        cout_eur = (
            volume_entree * self.PRIX_ENTREE_USD_PAR_MILLION / 1_000_000
            + volume_sortie * self.PRIX_SORTIE_USD_PAR_MILLION / 1_000_000
        ) * self.USD_VERS_EUR
        return ReponseModele(
            texte=contenu,
            volume_entree=volume_entree,
            volume_sortie=volume_sortie,
            cout_estime=cout_eur,
            modele=self.modele,
        )


_BASE_URLS = {
    "openai": None,
    "groq": "https://api.groq.com/openai/v1",
    "together": "https://api.together.xyz/v1",
}


def get_provider() -> SyntheseProvider:
    """Renvoie OpenAIProvider si clé présente, GabaritProvider sinon.

    Le `base_url` dépend de `settings.AI_PROVIDER` (openai / groq / together).
    Une seule définition de cette fonction doit exister dans le module :
    Python prend la dernière définie, donc un doublon écraserait silencieusement
    la version corrigée.
    """
    from django.conf import settings
    api_key = getattr(settings, "AI_API_KEY", "") or os.getenv("AI_API_KEY", "")
    if not api_key:
        return GabaritProvider()
    provider_name = getattr(settings, "AI_PROVIDER", "openai") or "openai"
    base_url = _BASE_URLS.get(provider_name)
    return OpenAIProvider(
        api_key=api_key,
        modele=getattr(settings, "AI_MODEL", "gpt-4o-mini"),
        base_url=base_url,
    )


def valider_sortie(brut: str) -> str | None:
    """Valide le JSON brut contre SortieSynthese. Retourne None si invalide."""
    try:
        data = json.loads(brut)
        obj = SortieSynthese(**data)
        return obj.texte
    except (json.JSONDecodeError, ValidationError, TypeError):
        return None