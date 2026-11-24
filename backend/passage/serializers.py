"""Serializers Passage. Le serializer de login ne fuit jamais
l'existence de l'identifiant : message d'erreur identique."""
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Utilisateur, Eleve, Passage, Anomalie, Badge

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


class ResponsableCompteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ["id", "identifiant", "nom", "role"]
        read_only_fields = ["id", "role"]

    def validate(self, attrs):
        extra_fields = set(self.initial_data) - {"identifiant", "nom"}
        if extra_fields:
            raise serializers.ValidationError(
                {"detail": "Seuls l’identifiant et le nom peuvent être modifiés."}
            )
        return attrs


class ResponsableMotDePasseSerializer(serializers.Serializer):
    mot_de_passe_actuel = serializers.CharField(write_only=True, trim_whitespace=False)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, trim_whitespace=False)
    confirmation_mot_de_passe = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        extra_fields = set(self.initial_data) - {
            "mot_de_passe_actuel",
            "nouveau_mot_de_passe",
            "confirmation_mot_de_passe",
        }
        if extra_fields:
            raise serializers.ValidationError(
                {"detail": "Seuls les champs de changement de mot de passe sont acceptés."}
            )

        user = self.context["request"].user
        if not user.check_password(attrs["mot_de_passe_actuel"]):
            raise serializers.ValidationError(
                {"mot_de_passe_actuel": "Le mot de passe actuel est incorrect."}
            )
        if attrs["nouveau_mot_de_passe"] != attrs["confirmation_mot_de_passe"]:
            raise serializers.ValidationError(
                {"confirmation_mot_de_passe": "La confirmation ne correspond pas au nouveau mot de passe."}
            )
        try:
            validate_password(attrs["nouveau_mot_de_passe"], user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                {"nouveau_mot_de_passe": list(error.messages)}
            ) from error
        return attrs

    def update(self, instance, validated_data):
        instance.set_password(validated_data["nouveau_mot_de_passe"])
        instance.save(update_fields=["password"])
        return instance


class EleveResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Eleve
        fields = ["id", "nom", "classe", "etablissement", "etat"]
        read_only_fields = ["id"]


class BadgeResponsableSerializer(serializers.ModelSerializer):
    eleve_id = serializers.IntegerField(read_only=True)
    eleve_nom = serializers.CharField(source="eleve.nom", read_only=True)
    badge_remplace = serializers.IntegerField(
        source="badge_remplace_id",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Badge
        fields = ["id", "eleve_id", "eleve_nom", "etat", "date_emission", "badge_remplace"]
        read_only_fields = fields


class BadgeEtatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ["etat"]

    def validate(self, attrs):
        extra_fields = set(self.initial_data) - {"etat"}
        if extra_fields:
            raise serializers.ValidationError(
                {"detail": "Seul l’état du badge peut être modifié."}
            )

        badge = self.instance
        if badge is None:
            return attrs

        if badge.remplacants.exists():
            raise serializers.ValidationError(
                {"detail": "Ce badge a été remplacé et ne peut plus être modifié."}
            )

        new_state = attrs["etat"]
        if new_state == badge.etat:
            return attrs
        if badge.etat in (Badge.Etat.PERDU, Badge.Etat.REVOQUE):
            raise serializers.ValidationError(
                {"etat": "Un badge perdu ou révoqué ne peut pas être réactivé; réémettez-le."}
            )
        if new_state == Badge.Etat.ACTIF:
            if badge.eleve.etat != Eleve.Etat.ACTIF:
                raise serializers.ValidationError(
                    {"etat": "Un élève inactif ne peut pas avoir de badge actif."}
                )
            if Badge.objects.filter(
                eleve=badge.eleve,
                etat=Badge.Etat.ACTIF,
            ).exclude(pk=badge.pk).exists():
                raise serializers.ValidationError(
                    {"etat": "Cet élève possède déjà un badge actif."}
                )
        return attrs



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