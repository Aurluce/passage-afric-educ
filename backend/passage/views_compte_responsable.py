"""Consultation et mise à jour du compte responsable connecté."""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from passage.permissions import EstResponsable
from passage.serializers import (
    ResponsableCompteSerializer,
    ResponsableMotDePasseSerializer,
)


class ResponsableCompteView(APIView):
    permission_classes = [IsAuthenticated, EstResponsable]

    def get(self, request):
        return Response(ResponsableCompteSerializer(request.user).data)

    def patch(self, request):
        serializer = ResponsableCompteSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        utilisateur = serializer.save()
        return Response(ResponsableCompteSerializer(utilisateur).data)


class ResponsableMotDePasseView(APIView):
    permission_classes = [IsAuthenticated, EstResponsable]

    def post(self, request):
        serializer = ResponsableMotDePasseSerializer(
            request.user,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Le mot de passe a été modifié."},
            status=status.HTTP_200_OK,
        )
