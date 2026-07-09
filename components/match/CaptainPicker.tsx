import { StyleSheet, Text, View } from 'react-native';

import { PlayerRow } from '@/components/match/PlayerComponents';
import { ChipGroup } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { User } from '@/types';
import { uniqueUsersById } from '@/utils/guestAttendees';

interface CaptainPickerProps {
  teamAUsers: User[];
  teamBUsers: User[];
  captainAId: string | null;
  captainBId: string | null;
  onCaptainAChange: (userId: string | null) => void;
  onCaptainBChange: (userId: string | null) => void;
  onSave: () => void;
  saving?: boolean;
}

const NONE = '__none__';

export function CaptainPicker({
  teamAUsers,
  teamBUsers,
  captainAId,
  captainBId,
  onCaptainAChange,
  onCaptainBChange,
  onSave,
  saving,
}: CaptainPickerProps) {
  const registeredTeamA = uniqueUsersById(teamAUsers.filter((u) => !u.isGuest));
  const registeredTeamB = uniqueUsersById(teamBUsers.filter((u) => !u.isGuest));

  const optionsA = [
    { label: 'Aucun', value: NONE },
    ...registeredTeamA.map((u) => ({ label: u.name, value: u.id })),
  ];
  const optionsB = [
    { label: 'Aucun', value: NONE },
    ...registeredTeamB.map((u) => ({ label: u.name, value: u.id })),
  ];

  const validCaptainAId =
    captainAId && registeredTeamA.some((u) => u.id === captainAId) ? captainAId : null;
  const validCaptainBId =
    captainBId && registeredTeamB.some((u) => u.id === captainBId) ? captainBId : null;

  const captainA = registeredTeamA.find((u) => u.id === validCaptainAId);
  const captainB = registeredTeamB.find((u) => u.id === validCaptainBId);

  if (registeredTeamA.length === 0 && registeredTeamB.length === 0) {
    return (
      <Text style={styles.hint}>
        Compose d'abord les équipes pour désigner des capitaines.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.desc}>
        Les capitaines doivent être dans leur équipe. Ils peuvent placer les joueurs de leur moitié de terrain, même après publication.
      </Text>

      <Text style={styles.label}>Capitaine équipe A</Text>
      {registeredTeamA.length === 0 ? (
        <Text style={styles.hint}>Aucun joueur inscrit dans l'équipe A.</Text>
      ) : (
        <>
          <ChipGroup
            options={optionsA}
            selected={validCaptainAId ?? NONE}
            onSelect={(v) => onCaptainAChange(v === NONE ? null : String(v))}
          />
          {captainA && (
            <View style={styles.preview}>
              <PlayerRow user={captainA} />
            </View>
          )}
        </>
      )}

      <Text style={styles.label}>Capitaine équipe B</Text>
      {registeredTeamB.length === 0 ? (
        <Text style={styles.hint}>Aucun joueur inscrit dans l'équipe B.</Text>
      ) : (
        <>
          <ChipGroup
            options={optionsB}
            selected={validCaptainBId ?? NONE}
            onSelect={(v) => onCaptainBChange(v === NONE ? null : String(v))}
          />
          {captainB && (
            <View style={styles.preview}>
              <PlayerRow user={captainB} />
            </View>
          )}
        </>
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
