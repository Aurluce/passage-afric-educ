"""Fixtures partagées pour tous les tests."""
import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache_between_tests():
    """Vide le cache avant chaque test pour isoler les throttles."""
    cache.clear()
    yield
    cache.clear()
