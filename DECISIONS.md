# Décisions techniques


## D1 — Badge tournant : nonce signé à durée courte + anti-rejeu serveur

- **Option retenue** : à chaque scan, le badge affiche un code = `HMAC-SHA256(badge.secret, nonce || timestamp)` avec un pas de temps de 5 s et une tolérance de ±1 pas. Le serveur vérifie la signature puis consomme le `nonce` dans la table `NonceConsomme` (contrainte `UNIQUE(badge, nonce)`).
- **Options écartées** :
  - TOTP-like à 30 s : une photo du badge reste exploitable jusqu'à 30 s, insuffisant pour le scénario §3.4 « photographier puis présenter depuis un autre appareil ».
  - Code statique contenant l'identifiant de l'élève : **éliminatoire** selon §3.2.
  - Challenge-réponse : suppose un badge actif (appareil), or le badge est un support affiché, pas un émetteur.
- **Contrainte imposée à l'agent** : le badge doit être affiché *au moment* du scan (pas imprimé, pas photographié). Un scan au-delà de la fenêtre de tolérance est refusé.
- **Coût** : une table `NonceConsomme` + job de purge des nonces de plus de 24 h.


## D2 — Idempotence de la synchronisation par `event_id_local`

- **Option retenue** : chaque passage porte un `event_id_local` (UUID généré côté client au moment du scan). Contrainte `UNIQUE(badge_id, event_id_local)` en base ; insertion via `get_or_create`. Un lot rejoué ne crée pas de doublon.
- **Option écartée (niveau 2)** : `sync_batch_id` tracé dans `JournalAudit` pour compter les rejeux — utile pour l'observabilité, mais non nécessaire à la garantie « ni perdu ni dupliqué ». Mentionné comme « ce que je ferais avec plus de temps ».
- **Test associé** : `test_sync_idempotente` qui envoie deux fois le même lot et vérifie que le compte de passages ne bouge pas.


## D3 — SGBD : PostgreSQL plutôt que MariaDB (XAMPP)

- **Option retenue** : PostgreSQL 17 (dépôt PGDG), base `passage`, utilisateur applicatif `passage_app`.
- **Option écartée** : MariaDB 10.4 fourni par XAMPP.
- **Raison** : Django 5.x exige MariaDB ≥ 10.5 ; le MariaDB de XAMPP (10.4.32) est refusé au démarrage. Plutôt que d'imposer une montée de version risquée de XAMPP (ou de rétrograder Django en 4.2), on migre vers PostgreSQL, supporté nativement et disponible via le dépôt officiel sur Ubuntu 24.04. Le README documentera l'installation PostgreSQL comme prérequis.


## D4 — Retrait d'un secret de l'historique Git

- **Constat** : la `SECRET_KEY` Django générée par `django-admin startproject` figurait dans le premier commit.
- **Action** : réécriture via `git filter-repo --replace-text` avant tout push. Sauvegarde du `.git` d'origine dans `/tmp` puis suppression locale.
- **Option écartée** : repartir d'un dépôt neuf à commit unique — écarté car le sujet écarte les dépôts à commit unique et valorise un historique lisible.
- **Leçon** : `SECRET_KEY` générée et placée dans `.env` *avant* le premier commit ; `.env` dans `.gitignore` dès l'initialisation.


## D5 — Privilège `CREATEDB` pour l'utilisateur de test

- **Constat** : `pytest` échoue avec `permission denied to create database` car Django tente de créer `test_passage`.
- **Action** : `ALTER ROLE passage_app CREATEDB` (et non `SUPERUSER`), conformément à la recommandation Django pour les utilisateurs de test PostgreSQL.
- **Pourquoi pas `SUPERUSER`** : respect du principe de moindre privilège ; `CREATEDB` suffit pour créer/détruire la base de test, sans donner le droit de modifier les rôles ou de contourner les permissions.

## D6 — Isolation du cache entre tests

- **Constat** : le throttle `login` (5/min) partage son état via `LocMemCache`, qui persiste entre les tests pytest-django. Le test du logout échouait avec `429 Too Many Requests` à cause du test du throttle exécuté avant.
- **Action** : fixture `autouse` dans `backend/conftest.py` qui vide le cache avant et après chaque test.
- **Option écartée** : désactiver le throttle en test (`override_settings`) — écartée car elle empêcherait de tester le throttle lui-même, qui est une exigence §2.2.


## D7 — Anomalies produites par le seed

- **Option retenue** : `ABSENCE`, `HORS_FENETRE`, `DOUBLE_SCAN`.
- **Raison** : ces trois types couvrent les cas les plus démonstratifs en vidéo (absence silencieuse détectée sans intervention, sortie hors plage horaire, double scan rapproché). `POINT_INATTENDU` et `HORLOGE_SUSPECTE` sont couverts par les tests unitaires mais pas seedés, pour ne pas alourdir la démo.
- **Conséquence** : le seed ne crée **que** les passages ; les anomalies sont produites par la commande `detect_anomalies`, ce qui permet de démontrer le scénario §3.4 « laisser passer la fin d'une fenêtre sans scan, montrer l'anomalie apparaître sans intervention ».


## D8 — Dates du seed : date passée fixe + aujourd'hui

- **Option retenue** : passages historiques et anomalies à `2025-01-15` (mercredi) ; passages « live » de la démo à `timezone.localdate()`.
- **Raison** : la date fixe rend les tests reproductibles (pas de dépendance à la date d'exécution) ; la date du jour permet à la vidéo de montrer un scan en direct et son anomalie.
- **Option écartée** : tout à `today` — rend les tests fragiles les week-ends et jours fériés (l'itinéraire Lun–Ven ne s'applique pas).


## D11 — Un HORS_FENETRE supprime l'ABSENCE correspondante

- **Constat** : un passage hors fenêtre (ex. sortie à 14:10 pour une fenêtre 15:30–16:15) déclenchait à la fois `HORS_FENETRE` (le passage est hors plage) et `ABSENCE` (aucun passage dans la fenêtre). Le parent recevait deux messages contradictoires.
- **Option retenue** : si un passage existe sur le point mais hors fenêtre, on ne crée pas d'`ABSENCE` — le `HORS_FENETRE` porte l'information la plus précise (« présent, mais en dehors de la plage attendue »).
- **Options écartées** :
  - Créer les deux : message contradictoire au parent.
  - Créer seulement ABSENCE : faux, l'élève est passé.
- **Conséquence** : le seed produit 3 anomalies (ABSENCE E2, HORS_FENETRE E1, DOUBLE_SCAN E3) au lieu de 4.


## D13 — Passage avec horloge manifestement fausse : signaler, pas rejeter ni corriger

- **Constat** : le sujet demande ce qu'on fait d'un passage dont `heure_locale` diverge fortement de `heure_serveur` (horloge de l'appareil de l'agent déréglée).
- **Option retenue** : enregistrer le passage avec `sync_etat=REJETE_HORLOGE`, créer une anomalie `HORLOGE_SUSPECTE`, et ne pas compter le passage comme valide pour la détection d'anomalies standard. Le parent reçoit un message honnête (« le badge a été scanné à une heure suspecte »).
- **Options écartées** :
  - Rejeter le passage : on perd la donnée et l'agent ne comprend pas pourquoi le scan échoue.
  - Corriger silencieusement (`heure_locale := heure_serveur`) : on perd l'information et on masque un problème matériel.
- **Seuil** : 30 minutes (`HORLOGE_TOLERANCE_MINUTES` dans `services/anomalies.py`).
- **Lien** : réutilise la 5ᵉ anomalie `HORLOGE_SUSPECTE` déjà détectée par `detect_anomalies`.