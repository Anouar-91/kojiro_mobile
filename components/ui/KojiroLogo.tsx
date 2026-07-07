import { Image } from 'expo-image';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

const logoSource = require('@/assets/images/icon.png');

interface KojiroLogoProps {
  size?: number;
  showWordmark?: boolean;
  style?: ViewStyle;
}

export function KojiroLogo({ size = 88, showWordmark = false, style }: KojiroLogoProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Image source={logoSource} style={{ width: size, height: size }} contentFit="contain" />
      {showWordmark && <Text style={styles.wordmark}>KOJIRO</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  wordmark: {
    ...Typography.hero,
    color: Colors.text,
    letterSpacing: 4,
    marginTop: Spacing.md,
    fontSize: 28,
  },
});
