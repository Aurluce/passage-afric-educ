"""Gestion des badges par le responsable, sans exposer leur secret."""
import secrets

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from passage.models import Badge, Eleve
from passage.permissions import EstResponsable
from passage.serializers import BadgeEtatSerializer, BadgeResponsableSerializer


def _nouveau_badge(eleve, badge_remplace=None):
    return Badge.objects.create(
        eleve=eleve,
        secret=secrets.token_hex(32),
        etat=Badge.Etat.ACTIF,
        badge_remplace=badge_remplace,
    )


class BadgesResponsableView(generics.ListAPIView):
    permission_classes = [EstResponsable]
    serializer_class = BadgeResponsableSerializer
    queryset = (
        Badge.objects.select_related("eleve", "badge_remplace")
        .order_by("-date_emission", "-id")
    )


class BadgeInitialView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, eleve_id):
        with transaction.atomic():
            eleve = get_object_or_404(
                Eleve.objects.select_for_update(),
                pk=eleve_id,
            )
            if eleve.etat != Eleve.Etat.ACTIF:
                raise ValidationError({"detail": "Un élève inactif ne peut pas recevoir de badge."})
            if Badge.objects.filter(eleve=eleve).exists():
                return Response(
                    {"detail": "Un badge existe déjà pour cet élève. Utilisez la réémission."},
                    status=status.HTTP_409_CONFLICT,
                )
            badge = _nouveau_badge(eleve)

        return Response(
            BadgeResponsableSerializer(badge).data,
            status=status.HTTP_201_CREATED,
        )


class BadgeReemissionView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, badge_id):
        badge_reference = get_object_or_404(
            Badge.objects.only("id", "eleve_id"),
            pk=badge_id,
        )
        with transaction.atomic():
            eleve = get_object_or_404(
                Eleve.objects.select_for_update(),
                pk=badge_reference.eleve_id,
            )
            badge = get_object_or_404(
                Badge.objects.select_for_update().select_related("eleve"),
                pk=badge_id,
                eleve=eleve,
            )
            if eleve.etat != Eleve.Etat.ACTIF:
                raise ValidationError({"detail": "Un élève inactif ne peut pas recevoir de badge."})
            if badge.remplacants.exists():
                return Response(
                    {"detail": "Ce badge a déjà été remplacé."},
                    status=status.HTTP_409_CONFLICT,
                )

            active_badges = list(
                Badge.objects.select_for_update()
                .filter(eleve=eleve, etat=Badge.Etat.ACTIF)
                .values_list("id", flat=True)
            )
            if any(active_id != badge.id for active_id in active_badges):
                return Response(
                    {"detail": "Réémettez le badge actif actuel de cet élève."},
                    status=status.HTTP_409_CONFLICT,
                )

            if badge.etat != Badge.Etat.REVOQUE:
                badge.etat = Badge.Etat.REVOQUE
                badge.save(update_fields=["etat"])
            nouveau = _nouveau_badge(eleve, badge_remplace=badge)

        return Response(
            BadgeResponsableSerializer(nouveau).data,
            status=status.HTTP_201_CREATED,
        )


class BadgeEtatResponsableView(APIView):
    permission_classes = [EstResponsable]

    def patch(self, request, badge_id):
        badge_reference = get_object_or_404(
            Badge.objects.only("id", "eleve_id"),
            pk=badge_id,
        )
        with transaction.atomic():
            eleve = get_object_or_404(
                Eleve.objects.select_for_update(),
                pk=badge_reference.eleve_id,
            )
            badge = get_object_or_404(
                Badge.objects.select_for_update().select_related("eleve"),
                pk=badge_id,
                eleve=eleve,
            )
            serializer = BadgeEtatSerializer(
                badge,
                data=request.data,
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            badge = serializer.save()

        return Response(BadgeResponsableSerializer(badge).data)
