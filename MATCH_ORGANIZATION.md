# Organisation d'un match — Kojiro

Guide du parcours complet, de la création à la fin du match.

---

## Vue d'ensemble

```
1. Créer le match          → Organisateur
2. Joueurs rejoignent      → Présences (présent / absent / peut-être)
3. Invitations (optionnel) → Organisateur invite des joueurs
4. Composition             → Organisateur : équipes A/B + formations
5. Démarrer le match       → Organisateur (statut « En cours »)
6. Jouer                   → Chat, terrain, etc.
7. Terminer le match       → Organisateur : score + stats par joueur
8. Résultats               → XP, historique, classement mis à jour
```

---

## Étape 1 — Créer le match

**Qui :** organisateur (n'importe quel joueur connecté)

**Écran :** `Matchs` → `Créer un match`

**À renseigner :**
- Format (ex. 7v7) + remplaçants par équipe
- Visibilité : ouvert à tous ou entre amis
- Date, heure, lieu (adresse géocodée), prix, description

**Résultat :** match créé en statut `upcoming`, l'organisateur est automatiquement **présent**.

---

## Étape 2 — Les joueurs confirment leur présence

**Qui :** chaque joueur inscrit ou qui rejoint le match

**Écran :** Détail du match → `Ma présence`

**Actions :**
- **Présent** — compte dans le quota et la composition
- **Peut-être** — visible mais pas dans la composition
- **Absent** — ne participe pas

**Match entre amis :** seuls les amis de l'organisateur (ou déjà inscrits) peuvent rejoindre.

---

## Étape 3 — Inviter des joueurs (optionnel)

**Qui :** organisateur

**Écran :** Détail du match → `Inviter des joueurs`

- Recherche par nom / ville
- Envoie une notification + statut `pending` sur le match

---

## Étape 4 — Composition des équipes et formations

**Qui :** **organisateur uniquement** (MVP actuel)

**Écran :** Détail du match → `Composer les équipes`

### Sous-étapes dans l'app

| # | Écran | Action |
|---|-------|--------|
| 4a | **Équipes** | Répartir les joueurs **présents** en équipe A et B (IA ou manuel) |
| 4b | **Formation A** | Placer les joueurs sur le terrain (touch : joueur → case) |
| 4c | **Formation B** | Idem pour l'équipe B |
| 4d | **Valider** | Publier → sauvegarde Supabase + notif aux joueurs |

**Les autres joueurs** consultent via `Voir la composition` (lecture seule).

**Formations :** choix par équipe via chips (2-3-1, 3-2-1…) ou steppers DEF / MIL / ATT personnalisés. Joueurs non placés = banc.

> **Phase 2 prévue :** capitaines par équipe avec droits d'édition limités à leur côté.

---

## Étape 5 — Démarrer le match

**Qui :** organisateur

**Condition :** composition publiée + statut `upcoming`

**Action :** bouton `Démarrer le match` sur le détail

**Résultat :** statut passe à `live`, badge « En cours » affiché.

---

## Étape 6 — Pendant le match

- **Chat du match** — messages temps réel
- **Composition** — visible par tous (lecture seule)
- Carte / notifications selon besoin

---

## Étape 7 — Terminer le match

**Qui :** organisateur

**Écran :** `Terminer le match`

**À saisir :**
- Score final (équipe A vs B)
- Par joueur (pré-rempli depuis la composition si publiée) :
  - Équipe A ou B
  - Buts, passes décisives
  - Note /5
  - MVP (un seul)

**Validation :** appelle la RPC `complete_match` côté Supabase.

---

## Étape 8 — Après le match

**Automatique pour chaque joueur :**
- Historique (`match_results`)
- Stats : matchs joués, buts, passes, V/N/D, MVP, note moyenne
- **XP** : `50 + buts×10 + passes×5 + (MVP ? 25)`
- **Niveau** si seuil XP atteint
- Classement mis à jour (tri par XP)

**Notifications** envoyées aux participants.

---

## Permissions récap

| Action | Organisateur | Joueur inscrit | Autre |
|--------|:------------:|:--------------:|:-----:|
| Créer match | ✅ | ✅ | ✅ |
| Confirmer présence | ✅ | ✅ | ❌* |
| Inviter | ✅ | ❌ | ❌ |
| Composer / publier formation | ✅ | ❌ | ❌ |
| Voir formation | ✅ | ✅ | selon visibilité |
| Démarrer match | ✅ | ❌ | ❌ |
| Terminer + stats | ✅ | ❌ | ❌ |
| Chat | ✅ | ✅ | ❌ |

\*Match entre amis : ami de l'orga ou déjà invité.

---

## Migration Supabase requise

Exécuter dans le SQL Editor :

```
supabase/migrations/011_match_composition.sql
```

Crée les tables `match_compositions`, `match_lineups` et les fonctions `save_match_composition`, `start_match`.

---

## Fichiers clés du code

| Fichier | Rôle |
|---------|------|
| `app/match/create.tsx` | Création |
| `app/match/[id].tsx` | Détail + parcours organisateur |
| `app/match/teams.tsx` | Wizard composition (4 étapes) |
| `app/match/lineup.tsx` | Vue formation lecture seule |
| `components/match/PitchFormation.tsx` | Terrain + placement |
| `app/match/complete.tsx` | Fin de match + stats |
| `services/composition.ts` | API composition |
| `supabase/migrations/011_match_composition.sql` | Schéma BDD |

---

*Kojiro — juillet 2026*
