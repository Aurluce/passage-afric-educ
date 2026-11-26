"""Tests de configuration et de consultation pour l’espace responsable."""
from datetime import date

import pytest
from rest_framework.test import APIClient

from passage.models import (
    Anomalie,
    Badge,
    Eleve,
    Itineraire,
    Passage,
    PointControle,
    Utilisateur,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def contexte():
    responsable = Utilisateur.objects.create_user(
        identifiant="responsable-suivi",
        password="Responsable!2026",
        role="RESPONSABLE",
        nom="Responsable test",
    )
    eleve = Eleve.objects.create(
        nom="Élève suivi",
        classe="6e A",
        etablissement="Collège test",
    )
    autre_eleve = Eleve.objects.create(
        nom="Autre élève",
        classe="5e B",
        etablissement="Collège test",
    )
    point = PointControle.objects.create(
        etablissement="Collège test",
        libelle="Portail entrée",
        type=PointControle.Type.PORTAIL,
    )
    badge = Badge.objects.create(eleve=eleve, secret="a" * 64)
    passage = Passage.objects.create(
        badge=badge,
        point=point,
        heure_locale="2026-11-24T07:30:00+01:00",
        heure_serveur="2026-11-24T07:30:03+01:00",
        appareil_id="agent-01",
    )
    anomalie = Anomalie.objects.create(
        eleve=eleve,
        type=Anomalie.Type.HORLOGE_SUSPECTE,
        date=date(2026, 11, 24),
        passage=passage,
    )
    client = APIClient()
    client.force_authenticate(user=responsable)
    return {
        "client": client,
        "eleve": eleve,
        "autre_eleve": autre_eleve,
        "point": point,
        "passage": passage,
        "anomalie": anomalie,
    }


def test_responsable_cree_et_modifie_un_point(contexte):
    client = contexte["client"]
    created = client.post(
        "/api/responsable/points",
        {
            "etablissement": "Collège test",
            "libelle": "Bus scolaire",
            "type": PointControle.Type.AUTOBUS,
        },
        format="json",
    )
    updated = client.patch(
        f"/api/responsable/points/{created.data['id']}",
        {"libelle": "Bus principal"},
        format="json",
    )

    assert created.status_code == 201
    assert updated.status_code == 200
    assert updated.data["libelle"] == "Bus principal"


def test_responsable_cree_et_filtre_les_itineraires_par_eleve(contexte):
    client = contexte["client"]
    response = client.post(
        "/api/responsable/itineraires",
        {
            "eleve_id": contexte["eleve"].id,
            "point_id": contexte["point"].id,
            "ordre": 1,
            "heure_debut": "07:00",
            "heure_fin": "07:45",
            "jours_application": "1111100",
        },
        format="json",
    )
    listing = client.get(
        f"/api/responsable/itineraires?eleve_id={contexte['eleve'].id}"
    )

    assert response.status_code == 201
    assert response.data["point_libelle"] == "Portail entrée"
    assert len(listing.data) == 1
    assert listing.data[0]["eleve_id"] == contexte["eleve"].id


@pytest.mark.parametrize(
    "changes,field",
    [
        ({"heure_debut": "08:00", "heure_fin": "07:00"}, "heure_fin"),
        ({"jours_application": "0000000"}, "jours_application"),
    ],
)
def test_itineraire_refuse_une_fenetre_ou_un_jour_invalide(contexte, changes, field):
    response = contexte["client"].post(
        "/api/responsable/itineraires",
        {
            "eleve_id": contexte["eleve"].id,
            "point_id": contexte["point"].id,
            "ordre": 1,
            "heure_debut": "07:00",
            "heure_fin": "07:45",
            "jours_application": "1111100",
            **changes,
        },
        format="json",
    )

    assert response.status_code == 400
    assert field in response.data
    assert Itineraire.objects.count() == 0


def test_passages_filtrables_et_reponse_contient_heures_et_appareil(contexte):
    response = contexte["client"].get(
        f"/api/responsable/passages?eleve_id={contexte['eleve'].id}"
        f"&point_id={contexte['point'].id}&date=2026-11-24"
    )

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["eleve_nom"] == "Élève suivi"
    assert response.data[0]["heure_locale"] is not None
    assert response.data[0]["heure_serveur"] is not None
    assert response.data[0]["appareil_id"] == "agent-01"
    assert response.data[0]["sync_etat"] == Passage.SyncEtat.RECU


def test_anomalies_filtrables_et_responsable_peut_indiquer_traitement(contexte):
    client = contexte["client"]
    listing = client.get(
        "/api/responsable/anomalies?type=HORLOGE_SUSPECTE"
        "&date=2026-11-24&traite=false"
    )
    update = client.patch(
        f"/api/responsable/anomalies/{contexte['anomalie'].id}",
        {"traite": True},
        format="json",
    )

    assert listing.status_code == 200
    assert len(listing.data) == 1
    assert listing.data[0]["passage_point"] == "Portail entrée"
    assert update.status_code == 200
    assert update.data["traite"] is True


def test_synthese_generee_et_retourne_les_chiffres(contexte, monkeypatch):
    from passage import views_responsable_suivi as view

    def fake_synthese(classe, jour):
        class FakeSynthese:
            pass

        result = FakeSynthese()
        result.classe = classe
        result.date = jour or date(2026, 11, 24)
        result.chiffres = {"eleves_presents": 1, "eleves_absents": 0}
        result.texte = "Un élève est présent."
        result.origine = "GABARIT"
        return type("Resultat", (), {"synthese": result, "origine": "GABARIT"})()

    monkeypatch.setattr(view, "generer_synthese", fake_synthese)
    response = contexte["client"].post(
        "/api/responsable/synthese",
        {"classe": contexte["eleve"].classe, "date": "2026-11-24"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["classe"] == "6e A"
    assert response.data["date"] == date(2026, 11, 24)
    assert response.data["chiffres"]["eleves_presents"] == 1
    assert response.data["origine"] == "GABARIT"


def test_responsable_routes_refuse_aux_agents(contexte):
    agent = Utilisateur.objects.create_user(
        identifiant="agent-suivi",
        password="Agent!2026",
        role="AGENT",
        nom="Agent",
    )
    client = APIClient()
    client.force_authenticate(user=agent)

    response = client.get("/api/responsable/anomalies")

    assert response.status_code == 403
