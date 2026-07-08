import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { FormationSlot } from '@/types/lineup';
import { User } from '@/types';

interface PitchFormationProps {
  slots: FormationSlot[];
  players: User[];
  /** slotId -> userId */
  slotAssignments: Record<string, string>;
  selectedPlayerId?: string | null;
  onSelectPlayer?: (userId: string | null) => void;
  onAssignToSlot?: (slotId: string) => void;
  onClearSlot?: (slotId: string) => void;
  readOnly?: boolean;
  accentColor?: string;
}

export function PitchFormation({
  slots,
  players,
  slotAssignments,
  selectedPlayerId,
  onSelectPlayer,
  onAssignToSlot,
  onClearSlot,
  readOnly = false,
  accentColor = Colors.primary,
}: PitchFormationProps) {
  const benchPlayers = useMemo(() => {
    const assigned = new Set(Object.values(slotAssignments));
    return players.filter((p) => !assigned.has(p.id));
  }, [players, slotAssignments]);

  const userById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const handleSlotPress = (slotId: string) => {
    if (readOnly) return;
    const occupied = slotAssignments[slotId];
    if (selectedPlayerId) {
      onAssignToSlot?.(slotId);
      return;
    }
    if (occupied) {
      onClearSlot?.(slotId);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.pitch}>
        <PitchSvg />
        {slots.map((slot) => {
          const userId = slotAssignments[slot.id];
          const user = userId ? userById[userId] : null;
          const slotStyle: ViewStyle = {
            left: `${slot.x * 100}%`,
            top: `${slot.y * 100}%`,
            borderColor: user ? accentColor : Colors.border,
          };

          return (
            <Pressable
              key={slot.id}
              style={[styles.slot, slotStyle]}
              onPress={() => handleSlotPress(slot.id)}
              disabled={readOnly && !user}
            >
              {user ? (
                <Avatar uri={user.avatar} size={36} name={user.name} />
              ) : (
                <Text style={styles.slotLabel}>{slot.label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {!readOnly && (
        <View style={styles.bench}>
          <Text style={styles.benchTitle}>
            Banc {benchPlayers.length > 0 ? `(${benchPlayers.length})` : ''}
            {selectedPlayerId ? ' · Touche une position sur le terrain' : ' · Touche un joueur puis une case'}
          </Text>
          <View style={styles.benchRow}>
            {benchPlayers.length === 0 ? (
              <Text style={styles.benchEmpty}>Tous les joueurs sont placés</Text>
            ) : (
              benchPlayers.map((player) => (
                <Pressable
                  key={player.id}
                  style={[
                    styles.benchChip,
                    selectedPlayerId === player.id && { borderColor: accentColor, backgroundColor: `${accentColor}22` },
                  ]}
                  onPress={() => onSelectPlayer?.(selectedPlayerId === player.id ? null : player.id)}
                >
                  <Avatar uri={player.avatar} size={32} name={player.name} />
                  <Text style={styles.benchName} numberOfLines={1}>
                    {player.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function PitchSvg() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 140" style={StyleSheet.absoluteFill}>
      <Rect x={2} y={2} width={96} height={136} rx={4} fill="#1a3d1a" stroke={Colors.primary} strokeWidth={0.8} />
      <Line x1={2} y1={70} x2={98} y2={70} stroke={Colors.primary} strokeWidth={0.5} opacity={0.6} />
      <Circle cx={50} cy={70} r={12} fill="none" stroke={Colors.primary} strokeWidth={0.5} opacity={0.6} />
      <Rect x={25} y={2} width={50} height={22} fill="none" stroke={Colors.primary} strokeWidth={0.5} opacity={0.5} />
      <Rect x={25} y={116} width={50} height={22} fill="none" stroke={Colors.primary} strokeWidth={0.5} opacity={0.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  pitch: {
    width: '100%',
    aspectRatio: 0.72,
    backgroundColor: '#0d2b0d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  slot: {
    position: 'absolute',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(10,10,11,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    ...Typography.small,
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 9,
  },
  bench: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  benchTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  benchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  benchEmpty: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  benchChip: {
    alignItems: 'center',
    width: 56,
    padding: Spacing.xs,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  benchName: {
    ...Typography.small,
    color: Colors.textMuted,
    marginTop: 2,
    fontSize: 10,
    textAlign: 'center',
  },
});

/** Vue lecture seule compacte */
export function PitchFormationReadOnly({
  slots,
  players,
  slotAssignments,
  accentColor = Colors.primary,
}: Omit<PitchFormationProps, 'onSelectPlayer' | 'onAssignToSlot' | 'onClearSlot'>) {
  return (
    <PitchFormation
      slots={slots}
      players={players}
      slotAssignments={slotAssignments}
      readOnly
      accentColor={accentColor}
    />
  );
}
