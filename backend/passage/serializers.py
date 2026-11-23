"""Serializers Passage. Le serializer de login ne fuit jamais
l'existence de l'identifiant : message d'erreur identique."""
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Utilisateur

MESSAGE_ERREUR_IDENTIQUE = "Identifiants invalides."


class LoginSerializer(serializers.Serializer):
    identifiant = serializers.CharField(max_length=64)
    password = serializers.CharField(
        write_only=True, min_length=8, trim_whitespace=False,
    )

    def validate(self, attrs):
        # `authenticate` renvoie None que l'identifiant existe ou non.
        # On ne renvoie JAMAIS "utilisateur inconnu" vs "mot de passe faux".
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["identifiant"],
            password=attrs["password"],
        )
        if user is None or not user.is_active:
            raise serializers.ValidationError(
                {"detail": MESSAGE_ERREUR_IDENTIQUE},
                code="authorization",
            )
        attrs["user"] = user
        return attrs


class UtilisateurPublicSerializer(serializers.ModelSerializer):
    """Ce qu'on accepte de renvoyer au client après login. Pas de password."""
    class Meta:
        model = Utilisateur
        fields = ["id", "identifiant", "nom", "role"]
        read_only_fields = fields