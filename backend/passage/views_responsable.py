"""Gestion des élèves réservée aux responsables d'établissement."""
from rest_framework import generics

from passage.models import Eleve
from passage.permissions import EstResponsable
from passage.serializers import EleveResponsableSerializer


class ElevesResponsableView(generics.ListCreateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = EleveResponsableSerializer
    queryset = Eleve.objects.all().order_by("nom", "id")


class EleveResponsableDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = EleveResponsableSerializer
    queryset = Eleve.objects.all()
    lookup_url_kwarg = "eleve_id"
    http_method_names = ["get", "patch", "head", "options"]
