# Décisions techniques


## D3 — SGBD : PostgreSQL plutôt que MariaDB (XAMPP)

- **Option retenue** : PostgreSQL 17 (dépôt PGDG), base `passage`, utilisateur applicatif `passage_app`.
- **Option écartée** : MariaDB 10.4 fourni par XAMPP.
- **Raison** : Django 5.x exige MariaDB ≥ 10.5 ; le MariaDB de XAMPP (10.4.32) est refusé au démarrage. Plutôt que d'imposer une montée de version risquée de XAMPP (ou de rétrograder Django en 4.2), on migre vers PostgreSQL, supporté nativement et disponible via le dépôt officiel sur Ubuntu 24.04. Le README documentera l'installation PostgreSQL comme prérequis.