"""Vues d'authentification JWT. Logout effectif via blacklist du refresh."""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, UtilisateurPublicSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "login"  # 5/min via settings.DEFAULT_THROTTLE_RATES

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UtilisateurPublicSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """Invalide le refresh token en le blacklistant côté serveur."""

    def post(self, request):
        refresh_str = request.data.get("refresh")
        if not refresh_str:
            return Response(
                {"detail": "Champ 'refresh' requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh_str).blacklist()
        except TokenError:
            # Token déjà invalide/expiré : on répond OK quand même,
            # pas de fuite d'information.
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)