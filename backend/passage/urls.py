from django.urls import path

from .views_auth import LoginView, LogoutView
from .views_parent import (
    MesEnfantsView, EnfantDetailView, EnfantPassagesView, EnfantAnomaliesView,
)
from .views_sync import PassageSyncView
from .views_responsable import ElevesResponsableView, EleveResponsableDetailView
from .views_responsable_agents import AgentsResponsableView, AgentResponsableDetailView
from .views_badge_responsable import (
    BadgesResponsableView,
    BadgeCodeResponsableView,
    BadgeEtatResponsableView,
    BadgeInitialView,
    BadgeReemissionView,
)
from .views_agent import PointsControleAgentView
from .views_compte_responsable import (
    ResponsableCompteView,
    ResponsableMotDePasseView,
)
from .views_responsable_suivi import (
    AnomalieResponsableDetailView,
    AnomaliesResponsableView,
    ItineraireResponsableDetailView,
    ItinerairesResponsableView,
    PassagesResponsableView,
    PointResponsableDetailView,
    PointsResponsableView,
    SyntheseResponsableView,
)

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/login/", LoginView.as_view(), name="auth-login-slash"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout-slash"),
    path("passages/sync", PassageSyncView.as_view(), name="passages-sync"),
    path("passages/sync/", PassageSyncView.as_view(), name="passages-sync-slash"),
    # Responsable
    path("responsable/compte", ResponsableCompteView.as_view(), name="responsable-compte"),
    path("responsable/compte/", ResponsableCompteView.as_view(), name="responsable-compte-slash"),
    path(
        "responsable/compte/mot-de-passe",
        ResponsableMotDePasseView.as_view(),
        name="responsable-compte-mot-de-passe",
    ),
    path(
        "responsable/compte/mot-de-passe/",
        ResponsableMotDePasseView.as_view(),
        name="responsable-compte-mot-de-passe-slash",
    ),
    path("responsable/points", PointsResponsableView.as_view(), name="responsable-points"),
    path("responsable/points/", PointsResponsableView.as_view(), name="responsable-points-slash"),
    path(
        "responsable/points/<int:point_id>",
        PointResponsableDetailView.as_view(),
        name="responsable-point-detail",
    ),
    path(
        "responsable/points/<int:point_id>/",
        PointResponsableDetailView.as_view(),
        name="responsable-point-detail-slash",
    ),
    path(
        "responsable/itineraires",
        ItinerairesResponsableView.as_view(),
        name="responsable-itineraires",
    ),
    path(
        "responsable/itineraires/",
        ItinerairesResponsableView.as_view(),
        name="responsable-itineraires-slash",
    ),
    path(
        "responsable/itineraires/<int:itineraire_id>",
        ItineraireResponsableDetailView.as_view(),
        name="responsable-itineraire-detail",
    ),
    path(
        "responsable/itineraires/<int:itineraire_id>/",
        ItineraireResponsableDetailView.as_view(),
        name="responsable-itineraire-detail-slash",
    ),
    path(
        "responsable/passages",
        PassagesResponsableView.as_view(),
        name="responsable-passages",
    ),
    path(
        "responsable/passages/",
        PassagesResponsableView.as_view(),
        name="responsable-passages-slash",
    ),
    path(
        "responsable/anomalies",
        AnomaliesResponsableView.as_view(),
        name="responsable-anomalies",
    ),
    path(
        "responsable/anomalies/",
        AnomaliesResponsableView.as_view(),
        name="responsable-anomalies-slash",
    ),
    path(
        "responsable/anomalies/<int:anomalie_id>",
        AnomalieResponsableDetailView.as_view(),
        name="responsable-anomalie-detail",
    ),
    path(
        "responsable/anomalies/<int:anomalie_id>/",
        AnomalieResponsableDetailView.as_view(),
        name="responsable-anomalie-detail-slash",
    ),
    path(
        "responsable/synthese",
        SyntheseResponsableView.as_view(),
        name="responsable-synthese",
    ),
    path(
        "responsable/synthese/",
        SyntheseResponsableView.as_view(),
        name="responsable-synthese-slash",
    ),
    path("responsable/eleves", ElevesResponsableView.as_view(), name="responsable-eleves"),
    path("responsable/eleves/", ElevesResponsableView.as_view(), name="responsable-eleves-slash"),
    path("responsable/agents", AgentsResponsableView.as_view(), name="responsable-agents"),
    path("responsable/agents/", AgentsResponsableView.as_view(), name="responsable-agents-slash"),
    path(
        "responsable/agents/<int:agent_id>",
        AgentResponsableDetailView.as_view(),
        name="responsable-agent-detail",
    ),
    path(
        "responsable/agents/<int:agent_id>/",
        AgentResponsableDetailView.as_view(),
        name="responsable-agent-detail-slash",
    ),
    path(
        "responsable/eleves/<int:eleve_id>",
        EleveResponsableDetailView.as_view(),
        name="responsable-eleve-detail",
    ),
    path(
        "responsable/eleves/<int:eleve_id>/",
        EleveResponsableDetailView.as_view(),
        name="responsable-eleve-detail-slash",
    ),
    path("responsable/badges", BadgesResponsableView.as_view(), name="responsable-badges"),
    path("responsable/badges/", BadgesResponsableView.as_view(), name="responsable-badges-slash"),
    path(
        "responsable/badges/<int:badge_id>/code",
        BadgeCodeResponsableView.as_view(),
        name="responsable-badge-code",
    ),
    path(
        "responsable/badges/<int:badge_id>/code/",
        BadgeCodeResponsableView.as_view(),
        name="responsable-badge-code-slash",
    ),
    path(
        "responsable/eleves/<int:eleve_id>/badge",
        BadgeInitialView.as_view(),
        name="responsable-badge-initial",
    ),
    path(
        "responsable/eleves/<int:eleve_id>/badge/",
        BadgeInitialView.as_view(),
        name="responsable-badge-initial-slash",
    ),
    path(
        "responsable/badges/<int:badge_id>/reemettre",
        BadgeReemissionView.as_view(),
        name="responsable-badge-reemission",
    ),
    path(
        "responsable/badges/<int:badge_id>/reemettre/",
        BadgeReemissionView.as_view(),
        name="responsable-badge-reemission-slash",
    ),
    path(
        "responsable/badges/<int:badge_id>",
        BadgeEtatResponsableView.as_view(),
        name="responsable-badge-etat",
    ),
    path(
        "responsable/badges/<int:badge_id>/",
        BadgeEtatResponsableView.as_view(),
        name="responsable-badge-etat-slash",
    ),

        # Agent
    path("agent/points", PointsControleAgentView.as_view(), name="agent-points"),
    path("agent/points/", PointsControleAgentView.as_view(), name="agent-points-slash"),
    # Parent
    path("parent/enfants", MesEnfantsView.as_view(), name="parent-enfants"),
    path("parent/enfants/", MesEnfantsView.as_view(), name="parent-enfants-slash"),
    path("parent/enfants/<int:eleve_id>", EnfantDetailView.as_view(), name="parent-enfant-detail"),
    path("parent/enfants/<int:eleve_id>/", EnfantDetailView.as_view(), name="parent-enfant-detail-slash"),
    path("parent/enfants/<int:eleve_id>/passages", EnfantPassagesView.as_view(), name="parent-enfant-passages"),
    path("parent/enfants/<int:eleve_id>/passages/", EnfantPassagesView.as_view(), name="parent-enfant-passages-slash"),
    path("parent/enfants/<int:eleve_id>/anomalies", EnfantAnomaliesView.as_view(), name="parent-enfant-anomalies"),
    path("parent/enfants/<int:eleve_id>/anomalies/", EnfantAnomaliesView.as_view(), name="parent-enfant-anomalies-slash"),
]