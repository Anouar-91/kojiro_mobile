import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BorderRadius, Colors, Typography } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ label, variant = 'primary', size = 'sm', style }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], size === 'md' && styles.md, style]}>
      <Text style={[styles.text, styles[`text_${variant}`], size === 'md' && styles.textMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  primary: {
    backgroundColor: Colors.primaryMuted,
  },
  secondary: {
    backgroundColor: Colors.surfaceHighlight,
  },
  success: {
    backgroundColor: 'rgba(57, 255, 20, 0.15)',
  },
  warning: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
  },
  error: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  text: {
    ...Typography.small,
    fontWeight: '600',
  },
  textMd: {
    fontSize: 13,
  },
  text_primary: { color: Colors.primary },
  text_secondary: { color: Colors.textSecondary },
  text_success: { color: Colors.success },
  text_warning: { color: Colors.warning },
  text_error: { color: Colors.error },
});
