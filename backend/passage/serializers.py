"""Serializers Passage. Le serializer de login ne fuit jamais
l'existence de l'identifiant : message d'erreur identique."""
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import Utilisateur, Eleve, Passage, Anomalie
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



class PassageSyncItemSerializer(serializers.Serializer):
    event_id_local = serializers.UUIDField()
    badge_id = serializers.IntegerField()
    badge_code = serializers.CharField(max_length=200)
    point_id = serializers.IntegerField()
    heure_locale = serializers.DateTimeField()

class PassageSyncLotSerializer(serializers.Serializer):
    """Un lot de passages à synchroniser."""
    appareil_id = serializers.CharField(max_length=64)
    passages = PassageSyncItemSerializer(many=True)

    def validate_passages(self, value):
        if not value:
            raise serializers.ValidationError("Le lot ne peut pas être vide.")
        if len(value) > 500:
            raise serializers.ValidationError("Lot trop volumineux (max 500 passages).")
        return value




class EleveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eleve
        fields = ["id", "nom", "classe", "etablissement"]
        read_only_fields = fields


class PassageSerializer(serializers.ModelSerializer):
    point_libelle = serializers.CharField(source="point.libelle", read_only=True)
    eleve_nom = serializers.CharField(source="badge.eleve.nom", read_only=True)

    class Meta:
        model = Passage
        fields = [
            "id", "point_libelle", "eleve_nom", "heure_locale",
            "heure_serveur", "appareil_id", "sync_etat",
        ]
        read_only_fields = fields


class AnomalieSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="eleve.nom", read_only=True)

    class Meta:
        model = Anomalie
        fields = ["id", "eleve_nom", "type", "date", "traite", "cree_le"]
        read_only_fields = fields