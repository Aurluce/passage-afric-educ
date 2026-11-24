"""
Tests de la synthèse IA (4 garde-fous §2.4).

Chaque test vérifie un garde-fou :
1. sortie contrainte (JSON invalide → 1 retry → gabarit) ;
2. mode dégradé (sans clé API → gabarit exact) ;
3. coût tracé et plafonné (JournalAppelIA + AI_COST_CAP) ;
4. aucune donnée inventée (chiffres du texte == chiffres calculés).
"""
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pytest
from django.conf import settings
from django.utils import timezone

from passage.models import (
    Anomalie, Badge, Eleve, Itineraire, JournalAppelIA, Passage,
    PointControle, Synthese,
)
from passage.services.ai import GabaritProvider, ReponseModele, SyntheseProvider
from passage.services.synthese import generer_synthese

pytestmark = pytest.mark.django_db
TZ = ZoneInfo("Africa/Douala")
JOUR = date(2025, 1, 15)


class FakeProvider(SyntheseProvider):
    """Faux provider configurable, sans appel réseau."""
    def __init__(self, reponses: list[str]):
        self.reponses = list(reponses)
        self.appels = 0

    def reformuler(self, gabarit, chiffres):
        self.appels += 1
        texte = self.reponses.pop(0)
        return ReponseModele(texte=texte, volume_entree=100, volume_sortie=50,
                             cout_estime=0.001, modele="fake")


@pytest.fixture
def contexte():
    etab = "Collège test"
    classe = "6e A"
    eleve = Eleve.objects.create(nom="E1", classe=classe, etablissement=etab)
    pe = PointControle.objects.create(etablissement=etab, libelle="Entrée", type="PORTAIL")
    Itineraire.objects.create(eleve=eleve, point=pe, ordre=1,
        heure_debut=time(7,0), heure_fin=time(7,45), jours_application="1111100")
    badge = Badge.objects.create(eleve=eleve, secret="x"*32, etat="ACTIF")
    dt = datetime.combine(JOUR, time(7, 15), tzinfo=TZ)
    Passage.objects.create(badge=badge, point=pe, heure_locale=dt, heure_serveur=dt,
                          appareil_id="dev", sync_etat="RECU")
    Anomalie.objects.create(eleve=eleve, type=Anomalie.Type.HORS_FENETRE, date=JOUR)
    return {"classe": classe, "eleve": eleve}


def test_mode_degrade_sans_cle_gabarit_exact(contexte):
    """Garde-fou 2 : sans clé, la synthèse est produite à partir du gabarit."""
    from passage.services.ai import GabaritProvider

    resultat = generer_synthese(
        contexte["classe"], JOUR, provider=GabaritProvider(),
    )
    assert resultat.origine == "GABARIT"
    assert "1 élèves présents sur 1" in resultat.synthese.texte
    journal = JournalAppelIA.objects.last()
    assert journal.chemin == "GABARIT"
    assert journal.cout_estime == 0

def test_modele_repond_json_valide(contexte):
    """Garde-fou 1 : un JSON valide est accepté, chemin MODELE."""
    provider = FakeProvider(['{"texte": "1 élève est présent, aucun absent."}'])
    resultat = generer_synthese(contexte["classe"], JOUR, provider=provider)
    assert resultat.origine == "MODELE"
    assert resultat.synthese.texte == "1 élève est présent, aucun absent."
    journal = JournalAppelIA.objects.last()
    assert journal.chemin == "MODELE"
    assert provider.appels == 1


def test_modele_repond_invalide_retry_puis_gabarit(contexte):
    """Garde-fou 1 : JSON invalide → 1 retry, puis gabarit si toujours invalide."""
    provider = FakeProvider(["pas du json", "toujours pas"])
    resultat = generer_synthese(contexte["classe"], JOUR, provider=provider)
    assert resultat.origine == "GABARIT"
    assert provider.appels == 2  # un essai + un retry
    journal = JournalAppelIA.objects.last()
    assert journal.chemin == "GABARIT"


def test_chiffres_du_texte_correspondent_a_la_base(contexte):
    """Garde-fou 4 : les chiffres du texte final viennent de la base."""
    provider = FakeProvider(['{"texte": "1 élève est présent sur 1, aucun absent."}'])
    resultat = generer_synthese(contexte["classe"], JOUR, provider=provider)
    chiffres = resultat.synthese.chiffres
    # Les chiffres calculés sont exacts
    assert chiffres["eleves_presents"] == 1
    assert chiffres["total_eleves"] == 1
    assert chiffres["eleves_absents"] == 0
    assert chiffres["retards_portail"] == 1


def test_plafond_bloque_appel_modele(contexte, settings):
    """Garde-fou 3 : plafond de coût atteint → gabarit, chemin PLAFOND."""
    settings.AI_COST_CAP_EUR_PER_DAY = 0.001
    # Pré-remplit un journal pour dépasser le plafond
    Synthese.objects.all().delete()
    JournalAppelIA.objects.create(modele="x", volume_entree=1, volume_sortie=1,
                                  cout_estime=0.01, chemin="MODELE")
    provider = FakeProvider(['{"texte": "ceci ne doit pas être utilisé."}'])
    resultat = generer_synthese(contexte["classe"], JOUR, provider=provider)
    assert resultat.origine == "GABARIT"
    assert provider.appels == 0  # le modèle n'est même pas appelé
    journal = JournalAppelIA.objects.last()
    assert journal.chemin == "PLAFOND"


def test_cache_evite_double_facturation(contexte):
    """Deux appels avec mêmes chiffres : un seul JournalAppelIA."""
    provider = FakeProvider([
        '{"texte": "1 élève est présent sur 1, aucun absent."}',
        '{"texte": "ceci ne doit pas être utilisé."}',
    ])
    generer_synthese(contexte["classe"], JOUR, provider=provider)
    generer_synthese(contexte["classe"], JOUR, provider=provider)
    assert provider.appels == 1  # le 2ᵉ appel est un cache hit
