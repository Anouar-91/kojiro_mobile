# Guide de déploiement — Kojiro

Référence des commandes pour installer, configurer Supabase, tester sur téléphone et publier sur iOS / Android.

---

## Prérequis

- **Node.js** 18+ et **npm**
- Compte [Expo](https://expo.dev) (gratuit)
- Compte [Supabase](https://supabase.com) (gratuit)
- Pour build natif iOS : compte **Apple Developer** (99 €/an)
- Pour build Android store : compte **Google Play Console** (25 $ une fois)

Identifiants de l'app :

| Plateforme | Valeur |
|------------|--------|
| Nom | Kojiro |
| Bundle ID iOS | `com.kojiro.app` |
| Package Android | `com.kojiro.app` |
| SKU App Store | `kojiro-ios` |
| Scheme deep link | `kojiro://` |
| EAS Project ID | `82c43213-77bf-4227-9fb2-fce80d51c335` |

---

## 1. Installation locale

```bash
cd /Applications/PROJECTS/app-football

# Installer les dépendances
npm install

# Copier et remplir les variables d'environnement
cp .env.example .env
```

Contenu de `.env` :

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> L'URL Supabase = base du projet **sans** `/rest/v1/`.

---

## 2. Supabase — base de données

Dans **Supabase Dashboard → SQL Editor**, exécuter **dans l'ordre** :

```text
supabase/schema.sql
supabase/migrations/002_notifications_leaderboard.sql
supabase/migrations/003_history_tournaments_news.sql
supabase/migrations/004_social_storage.sql
supabase/migrations/005_complete_match.sql
supabase/migrations/006_match_invites.sql
supabase/migrations/007_flexible_match_format.sql
supabase/migrations/008_substitutes.sql
supabase/migrations/009_friendships.sql
supabase/migrations/010_profile_location.sql
supabase/migrations/011_match_composition.sql
supabase/migrations/023_match_guest_attendees.sql
supabase/migrations/024_match_recruitment_closed.sql
supabase/migrations/025_guest_position.sql
supabase/migrations/027_match_captains.sql
supabase/migrations/028_captain_edit_after_publish.sql
supabase/migrations/029_match_recap_notifications.sql
supabase/migrations/030_match_recap_fair_play.sql
supabase/migrations/031_match_collaborative_stats.sql
supabase/migrations/032_fix_dev_fill_on_conflict.sql
```

### Auth (développement)

Dans **Authentication → Providers → Email** :

- Désactiver **Confirm email** pour tester sans validation mail

### OAuth (optionnel)

Dans **Authentication → URL Configuration**, ajouter :

```text
kojiro://auth/callback
exp://127.0.0.1:8081/--/auth/callback
```

### Comptes démo (20 joueurs)

```bash
# Optionnel : ajouter SUPABASE_SERVICE_ROLE_KEY dans .env pour plus de fiabilité
npm run seed:users
```

Comptes créés : `anouar+1@bhgroupe.fr` … `anouar+20@bhgroupe.fr`  
Mot de passe : `Kojiro2026!`

---

## 3. Développement local

```bash
# Démarrer Metro (Expo)
npm start

# Simulateur iOS (Mac + Xcode)
npm run ios

# Émulateur Android
npm run android

# Web
npm run web
```

Raccourcis dans le terminal Expo :

| Touche | Action |
|--------|--------|
| `i` | Ouvrir simulateur iOS |
| `a` | Ouvrir émulateur Android |
| `r` | Recharger l'app |
| `m` | Menu développeur |

---

## 4. Tester sur ton téléphone (Expo Go)

Le plus rapide, sans build.

```bash
npm start
```

- **iPhone** : installer [Expo Go](https://apps.apple.com/app/expo-go/id982107779) → scanner le QR code
- **Android** : installer [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) → scanner le QR

Mac et téléphone sur le **même Wi‑Fi**. Si ça ne connecte pas :

```bash
npx expo start --tunnel
```

> Les push notifications et l'icône personnalisée ne fonctionnent pas en Expo Go.

---

## 5. EAS — configuration initiale (une fois)

```bash
# Installer EAS CLI (ou utiliser npx)
npm install -g eas-cli

# Se connecter à Expo
eas login

# Lier le projet (déjà fait si eas.json existe)
eas build:configure
```

---

## 6. Build iOS — install directe sur iPhone (preview)

Pour installer l'app sur ton iPhone sans TestFlight (build interne / ad hoc).

```bash
npx eas build --platform ios --profile preview
```

Réponses typiques aux questions EAS :

| Question | Réponse |
|----------|---------|
| Log in to Apple account? | **Yes** |
| Reuse distribution certificate? | **Y** |
| Register devices? | **Y** → **Website** → ouvrir le lien sur l'iPhone |
| Push Notifications? | **No** (pour l'instant) |
| Standard/exempt encryption? | **Y** |
| Generate new Provisioning Profile? | **Y** |

### Enregistrer un nouvel iPhone plus tard

```bash
eas device:create
```

### Activer le mode développeur (iPhone, iOS 16+)

```text
Réglages → Confidentialité et sécurité → Mode développeur → ON → Redémarrer
```

### Installer le build terminé

À la fin du build, EAS affiche un **lien de téléchargement** → ouvrir sur l'iPhone → installer.

Suivre le build en cours :

```bash
eas build:list
```

---

## 7. Build iOS — TestFlight (beta / App Store)

### Créer l'app dans App Store Connect (une fois)

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Mes apps** → **+** → Nouvelle app
3. Nom : **Kojiro**
4. Bundle ID : `com.kojiro.app`
5. SKU : `kojiro-ios`

### Capabilities Apple (App ID)

Cocher uniquement :

- **Push Notifications** (optionnel pour l'instant)
- **Sign in with Apple** (si OAuth Apple activé)

Ne pas cocher le reste. Localisation / caméra / photos = géré dans `app.json` (`infoPlist`).

### Build production

```bash
npx eas build --platform ios --profile production
```

Réponses : identiques au build preview (certificat **Y**, encryption **Y**, provisioning profile **Y**).

### Envoyer sur App Store Connect

```bash
npx eas submit --platform ios --latest
```

Ou build + submit en une commande :

```bash
npx eas build --platform ios --profile production --auto-submit
```

**Mot de passe spécifique aux apps** (pas le mot de passe Apple) :  
[appleid.apple.com](https://appleid.apple.com) → Connexion et sécurité → Mots de passe spécifiques aux apps

### TestFlight

1. App Store Connect → **Kojiro** → **TestFlight**
2. Attendre le traitement Apple (5–30 min)
3. **Testeurs internes** : ajouter ton Apple ID → installer via l'app **TestFlight**

> TestFlight ne nécessite pas le mode développeur ni l'enregistrement UDID.

---

## 8. Build Android

### APK interne (test direct)

```bash
npx eas build --platform android --profile preview
```

Télécharger l'APK depuis le lien EAS et l'installer sur l'appareil (autoriser sources inconnues).

### AAB production (Google Play)

```bash
npx eas build --platform android --profile production
```

Soumettre :

```bash
npx eas submit --platform android --latest
```

---

## 9. Icônes et splash

Fichiers à placer dans `assets/images/` :

| Fichier | Usage | Taille |
|---------|-------|--------|
| `icon.png` | Icône iOS + notifications | 1024×1024 |
| `splash-icon.png` | Écran de démarrage | ~512 px, fond transparent OK |
| `android-icon-foreground.png` | Logo Android (avant-plan) | 1024×1024 |
| `android-icon-background.png` | Fond Android | 1024×1024, `#0A0A0B` |
| `favicon.png` | Web | 48×48 |

Après modification des icônes, **refaire un build EAS** (pas seulement `npm start`).

---

## 10. Mettre à jour une version

Avant chaque nouveau build store :

1. Incrémenter `"version"` dans `app.json` (ex. `1.0.0` → `1.0.1`)
2. Le `buildNumber` iOS est auto-incrémenté via `eas.json` (`autoIncrement: true`)

```bash
# Exemple : nouvelle version TestFlight
npx eas build --platform ios --profile production --auto-submit
```

---

## 11. Variables d'environnement en production

Les variables `EXPO_PUBLIC_*` sont **compilées dans le build** au moment du build EAS.

Pour des secrets côté EAS (recommandé en prod) :

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxxx.supabase.co"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbG..."
```

Lister les secrets :

```bash
eas secret:list
```

> Vérifier que `.env` est correct **avant** de lancer un build production.

---

## 12. Push notifications (plus tard)

1. Créer une clé **APNs** dans Apple Developer
2. Configurer dans [expo.dev](https://expo.dev) → projet Kojiro → Credentials
3. Ou relancer :

```bash
eas credentials
```

Répondre **Yes** à Push Notifications lors du prochain build.

### Rappels match (J-0 / H-2)

Migration : `supabase/migrations/058_scheduled_match_reminders.sql`

1. Activer l'extension **pg_cron** (Dashboard → Database → Extensions)
2. Exécuter la migration dans le SQL Editor
3. Vérifier le job :

```sql
SELECT * FROM cron.job WHERE jobname = 'kojiro-match-reminders';
-- Test manuel :
SELECT public.send_scheduled_match_reminders();
```

Les push partent via le trigger existant (`017`) dès qu'une notif est insérée. Les appareils doivent avoir un `push_token` Expo valide.

---

## 13. Commandes utiles

```bash
# Voir les builds en cours / terminés
eas build:list

# Voir les soumissions App Store / Play Store
eas submit:list

# Gérer certificats et profils iOS
eas credentials

# Enregistrer un appareil iOS
eas device:create

# Vérifier la config Expo
npx expo-doctor

# TypeScript
npx tsc --noEmit
```

---

## 14. Checklist rapide

### Premier test local

- [ ] `.env` rempli
- [ ] Migrations SQL exécutées (001 → 010)
- [ ] `npm install` puis `npm start`
- [ ] Expo Go sur le téléphone

### Premier build iPhone (preview)

- [ ] Icône dans `assets/images/icon.png`
- [ ] `eas login`
- [ ] `npx eas build --platform ios --profile preview`
- [ ] iPhone enregistré (lien Website)
- [ ] Mode développeur activé sur iPhone
- [ ] Installer via le lien EAS

### TestFlight

- [ ] App créée dans App Store Connect (`com.kojiro.app`)
- [ ] `npx eas build --platform ios --profile production`
- [ ] `npx eas submit --platform ios --latest`
- [ ] Testeur interne ajouté dans TestFlight
- [ ] App **TestFlight** installée sur l'iPhone

---

## Organisation d'un match

Voir **`MATCH_ORGANIZATION.md`** pour le parcours complet (création → composition → fin de match).

---

## Liens utiles

- Dashboard Expo : https://expo.dev/accounts/zinoyami/projects/kojiro
- Supabase Dashboard : https://supabase.com/dashboard
- App Store Connect : https://appstoreconnect.apple.com
- Apple Developer : https://developer.apple.com
- Doc Expo EAS Build : https://docs.expo.dev/build/introduction/
- Doc Expo EAS Submit : https://docs.expo.dev/submit/introduction/

---

*Dernière mise à jour : juillet 2026 — Kojiro v1.0.0*
