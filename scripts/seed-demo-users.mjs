/**
 * Crée 20 comptes démo : anouar+1@bhgroupe.fr … anouar+20@bhgroupe.fr
 *
 * Usage :
 *   node scripts/seed-demo-users.mjs
 *
 * Optionnel : SUPABASE_SERVICE_ROLE_KEY dans .env (plus fiable)
 * Sinon utilise signUp avec la clé anon (désactive "Confirm email" dans Supabase)
 *
 * Mot de passe commun : Kojiro2026!
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...process.env, ...loadEnv() };
const url = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const PASSWORD = 'Kojiro2026!';
const COUNT = 20;

const PLAYERS = [
  { name: 'Youssef Benali', position: 'FWD', foot: 'Droit', city: 'Paris', level: 14, xp: 1650, rating: 4.7 },
  { name: 'Mehdi Cherif', position: 'MID', foot: 'Gauche', city: 'Lyon', level: 11, xp: 980, rating: 4.3 },
  { name: 'Karim Mansouri', position: 'DEF', foot: 'Droit', city: 'Marseille', level: 10, xp: 870, rating: 4.1 },
  { name: 'Lucas Petit', position: 'GK', foot: 'Droit', city: 'Paris', level: 13, xp: 1420, rating: 4.6 },
  { name: 'Thomas Dupont', position: 'FWD', foot: 'Droit', city: 'Paris', level: 15, xp: 1880, rating: 4.8 },
  { name: 'Sophie Bernard', position: 'MID', foot: 'Ambidextre', city: 'Lille', level: 12, xp: 1150, rating: 4.4 },
  { name: 'Alex Rivera', position: 'DEF', foot: 'Gauche', city: 'Paris', level: 9, xp: 720, rating: 4.0 },
  { name: 'Emma Dubois', position: 'MID', foot: 'Gauche', city: 'Bordeaux', level: 16, xp: 2100, rating: 4.9 },
  { name: 'Kevin Ndiaye', position: 'FWD', foot: 'Droit', city: 'Paris', level: 13, xp: 1380, rating: 4.5 },
  { name: 'Marc Leroy', position: 'GK', foot: 'Droit', city: 'Nantes', level: 14, xp: 1590, rating: 4.7 },
  { name: 'Hugo Martin', position: 'DEF', foot: 'Droit', city: 'Toulouse', level: 8, xp: 540, rating: 3.9 },
  { name: 'Inès Moreau', position: 'MID', foot: 'Droit', city: 'Paris', level: 11, xp: 1020, rating: 4.2 },
  { name: 'Rayan Bouzid', position: 'FWD', foot: 'Gauche', city: 'Lyon', level: 12, xp: 1200, rating: 4.4 },
  { name: 'Claire Fontaine', position: 'DEF', foot: 'Droit', city: 'Paris', level: 10, xp: 800, rating: 4.0 },
  { name: 'Nassim Hamdi', position: 'MID', foot: 'Droit', city: 'Marseille', level: 14, xp: 1700, rating: 4.6 },
  { name: 'Julie Lambert', position: 'FWD', foot: 'Droit', city: 'Strasbourg', level: 9, xp: 690, rating: 4.1 },
  { name: 'Omar Soltani', position: 'DEF', foot: 'Gauche', city: 'Paris', level: 11, xp: 950, rating: 4.3 },
  { name: 'Pierre Girard', position: 'GK', foot: 'Droit', city: 'Nice', level: 12, xp: 1100, rating: 4.4 },
  { name: 'Sara El Amrani', position: 'MID', foot: 'Ambidextre', city: 'Paris', level: 15, xp: 1820, rating: 4.7 },
  { name: 'Antoine Rousseau', position: 'FWD', foot: 'Droit', city: 'Rennes', level: 10, xp: 830, rating: 4.2 },
];

function buildStats(level, rating) {
  const mp = 10 + level * 3;
  return {
    matchesPlayed: mp,
    goals: Math.floor(level * 1.8),
    assists: Math.floor(level * 1.2),
    wins: Math.floor(mp * 0.55),
    losses: Math.floor(mp * 0.3),
    draws: Math.floor(mp * 0.15),
    mvpCount: Math.floor(level / 3),
    averageRating: rating,
    fairPlayScore: 88 + (level % 10),
    shotsOnTarget: level * 5,
    passAccuracy: 70 + level,
    minutesPlayed: mp * 70,
  };
}

async function enrichProfile(supabase, userId, player, email) {
  const stats = buildStats(player.level, player.rating);
  const { error } = await supabase
    .from('profiles')
    .update({
      name: player.name,
      position: player.position,
      foot: player.foot,
      city: player.city,
      level: player.level,
      xp: player.xp,
      xp_to_next_level: 1000 + player.level * 200,
      rating: player.rating,
      avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
      bio: `Joueur Kojiro — ${player.position} à ${player.city}`,
      stats,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

async function seedWithServiceRole() {
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 1; i <= COUNT; i++) {
    const email = `anouar+${i}@bhgroupe.fr`;
    const player = PLAYERS[i - 1];

    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = listData?.users?.find((u) => u.email === email);
    let userId = found?.id;

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: player.name },
      });

      if (error) {
        results.errors.push(`${email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      results.created++;
      console.log(`✓ Créé ${email} — ${player.name}`);
    } else {
      results.skipped++;
      console.log(`○ Existe déjà ${email}`);
    }

    try {
      await enrichProfile(supabase, userId, player, email);
    } catch (e) {
      results.errors.push(`${email} profil: ${e.message}`);
    }
  }

  return results;
}

async function seedWithSignUp() {
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 1; i <= COUNT; i++) {
    const email = `anouar+${i}@bhgroupe.fr`;
    const player = PLAYERS[i - 1];

    const { data, error } = await supabase.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { name: player.name } },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        results.skipped++;
        console.log(`○ Existe déjà ${email}`);
      } else {
        results.errors.push(`${email}: ${error.message}`);
      }
      continue;
    }

    if (!data.user) {
      results.errors.push(`${email}: pas de user retourné`);
      continue;
    }

    results.created++;
    console.log(`✓ Créé ${email} — ${player.name}`);

    if (data.session) {
      try {
        await enrichProfile(supabase, data.user.id, player, email);
      } catch (e) {
        results.errors.push(`${email} profil: ${e.message}`);
      }
      await supabase.auth.signOut();
    } else {
      results.errors.push(`${email}: active "Confirm email" OFF dans Supabase Auth`);
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return results;
}

async function main() {
  if (!url) {
    console.error('❌ EXPO_PUBLIC_SUPABASE_URL manquant dans .env');
    process.exit(1);
  }

  if (!serviceKey && !anonKey) {
    console.error('❌ Clés Supabase manquantes dans .env');
    process.exit(1);
  }

  console.log(`\n🌱 Seed de ${COUNT} profils sur ${url}\n`);
  console.log(`   Emails : anouar+1@bhgroupe.fr … anouar+${COUNT}@bhgroupe.fr`);
  console.log(`   Mot de passe : ${PASSWORD}\n`);

  if (!serviceKey) {
    console.log('ℹ️  Mode signUp (ajoute SUPABASE_SERVICE_ROLE_KEY pour le mode admin)\n');
  }

  const results = serviceKey ? await seedWithServiceRole() : await seedWithSignUp();

  console.log('\n── Résultat ──');
  console.log(`Créés : ${results.created}`);
  console.log(`Déjà existants : ${results.skipped}`);
  if (results.errors.length) {
    console.log('Erreurs :');
    results.errors.forEach((e) => console.log(`  - ${e}`));
  } else {
    console.log('Aucune erreur.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
