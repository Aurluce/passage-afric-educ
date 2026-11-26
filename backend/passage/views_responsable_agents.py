"""Affectation des points de contrôle aux comptes Agent."""
from rest_framework import generics

from passage.models import Utilisateur
from passage.permissions import EstResponsable
from passage.serializers import AgentResponsableSerializer


class AgentsResponsableView(generics.ListAPIView):
    permission_classes = [EstResponsable]
    serializer_class = AgentResponsableSerializer
    queryset = Utilisateur.objects.filter(role=Utilisateur.Role.AGENT).order_by("nom", "id")


class AgentResponsableDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = AgentResponsableSerializer
    queryset = Utilisateur.objects.filter(role=Utilisateur.Role.AGENT)
    lookup_url_kwarg = "agent_id"
    http_method_names = ["get", "patch", "head", "options"]
