"""
Génération de la synthèse du jour (D16 + D17 + D18).

Règles strictes :
- les CHIFFRES sont calculés en Python, jamais par le modèle ;
- le modèle ne fait que REFORMULER le gabarit ;
- si le service est indisponible, on utilise le gabarit (mode dégradé) ;
- chaque appel est journalisé (JournalAppelIA) avec coût et chemin ;
- le coût cumulé du jour est plafonné (AI_COST_CAP_EUR_PER_DAY) ;
- deux demandes identiques (même classe, même date, mêmes chiffres) ne sont pas refacturées.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from passage.models import (
    Anomalie,
    Eleve,
    JournalAppelIA,
    Passage,
    Synthese,
)
from passage.services.ai import (
    GabaritProvider,
    ReponseModele,
    SyntheseProvider,
    get_provider,
    valider_sortie,
)


@dataclass
class ResultatSynthese:
    synthese: Synthese
    origine: str  # "MODELE" | "GABARIT"


def _calculer_chiffres(classe: str, jour: date) -> dict:
    """Calcule les chiffres à partir de la base — jamais par le modèle."""
    eleves = Eleve.objects.filter(classe=classe, etat=Eleve.Etat.ACTIF)
    eleve_ids = list(eleves.values_list("id", flat=True))

    passages_du_jour = Passage.objects.filter(
        badge__eleve_id__in=eleve_ids,
        heure_locale__date=jour,
        sync_etat=Passage.SyncEtat.RECU,
    )

    presents = passages_du_jour.values("badge__eleve_id").distinct().count()
    total = eleves.count()

    anomalies_du_jour = Anomalie.objects.filter(eleve_id__in=eleve_ids, date=jour)
    par_type = Counter(anomalies_du_jour.values_list("type", flat=True))

    return {
        "classe": classe,
        "date": jour.isoformat(),
        "total_eleves": total,
        "eleves_presents": presents,
        "eleves_absents": total - presents,
        "retards_portail": par_type.get(Anomalie.Type.HORS_FENETRE, 0),
        "doubles_scans": par_type.get(Anomalie.Type.DOUBLE_SCAN, 0),
        "sorties_hors_plage": par_type.get(Anomalie.Type.HORS_FENETRE, 0),
        "anomalies_horloge": par_type.get(Anomalie.Type.HORLOGE_SUSPECTE, 0),
    }


def _gabarit_texte(chiffres: dict) -> str:
    """Gabarit exact, utilisé en mode dégradé ou si le modèle échoue."""
    return (
        f"{chiffres['eleves_presents']} élèves présents sur {chiffres['total_eleves']}, "
        f"{chiffres['eleves_absents']} absent(s), "
        f"{chiffres['retards_portail']} retard(s) au portail, "
        f"{chiffres['doubles_scans']} double(s) scan(s)."
    )


def _cout_du_jour() -> float:
    """Coût cumulé des appels IA du jour (en euros)."""
    today = timezone.localdate()
    total = JournalAppelIA.objects.filter(horodatage__date=today).aggregate(
        total=Sum("cout_estime")
    )["total"]
    return float(total or 0)


def _plafond_atteint() -> bool:
    plafond = getattr(settings, "AI_COST_CAP_EUR_PER_DAY", 1.0)
    return _cout_du_jour() >= plafond


def generer_synthese(
    classe: str,
    jour: date | None = None,
    *,
    provider: SyntheseProvider | None = None,
) -> ResultatSynthese:
    """Produit (ou réutilise) la synthèse d'une classe pour un jour."""
    jour = jour or timezone.localdate()
    chiffres = _calculer_chiffres(classe, jour)
    gabarit = _gabarit_texte(chiffres)

    # D17 : cache par (classe, date) + mêmes chiffres
    existante = Synthese.objects.filter(classe=classe, date=jour).first()
    if existante and existante.chiffres == chiffres:
        return ResultatSynthese(synthese=existante, origine=existante.origine)

    # Plafond atteint ? (D17 garde-fou coût)
    if _plafond_atteint():
        synthese = _enregistrer(classe, jour, chiffres, gabarit, Synthese.Origine.GABARIT)
        _journaliser(modele="plafond", volume_e=0, volume_s=0, cout=0.0, chemin="PLAFOND", synthese=synthese)
        return ResultatSynthese(synthese=synthese, origine="GABARIT")

    # Appel au modèle (avec 1 retry puis gabarit — D18)
    p = provider or get_provider()
    texte_final: str | None = None
    chemin = "GABARIT"
    modele_utilise = getattr(p, "modele", "gabarit")
    reponse: ReponseModele | None = None

    for essai in (1, 2):
        try:
            rep = p.reformuler(gabarit, chiffres)
        except Exception:  # service indisponible, timeout, 5xx...
            break
        texte_valide = valider_sortie(rep.texte)
        if texte_valide is not None:
            texte_final = texte_valide
            chemin = "MODELE" if essai == 1 else "RETRY"
            reponse = rep
            modele_utilise = rep.modele
            break
        # sortie non conforme : on retente une fois
        reponse = rep

    if texte_final is None:
        texte_final = gabarit
        chemin = "GABARIT"

    cout = reponse.cout_estime if reponse else 0.0
    volume_e = reponse.volume_entree if reponse else 0
    volume_s = reponse.volume_sortie if reponse else 0
    origine = Synthese.Origine.MODELE if chemin in ("MODELE", "RETRY") else Synthese.Origine.GABARIT
    synthese = _enregistrer(classe, jour, chiffres, texte_final, origine)
    _journaliser(
        modele=modele_utilise, volume_e=volume_e, volume_s=volume_s,
        cout=cout, chemin=chemin, synthese=synthese,
    )
    return ResultatSynthese(synthese=synthese, origine=origine)


def _enregistrer(classe, jour, chiffres, texte, origine) -> Synthese:
    synthese, _ = Synthese.objects.update_or_create(
        classe=classe, date=jour,
        defaults={"chiffres": chiffres, "texte": texte, "origine": origine},
    )
    return synthese


def _journaliser(*, modele, volume_e, volume_s, cout, chemin, synthese):
    JournalAppelIA.objects.create(
        modele=modele,
        volume_entree=volume_e,
        volume_sortie=volume_s,
        cout_estime=cout,
        chemin=chemin,
        synthese=synthese,
    )
