# Passage — Afric'Éduc

Suivi des passages d'élèves par badge, en conditions de réseau dégradé, avec synthèse assistée par IA.

## Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Backend | Django 5.1 + Django REST Framework | ORM sûr, admin intégré, écosystème mature |
| Base de données | PostgreSQL 17 | Supporté par Django 5.x (MariaDB 10.4 de XAMPP refusé) |
| Auth | JWT simplejwt + blacklist | Déconnexion effective, contrôle de rôle serveur |
| Frontend | Next.js 15 + TypeScript | Choix ; le sujet autorise HTML/JS simple |
| Mode hors ligne | IndexedDB (front) + `event_id_local` (back) | Idempotence via `UNIQUE(badge, event_id_local)` |
| IA | Groq (compatible OpenAI) + `GabaritProvider` fallback | Mode dégradé obligatoire, coût plafonné |

Décisions détaillées : `DECISIONS.md`.

## Installation

### Prérequis

- Python 3.12+
- PostgreSQL 17
- Node.js 20+ et npm

### Base de données

```bash
sudo apt install -y postgresql-17
sudo -u postgres psql <<'SQL'
CREATE DATABASE passage WITH ENCODING 'UTF8';
CREATE USER passage_app WITH PASSWORD 'ChangeMe_2026!';
GRANT ALL PRIVILEGES ON DATABASE passage TO passage_app;
ALTER DATABASE passage OWNER TO passage_app;
ALTER ROLE passage_app CREATEDB;
SQL





cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env
# Éditer ../.env : DJANGO_SECRET_KEY, DB_PASSWORD, AI_API_KEY si mode assisté
python manage.py migrate
python manage.py seed_demo




cd frontend
npm install



# Terminal 1 — Django
cd backend && source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Terminal 2 — Next.js
cd frontend && npm run dev





Comptes de test
Rôle	Identifiant	Mot de passe	Enfants
Responsable	responsable	Responsable!2026	—
Agent	agent01	Agent!2026	—
Parent	parent1	Parent1!2026	E1, E2
Parent	parent2	Parent2!2026	E3




Commandes métier
bash
cd backend

python manage.py seed_demo
python manage.py detect_anomalies --date 2025-01-15
python manage.py notifier_anomalies --date 2025-01-15
python manage.py synthese_jour --classe "6e A" --date 2025-01-15




Tests
bash
cd backend
pytest passage/tests/ -v