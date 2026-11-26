"""Vues de configuration et de consultation réservées au responsable."""
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from passage.models import Anomalie, Eleve, Itineraire, Passage, PointControle
from passage.permissions import EstResponsable
from passage.serializers import (
    AnomalieResponsableSerializer,
    ItineraireResponsableSerializer,
    PassageResponsableSerializer,
    PointControleResponsableSerializer,
    SyntheseResponsableSerializer,
)
from passage.services.synthese import generer_synthese


class PointsResponsableView(generics.ListCreateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = PointControleResponsableSerializer
    queryset = PointControle.objects.all().order_by("etablissement", "libelle", "id")


class PointResponsableDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = PointControleResponsableSerializer
    queryset = PointControle.objects.all()
    lookup_url_kwarg = "point_id"
    http_method_names = ["get", "patch", "head", "options"]


class ItinerairesResponsableView(generics.ListCreateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = ItineraireResponsableSerializer

    def get_queryset(self):
        queryset = Itineraire.objects.select_related("eleve", "point").order_by(
            "eleve_id", "ordre", "id"
        )
        eleve_id = self.request.query_params.get("eleve_id")
        if eleve_id:
            try:
                eleve_id = serializers.IntegerField().run_validation(eleve_id)
            except ValidationError:
                raise ValidationError({"eleve_id": "Identifiant d’élève invalide."})
            queryset = queryset.filter(eleve_id=eleve_id)
        return queryset


class ItineraireResponsableDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [EstResponsable]
    serializer_class = ItineraireResponsableSerializer
    queryset = Itineraire.objects.select_related("eleve", "point")
    lookup_url_kwarg = "itineraire_id"
    http_method_names = ["get", "patch", "head", "options"]


class PassagesResponsableView(generics.ListAPIView):
    permission_classes = [EstResponsable]
    serializer_class = PassageResponsableSerializer

    def get_queryset(self):
        queryset = Passage.objects.select_related(
            "badge__eleve", "point"
        ).order_by("-heure_serveur", "-id")
        params = self.request.query_params
        for key, lookup in (("eleve_id", "badge__eleve_id"), ("point_id", "point_id")):
            value = params.get(key)
            if value:
                try:
                    value = serializers.IntegerField().run_validation(value)
                except ValidationError:
                    raise ValidationError({key: "Cet identifiant doit être un entier."})
                queryset = queryset.filter(**{lookup: value})
        jour = params.get("date")
        if jour:
            try:
                jour_parse = serializers.DateField().run_validation(jour)
            except ValidationError:
                raise ValidationError({"date": "La date doit respecter le format AAAA-MM-JJ."})
            queryset = queryset.filter(heure_locale__date=jour_parse)
        return queryset[:500]


class AnomaliesResponsableView(generics.ListAPIView):
    permission_classes = [EstResponsable]
    serializer_class = AnomalieResponsableSerializer

    def get_queryset(self):
        queryset = Anomalie.objects.select_related(
            "eleve", "passage__point"
        ).order_by("-date", "-cree_le", "-id")
        params = self.request.query_params
        eleve_id = params.get("eleve_id")
        if eleve_id:
            try:
                eleve_id = serializers.IntegerField().run_validation(eleve_id)
            except ValidationError:
                raise ValidationError({"eleve_id": "Identifiant d’élève invalide."})
            queryset = queryset.filter(eleve_id=eleve_id)
        anomalie_type = params.get("type")
        if anomalie_type:
            valid_types = {choice for choice, _ in Anomalie.Type.choices}
            if anomalie_type not in valid_types:
                raise ValidationError({"type": "Type d’anomalie invalide."})
            queryset = queryset.filter(type=anomalie_type)
        jour = params.get("date")
        if jour:
            try:
                jour_parse = serializers.DateField().run_validation(jour)
            except ValidationError:
                raise ValidationError({"date": "La date doit respecter le format AAAA-MM-JJ."})
            queryset = queryset.filter(date=jour_parse)
        traite = params.get("traite")
        if traite is not None:
            try:
                traite = serializers.BooleanField().run_validation(traite)
            except ValidationError:
                raise ValidationError({"traite": "Utilisez true ou false."})
            queryset = queryset.filter(traite=traite)
        return queryset[:500]


class AnomalieResponsableDetailView(APIView):
    permission_classes = [EstResponsable]

    def patch(self, request, anomalie_id):
        anomalie = get_object_or_404(Anomalie, pk=anomalie_id)
        serializer = AnomalieResponsableSerializer(
            anomalie,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        anomalie = serializer.save()
        return Response(AnomalieResponsableSerializer(anomalie).data)


class SyntheseResponsableView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request):
        serializer = SyntheseResponsableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resultat = generer_synthese(
            serializer.validated_data["classe"],
            serializer.validated_data.get("date"),
        )
        return Response({
            "classe": resultat.synthese.classe,
            "date": resultat.synthese.date,
            "chiffres": resultat.synthese.chiffres,
            "texte": resultat.synthese.texte,
            "origine": resultat.origine,
        })
