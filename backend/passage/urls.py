from django.urls import path

from .views_auth import LoginView, LogoutView
from .views_sync import PassageSyncView

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("passages/sync/", PassageSyncView.as_view(), name="passages-sync"),
]