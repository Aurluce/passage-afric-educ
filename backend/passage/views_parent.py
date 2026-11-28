"""Vues accessibles aux parents — cloisonnement strict (D15)."""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from passage.models import Anomalie, Eleve, MessageSortant, ParentEleve, Passage
from passage.permissions import EstParent
from passage.serializers import (
    AnomalieSerializer,
    EleveSerializer,
    NotificationParentSerializer,
    PassageSerializer,
)


def _eleves_du_parent(user):
    """Renvoie uniquement les élèves rattachés au parent authentifié."""
    return Eleve.objects.filter(parents__parent=user)


class MesEnfantsView(APIView):
    """GET /api/parent/enfants/ — liste les enfants du parent connecté."""
    permission_classes = [EstParent]

    def get(self, request):
        eleves = _eleves_du_parent(request.user).distinct()
        return Response(EleveSerializer(eleves, many=True).data)


class EnfantDetailView(APIView):
    """
    GET /api/parent/enfants/<id>/

    D15 : si l'élève n'est pas rattaché au parent authentifié, on renvoie 404
    (pas 403) pour ne pas révéler son existence.
    """
    permission_classes = [EstParent]

    def get(self, request, eleve_id):
        eleve = get_object_or_404(_eleves_du_parent(request.user), id=eleve_id)
        return Response(EleveSerializer(eleve).data)


class EnfantPassagesView(APIView):
    """GET /api/parent/enfants/<id>/passages/ — passages d'un enfant du parent."""
    permission_classes = [EstParent]

    def get(self, request, eleve_id):
        eleve = get_object_or_404(_eleves_du_parent(request.user), id=eleve_id)
        passages = (
            Passage.objects.filter(badge__eleve=eleve)
            .select_related("point", "badge")
            .order_by("-heure_locale")
        )
        return Response(PassageSerializer(passages, many=True).data)


class EnfantAnomaliesView(APIView):
    """GET /api/parent/enfants/<id>/anomalies/ — anomalies d'un enfant du parent."""
    permission_classes = [EstParent]

    def get(self, request, eleve_id):
        eleve = get_object_or_404(_eleves_du_parent(request.user), id=eleve_id)
        anomalies = (
            Anomalie.objects.filter(eleve=eleve)
            .order_by("-date", "-cree_le")
        )
        return Response(AnomalieSerializer(anomalies, many=True).data)


class NotificationsParentView(APIView):
    """GET /api/parent/notifications/ — notifications du parent connecté."""
    permission_classes = [EstParent]

    def get(self, request):
        messages = (
            MessageSortant.objects.filter(
                parent=request.user,
                etat=MessageSortant.Etat.ENVOYE,
            )
            .select_related("anomalie__eleve")
            .order_by("-date")
        )
        return Response(NotificationParentSerializer(messages, many=True).data)
