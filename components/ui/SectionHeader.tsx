import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    marginRight: 2,
  },
});
