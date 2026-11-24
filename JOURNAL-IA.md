# Journal d'usage de l'IA

## Outils utilisés

- **Claude (Anthropic)** : assistant principal pour la génération de code, la revue d'architecture, la rédaction des tests et de la documentation.
- **ChatGPT (OpenAI)** : ponctuellement, pour vérifier la syntaxe de `git filter-repo` et la structure d'un `manifest.webmanifest`.
- **GitHub Copilot** : non utilisé.

Tous les échanges ont donné lieu à une revue manuelle avant commit. Aucun code n'a été accepté sans avoir été lu, compris et testé.

## Usages

- Génération initiale des modèles Django, avec relecture et ajustements (contrainte `UNIQUE(badge, event_id_local)` pour l'idempotence).
- Écriture des tests pytest (auth, anomalies, sync, badge, synthèse, notification, cloisonnement).
- Proposition d'architecture pour le badge tournant (D1) et l'idempotence (D2).
- Rédaction du `DECISIONS.md` à partir des choix tranchés par le candidat.

## Corrections et refus motivés

### Correction 1 — Timezone dans la détection d'absence

L'assistant comparait `heure_locale` (stocké en UTC) avec `fin_fenetre` construite en `Africa/Douala`. Résultat : fausse anomalie `ABSENCE` sur E1, dont le passage d'entrée (07:15 Douala = 06:15 UTC) tombait hors de la fenêtre 07:00–07:45 Douala.

Détecté en exécutant `detect_anomalies` sur le seed : 4 anomalies au lieu de 3.

Corrigé en filtrant côté Django par `heure_locale__date=jour` (Django applique `TIME_ZONE`) puis en vérifiant en Python via `timezone.localtime(h).time()`. Test : `test_detecter_anomalies_historique`.

### Correction 2 — `HORS_FENETRE` vs `ABSENCE` contradictoires

L'assistant créait les deux anomalies quand un passage existait hors fenêtre mais que la fenêtre était vide. Le parent recevait deux messages contradictoires.

Décision : un `HORS_FENETRE` supprime l'`ABSENCE` correspondante (D11). Test : `test_detection_idempotente` (total = 3).

### Correction 3 — Import de mauvais module dans `urls.py`

Deux erreurs : `from .views_passage import ...` alors que le module s'appelle `views_sync.py`, et un fichier `views_auth,py` (virgule au lieu du point). Détecté par `pytest` (`ModuleNotFoundError`), corrigé. Leçon : les tests ont joué leur rôle de filet.

### Correction 4 — Doublon de `get_provider()` dans `ai.py`

Deux définitions de `get_provider()`, la seconde sans `base_url`. Python utilise la dernière définie → la configuration Groq était silencieusement ignorée (`base_url=None`). Détecté avec `grep -n "def get_provider"`. Supprimé la seconde. Leçon : les tests avec `FakeProvider` ne voient pas les bugs de configuration ; il faut aussi tester `get_provider()` directement.

### Correction 5 — Plafond de notification compté par `MessageSortant.date`

L'assistant comptait avec `MessageSortant.date__date=jour`. En test, les anomalies sont datées `2025-01-15`, les `MessageSortant` insérés aujourd'hui (`auto_now_add`) → compteur à 0, plafond inopérant. Corrigé en comptant par `anomalie__date=jour` (D20), sémantiquement plus juste.

### Refus — Utilisation d'un secret en clair

Une clé API a été collée par erreur dans une session de chat. Elle a été **révoquée** immédiatement, une nouvelle clé générée, et le dépôt vérifié (`git log --all -S "gsk_"` → aucune ligne). Leçon : les secrets ne doivent jamais transiter par un canal non chiffré ; `.env` ignoré dès l'initialisation (D4).