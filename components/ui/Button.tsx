import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Colors, Shadows, Spacing, Typography } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = false,
}: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const sizeStyles = {
    sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontSize: 13 },
    md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, fontSize: 15 },
    lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, fontSize: 17 },
  };

  const content = (
    <View style={[styles.content, loading && styles.loading]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.background : Colors.primary} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 16 : 20}
              color={variant === 'primary' ? Colors.background : Colors.primary}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              { fontSize: sizeStyles[size].fontSize },
              variant === 'primary' && styles.textPrimary,
              variant === 'secondary' && styles.textSecondary,
              variant === 'outline' && styles.textOutline,
              variant === 'ghost' && styles.textGhost,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const containerStyle = [
    styles.base,
    {
      paddingVertical: sizeStyles[size].paddingVertical,
      paddingHorizontal: sizeStyles[size].paddingHorizontal,
    },
    variant === 'secondary' && styles.secondary,
    variant === 'outline' && styles.outline,
    variant === 'ghost' && styles.ghost,
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  if (variant === 'primary') {
    return (
      <Pressable onPress={handlePress} disabled={disabled || loading} style={({ pressed }) => [pressed && styles.pressed]}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[containerStyle, Shadows.glow]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    minHeight: 20,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  text: {
    ...Typography.bodyBold,
  },
  textPrimary: {
    color: Colors.background,
  },
  textSecondary: {
    color: Colors.text,
  },
  textOutline: {
    color: Colors.primary,
  },
  textGhost: {
    color: Colors.textSecondary,
  },
  secondary: {
    backgroundColor: Colors.surfaceElevated,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
