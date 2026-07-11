# Notifications Kojiro

Référence des actions qui créent une entrée dans `public.notifications` (in-app + push Expo).

**Dernière mise à jour :** 2026-07-10

> Lors de l'ajout ou la modification d'une notification, mettre à jour ce fichier en même temps que le code.

---

## Infrastructure

| Mécanisme | Fichier / objet | Rôle |
|-----------|-----------------|------|
| Insertion app | `services/notifications.ts` → `createNotification()` | Crée une notif depuis le client |
| Push Expo | Trigger SQL `trg_send_push_for_notification` | Envoie un push après chaque `INSERT` (migration `017`, cooldown chat dans `021`) |
| Temps réel | `subscribeToNotifications()` dans `services/notifications.ts` | Rafraîchit la liste in-app via Supabase Realtime |
| Accès chat | `can_access_match_chat()` (migration `042`) + `canAccessMatchChat()` | Organisateur + inscrits `present` / `maybe` / `waitlist` / `pending` |
| Types TypeScript | `types/index.ts` → `Notification['type']` | Union des types supportés |
| Écran liste | `app/notifications/index.tsx` | Filtres lu/non lu, pagination au scroll, « Tout lire » |
| Token push | `services/push.ts` → `registerPushToken()` | Enregistre `profiles.push_token` |

### Push

- Toute notif insérée déclenche un push si l'utilisateur a un `push_token` Expo valide.
- **Chat** (`chat_message`) : cooldown push de **15 min** par couple `(user_id, match_id)` via `chat_push_cooldown`.
- Si le push échoue, l'insertion in-app n'est pas bloquée.

### RLS insert (résumé)

L'organisateur peut insérer `match_invite`, `match_reminder`, `team_assigned` pour les joueurs de ses matchs. L'expéditeur peut insérer `friend_request`. Sinon, seul `auth.uid() = user_id` (notif à soi-même).

---

## Catalogue des notifications

### `social` — Bienvenue

| Champ | Valeur |
|-------|--------|
| **Action** | Création du profil utilisateur |
| **Source** | SQL trigger `on_profile_welcome_notification` sur `profiles` |
| **Fichier** | `supabase/migrations/002_notifications_leaderboard.sql` |
| **Destinataire** | Nouvel utilisateur |
| **Titre** | Bienvenue sur Kojiro ! ⚽ |
| **Corps** | Crée ton premier match et invite tes amis à rejoindre. |
| **data** | — |

**Fallback app :** `ensureWelcomeNotification()` dans `services/notifications.ts` — crée la même notif si l'utilisateur n'en a aucune (évite le doublon si le trigger SQL a déjà tourné).

---

### `match_reminder` — Match créé

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur crée un match |
| **Source** | App |
| **Fichier** | `store/matchStore.ts` → `createMatch()` |
| **Destinataire** | Organisateur |
| **Titre** | Match créé ! |
| **Corps** | `"{titre}"` est prêt. Invite des joueurs ! |
| **data** | `{ matchId }` |

---

### `friend_match_created` — Ami a créé un match

| Champ | Valeur |
|-------|--------|
| **Action** | Un match est inséré |
| **Source** | SQL trigger `trg_notify_friends_on_match_created` |
| **Fichier** | `supabase/migrations/035_friend_match_created_notifications.sql` |
| **Destinataire** | Tous les amis acceptés de l'organisateur |
| **Titre** | Nouveau match |
| **Corps** | `{nom orga}` a créé « `{titre}` » |
| **data** | `{ matchId, organizerId }` |

---

### `match_invite` — Invitation au match

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur invite un joueur |
| **Source** | SQL RPC `invite_to_match` |
| **Fichier** | `supabase/migrations/006_match_invites.sql` (versions ultérieures : `019`, `024`, `026`) |
| **Appel app** | `services/invites.ts` → écran `app/match/invite.tsx` |
| **Destinataire** | Joueur invité |
| **Titre** | Invitation au match |
| **Corps** | `{nom orga}` t'invite à « `{titre}` » |
| **data** | `{ matchId, inviterId? }` |

---

### `match_reminder` — Retiré du match

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur retire un joueur inscrit |
| **Source** | SQL RPC `remove_attendee_by_organizer` ou `remove_attendee_by_id` |
| **Fichier** | `supabase/migrations/016_organizer_remove_attendee.sql`, `019_lock_attendance.sql`, `023_match_guest_attendees.sql` |
| **Destinataire** | Joueur retiré (compte Kojiro uniquement) |
| **Titre** | Retiré du match |
| **Corps** | L'organisateur t'a retiré de « `{titre}` ». |
| **data** | `{ matchId }` |

> Note : le type est `match_reminder` (pas un type dédié « retrait »).

---

### `match_waitlist` — Place libérée

| Champ | Valeur |
|-------|--------|
| **Action** | Un joueur `present` change de statut (désistement) |
| **Source** | SQL trigger `trg_notify_waitlist_spot` → `notify_waitlist_spot_available()` |
| **Fichier** | `supabase/migrations/015_match_waitlist.sql` |
| **Destinataire** | Tous les joueurs en `waitlist` sur ce match |
| **Titre** | Une place s'est libérée ! |
| **Corps** | Un joueur s'est désisté de « `{titre}` ». Sois le premier à confirmer… |
| **data** | `{ matchId }` |

---

### `team_assigned` — Capitaine désigné

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur enregistre un **nouveau** capitaine (A ou B) |
| **Source** | App (après RPC `assign_match_captains`) |
| **Fichier** | `app/match/[id].tsx` → `handleSaveCaptains()` |
| **Destinataire** | Nouveau(x) capitaine(s) — pas l'organisateur, pas un capitaine inchangé |
| **Titre** | Capitaine désigné |
| **Corps** | Tu es capitaine pour « `{titre}` ». Compose ton équipe depuis le match. |
| **data** | `{ matchId }` |

**Ne notifie pas :** retrait du rôle capitaine, remplacement sans changement d'id, auto-désignation par l'orga.

---

### `team_assigned` — Composition publiée

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur publie la composition (`publish: true`) |
| **Source** | App |
| **Fichier** | `app/match/teams.tsx` |
| **Destinataire** | Tous les joueurs des deux équipes (sauf orga, hors invités `guest:`) |
| **Titre** | Composition publiée |
| **Corps** | Les équipes sont publiées pour « `{titre}` ». |
| **data** | `{ matchId }` |

**Ne notifie pas :** sauvegarde brouillon sans publication.

---

### `chat_message` — Message chat match

| Champ | Valeur |
|-------|--------|
| **Action** | Nouveau message texte/image dans le chat d'un match |
| **Source** | SQL trigger `trg_notify_match_chat_message` |
| **Fichier** | `supabase/migrations/021_chat_notifications.sql` |
| **Destinataire** | Participants au match (`present`, `maybe`, `waitlist`, `pending`) sauf l'expéditeur |
| **Titre** | `{nom expéditeur}` · `{titre match}` |
| **Corps** | Extrait du message (120 car. max) |
| **data** | `{ matchId, messageId, chat: "true" }` |

**Ignoré :** messages `system` ou sans `sender_id`.

---

### `match_stats` — Saisie des stats ouverte

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur ouvre la saisie des stats (score + roster) |
| **Source** | SQL RPC `open_match_stats` |
| **Fichier** | `supabase/migrations/031_match_collaborative_stats.sql` |
| **Appel app** | `services/matchStats.ts` |
| **Destinataire** | Joueurs `present` avec compte (`user_id` non null) |
| **Titre** | Saisis tes stats |
| **Corps** | « `{titre}` » — Indique tes buts, passes et vote pour le MVP. |
| **data** | `{ matchId, stats: "true" }` |

---

### `match_recap` — Résumé du match

| Champ | Valeur |
|-------|--------|
| **Action** | L'organisateur finalise les stats du match |
| **Source** | SQL RPC `finalize_match_stats` |
| **Fichier** | `supabase/migrations/029_match_recap_notifications.sql` (logique reprise dans `031`, `036`, `037`, `038`) |
| **Appel app** | `services/matchStats.ts` |
| **Destinataire** | Joueurs `present` avec compte |
| **Titre** | Résumé du match disponible |
| **Corps** | « `{titre}` » — Score : `{score}`. Consulte buteurs, passes et composition. |
| **data** | `{ matchId, recap: "true" }` |

---

### `friend_request` — Demande d'ami

| Champ | Valeur |
|-------|--------|
| **Action** | Envoi d'une demande d'ami |
| **Source** | App |
| **Fichier** | `store/friendStore.ts` → `sendRequest()` |
| **Destinataire** | Utilisateur ciblé |
| **Titre** | Demande d'ami |
| **Corps** | `{nom}` souhaite t'ajouter en ami |
| **data** | `{ fromUserId }` |

**Ne notifie pas :** acceptation, refus, annulation, suppression d'ami.

---

### `tournament` — Inscription tournoi

| Champ | Valeur |
|-------|--------|
| **Action** | Inscription à un tournoi |
| **Source** | App |
| **Fichier** | `app/tournament/index.tsx` → `handleRegister()` |
| **Destinataire** | Utilisateur inscrit (à lui-même) |
| **Titre** | Inscription confirmée |
| **Corps** | Tu es inscrit au `{nom tournoi}` |
| **data** | `{ tournamentId }` |

---

## Actions sans notification (à ce jour)

| Action | Fichier / RPC concerné |
|--------|------------------------|
| Modification du nombre de remplaçants | `organizer_update_substitutes` — `039_organizer_update_substitutes.sql` |
| Sauvegarde composition (brouillon) | `save_match_composition` sans `publish` |
| Validation des stats par un capitaine | `captain_save_team_stats` |
| Retrait du rôle de capitaine | `assign_match_captains` (pas de notif côté app) |
| Acceptation / refus demande d'ami | `friendStore` |
| Confirmation de présence / liste d'attente (inscription) | `upsert_attendance` |
| Clôture du recrutement | `close_match_recruitment` |

---

## Navigation au tap (in-app)

Définie dans `app/notifications/index.tsx` → `getNotificationRoute()` :

| Type | Destination |
|------|-------------|
| `chat_message` | `/match/chat?id={matchId}` |
| `match_recap` | `/match/recap?id={matchId}` |
| `match_stats` | `/match/stats?id={matchId}` |
| `match_invite`, `match_reminder`, `team_assigned`, `match_waitlist`, `friend_match_created` | `/match/{matchId}` |
| `tournament` | `/tournament` |
| `social` | `/social/feed` |
| `friend_request` | `/(tabs)/community` |

---

## Checklist — ajouter une nouvelle notification

1. Choisir ou ajouter un `type` dans `types/index.ts`.
2. Créer la notif (app via `createNotification` **ou** SQL trigger/RPC).
3. Vérifier la policy RLS `notifications_insert_own` si insertion depuis l'app vers un autre utilisateur.
4. Ajouter l'icône dans `NOTIF_ICONS` (`app/notifications/index.tsx`) si nouveau type.
5. Ajouter la route dans `getNotificationRoute()` si navigation spécifique.
6. **Mettre à jour ce fichier.**
