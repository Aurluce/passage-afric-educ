# Décisions techniques


## D3 — SGBD : PostgreSQL plutôt que MariaDB (XAMPP)

- **Option retenue** : PostgreSQL 17 (dépôt PGDG), base `passage`, utilisateur applicatif `passage_app`.
- **Option écartée** : MariaDB 10.4 fourni par XAMPP.
- **Raison** : Django 5.x exige MariaDB ≥ 10.5 ; le MariaDB de XAMPP (10.4.32) est refusé au démarrage. Plutôt que d'imposer une montée de version risquée de XAMPP (ou de rétrograder Django en 4.2), on migre vers PostgreSQL, supporté nativement et disponible via le dépôt officiel sur Ubuntu 24.04. Le README documentera l'installation PostgreSQL comme prérequis.



## D5 — Privilège `CREATEDB` pour l'utilisateur de test

- **Constat** : `pytest` échoue avec `permission denied to create database` car Django tente de créer `test_passage`.
- **Action** : `ALTER ROLE passage_app CREATEDB` (et non `SUPERUSER`), conformément à la recommandation Django pour les utilisateurs de test PostgreSQL.
- **Pourquoi pas `SUPERUSER`** : respect du principe de moindre privilège ; `CREATEDB` suffit pour créer/détruire la base de test, sans donner le droit de modifier les rôles ou de contourner les permissions.

## D6 — Isolation du cache entre tests

- **Constat** : le throttle `login` (5/min) partage son état via `LocMemCache`, qui persiste entre les tests pytest-django. Le test du logout échouait avec `429 Too Many Requests` à cause du test du throttle exécuté avant.
- **Action** : fixture `autouse` dans `backend/conftest.py` qui vide le cache avant et après chaque test.
- **Option écartée** : désactiver le throttle en test (`override_settings`) — écartée car elle empêcherait de tester le throttle lui-même, qui est une exigence §2.2.