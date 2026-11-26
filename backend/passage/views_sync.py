"""Endpoint de synchronisation des passages (agent uniquement)."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from passage.permissions import EstAgent
from passage.serializers import PassageSyncLotSerializer
from passage.services.sync import synchroniser_passages


class PassageSyncView(APIView):
    """
    POST /api/passages/sync/

    Corps :
    {
        "appareil_id": "dev-agent-01",
        "passages": [
            {"event_id_local": "<uuid>", "badge_id": 1, "point_id": 2,
             "heure_locale": "2025-01-15T07:15:00+01:00"},
            ...
        ]
    }
    """
    permission_classes = [EstAgent]

    def post(self, request):
        serializer = PassageSyncLotSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        rapport = synchroniser_passages(
            appareil_id=data["appareil_id"],
            passages=data["passages"],
        )

        return Response(
            {
                "created": rapport.created,
                "ignored": rapport.ignored,
                "rejected_clock": rapport.rejected_clock,
                "rejected_badge": rapport.rejected_badge,
                "rejected_signature": rapport.rejected_signature,
                "details": rapport.details,
            },
            status=status.HTTP_200_OK,
        )
