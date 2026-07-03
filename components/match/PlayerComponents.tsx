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
}

export function PlayerRow({ user, skillScore, showSkill = false, rightElement }: PlayerRowProps) {
  const score = skillScore ?? getSkillScore(user);

  return (
    <View style={styles.row}>
      <Avatar uri={user.avatar} size={40} name={user.name} />
      <View style={styles.info}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.meta}>{getPositionLabel(user.position)} · Niv. {user.level}</Text>
      </View>
      {showSkill && (
        <View style={styles.skillBadge}>
          <Text style={styles.skillText}>{score}</Text>
        </View>
      )}
      {rightElement}
    </View>
  );
}

interface TeamColumnProps {
  title: string;
  players: User[];
  averageLevel: number;
  color?: string;
}

export function TeamColumn({ title, players, averageLevel, color = Colors.primary }: TeamColumnProps) {
  return (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <Text style={[styles.columnTitle, { color }]}>{title}</Text>
        <Badge label={`Moy. ${averageLevel}`} variant="secondary" />
      </View>
      {players.map((player) => (
        <PlayerRow key={player.id} user={player} showSkill />
      ))}
    </View>
  );
}

interface AttendanceSectionProps {
  title: string;
  users: User[];
  statusColor: string;
}

export function AttendanceSection({ title, users, statusColor }: AttendanceSectionProps) {
  if (users.length === 0) return null;

  return (
    <View style={styles.attendanceSection}>
      <View style={styles.attendanceHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.attendanceTitle}>{title}</Text>
        <Text style={styles.attendanceCount}>{users.length}</Text>
      </View>
      <View style={styles.avatarList}>
        {users.map((user) => (
          <View key={user.id} style={styles.avatarItem}>
            <Avatar uri={user.avatar} size={36} name={user.name} showBorder />
            <Text style={styles.avatarName} numberOfLines={1}>{user.name.split(' ')[0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface AttendanceActionsProps {
  currentStatus: string;
  onStatusChange: (status: 'present' | 'absent' | 'maybe') => void;
}

export function AttendanceActions({ currentStatus, onStatusChange }: AttendanceActionsProps) {
  const options = [
    { status: 'present' as const, label: 'Présent', icon: 'checkmark-circle', color: Colors.success },
    { status: 'maybe' as const, label: 'Peut-être', icon: 'help-circle', color: Colors.warning },
    { status: 'absent' as const, label: 'Absent', icon: 'close-circle', color: Colors.error },
  ];

  return (
    <View style={styles.actions}>
      {options.map((opt) => (
        <Pressable
          key={opt.status}
          style={[
            styles.actionBtn,
            currentStatus === opt.status && { borderColor: opt.color, backgroundColor: `${opt.color}20` },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onStatusChange(opt.status);
          }}
        >
          <Ionicons
            name={opt.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={currentStatus === opt.status ? opt.color : Colors.textMuted}
          />
          <Text style={[styles.actionLabel, currentStatus === opt.status && { color: opt.color }]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 14,
  },
  meta: {
    ...Typography.small,
    color: Colors.textMuted,
  },
  skillBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  skillText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '800',
  },
  column: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  columnTitle: {
    ...Typography.bodyBold,
    fontSize: 15,
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
  avatarName: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
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
  actionLabel: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
});
