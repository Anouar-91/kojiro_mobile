import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import {
  GuestAddProposalPayload,
  FriendInviteProposalPayload,
  MatchProposal,
  PlayerTransferProposalPayload,
  Position,
  TeamSplitProposalPayload,
} from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Gardien',
  DEF: 'Défenseur',
  MID: 'Milieu',
  FWD: 'Attaquant',
};

function proposalTitle(proposal: MatchProposal): string {
  switch (proposal.proposalType) {
    case 'guest_add':
      return 'Joueur sans compte';
    case 'player_transfer':
      return 'Transfert';
    case 'team_split':
      return 'Composition d\'équipes';
    case 'friend_invite':
      return 'Invitation d\'ami';
    default:
      return 'Proposition';
  }
}

function proposalIcon(type: MatchProposal['proposalType']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'guest_add':
      return 'person-add-outline';
    case 'player_transfer':
      return 'swap-horizontal-outline';
    case 'team_split':
      return 'people-outline';
    case 'friend_invite':
      return 'person-outline';
    default:
      return 'flash-outline';
  }
}

function proposalDetails(proposal: MatchProposal): string {
  if (proposal.proposalType === 'guest_add') {
    const payload = proposal.payload as GuestAddProposalPayload;
    const pos = payload.guest_position
      ? ` · ${POSITION_LABELS[payload.guest_position]}`
      : '';
    return `${payload.guest_name}${pos}`;
  }
  if (proposal.proposalType === 'player_transfer') {
    const payload = proposal.payload as PlayerTransferProposalPayload;
    return `${payload.player_name} · ${payload.from_side} → ${payload.to_side}`;
  }
  if (proposal.proposalType === 'friend_invite') {
    const payload = proposal.payload as FriendInviteProposalPayload;
    return payload.user_name;
  }
  const payload = proposal.payload as TeamSplitProposalPayload;
  const a = payload.team_a_names?.length ?? 0;
  const b = payload.team_b_names?.length ?? 0;
  if (a || b) return `Équipe A (${a}) · Équipe B (${b})`;
  return `${payload.lineups?.length ?? 0} joueurs placés`;
}

export function getProposalTitle(proposal: MatchProposal): string {
  return proposalTitle(proposal);
}

export function getProposalDetails(proposal: MatchProposal): string {
  return proposalDetails(proposal);
}

export function getProposalIcon(
  type: MatchProposal['proposalType']
): keyof typeof Ionicons.glyphMap {
  return proposalIcon(type);
}

function statusLabel(status: MatchProposal['status']): string {
  switch (status) {
    case 'accepted':
      return 'Acceptée';
    case 'rejected':
      return 'Refusée';
    default:
      return 'En attente';
  }
}

interface ProposalCardProps {
  proposal: MatchProposal;
  isOrganizer: boolean;
  senderName?: string;
  senderAvatar?: string;
  isOwn: boolean;
  timestamp: string;
  resolving?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onSenderPress?: () => void;
}

export function ProposalCard({
  proposal,
  isOrganizer,
  senderName,
  senderAvatar,
  isOwn,
  timestamp,
  resolving,
  onAccept,
  onReject,
  onSenderPress,
}: ProposalCardProps) {
  const pending = proposal.status === 'pending';
  const showActions = pending && isOrganizer;

  return (
    <View style={[styles.cardRow, isOwn && styles.cardRowOwn]}>
      {!isOwn && (
        <Pressable onPress={onSenderPress} disabled={!onSenderPress} hitSlop={4}>
          <Avatar uri={senderAvatar ?? ''} size={32} name={senderName} />
        </Pressable>
      )}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Ionicons name={proposalIcon(proposal.proposalType)} size={16} color={Colors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            {!isOwn && senderName ? (
              <Pressable onPress={onSenderPress} disabled={!onSenderPress}>
                <Text style={styles.senderName}>{senderName}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.cardTitle}>{proposalTitle(proposal)}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              proposal.status === 'accepted' && styles.statusAccepted,
              proposal.status === 'rejected' && styles.statusRejected,
              pending && styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                proposal.status === 'accepted' && styles.statusTextAccepted,
                proposal.status === 'rejected' && styles.statusTextRejected,
              ]}
            >
              {statusLabel(proposal.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.details}>{proposalDetails(proposal)}</Text>

        {showActions ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={onReject}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <Text style={styles.rejectText}>Refuser</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={onAccept}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.acceptText}>Accepter</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {pending && !isOrganizer ? (
          <Text style={styles.waitingHint}>En attente de l'organisateur</Text>
        ) : null}

        <Text style={styles.timestamp}>{formatRelativeTime(timestamp)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    maxWidth: '92%',
  },
  cardRowOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '700',
  },
  cardTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceHighlight,
  },
  statusPending: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
  },
  statusAccepted: {
    backgroundColor: Colors.primaryMuted,
  },
  statusRejected: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
  },
  statusText: {
    ...Typography.small,
    color: Colors.warning,
    fontWeight: '700',
  },
  statusTextAccepted: {
    color: Colors.primary,
  },
  statusTextRejected: {
    color: Colors.error,
  },
  details: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  rejectText: {
    ...Typography.bodyBold,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  acceptText: {
    ...Typography.bodyBold,
    color: Colors.background,
    fontSize: 14,
  },
  waitingHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  timestamp: {
    ...Typography.small,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },
});
