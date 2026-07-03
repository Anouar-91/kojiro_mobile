export const Colors = {
  background: '#0A0A0B',
  surface: '#141416',
  surfaceElevated: '#1C1C1F',
  surfaceHighlight: '#252528',
  border: '#2A2A2E',
  borderLight: '#3A3A40',

  primary: '#39FF14',
  primaryDark: '#2ECC0F',
  primaryMuted: 'rgba(57, 255, 20, 0.15)',
  primaryGlow: 'rgba(57, 255, 20, 0.3)',

  text: '#FFFFFF',
  textSecondary: '#A0A0A8',
  textMuted: '#6B6B73',

  success: '#39FF14',
  warning: '#FFB800',
  error: '#FF4757',
  info: '#00D4FF',

  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',

  overlay: 'rgba(0, 0, 0, 0.7)',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Typography = {
  hero: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '500' as const },
  stat: { fontSize: 24, fontWeight: '800' as const },
} as const;

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
