# Kojiro — Documentation produit

Document de référence : vision, personas, fonctionnalités, parcours et état d'avancement.
À mettre à jour à chaque évolution significative de l'app.

**Docs liées :**
- [README.md](./README.md) — installation et setup technique
- [MATCH_ORGANIZATION.md](./MATCH_ORGANIZATION.md) — parcours détaillé d'un match
- [DEPLOY.md](./DEPLOY.md) — déploiement, builds, migrations Supabase

---

## 1. Vision & positionnement

| | |
|---|---|
| **Nom** | Kojiro |
| **Tagline** | *Joue. Progresse. Connecte-toi. Vis le foot.* |
| **Pitch** | Application mobile pour organiser des matchs de foot amateur entre amis ou en open play, suivre ses stats, progresser (XP, badges) et rester connecté à sa communauté. |
| **Inspirations** | Strava (progression), Instagram (social/highlights), EA Sports FC (terrain, formations) |
| **Langue UI** | Français |
| **Design** | Dark mode, accent vert néon (`#39FF14`), surfaces `#141416` / `#1C1C1F` |

### Proposition de valeur

1. **Organiser un match en quelques minutes** — format, lieu, prix, visibilité
2. **Gérer l'effectif sans friction** — présences, liste d'attente, invités sans compte
3. **Composer des équipes équilibrées** — IA par niveau/poste, formations tactiques
4. **Stats collaboratives post-match** — auto-déclaration, validation capitaine, récap
5. **Communauté locale** — amis, carte, chat, highlights, classement

---

## 2. Personas

### Organisateur

Joueur qui crée et pilote un match.

- Crée le match (format, lieu, visibilité, prix)
- Gère l'effectif : invitations, joueurs sans compte, retrait, fermeture du recrutement
- Compose les équipes (IA ou manuel), désigne les capitaines, publie la composition
- Ouvre la saisie des stats, corrige et finalise le match
- Reçoit les mêmes droits qu'un joueur sur sa propre présence

**Frustrations adressées :** WhatsApp éparpillé, effectif flou, équipes déséquilibrées, stats oubliées.

### Joueur inscrit

Utilisateur avec un compte Kojiro qui rejoint des matchs.

- Confirme sa présence (présent / peut-être / absent)
- Rejoint la liste d'attente si le match est complet
- Consulte la composition, participe au chat
- Déclare ses stats et vote MVP après le match
- Consulte son profil, historique, XP et badges

### Capitaine (rôle dérivé)

Joueur présent désigné par l'organisateur pour une équipe (A ou B).

- Doit être **dans l'équipe** dont il est capitaine
- Peut placer les joueurs de son équipe sur le terrain (même après publication)
- Valide / corrige les stats de son équipe pendant la phase `pending_stats`
- Perd le rôle si retiré de l'effectif ou déplacé hors de son équipe

### Joueur sans compte (invité)

Personne ajoutée manuellement par l'organisateur (pas d'app Kojiro).

- Inscrit par nom (+ poste optionnel pour l'équilibrage IA)
- Compte dans l'effectif et la composition
- Ses stats sont saisies par le capitaine ou l'organisateur
- Ne peut pas se connecter, chatter ou déclarer ses stats

### Membre de la communauté

- Envoie / accepte des demandes d'ami
- Voit les matchs « entre amis » de ses amis
- Publie et like des highlights
- Consulte le classement amis

### Spectateur / non-inscrit

- Peut voir les matchs publics
- Matchs entre amis : accès restreint (ami de l'orga ou déjà invité)

---

## 3. Navigation & écrans

### Onglets principaux

| Onglet | Route | Rôle |
|--------|-------|------|
| Accueil | `/(tabs)/index` | Dashboard : matchs à venir, proches, amis, actu |
| Matchs | `/(tabs)/matches` | Liste filtrée + création de match |
| Communauté | `/(tabs)/community` | Amis, joueurs, classement, highlights |
| Profil | `/(tabs)/profile` | Stats, XP, badges, menu |

### Auth

| Écran | Route |
|-------|-------|
| Bienvenue | `/(auth)/welcome` |
| Inscription | `/(auth)/register` |
| Connexion | `/(auth)/login` |
| Callback OAuth | `/(auth)/auth/callback` |

### Parcours match

| Écran | Route | Description |
|-------|-------|-------------|
| Création | `/match/create` | Formulaire nouveau match |
| Détail | `/match/[id]` | Hub : présence, participants, actions orga |
| Composition | `/match/teams` | Wizard 4 étapes (équipes → form. A → form. B → valider) |
| Composition (lecture) | `/match/lineup` | Terrain en lecture seule |
| Invitations | `/match/invite` | Recherche et invitation |
| Chat | `/match/chat` | Messages temps réel |
| Stats | `/match/stats` | Saisie collaborative |
| Récap | `/match/recap` | Résultat, MVP, fair-play |

### Autres

| Écran | Route |
|-------|-------|
| Carte | `/map` |
| Notifications | `/notifications` |
| Édition profil | `/profile/edit` |
| Stats détaillées | `/profile/stats` |
| Historique | `/profile/history` |
| Classement | `/rankings` |
| Tournois | `/tournament` |
| Fil social | `/social/feed` |
| Créer un post | `/social/create-post` |

---

## 4. Cycle de vie d'un match

### Statuts

```
upcoming → live → pending_stats → completed
         ↘ cancelled
```

| Statut | Label UI | Description |
|--------|----------|-------------|
| `upcoming` | — | Recrutement, composition, préparation |
| `live` | En cours | Match démarré (RPC existant, **non branché UI**) |
| `pending_stats` | Stats en cours | Saisie collaborative des stats |
| `completed` | Terminé | Stats finalisées, XP et historique à jour |
| `cancelled` | Annulé | Match annulé |

### Sous-état recrutement

- `recruitmentClosed` : l'orga fige les inscriptions ; les joueurs peuvent encore se désister ; la waitlist peut réclamer une place libérée

### Parcours actuel (UI)

```
Créer → Présences → [Inviter / Invité sans compte] → Composition →
Ouvrir saisie stats → Auto-déclaration joueurs → Validation capitaine →
Finalisation orga → Récap
```

> **Note :** `MATCH_ORGANIZATION.md` décrit encore l'étape « Démarrer le match » (`live`). En pratique, l'orga passe directement à « Ouvrir la saisie des stats » (`pending_stats`).

### Présences

| Statut | Effet |
|--------|-------|
| `present` | Compte dans le quota et la composition |
| `maybe` | Visible, exclu de la composition |
| `absent` | Ne participe pas |
| `pending` | Invitation envoyée, en attente |
| `waitlist` | Match complet ; notif si place libre |

---

## 5. Inventaire des fonctionnalités

Légende : ✅ Fait · 🟡 Partiel · 🔲 Prévu · ⏸ Existe en base, pas dans l'UI

### Authentification & compte

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Inscription email | ✅ | |
| Connexion email | ✅ | |
| Mot de passe oublié | ✅ | Email Supabase → page web `/reset-password` (+ fallback mobile) |
| Réinitialisation MDP | ✅ | Web `app-web` + écran mobile `/(auth)/reset-password` |
| Google OAuth | ⚠️ | Dépendances présentes, UI non branchée |
| Apple Sign-In | ⚠️ | Dépendances présentes, UI non branchée |
| Création auto du profil | ✅ | Trigger Supabase |
| Notif de bienvenue | ✅ | |

### Accueil & découverte

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Matchs à venir (inscrit) | ✅ | |
| Matchs à proximité (GPS) | ✅ | |
| Amis actifs | ✅ | |
| Fil d'actualités foot | ✅ | Table `news` |
| Carte interactive | ✅ | Filtre par format |
| Filtres matchs (format, distance, scope) | ✅ | Onglet Matchs |

### Création & gestion de match

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Formats 5 à 11 joueurs/équipe | ✅ | + remplaçants 0–5 |
| Visibilité public / entre amis | ✅ | |
| Géocodage du lieu | ✅ | Nominatim |
| Prix par joueur | ✅ | |
| Fermer / rouvrir le recrutement | ✅ | |
| Inviter des joueurs (recherche) | ✅ | Statut `pending` + notif |
| Ajouter un joueur sans compte | ✅ | Label : « Ajouter un joueur sans compte » |
| Retirer un joueur (orga) | ✅ | |
| Liste d'attente | ✅ | Notif place libre |
| Panel dev remplir effectif | ✅ | `__DEV__` uniquement |

### Composition & équipes

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Équilibrage IA A/B | ✅ | Niveau, note, poste, stats |
| Répartition manuelle A/B | ✅ | |
| Sauvegarde effectifs sans formation | ✅ | Étape 1 → enregistrement auto |
| Publication effectifs seuls | ✅ | Sans placement terrain |
| Formations tactiques (pitch) | ✅ | Placement joueur → case |
| Publication composition | ✅ | Notif aux joueurs |
| Capitaines A/B | ✅ | Doivent être dans leur équipe |
| Édition capitaine après publication | ✅ | Jusqu'à `live` / stats |
| Retrait auto statut capitaine | ✅ | Migration 033–034 |
| Voir composition (lecture seule) | ✅ | |

### Pendant / après le match

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Démarrer le match (`live`) | ⏸ | RPC `start_match`, pas de bouton UI |
| Chat par match | ✅ | Temps réel + push (cooldown 15 min) |
| FAB chat sur détail match | ✅ | Badge non-lus |
| Saisie stats collaborative | ✅ | `pending_stats` |
| Auto-déclaration buts/passes/MVP | ✅ | Joueurs inscrits présents |
| Validation stats capitaine | ✅ | Par équipe, inclut invités |
| Finalisation orga (score = Σ buts) | ✅ | → `completed` |
| Récap match (scores, MVP, fair-play) | ✅ | |
| XP & historique post-match | ✅ | Formule dans §6 |

### Profil & progression

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Avatar, bio, poste, pied, ville | ✅ | |
| Niveau & barre XP | ✅ | |
| Stats saison (buts, passes, MVP, note) | ✅ | |
| Fair-play /5 | ✅ | Profil + récap |
| Badges | ✅ | JSON sur profil |
| Historique des matchs | ✅ | |
| Graphique stats | ✅ | `profile/stats` |

### Social & communauté

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Demandes d'ami | ✅ | Envoyer, accepter, refuser, annuler, retirer |
| Classement amis (XP) | ✅ | Podium |
| Classement global | 🟡 | Service existe, pas d'écran dédié |
| Classement par ville | 🔲 | Mentionné README, non implémenté |
| Highlights (photo/vidéo) | ✅ | Storage Supabase |
| Likes temps réel | ✅ | |

### Tournois

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Liste & inscription équipe | ✅ | Données seed |
| Brackets / planning matchs | 🔲 | Pas d'UI |

### Notifications

| Type | Statut |
|------|--------|
| `match_invite` | ✅ |
| `match_reminder` | ✅ |
| `match_recap` | ✅ |
| `match_stats` | ✅ |
| `match_waitlist` | ✅ |
| `team_assigned` | ✅ |
| `chat_message` | ✅ |
| `social` | ✅ |
| `tournament` | ✅ |
| `friend_request` | ✅ |
| Push Expo (appareil) | ✅ |
| Deep links | ✅ |

### UX détail match (organisateur) — dette connue

| Sujet | Statut | Notes |
|-------|--------|-------|
| Pile de boutons full-width | 🟡 | Chat → FAB fait ; reste à structurer (CTA unique, menu « Plus ») |
| Timeline orga cliquable | 🔲 | `MatchOrganizerSteps` décoratif aujourd'hui |
| Capitaines hors détail | 🔲 | Pourrait aller dans l'écran composition |
| Participants en accordéon | 🔲 | 5 listes toujours visibles |

---

## 6. Règles métier clés

### XP par match

```
XP = 50 + (buts × 10) + (passes × 5) + (MVP ? 25 : 0)
```

### Montée de niveau

- Seuil initial : 1000 XP
- +200 XP par niveau suivant

### Permissions composition

| Action | Orga | Capitaine | Joueur |
|--------|------|-----------|--------|
| Répartir équipes A/B | ✅ | ❌ | ❌ |
| Publier composition | ✅ | ❌ | ❌ |
| Éditer formation son équipe | ✅ | ✅ (son côté) | ❌ |
| Voir composition | ✅ | ✅ | ✅ |
| Désigner capitaines | ✅ | ❌ | ❌ |

### Capitaines

- Un capitaine par équipe (A et/ou B), optionnel
- Doit être **présent**, **inscrit** (pas invité sans compte) et **dans l'équipe** correspondante
- Retiré automatiquement s'il quitte l'effectif ou change d'équipe

---

## 7. Stack technique (résumé)

| Couche | Technologie |
|--------|-------------|
| Mobile | Expo SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (file-based) |
| État | Zustand + AsyncStorage |
| API | Supabase (Postgres, Auth, Realtime, Storage, RPC) |
| Requêtes | TanStack Query v5 |
| Carte | react-native-maps |
| Notifications | expo-notifications + pg_net |

**Identifiants app :** `com.kojiro.app` · scheme `kojiro://`

---

## 8. Fichiers sources importants

| Domaine | Fichiers |
|---------|----------|
| Détail match | `app/match/[id].tsx` |
| Composition | `app/match/teams.tsx`, `services/composition.ts` |
| Stats | `app/match/stats.tsx`, `services/matchStats.ts` |
| Capitaines | `components/match/CaptainPicker.tsx`, migration 027–034 |
| Présences / waitlist | `utils/matchAttendance.ts` |
| Équilibrage IA | `utils/teamBalancer.ts` |
| Formations | `utils/formations.ts`, `components/match/PitchFormation.tsx` |
| Chat | `services/messages.ts`, `hooks/useMatchChatUnread.ts` |
| Notifications | `services/notifications.ts`, `services/push.ts` |

---

## 9. Migrations Supabase (ordre)

Voir [DEPLOY.md](./DEPLOY.md) pour l'ordre complet. Dernières migrations produit :

| # | Fichier | Sujet |
|---|---------|-------|
| 031 | `match_collaborative_stats.sql` | Stats collaboratives, `pending_stats` |
| 032 | `fix_dev_fill_on_conflict.sql` | Fix dev fill |
| 033 | `clear_captain_on_roster_removal.sql` | Retrait auto capitaine |
| 034 | `captain_must_be_on_team.sql` | Capitaine dans son équipe |

---

## 10. Journal des évolutions produit

| Date | Changement |
|------|------------|
| 2026-07 | Capitaines filtrés par équipe (A/B) + validation SQL |
| 2026-07 | Sauvegarde effectifs à l'étape 1 composition (sans obligation de formation) |
| 2026-07 | Chat → FAB flottant avec badge non-lus |
| 2026-07 | Label « Ajouter un joueur sans compte » (ex « Ajouter sans appli ») |
| 2026-07 | Création de ce document `PRODUCT.md` |

---

## 11. Backlog produit (idées)

- [ ] Refonte UX détail match : CTA principal dynamique + menu « Plus »
- [ ] Timeline orga cliquable (`MatchOrganizerSteps`)
- [ ] Brancher ou supprimer le statut `live` (cohérence doc / UI)
- [ ] Classement par ville
- [ ] Tournois : brackets et matchs liés
- [x] Rappels automatiques J-0 / H-2 avant match (`058_scheduled_match_reminders.sql`)
- [ ] Partage de match (lien public / deep link)

---

*Dernière mise à jour : juillet 2026*
