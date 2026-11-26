"""Serializers Passage. Le serializer de login ne fuit jamais
l'existence de l'identifiant : message d'erreur identique."""
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    Anomalie,
    Badge,
    Eleve,
    Itineraire,
    Passage,
    PointControle,
    Utilisateur,
)

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


class PointControleResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointControle
        fields = ["id", "etablissement", "libelle", "type"]
        read_only_fields = ["id"]


class AgentResponsableSerializer(serializers.ModelSerializer):
    point_controle_ids = serializers.PrimaryKeyRelatedField(
        source="points_controle",
        queryset=PointControle.objects.all(),
        many=True,
    )

    class Meta:
        model = Utilisateur
        fields = ["id", "identifiant", "nom", "point_controle_ids"]
        read_only_fields = ["id", "identifiant", "nom"]

    def validate(self, attrs):
        extra_fields = set(self.initial_data) - {"point_controle_ids"}
        if extra_fields:
            raise serializers.ValidationError(
                {"detail": "Seuls les points de contrôle affectés à l’agent peuvent être modifiés."}
            )
        return attrs


class ItineraireResponsableSerializer(serializers.ModelSerializer):
    eleve_id = serializers.PrimaryKeyRelatedField(
        source="eleve", queryset=Eleve.objects.all()
    )
    eleve_nom = serializers.CharField(source="eleve.nom", read_only=True)
    point_id = serializers.PrimaryKeyRelatedField(
        source="point", queryset=PointControle.objects.all()
    )
    point_libelle = serializers.CharField(source="point.libelle", read_only=True)
    ordre = serializers.IntegerField(min_value=1, max_value=32767)
    jours_application = serializers.RegexField(r"^[01]{7}$")

    class Meta:
        model = Itineraire
        fields = [
            "id", "eleve_id", "eleve_nom", "point_id", "point_libelle",
            "ordre", "heure_debut", "heure_fin", "jours_application",
        ]
        read_only_fields = ["id", "eleve_nom", "point_libelle"]

    def validate(self, attrs):
        eleve = attrs.get("eleve", getattr(self.instance, "eleve", None))
        point = attrs.get("point", getattr(self.instance, "point", None))
        ordre = attrs.get("ordre", getattr(self.instance, "ordre", None))
        debut = attrs.get("heure_debut", getattr(self.instance, "heure_debut", None))
        fin = attrs.get("heure_fin", getattr(self.instance, "heure_fin", None))
        jours = attrs.get("jours_application", getattr(self.instance, "jours_application", None))

        if eleve is None or point is None:
            raise serializers.ValidationError(
                {"detail": "Un élève et un point de contrôle sont requis."}
            )
        if eleve.etablissement != point.etablissement:
            raise serializers.ValidationError({
                "point_id": "Le point de contrôle doit appartenir à l’établissement de l’élève."
            })
        if debut is not None and fin is not None and fin <= debut:
            raise serializers.ValidationError({
                "heure_fin": "L’heure de fin doit être postérieure à l’heure de début."
            })
        if jours == "0000000":
            raise serializers.ValidationError({
                "jours_application": "Sélectionnez au moins un jour d’application."
            })
        conflit = Itineraire.objects.filter(eleve=eleve).exclude(pk=getattr(self.instance, "pk", None))
        if ordre is not None and conflit.filter(ordre=ordre).exists():
            raise serializers.ValidationError({"ordre": "Cet ordre est déjà utilisé pour cet élève."})
        if conflit.filter(point=point).exists():
            raise serializers.ValidationError({"point_id": "Ce point est déjà présent dans l’itinéraire."})
        return attrs


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
    badge_id = serializers.IntegerField(required=False, allow_null=True)
    badge_code = serializers.CharField(
        max_length=200, required=False, allow_blank=True, allow_null=True,
    )
    code_secours = serializers.CharField(
        max_length=20, required=False, allow_blank=True, allow_null=True,
    )
    point_id = serializers.IntegerField()
    heure_locale = serializers.DateTimeField()

    def validate(self, attrs):
        manual_code = (attrs.get("code_secours") or "").strip()
        has_qr_code = attrs.get("badge_id") is not None and bool(attrs.get("badge_code"))
        if bool(manual_code) == has_qr_code:
            raise serializers.ValidationError(
                "Fournissez soit le QR signé, soit le code de secours."
            )
        return attrs


class PassageSyncLotSerializer(serializers.Serializer):
    """Un lot de passages à synchroniser."""
    appareil_id = serializers.CharField(max_length=64)
    passages = PassageSyncItemSerializer(many=True)

    def validate_passages(self, value):
        if not value:
            raise serializers.ValidationError("Le lot ne peut pas être vide.")
        if len(value) > 500:
            raise serializers.ValidationError("Lot trop volumineux (max 500 passages).")
        request = self.context.get("request")
        user = getattr(request, "user", None)
        assigned_point_ids = set(user.points_controle.values_list("id", flat=True)) if user else set()
        if not assigned_point_ids:
            raise serializers.ValidationError(
                "Aucun point de contrôle n’est affecté à votre compte Agent."
            )
        if any(passage["point_id"] not in assigned_point_ids for passage in value):
            raise serializers.ValidationError(
                "Un ou plusieurs passages ne correspondent pas aux points affectés à votre compte."
            )
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


class PassageResponsableSerializer(serializers.ModelSerializer):
    eleve_id = serializers.IntegerField(source="badge.eleve_id", read_only=True)
    eleve_nom = serializers.CharField(source="badge.eleve.nom", read_only=True)
    point_id = serializers.IntegerField(read_only=True)
    point_libelle = serializers.CharField(source="point.libelle", read_only=True)

    class Meta:
        model = Passage
        fields = [
            "id", "eleve_id", "eleve_nom", "point_id", "point_libelle",
            "heure_locale", "heure_serveur", "appareil_id", "sync_etat",
        ]
        read_only_fields = fields


class AnomalieSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="eleve.nom", read_only=True)

    class Meta:
        model = Anomalie
        fields = ["id", "eleve_nom", "type", "date", "traite", "cree_le"]
        read_only_fields = fields


class AnomalieResponsableSerializer(serializers.ModelSerializer):
    eleve_nom = serializers.CharField(source="eleve.nom", read_only=True)
    passage_point = serializers.CharField(
        source="passage.point.libelle", read_only=True, allow_null=True
    )

    class Meta:
        model = Anomalie
        fields = [
            "id", "eleve_id", "eleve_nom", "type", "date", "traite",
            "cree_le", "passage_id", "passage_point",
        ]
        read_only_fields = [
            "id", "eleve_id", "eleve_nom", "type", "date",
            "cree_le", "passage_id", "passage_point",
        ]

    def validate(self, attrs):
        extra_fields = set(self.initial_data) - {"traite"}
        if extra_fields:
            raise serializers.ValidationError(
                {"detail": "Seul l’état de traitement peut être modifié."}
            )
        if "traite" not in attrs:
            raise serializers.ValidationError({"traite": "Ce champ est requis."})
        return attrs


class SyntheseResponsableSerializer(serializers.Serializer):
    classe = serializers.CharField(max_length=32, allow_blank=False, trim_whitespace=True)
    date = serializers.DateField(required=False)

    def validate_classe(self, value):
        if not value:
            raise serializers.ValidationError("La classe est requise.")
        return value