import { Image } from 'expo-image';
import { ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import {
  ProfileStatIconKey,
  ProfileStatIconSizes,
  ProfileStatIcons,
} from '@/constants/profileIcons';

export type StatIconVariant = 'default' | 'compact' | 'large';

/** Tailles réduites pour listes et lignes compactes */
const COMPACT_SIZES: Record<ProfileStatIconKey, { width: number; height: number }> = {
  match: { width: 14, height: 14 },
  goal: { width: 18, height: 12 },
  assist: { width: 20, height: 10 },
  mvp: { width: 13, height: 15 },
  fairPlay: { width: 16, height: 14 },
  defense: { width: 12, height: 15 },
  rating: { width: 15, height: 15 },
};

/** Tailles pour cartes récap « Ton match » */
const LARGE_SIZES: Record<ProfileStatIconKey, { width: number; height: number }> = {
  match: { width: 32, height: 32 },
  goal: { width: 40, height: 26 },
  assist: { width: 44, height: 21 },
  mvp: { width: 30, height: 34 },
  fairPlay: { width: 36, height: 32 },
  defense: { width: 28, height: 34 },
  rating: { width: 38, height: 38 },
};

function getIconSize(name: ProfileStatIconKey, variant: StatIconVariant) {
  if (variant === 'compact') return COMPACT_SIZES[name];
  if (variant === 'large') return LARGE_SIZES[name];
  return ProfileStatIconSizes[name];
}

interface StatIconProps {
  name: ProfileStatIconKey;
  variant?: StatIconVariant;
  style?: StyleProp<ImageStyle>;
  slotStyle?: StyleProp<ViewStyle>;
}

export function StatIcon({ name, variant = 'default', style, slotStyle }: StatIconProps) {
  const size = getIconSize(name, variant);
  const slotHeight = variant === 'compact' ? 16 : variant === 'large' ? 36 : 32;

  return (
    <View style={[styles.slot, { height: slotHeight }, slotStyle]}>
      <Image
        source={ProfileStatIcons[name]}
        style={[size, style]}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
