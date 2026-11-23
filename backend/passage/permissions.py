"""Permissions DRF basées sur le rôle, vérifié côté serveur uniquement."""
from rest_framework.permissions import BasePermission


class RoleRequis(BasePermission):
    """Base : exige un rôle précis. À surcharger via `role_attendu`."""
    role_attendu: str | None = None

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if self.role_attendu is None:
            return True
        return user.role == self.role_attendu


class EstResponsable(RoleRequis):
    role_attendu = "RESPONSABLE"


class EstAgent(RoleRequis):
    role_attendu = "AGENT"


class EstParent(RoleRequis):
    role_attendu = "PARENT"