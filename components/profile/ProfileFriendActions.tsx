import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getFriendshipState } from '@/services/friends';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { User } from '@/types';
import { isDeletedUser } from '@/utils/deletedUser';

interface ProfileFriendActionsProps {
  targetUser: User;
}

export function ProfileFriendActions({ targetUser }: ProfileFriendActionsProps) {
  const currentUser = useAuthStore((s) => s.user);
  const requests = useFriendStore((s) => s.requests);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const declineRequest = useFriendStore((s) => s.declineRequest);
  const cancelRequest = useFriendStore((s) => s.cancelRequest);

  if (!currentUser || currentUser.id === targetUser.id || isDeletedUser(targetUser)) return null;

  const friendState = getFriendshipState(currentUser.id, targetUser.id, requests);
  const request = requests.find(
    (r) =>
      (r.fromUserId === currentUser.id && r.toUserId === targetUser.id) ||
      (r.fromUserId === targetUser.id && r.toUserId === currentUser.id)
  );

  const handleSendRequest = async () => {
    try {
      await sendRequest(currentUser.id, targetUser.id, currentUser.name);
      Alert.alert('Demande envoyée', `${targetUser.name} recevra une notification.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'envoyer la demande');
    }
  };

  const handleAccept = async () => {
    if (!request) return;
    try {
      await acceptRequest(request.id);
      Alert.alert('Ami ajouté', `${targetUser.name} fait maintenant partie de tes amis.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'accepter');
    }
  };

  const handleDecline = () => {
    if (!request) return;
    Alert.alert('Refuser la demande', `Refuser la demande de ${targetUser.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          try {
            await declineRequest(request.id);
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de refuser');
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    if (!request) return;
    Alert.alert('Annuler la demande', `Annuler ta demande envoyée à ${targetUser.name} ?`, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler la demande',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelRequest(request.id);
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'annuler');
          }
        },
      },
    ]);
  };

  if (friendState === 'friends') {
    return (
      <View style={styles.friendBanner}>
        <Text style={styles.friendBannerText}>Vous êtes amis</Text>
      </View>
    );
  }

  if (friendState === 'pending_sent') {
    return (
      <Button
        title="Annuler la demande d'ami"
        onPress={handleCancel}
        variant="outline"
        fullWidth
      />
    );
  }

  if (friendState === 'pending_received') {
    return (
      <View style={styles.actionRow}>
        <Button title="Refuser" onPress={handleDecline} variant="outline" style={styles.actionBtn} />
        <Button title="Accepter" onPress={handleAccept} style={styles.actionBtn} />
      </View>
    );
  }

  return (
    <Button
      title="Ajouter en ami"
      onPress={handleSendRequest}
      fullWidth
      icon="person-add-outline"
    />
  );
}

const styles = StyleSheet.create({
  friendBanner: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.25)',
    alignItems: 'center',
  },
  friendBannerText: {
    ...Typography.bodyBold,
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
