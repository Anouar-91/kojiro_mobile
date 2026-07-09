/** Icônes stats profil — assets/images/icons */
export const ProfileStatIcons = {
  match: require('@/assets/images/icons/icon_match.png'),
  goal: require('@/assets/images/icons/icon_but.png'),
  assist: require('@/assets/images/icons/icon_passe.png'),
  mvp: require('@/assets/images/icons/icon_mvp.png'),
  fairPlay: require('@/assets/images/icons/icon_fairPlay.png'),
  defense: require('@/assets/images/icons/icon_defense.png'),
  rating: require('@/assets/images/icons/icon_note.png'),
} as const;

export type ProfileStatIconKey = keyof typeof ProfileStatIcons;

/** Tailles ajustées selon le ratio de chaque PNG pour un rendu visuel homogène */
export const ProfileStatIconSizes: Record<ProfileStatIconKey, { width: number; height: number }> = {
  match: { width: 28, height: 28 },
  goal: { width: 36, height: 24 },
  assist: { width: 40, height: 19 },
  mvp: { width: 26, height: 30 },
  fairPlay: { width: 32, height: 29 },
  defense: { width: 24, height: 30 },
  rating: { width: 34, height: 34 },
};

/** Hauteur réservée dans chaque carte stat pour aligner la grille */
export const PROFILE_STAT_ICON_SLOT_HEIGHT = 32;
