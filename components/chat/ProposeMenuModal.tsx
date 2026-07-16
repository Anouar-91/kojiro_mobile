import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { Position } from '@/types';
import { TeamSide } from '@/types/lineup';

const POSITION_OPTIONS: { label: string; value: Position | 'unknown' }[] = [
  { label: 'Gardien', value: 'GK' },
  { label: 'Défenseur', value: 'DEF' },
  { label: 'Milieu', value: 'MID' },
  { label: 'Attaquant', value: 'FWD' },
  { label: 'Je ne sais pas', value: 'unknown' },
];

type ProposeMode = 'menu' | 'guest' | 'transfer' | 'friend';

interface ProposeMenuModalProps {
  visible: boolean;
  onClose: () => void;
  presentCount: number;
  maxPlayers: number;
  isOrganizer?: boolean;
  transferCandidates: { id: string; name: string; side: TeamSide }[];
  friendCandidates: { id: string; name: string }[];
  onProposeGuest: (name: string, position: Position | null) => Promise<void>;
  onProposeTransfer: (playerId: string, fromSide: TeamSide, toSide: TeamSide) => Promise<void>;
  onProposeFriend: (friendId: string, friendName: string) => Promise<void>;
}

export function ProposeMenuModal({
  visible,
  onClose,
  presentCount,
  maxPlayers,
  isOrganizer = false,
  transferCandidates,
  friendCandidates,
  onProposeGuest,
  onProposeTransfer,
  onProposeFriend,
}: ProposeMenuModalProps) {
  const [mode, setMode] = useState<ProposeMode>('menu');
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position | 'unknown'>('unknown');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => transferCandidates.find((c) => c.id === selectedPlayerId) ?? null,
    [transferCandidates, selectedPlayerId]
  );

  const selectedFriend = useMemo(
    () => friendCandidates.find((c) => c.id === selectedFriendId) ?? null,
    [friendCandidates, selectedFriendId]
  );

  const filteredFriends = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    if (!q) return friendCandidates;
    return friendCandidates.filter((f) => f.name.toLowerCase().includes(q));
  }, [friendCandidates, friendSearch]);

  const reset = () => {
    setMode('menu');
    setName('');
    setPosition('unknown');
    setSelectedPlayerId(null);
    setSelectedFriendId(null);
    setFriendSearch('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const title =
    mode === 'menu'
      ? 'Proposer'
      : mode === 'guest'
        ? 'Joueur sans compte'
        : mode === 'transfer'
          ? 'Transférer un joueur'
          : isOrganizer
            ? 'Inviter un ami'
            : 'Proposer un ami';

  const handleGuestSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Nom trop court (2 caractères minimum).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onProposeGuest(trimmed, position === 'unknown' ? null : position);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'envoyer la proposition');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSubmit = async () => {
    if (!selected) {
      setError('Choisis un joueur.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const toSide: TeamSide = selected.side === 'A' ? 'B' : 'A';
      await onProposeTransfer(selected.id, selected.side, toSide);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'envoyer la proposition');
    } finally {
      setLoading(false);
    }
  };

  const handleFriendSubmit = async () => {
    if (!selectedFriend) {
      setError('Choisis un ami.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onProposeFriend(selectedFriend.id, selectedFriend.name);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'envoyer la proposition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={12} disabled={loading}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </Pressable>
          </View>

          {mode === 'menu' && (
            <View style={styles.menu}>
              <Pressable
                style={[styles.menuItem, friendCandidates.length === 0 && styles.menuItemDisabled]}
                onPress={() => friendCandidates.length > 0 && setMode('friend')}
                disabled={friendCandidates.length === 0}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name="people-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>
                    {isOrganizer ? 'Inviter un ami' : 'Proposer un ami'}
                  </Text>
                  <Text style={styles.menuSubtitle}>
                    {friendCandidates.length === 0
                      ? 'Aucun ami disponible à inviter'
                      : isOrganizer
                        ? 'Invitation envoyée tout de suite'
                        : 'L\'organisateur devra accepter'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>

              <Pressable style={styles.menuItem} onPress={() => setMode('guest')}>
                <View style={styles.menuIcon}>
                  <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>Ajouter un joueur sans compte</Text>
                  <Text style={styles.menuSubtitle}>
                    {isOrganizer
                      ? `Ajout immédiat (${presentCount}/${maxPlayers})`
                      : `L'organisateur devra accepter (${presentCount}/${maxPlayers})`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>

              <Pressable
                style={[styles.menuItem, transferCandidates.length === 0 && styles.menuItemDisabled]}
                onPress={() => transferCandidates.length > 0 && setMode('transfer')}
                disabled={transferCandidates.length === 0}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name="swap-horizontal-outline" size={20} color={Colors.info} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>Transférer un joueur</Text>
                  <Text style={styles.menuSubtitle}>
                    {transferCandidates.length === 0
                      ? 'Compose les équipes d\'abord'
                      : 'Changer un joueur d\'équipe'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          )}

          {mode === 'guest' && (
            <>
              <Text style={styles.subtitle}>
                {isOrganizer
                  ? 'Ajoute quelqu\'un qui n\'a pas Kojiro. L\'ajout sera appliqué tout de suite.'
                  : 'Propose quelqu\'un qui n\'a pas Kojiro. L\'organisateur validera dans le chat.'}
              </Text>
              <Input
                label="Nom du joueur"
                placeholder="Ex: Karim (cousin)"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) setError(null);
                }}
                icon="person-outline"
                autoFocus
              />
              <Text style={styles.fieldLabel}>Poste (optionnel)</Text>
              <ChipGroup
                options={POSITION_OPTIONS}
                selected={position}
                onSelect={(v) => setPosition(v as Position | 'unknown')}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actions}>
                <Button title="Retour" onPress={() => setMode('menu')} variant="ghost" disabled={loading} />
                <Button
                  title={isOrganizer ? 'Ajouter' : 'Proposer'}
                  onPress={handleGuestSubmit}
                  loading={loading}
                  icon="send-outline"
                />
              </View>
            </>
          )}

          {mode === 'friend' && (
            <>
              <Text style={styles.subtitle}>
                {isOrganizer
                  ? 'Choisis un ami à inviter au match.'
                  : 'Propose un ami à l\'organisateur. Il pourra accepter dans le chat.'}
              </Text>
              <Input
                label="Rechercher"
                placeholder="Nom de l'ami"
                value={friendSearch}
                onChangeText={setFriendSearch}
                icon="search-outline"
              />
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {filteredFriends.length === 0 ? (
                  <Text style={styles.emptyList}>Aucun ami trouvé.</Text>
                ) : (
                  filteredFriends.map((f) => {
                    const active = f.id === selectedFriendId;
                    return (
                      <Pressable
                        key={f.id}
                        style={[styles.playerRow, active && styles.playerRowActive]}
                        onPress={() => {
                          setSelectedFriendId(f.id);
                          if (error) setError(null);
                        }}
                      >
                        <View style={styles.friendAvatar}>
                          <Ionicons name="person" size={14} color={Colors.primary} />
                        </View>
                        <Text style={styles.playerName}>{f.name}</Text>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actions}>
                <Button title="Retour" onPress={() => setMode('menu')} variant="ghost" disabled={loading} />
                <Button
                  title={isOrganizer ? 'Inviter' : 'Proposer'}
                  onPress={handleFriendSubmit}
                  loading={loading}
                  icon="send-outline"
                />
              </View>
            </>
          )}

          {mode === 'transfer' && (
            <>
              <Text style={styles.subtitle}>Choisis le joueur à faire changer d'équipe.</Text>
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {transferCandidates.map((c) => {
                  const active = c.id === selectedPlayerId;
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.playerRow, active && styles.playerRowActive]}
                      onPress={() => {
                        setSelectedPlayerId(c.id);
                        if (error) setError(null);
                      }}
                    >
                      <View style={[styles.sideBadge, c.side === 'B' && styles.sideBadgeB]}>
                        <Text style={styles.sideBadgeText}>{c.side}</Text>
                      </View>
                      <Text style={styles.playerName}>{c.name}</Text>
                      <Text style={styles.arrow}>→ {c.side === 'A' ? 'B' : 'A'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actions}>
                <Button title="Retour" onPress={() => setMode('menu')} variant="ghost" disabled={loading} />
                <Button
                  title="Proposer"
                  onPress={handleTransferSubmit}
                  loading={loading}
                  icon="send-outline"
                />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  menu: {
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 15,
  },
  menuSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: -Spacing.xs,
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
  },
  emptyList: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  list: {
    maxHeight: 280,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playerRowActive: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.sm,
  },
  sideBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBadgeB: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
  },
  sideBadgeText: {
    ...Typography.small,
    color: Colors.text,
    fontWeight: '700',
  },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  arrow: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
