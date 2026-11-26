"""Gestion des élèves réservée aux responsables d'établissement."""
from rest_framework import generics

from rest_framework.exceptions import ValidationError

from passage.models import Eleve
from passage.permissions import EstResponsable
from passage.serializers import EleveResponsableSerializer


class ElevesResponsableView(generics.ListCreateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = EleveResponsableSerializer

    def get_queryset(self):
        queryset = Eleve.objects.all().order_by("nom", "id")
        classe = self.request.query_params.get("classe")
        etablissement = self.request.query_params.get("etablissement")
        etat = self.request.query_params.get("etat")
        if classe:
            queryset = queryset.filter(classe=classe)
        if etablissement:
            queryset = queryset.filter(etablissement=etablissement)
        if etat:
            if etat not in Eleve.Etat.values:
                raise ValidationError({"etat": "État d’élève invalide."})
            queryset = queryset.filter(etat=etat)
        return queryset


class EleveResponsableDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = EleveResponsableSerializer
    queryset = Eleve.objects.all()
    lookup_url_kwarg = "eleve_id"
    http_method_names = ["get", "patch", "head", "options"]
