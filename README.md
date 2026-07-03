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

### 5. Auth (dev)

Pour tester sans confirmation email :
**Authentication → Providers → Email → désactiver "Confirm email"**

### 4. Relancer l'app

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
