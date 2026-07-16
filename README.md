# Kojiro ⚽

Application mobile premium pour les passionnés de football amateur. Design dark mode avec accents verts, inspirée de Strava, Instagram et EA Sports FC.

## Fonctionnalités

- **Authentification** — Email, Google et Apple
- **Profil joueur** — Photo, poste, pied fort, niveau XP, statistiques et badges
- **Accueil** — Matchs à venir, matchs proches, amis actifs et actualités
- **Création de matchs** — Formats 5v5, 7v7 et 11v11
- **Gestion des présences** — Présent, Absent, Peut-être
- **Carte interactive** — Trouver des matchs autour de soi
- **IA d'équilibrage** — Composition automatique des équipes par niveau et poste
- **Chat intégré** — Discussion par match
- **Historique & statistiques** — Buts, passes, victoires, MVP, notes
- **Classements** — Amis, villes et général
- **Tournois** — Organisation et inscription
- **Réseau social** — Highlights photos et vidéos
- **Notifications** — Temps réel (matchs, équipes, social)

## Supabase (backend)

### 1. Configurer `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> L'URL doit être la base du projet **sans** `/rest/v1/`.

### 2. Créer les tables

Dans **Supabase Dashboard → SQL Editor**, exécute le contenu de :

```
supabase/schema.sql
```

### 3. Migration 002 (notifications + classement)

Exécute aussi `supabase/migrations/002_notifications_leaderboard.sql` dans le SQL Editor.

### 4. Migration 003 (historique, tournois, actu)

Exécute `supabase/migrations/003_history_tournaments_news.sql` dans le SQL Editor.

### 5. Migration 004 (social + storage)

Exécute `supabase/migrations/004_social_storage.sql` dans le SQL Editor.

Crée la table `social_posts`, le bucket Storage `highlights` et la colonne `push_token` sur les profils.

### 6. Auth (dev)

Pour tester sans confirmation email :
**Authentication → Providers → Email → désactiver "Confirm email"**

### 7. Mot de passe oublié (obligatoire)

Flux : app ou site → email Supabase → page web **`/reset-password`** (recommandé) ; l’écran mobile reste en fallback.

Dans Supabase → **Authentication → URL Configuration**, ajoute ces **Redirect URLs** :

```
https://kojiro.app/reset-password
https://app-web-two-mauve.vercel.app/reset-password
http://localhost:3000/reset-password
kojiro://reset-password
exp://127.0.0.1:8081/--/reset-password
```

(Ajuste le domaine prod / l’URL Vercel / le port Expo Go selon ton setup.)

Côté mobile, renseigne `EXPO_PUBLIC_SITE_URL` (ex. `https://kojiro.app`) pour que le mail redirige vers le web.

Vérifie aussi :
- **Authentication → Email Templates → Reset Password** : le lien doit utiliser `{{ .ConfirmationURL }}` (ou rediriger vers `{{ .RedirectTo }}`)
- En prod : **Project Settings → Auth → SMTP** (Resend, SendGrid, etc.) — le mailer par défaut de Supabase est limité

### 8. OAuth Google / Apple (optionnel)

Dans Supabase → **Authentication → URL Configuration**, ajoute aussi :

```
kojiro://auth/callback
exp://127.0.0.1:8081/--/auth/callback
```

Active **Google** et **Apple** dans Providers et configure les clés OAuth.

### 9. Migration 005 (fin de match)

Exécute `supabase/migrations/005_complete_match.sql` dans le SQL Editor.

Permet à l'organisateur de terminer un match, enregistrer scores/stats et mettre à jour XP + historique.

### 10. Migration 006 (invitations)

Exécute `supabase/migrations/006_match_invites.sql` dans le SQL Editor.

Permet à l'organisateur d'inviter des joueurs (notification + statut `pending`).

### 11. Migration 007 (formats flexibles)

Exécute `supabase/migrations/007_flexible_match_format.sql` pour autoriser 6v6, 9v9, etc.

### 12. Migration 008 (remplaçants)

Exécute `supabase/migrations/008_substitutes.sql` pour gérer les remplaçants par équipe.

### 13. Migration 009 (amis + match privé)

Exécute `supabase/migrations/009_friendships.sql` dans le SQL Editor.

### 14. Migration 010 (position GPS des joueurs)

Exécute `supabase/migrations/010_profile_location.sql` pour stocker latitude/longitude sur les profils (carte et distances réelles).

### 15. Migration 011 (composition & formations)

Exécute `supabase/migrations/011_match_composition.sql` pour les équipes, formations tactiques et démarrage de match.

Voir le parcours complet : **`MATCH_ORGANIZATION.md`**

### 16. Migration 023 (joueurs invités sans appli)

Exécute `supabase/migrations/023_match_guest_attendees.sql` pour permettre à l'organisateur d'ajouter manuellement des joueurs sans compte Kojiro.

### 17. Relancer l'app

```bash
npm start
```

Inscription → création de match → chat en temps réel.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Expo SDK 57 + React Native |
| Navigation | Expo Router (file-based) |
| État | Zustand + AsyncStorage |
| Data fetching | TanStack React Query |
| Cartes | react-native-maps |
| Animations | Reanimated + Gesture Handler |
| UI | Design system custom (thème sombre + vert néon) |

## Architecture

```
app/
├── (auth)/          # Welcome, Login, Register
├── (tabs)/          # Accueil, Matchs, Communauté, Profil
├── match/           # Création, détail, équipes IA, chat
├── map/             # Carte des matchs
├── profile/         # Stats, historique, édition
├── rankings/        # Classements
├── tournament/      # Tournois
├── social/          # Feed highlights
└── notifications/   # Notifications

components/
├── ui/              # Button, Card, Avatar, Input, Chip...
├── home/            # Cartes match, amis, actualités
├── match/           # Joueurs, présences, équipes
├── profile/         # Niveau, badges, header
├── community/       # Podium, highlights
└── chat/            # Bulles de chat

store/               # authStore, matchStore
services/            # Prêt pour API backend
utils/               # teamBalancer (IA), formatters
types/               # Types TypeScript
data/                # Données mock (dev)
constants/           # Thème et design tokens
```

## Démarrage

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm start

# iOS
npm run ios

# Android
npm run android
```

## Prochaines étapes (production)

1. **Backend** — Supabase ou Firebase (auth, realtime, storage)
2. **API REST/GraphQL** — Remplacer les mocks dans `data/mock.ts`
3. **Push notifications** — Expo Notifications + serveur
4. **OAuth** — Configurer Google/Apple Sign-In en production
5. **Maps** — Clés API Google Maps / Mapbox
6. **Chat temps réel** — WebSockets ou Firebase Realtime
7. **Upload média** — Expo Image Picker + cloud storage

## Design

- **Background** : `#0A0A0B`
- **Primary (vert terrain)** : `#39FF14`
- **Surface cards** : `#141416` / `#1C1C1F`
- **Typography** : Bold headings, clean sans-serif
- **Components** : Coins arrondis 12-16px, ombres légères, animations press

---

Développé avec ❤️ pour la communauté du foot amateur.
