"""Vues spécifiques à l'agent de portail."""
from rest_framework.response import Response
from rest_framework.views import APIView

from passage.permissions import EstAgent


class PointsControleAgentView(APIView):
    """GET /api/agent/points/ — retourne les points affectés au compte Agent."""
    permission_classes = [EstAgent]

    def get(self, request):
        points = request.user.points_controle.all().order_by(
            "etablissement", "libelle", "id"
        )
        return Response([
            {
                "id": point.id,
                "libelle": point.libelle,
                "etablissement": point.etablissement,
                "type": point.type,
            }
            for point in points
        ])


