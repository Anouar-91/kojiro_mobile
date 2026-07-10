import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { User } from '@/types';
import { getPositionLabel } from '@/utils/formatters';
import { getSkillScore } from '@/utils/teamBalancer';

interface PlayerRowProps {
  user: User;
  skillScore?: number;
  showSkill?: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
}

export function PlayerRow({ user, skillScore, showSkill = false, rightElement, onPress }: PlayerRowProps) {
  const score = skillScore ?? getSkillScore(user);

  const content = (
    <>
      <Avatar uri={user.avatar} size={36} name={user.name} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {user.name}
          </Text>
          {user.isGuest && <Badge label="Invité" variant="secondary" />}
        </View>
        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {user.isGuest
            ? `${getPositionLabel(user.position)} · Invité`
            : `${getPositionLabel(user.position)} · Niv. ${user.level}`}
        </Text>
      </View>
      {showSkill && (
        <View style={styles.skillBadge}>
          <Text style={styles.skillText}>{score}</Text>
        </View>
      )}
      {rightElement}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

interface TeamColumnProps {
  title: string;
  players: User[];
  averageLevel: number;
  color?: string;
}

export function TeamColumn({ title, players, averageLevel, color = Colors.primary }: TeamColumnProps) {
  return (
    <View style={[styles.column, { borderColor: `${color}40` }]}>
      <View style={[styles.columnHeader, { borderBottomColor: `${color}30` }]}>
        <Text style={[styles.columnTitle, { color }]}>{title}</Text>
        <View style={styles.columnStats}>
          <Text style={styles.columnCount}>{players.length} joueur{players.length > 1 ? 's' : ''}</Text>
          <Badge label={`Moy. ${averageLevel}`} variant="secondary" />
        </View>
      </View>
      {players.map((player, index) => (
        <View key={player.id}>
          {index > 0 && <View style={styles.playerDivider} />}
          <PlayerRow user={player} showSkill />
        </View>
      ))}
    </View>
  );
}

interface AttendanceSectionProps {
  title: string;
  users: User[];
  statusColor: string;
  onRemovePlayer?: (user: User) => void;
  onPlayerPress?: (user: User) => void;
}

export function AttendanceSection({
  title,
  users,
  statusColor,
  onRemovePlayer,
  onPlayerPress,
}: AttendanceSectionProps) {
  if (users.length === 0) return null;

  return (
    <View style={styles.attendanceSection}>
      <View style={styles.attendanceHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.attendanceTitle}>{title}</Text>
        <Text style={styles.attendanceCount}>{users.length}</Text>
      </View>
      {onRemovePlayer ? (
        <View style={styles.manageList}>
          {users.map((user, index) => (
            <View key={user.id}>
              {index > 0 && <View style={styles.playerDivider} />}
              <PlayerRow
                user={user}
                onPress={onPlayerPress ? () => onPlayerPress(user) : undefined}
                rightElement={
                  <Pressable
                    onPress={() => onRemovePlayer(user)}
                    style={styles.removeBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="person-remove-outline" size={20} color={Colors.error} />
                  </Pressable>
                }
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.avatarList}>
          {users.map((user) => (
            <Pressable
              key={user.id}
              style={({ pressed }) => [
                styles.avatarItem,
                user.isGuest && styles.avatarItemGuest,
                pressed && styles.rowPressed,
              ]}
              onPress={onPlayerPress ? () => onPlayerPress(user) : undefined}
              disabled={!onPlayerPress}
            >
              <Avatar uri={user.avatar} size={36} name={user.name} showBorder />
              <Text style={styles.avatarName} numberOfLines={1}>{user.name.split(' ')[0]}</Text>
              {user.isGuest && <Text style={styles.avatarGuestHint}>Invité</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

interface AttendanceActionsProps {
  currentStatus: string;
  onStatusChange: (status: 'present' | 'absent' | 'maybe') => void;
  canSetPresent?: boolean;
  canSetMaybe?: boolean;
  canSetAbsent?: boolean;
}

export function AttendanceActions({
  currentStatus,
  onStatusChange,
  canSetPresent = true,
  canSetMaybe = true,
  canSetAbsent = true,
}: AttendanceActionsProps) {
  const options = [
    { status: 'present' as const, label: 'Présent', icon: 'checkmark-circle', color: Colors.success },
    { status: 'maybe' as const, label: 'Peut-être', icon: 'help-circle', color: Colors.warning },
    { status: 'absent' as const, label: 'Absent', icon: 'close-circle', color: Colors.error },
  ];

  return (
    <View style={styles.actions}>
      {options.map((opt) => {
        const isPresentDisabled = opt.status === 'present' && !canSetPresent && currentStatus !== 'present';
        const isMaybeDisabled = opt.status === 'maybe' && !canSetMaybe;
        const isAbsentDisabled = opt.status === 'absent' && !canSetAbsent;
        const isDisabled = isPresentDisabled || isMaybeDisabled || isAbsentDisabled;
        return (
        <Pressable
          key={opt.status}
          style={[
            styles.actionBtn,
            currentStatus === opt.status && { borderColor: opt.color, backgroundColor: `${opt.color}20` },
            isDisabled && styles.actionBtnDisabled,
          ]}
          disabled={isDisabled}
          onPress={() => {
            if (isDisabled) return;
            Haptics.selectionAsync();
            onStatusChange(opt.status);
          }}
        >
          <Ionicons
            name={opt.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={isDisabled ? Colors.textMuted : currentStatus === opt.status ? opt.color : Colors.textMuted}
          />
          <Text
            style={[
              styles.actionLabel,
              currentStatus === opt.status && { color: opt.color },
              isDisabled && styles.actionLabelDisabled,
            ]}
          >
            {opt.label}
          </Text>
        </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowPressed: {
    opacity: 0.85,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  name: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 15,
  },
  meta: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  skillBadge: {
    flexShrink: 0,
    backgroundColor: Colors.primaryMuted,
    minWidth: 40,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  skillText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '800',
  },
  column: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  columnTitle: {
    ...Typography.h3,
    fontSize: 17,
  },
  columnStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  columnCount: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  playerDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  attendanceSection: {
    marginBottom: Spacing.lg,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  attendanceTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  attendanceCount: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  avatarList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  avatarItem: {
    alignItems: 'center',
    width: 52,
  },
  avatarItemGuest: {
    opacity: 0.85,
  },
  avatarName: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  avatarGuestHint: {
    ...Typography.small,
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center',
  },
  manageList: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeBtn: {
    padding: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
  actionLabelDisabled: {
    color: Colors.textMuted,
  },
});
