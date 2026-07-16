import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getProposalDetails,
  getProposalIcon,
  getProposalTitle,
} from '@/components/chat/ProposalCard';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { MatchProposal } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

interface PendingProposalsSheetProps {
  visible: boolean;
  onClose: () => void;
  proposals: MatchProposal[];
  proposerNames: Record<string, string>;
  resolvingId: string | null;
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

export function PendingProposalsSheet({
  visible,
  onClose,
  proposals,
  proposerNames,
  resolvingId,
  onAccept,
  onReject,
}: PendingProposalsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Propositions en attente</Text>
              <Text style={styles.subtitle}>
                {proposals.length === 0
                  ? 'Rien à valider pour le moment'
                  : proposals.length === 1
                    ? '1 proposition à traiter'
                    : `${proposals.length} propositions à traiter`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {proposals.length === 0 ? (
              <Text style={styles.empty}>Aucune proposition en attente.</Text>
            ) : (
              proposals.map((proposal) => {
                const resolving = resolvingId === proposal.id;
                return (
                  <View key={proposal.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.iconWrap}>
                        <Ionicons
                          name={getProposalIcon(proposal.proposalType)}
                          size={16}
                          color={Colors.primary}
                        />
                      </View>
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>{getProposalTitle(proposal)}</Text>
                        <Text style={styles.proposer}>
                          Par {proposerNames[proposal.proposedBy] ?? 'un joueur'} ·{' '}
                          {formatRelativeTime(proposal.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.details}>{getProposalDetails(proposal)}</Text>
                    <View style={styles.actions}>
                      <Pressable
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => onReject(proposal.id)}
                        disabled={Boolean(resolvingId)}
                      >
                        {resolving ? (
                          <ActivityIndicator size="small" color={Colors.error} />
                        ) : (
                          <Text style={styles.rejectText}>Refuser</Text>
                        )}
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.acceptBtn]}
                        onPress={() => onAccept(proposal.id)}
                        disabled={Boolean(resolvingId)}
                      >
                        {resolving ? (
                          <ActivityIndicator size="small" color={Colors.background} />
                        ) : (
                          <Text style={styles.acceptText}>Accepter</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface PendingProposalsBannerProps {
  count: number;
  onPress: () => void;
}

export function PendingProposalsBanner({ count, onPress }: PendingProposalsBannerProps) {
  if (count <= 0) return null;

  return (
    <Pressable style={styles.banner} onPress={onPress}>
      <View style={styles.bannerIcon}>
        <Ionicons name="flash-outline" size={16} color={Colors.warning} />
      </View>
      <Text style={styles.bannerText}>
        {count === 1 ? '1 proposition à valider' : `${count} propositions à valider`}
      </Text>
      <Text style={styles.bannerAction}>Voir</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
    </Pressable>
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
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  empty: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xxl,
  },
  card: {
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
  cardTitle: {
    ...Typography.bodyBold,
    color: Colors.text,
    fontSize: 15,
  },
  proposer: {
    ...Typography.caption,
    color: Colors.textMuted,
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.35)',
  },
  bannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    ...Typography.bodyBold,
    color: Colors.warning,
    fontSize: 14,
    flex: 1,
  },
  bannerAction: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
  },
});
