"""
Modèles Passage — alignés sur §3.5 du sujet, avec les décisions D1/D2.
"""
import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


# --------------------------------------------------------------------------
# Utilisateurs et rôles
# --------------------------------------------------------------------------
class UtilisateurManager(BaseUserManager):
    def create_user(self, identifiant, password=None, **extra):
        if not identifiant:
            raise ValueError("identifiant requis")
        user = self.model(identifiant=identifiant, **extra)
        user.set_password(password)  # hachage fort (PBKDF2 par défaut)
        user.save(using=self._db)
        return user

    def create_superuser(self, identifiant, password=None, **extra):
        extra.setdefault("role", Utilisateur.Role.RESPONSABLE)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(identifiant, password, **extra)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        AGENT = "AGENT", "Agent de portail"
        RESPONSABLE = "RESPONSABLE", "Responsable"
        PARENT = "PARENT", "Parent"

    identifiant = models.CharField(max_length=64, unique=True)
    nom = models.CharField(max_length=120)
    role = models.CharField(max_length=16, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    objects = UtilisateurManager()

    USERNAME_FIELD = "identifiant"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return f"{self.identifiant} ({self.role})"


# --------------------------------------------------------------------------
# Élèves et lien parent
# --------------------------------------------------------------------------
class Eleve(models.Model):
    class Etat(models.TextChoices):
        ACTIF = "ACTIF", "Actif"
        INACTIF = "INACTIF", "Inactif"

    nom = models.CharField(max_length=120)
    classe = models.CharField(max_length=32)
    etablissement = models.CharField(max_length=120)
    etat = models.CharField(max_length=16, choices=Etat.choices, default=Etat.ACTIF)

    def __str__(self) -> str:
        return f"{self.nom} — {self.classe}"


class ParentEleve(models.Model):
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        limit_choices_to={"role": "PARENT"}, related_name="enfants",
    )
    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name="parents")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["parent", "eleve"], name="uniq_parent_eleve"),
        ]


# --------------------------------------------------------------------------
# Badges (D1 : code tournant + anti-rejeu par nonce)
# --------------------------------------------------------------------------
class Badge(models.Model):
    class Etat(models.TextChoices):
        ACTIF = "ACTIF", "Actif"
        SUSPENDU = "SUSPENDU", "Suspendu"
        PERDU = "PERDU", "Perdu"
        REVOQUE = "REVOQUE", "Révoqué"

    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name="badges")
    # secret HMAC côté serveur ; aucune donnée nominative sur le support
    secret = models.CharField(max_length=64)
    etat = models.CharField(max_length=16, choices=Etat.choices, default=Etat.ACTIF)
    date_emission = models.DateTimeField(auto_now_add=True)
    badge_remplace = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="remplacants",
    )

    def est_valide(self) -> bool:
        return self.etat == self.Etat.ACTIF


class NonceConsomme(models.Model):
    """Anti-rejeu : un nonce ne peut être accepté qu'une fois."""
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name="nonces")
    nonce = models.UUIDField()
    consomme_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["badge", "nonce"], name="uniq_badge_nonce"),
        ]


# --------------------------------------------------------------------------
# Points de contrôle et itinéraires
# --------------------------------------------------------------------------
class PointControle(models.Model):
    class Type(models.TextChoices):
        PORTAIL = "PORTAIL", "Portail"
        AUTOBUS = "AUTOBUS", "Autobus"

    etablissement = models.CharField(max_length=120)
    libelle = models.CharField(max_length=120)
    type = models.CharField(max_length=16, choices=Type.choices)

    def __str__(self) -> str:
        return self.libelle


class Itineraire(models.Model):
    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name="itineraires")
    point = models.ForeignKey(PointControle, on_delete=models.CASCADE)
    ordre = models.PositiveSmallIntegerField()
    heure_debut = models.TimeField()
    heure_fin = models.TimeField()
    # jours d'application : "1111100" = lundi-vendredi (index 0 = lundi)
    jours_application = models.CharField(max_length=7, default="1111100")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["eleve", "point"], name="uniq_eleve_point"),
            models.UniqueConstraint(fields=["eleve", "ordre"], name="uniq_eleve_ordre"),
        ]


# --------------------------------------------------------------------------
# Passages (D2 : idempotence par event_id_local)
# --------------------------------------------------------------------------
class Passage(models.Model):
    class SyncEtat(models.TextChoices):
        RECU = "RECU", "Reçu"
        REJETE_HORLOGE = "REJETE_HORLOGE", "Rejeté (horloge suspecte)"

    badge = models.ForeignKey(Badge, on_delete=models.PROTECT, related_name="passages")
    point = models.ForeignKey(PointControle, on_delete=models.PROTECT)
    heure_locale = models.DateTimeField()      # fourni par le client — NON fiable
    heure_serveur = models.DateTimeField(default=timezone.now)  # fiable
    appareil_id = models.CharField(max_length=64)
    event_id_local = models.UUIDField(default=uuid.uuid4)
    sync_etat = models.CharField(
        max_length=16, choices=SyncEtat.choices, default=SyncEtat.RECU,
    )

    class Meta:
        # D2 : la clé composite rend le rejeu idempotent
        constraints = [
            models.UniqueConstraint(
                fields=["badge", "event_id_local"], name="uniq_badge_event_local",
            ),
        ]
        indexes = [
            models.Index(fields=["heure_serveur"]),
            models.Index(fields=["badge", "heure_serveur"]),
        ]


# --------------------------------------------------------------------------
# Anomalies et notifications
# --------------------------------------------------------------------------
class Anomalie(models.Model):
    class Type(models.TextChoices):
        ABSENCE = "ABSENCE", "Point attendu non validé"
        HORS_FENETRE = "HORS_FENETRE", "Validation hors fenêtre"
        POINT_INATTENDU = "POINT_INATTENDU", "Point absent de l'itinéraire"
        DOUBLE_SCAN = "DOUBLE_SCAN", "Double scan < 60 s"
        HORLOGE_SUSPECTE = "HORLOGE_SUSPECTE", "Horloge suspecte"  # 5e anomalie (D1)

    eleve = models.ForeignKey(Eleve, on_delete=models.CASCADE, related_name="anomalies")
    type = models.CharField(max_length=24, choices=Type.choices)
    date = models.DateField()
    passage = models.ForeignKey(Passage, null=True, blank=True, on_delete=models.SET_NULL)
    traite = models.BooleanField(default=False)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["eleve", "date"])]


class MessageSortant(models.Model):
    class Etat(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        ENVOYE = "ENVOYE", "Envoyé"
        BLOQUE = "BLOQUE", "Bloqué (plafond)"
        ECHEC = "ECHEC", "Échec"

    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        limit_choices_to={"role": "PARENT"},
    )
    anomalie = models.ForeignKey(Anomalie, on_delete=models.CASCADE, related_name="messages")
    texte = models.TextField()
    etat = models.CharField(max_length=16, choices=Etat.choices, default=Etat.EN_ATTENTE)
    date = models.DateTimeField(auto_now_add=True)
    motif_non_envoi = models.CharField(max_length=120, blank=True)


# --------------------------------------------------------------------------
# Synthèses et audit
# --------------------------------------------------------------------------
class Synthese(models.Model):
    class Origine(models.TextChoices):
        MODELE = "MODELE", "Modèle de langage"
        GABARIT = "GABARIT", "Gabarit (mode dégradé)"

    classe = models.CharField(max_length=32)
    date = models.DateField()
    chiffres = models.JSONField()        # calculés par le code — jamais par le modèle
    texte = models.TextField()
    origine = models.CharField(max_length=16, choices=Origine.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["classe", "date"], name="uniq_classe_date"),
        ]


class JournalAudit(models.Model):
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )
    action = models.CharField(max_length=64)
    cible = models.CharField(max_length=120, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    horodatage = models.DateTimeField(auto_now_add=True)


class JournalAppelIA(models.Model):
    """Traçage des appels au modèle : coût, modèle, résultat."""
    horodatage = models.DateTimeField(auto_now_add=True)
    modele = models.CharField(max_length=64)
    volume_entree = models.PositiveIntegerField(default=0)
    volume_sortie = models.PositiveIntegerField(default=0)
    cout_estime = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    chemin = models.CharField(max_length=16)  # MODELE | GABARIT | RETRY
    synthese = models.ForeignKey(Synthese, null=True, blank=True, on_delete=models.SET_NULL)