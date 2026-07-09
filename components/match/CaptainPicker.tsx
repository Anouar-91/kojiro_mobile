import { StyleSheet, Text, View } from 'react-native';

import { PlayerRow } from '@/components/match/PlayerComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { User } from '@/types';
import { uniqueUsersById } from '@/utils/guestAttendees';

interface CaptainPickerProps {
  presentUsers: User[];
  captainAId: string | null;
  captainBId: string | null;
  onCaptainAChange: (userId: string | null) => void;
  onCaptainBChange: (userId: string | null) => void;
  onSave: () => void;
  saving?: boolean;
}

const NONE = '__none__';

export function CaptainPicker({
  presentUsers,
  captainAId,
  captainBId,
  onCaptainAChange,
  onCaptainBChange,
  onSave,
  saving,
}: CaptainPickerProps) {
  const registeredUsers = uniqueUsersById(presentUsers.filter((u) => !u.isGuest));
  const optionsA = [
    { label: 'Aucun', value: NONE },
    ...registeredUsers
      .filter((u) => u.id !== captainBId)
      .map((u) => ({ label: u.name, value: u.id })),
  ];
  const optionsB = [
    { label: 'Aucun', value: NONE },
    ...registeredUsers
      .filter((u) => u.id !== captainAId)
      .map((u) => ({ label: u.name, value: u.id })),
  ];

  const captainA = registeredUsers.find((u) => u.id === captainAId);
  const captainB = registeredUsers.find((u) => u.id === captainBId);

  if (registeredUsers.length < 2) {
    return (
      <Text style={styles.hint}>
        Il faut au moins 2 joueurs inscrits présents pour désigner des capitaines.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.desc}>
        Les capitaines peuvent placer les joueurs de leur équipe, même après publication. Retire un capitaine pour bloquer les modifications.
      </Text>

      <Text style={styles.label}>Capitaine équipe A</Text>
      <ChipGroup
        options={optionsA}
        selected={captainAId ?? NONE}
        onSelect={(v) => onCaptainAChange(v === NONE ? null : String(v))}
      />
      {captainA && (
        <View style={styles.preview}>
          <PlayerRow user={captainA} />
        </View>
      )}

      <Text style={styles.label}>Capitaine équipe B</Text>
      <ChipGroup
        options={optionsB}
        selected={captainBId ?? NONE}
        onSelect={(v) => onCaptainBChange(v === NONE ? null : String(v))}
      />
      {captainB && (
        <View style={styles.preview}>
          <PlayerRow user={captainB} />
        </View>
      )}

      <Button title="Enregistrer les capitaines" onPress={onSave} loading={saving} variant="outline" fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  desc: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
  hint: { ...Typography.caption, color: Colors.textMuted, fontStyle: 'italic' },
  label: { ...Typography.bodyBold, color: Colors.text, marginTop: Spacing.sm },
  preview: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
