
# Passage — Afric'Éduc

Suivi des passages d'élèves par badge, en conditions de réseau dégradé, avec synthèse assistée par IA.

## Sommaire

- [Passage — Afric'Éduc](#passage--africéduc)
  - [Sommaire](#sommaire)
  - [Stack technique](#stack-technique)
  - [Installation](#installation)
    - [Prérequis](#prérequis)
    - [Base de données](#base-de-données)
    - [Backend](#backend)
    - [Frontend](#frontend)
  - [Lancement](#lancement)
  - [Comptes de test](#comptes-de-test)
  - [Commandes métier](#commandes-métier)
    - [Planification en production](#planification-en-production)
  - [Tests](#tests)
  - [Sécurité](#sécurité)
    - [Ce que je ferais de plus avec davantage de temps](#ce-que-je-ferais-de-plus-avec-davantage-de-temps)
  - [Mode dégradé](#mode-dégradé)
  - [Décisions](#décisions)
  - [Ce qui n'est pas terminé](#ce-qui-nest-pas-terminé)
  - [Commit](#commit)

## Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Backend | Django 5.1 + Django REST Framework | ORM sûr, admin intégré, écosystème mature |
| Base de données | PostgreSQL 17 | Supporté par Django 5.x (MariaDB 10.4 de XAMPP refusé au démarrage) |
| Auth | JWT simplejwt + blacklist | Déconnexion effective, contrôle de rôle serveur |
| Frontend | Next.js 15 + TypeScript | Choix du candidat ; le sujet autorise HTML/JS simple |
| Mode hors ligne | IndexedDB (front) + `event_id_local` (back) | Idempotence via `UNIQUE(badge, event_id_local)` |
| IA | Groq (compatible OpenAI) + `GabaritProvider` fallback | Mode dégradé obligatoire, coût plafonné |

Les arbitrages détaillés sont dans `DECISIONS.md` (D1 à D24).

## Installation

### Prérequis

- Python 3.12+
- PostgreSQL 17 (ou 14+)
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
```

`ALTER ROLE passage_app CREATEDB` est nécessaire pour que `pytest` puisse créer la base de test `test_passage`.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env
# Éditer ../.env : DJANGO_SECRET_KEY, DB_PASSWORD, AI_API_KEY si mode assisté
python manage.py migrate
python manage.py seed_demo
```

### Frontend

```bash
cd frontend
npm install
```

## Lancement

Trois terminaux (ou `tmux`/`screen`) :

```bash
# Terminal 1 — Django
cd backend && source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Terminal 2 — Next.js
cd frontend && npm run dev

# Terminal 3 — commandes métier (voir ci-dessous)
```

Application accessible sur http://localhost:3000. Le proxy Next.js (`next.config.ts`) redirige `/api/*` vers Django sur `:8000`.

Sur téléphone (même Wi-Fi) :

```bash
# Terminal 2
npm run dev -- --hostname 0.0.0.0
# Ouvrir http://<IP_locale>:3000 sur le téléphone
```

## Comptes de test

Créés par `python manage.py seed_demo` :

| Rôle | Identifiant | Mot de passe | Enfants |
|---|---|---|---|
| Responsable | `responsable` | `Responsable!2026` | — |
| Agent de portail | `agent01` | `Agent!2026` | — |
| Parent | `parent1` | `Parent1!2026` | E1, E2 (fratrie) |
| Parent | `parent2` | `Parent2!2026` | E3 |

Cinq élèves (`E1` à `E5`), deux points de contrôle (`Portail entrée`, `Portail sortie`), itinéraires Lun–Ven, passages historiques au `2025-01-15` produisant trois anomalies.

## Commandes métier

```bash
cd backend

# Réinitialise les données de démo (idempotent)
python manage.py seed_demo

# Détecte les anomalies d'une journée
python manage.py detect_anomalies --date 2025-01-15

# Envoie les notifications parent (plafond PARENT_MSG_DAILY_CAP)
python manage.py notifier_anomalies --date 2025-01-15

# Produit (ou réutilise) la synthèse d'une classe
python manage.py synthese_jour --classe "6e A" --date 2025-01-15
```

### Planification en production

La détection d'anomalies doit tourner sans que personne n'ouvre l'application. En production :

```cron
*/5 * * * * cd /chemin/vers/backend && .venv/bin/python manage.py detect_anomalies
```

Démonstration : `crontab -l` affiche la ligne, l'anomalie `ABSENCE` apparaît à la clôture de la fenêtre sans intervention manuelle.

## Tests

```bash
cd backend
pytest passage/tests/ -v
```

**30 tests**, tous verts, exécutés par GitHub Actions à chaque push.

Couverture des scénarios §3.4 du sujet :

| Scénario | Test |
|---|---|
| 20 scans hors ligne → 20 passages | `test_sync::test_20_passages_20_en_base` |
| Rejeu de lot → pas de doublon | `test_sync::test_rejeu_idempotent` |
| Photo du badge → refus | `test_badge::test_code_rejoue_refuse` |
| Horloge fausse → signalée | `test_sync::test_horloge_fausse_rejetee` |
| Parent change l'ID dans l'URL → 404 | `test_cloisonnement::test_parent_change_id_dans_url_refuse_404` |
| Synthèse sans clé → exacte | `test_synthese::test_mode_degrade_sans_cle_gabarit_exact` |
| Absence détectée sans intervention | `test_anomalies::test_detecter_anomalies_historique` |

## Sécurité

Chaque point de la section 2.2 du sujet :

- **Mots de passe hachés et validés** : `set_password` Django (PBKDF2 par défaut). Le responsable peut modifier son mot de passe après vérification de l'ancien; le nouveau est validé par les règles Django configurées : 8 caractères minimum, pas de mot de passe courant, pas de mot de passe entièrement numérique, et pas de ressemblance excessive avec ses informations personnelles.
- **Compte responsable** : l'identifiant et le nom affiché sont modifiables depuis « Mon compte »; le rôle reste contrôlé côté serveur et ne peut pas être modifié par cette interface.
- **Tentatives limitées** : throttle DRF `login: 5/min` ; message d'erreur identique que l'identifiant existe ou non (`LoginSerializer` → « Identifiants invalides »).
- **Session/JWT à durée limitée, déconnexion effective** : JWT access 30 min, refresh 1 jour, `LogoutView` blackliste le refresh (table `token_blacklist`).
- **Contrôle de rôle serveur** : permissions `EstResponsable`, `EstAgent`, `EstParent` dans `passage/permissions.py`. Test : `test_cloisonnement::test_agent_interdit_sur_endpoint_parent`.
- **Cloisonnement des données** : filtre `parents__parent=request.user` avant `get_object_or_404` ; renvoie 404 (pas 403) pour ne pas révéler l'existence d'un élève d'un autre parent. Test : `test_parent_change_id_dans_url_refuse_404`.
- **Validation côté serveur** : serializers DRF stricts (`PassageSyncLotSerializer` refuse un lot > 500, `event_id_local` doit être un UUID).
- **Requêtes paramétrées / ORM** : aucune concaténation SQL. `get_or_create`, `filter`, `update_or_create`.
- **XSS** : React échappe par défaut ; pas de `dangerouslySetInnerHTML`.
- **Secrets** : tous dans `.env` (ignoré par Git). `.env.example` documente les variables sans valeurs réelles. L'historique Git a été purgé d'un secret accidentel (D4, `git filter-repo`).

### Ce que je ferais de plus avec davantage de temps

- Rate limiting par IP en plus du throttle par utilisateur (django-ratelimit).
- `SECURE_HSTS_SECONDS`, cookies `Secure`/`HttpOnly` durcis en production.
- Rotation des `Badge.secret` avec période de recouvrement.
- Audit des connexions échouées (table dédiée).
- Tests de charge sur `/api/passages/sync/` (500 passages × N agents).

## Mode dégradé

L'application fonctionne sans clé API :

- **Sans `AI_API_KEY`** : `get_provider()` retourne `GabaritProvider`, la synthèse est produite à partir d'un gabarit exact. Test : `test_mode_degrade_sans_cle_gabarit_exact`.
- **Avec clé mais service en erreur** : 1 retry puis bascule gabarit (`generer_synthese`). Le chemin (`MODELE`, `RETRY`, `GABARIT`, `PLAFOND`) est tracé dans `JournalAppelIA`.
- **Plafond atteint** (`AI_COST_CAP_EUR_PER_DAY`) : pas d'appel, gabarit, tracé `PLAFOND`.
- **Hors ligne (agent)** : les scans sont stockés en `IndexedDB` et synchronisés au retour du réseau. Endpoint `POST /api/passages/sync/`, idempotent via `UNIQUE(badge, event_id_local)`.

Vérification en démo :

```bash
# 1. Vider AI_API_KEY dans .env
# 2. Relancer la synthèse
python manage.py synthese_jour --classe "6e A" --date 2025-01-15
# → [GABARIT] texte exact
```

## Décisions

Voir `DECISIONS.md` (24 décisions, chacune avec option retenue, option écartée, raison).

## Ce qui n'est pas terminé

- **Frontend Next.js** : les 3 pages (login, scan, parent) sont en cours au moment du rendu. Le backend expose tous les endpoints nécessaires (`/api/auth/login/`, `/api/passages/sync/`, `/api/parent/enfants/…`) ; la partie frontend est un consommateur direct.
- **Capsule de communication** : à produire (lien à ajouter dans le courriel de rendu).
- **Tests end-to-end** (Playwright) : non écrits. Priorité donnée aux tests de service et d'API.
- **Notification SMS réelle** : `NotificationProvider` est abstrait, `ConsoleProvider` est utilisé. Brancher Twilio/Africa's Talking consiste à implémenter `envoyer`, sans toucher au reste.
```

Sauvegarde : `Ctrl+O`, `Entrée`, `Ctrl+X`.

## Vérification immédiate

```bash
cd ~/Bureau/passage-afric-educ
wc -l README.md
tail -5 README.md
grep -c "^## " README.md
```

Attendu :
- `wc -l` → **~200 lignes**,
- `tail -5` → « Notification SMS réelle : `NotificationProvider` est abstrait… »,
- `grep -c "^## "` → **10 sections** (Sommaire, Stack, Installation, Lancement, Comptes, Commandes, Tests, Sécurité, Mode dégradé, Décisions, Ce qui n'est pas terminé → 11 en fait, mais l'important est que ce soit > 5).

Si `wc -l` donne encore ~94, ou si `tail -5` montre `-vaurluce@aurluce`, le copier-coller a échoué. **Recommence** : `nano README.md`, `Ctrl+K` jusqu'à ce que le fichier soit vide, colle, sauvegarde. Ne valide que quand `wc -l` affiche > 180.

## Commit

```bash
cd ~/Bureau/passage-afric-educ
git add README.md
git -c user.name="Aurluce" -c user.email="aurlucefeudjio8@gmail.com" commit -m "docs(readme): README complet (stack, installation, tests, sécurité, mode dégradé, reste à faire)"
git log --oneline
```

