import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { ResolvedMatchAction } from '@/utils/matchOrganizerCta';

interface MatchMoreActionsSheetProps {
  visible: boolean;
  actions: ResolvedMatchAction[];
  onClose: () => void;
  onSelect: (action: ResolvedMatchAction) => void;
}

export function MatchMoreActionsSheet({
  visible,
  actions,
  onClose,
  onSelect,
}: MatchMoreActionsSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Plus d'actions</Text>
          {actions.length === 0 ? (
            <Text style={styles.empty}>Aucune action disponible</Text>
          ) : (
            actions.map((action) => (
              <Pressable
                key={action.id}
                style={styles.row}
                onPress={() => {
                  onClose();
                  onSelect(action);
                }}
              >
                <Ionicons
                  name={action.icon as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={action.destructive ? Colors.error : Colors.primary}
                />
                <Text
                  style={[styles.rowLabel, action.destructive && styles.rowLabelDestructive]}
                >
                  {action.title}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>
            ))
          )}
          <Pressable style={styles.cancelRow} onPress={onClose}>
            <Text style={styles.cancelLabel}>Fermer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  empty: {
    ...Typography.body,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowLabel: {
    ...Typography.bodyBold,
    color: Colors.text,
    flex: 1,
    fontSize: 15,
  },
  rowLabelDestructive: {
    color: Colors.error,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xs,
  },
  cancelLabel: {
    ...Typography.bodyBold,
    color: Colors.textSecondary,
  },
});
