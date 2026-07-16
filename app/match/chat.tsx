import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat/ChatComponents';
import {
  PendingProposalsBanner,
  PendingProposalsSheet,
} from '@/components/chat/PendingProposalsSheet';
import { ProposalCard } from '@/components/chat/ProposalCard';
import { ProposeMenuModal } from '@/components/chat/ProposeMenuModal';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  markChatNotificationsRead,
  markChatRead,
  setActiveChatMatchId,
} from '@/services/chatReads';
import { fetchMatchComposition } from '@/services/composition';
import {
  CHAT_PAGE_SIZE,
  fetchOlderMessages,
  fetchRecentMessages,
  sendMessage,
  subscribeToMessages,
} from '@/services/messages';
import { fetchProfile } from '@/services/profiles';
import {
  buildFriendInviteProposalContent,
  buildGuestProposalContent,
  buildTransferProposalContent,
  createMatchProposal,
  fetchPendingProposals,
  fetchProposalById,
  fetchProposalsByIds,
  friendInvitePayload,
  guestPayload,
  resolveMatchProposal,
  subscribeToProposals,
  transferPayload,
} from '@/services/proposals';
import { setSuppressChatBannerMatchId } from '@/services/push';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useMatchStore } from '@/store/matchStore';
import { useProfileStore } from '@/store/profileStore';
import { ChatMessage, MatchProposal, Position, User } from '@/types';
import { TeamSide } from '@/types/lineup';
import { isDeletedUser } from '@/utils/deletedUser';
import { resolveParticipantUser } from '@/utils/guestAttendees';
import { canAccessMatchChat, getMatchChatAccessDeniedMessage } from '@/utils/matchAttendance';
import { openUserProfile } from '@/utils/profileNavigation';

export default function MatchChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.getMatch(id ?? ''));
  const refreshMatch = useMatchStore((s) => s.refreshMatch);
  const getProfile = useProfileStore((s) => s.getProfile);
  const profiles = useProfileStore((s) => s.profiles);
  const fetchProfiles = useProfileStore((s) => s.fetchProfiles);
  const friendIds = useFriendStore((s) => s.friendIds);
  const fetchFriends = useFriendStore((s) => s.fetchFriends);
  const [matchLoading, setMatchLoading] = useState(!match);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<Record<string, MatchProposal>>({});
  const [senders, setSenders] = useState<Record<string, User>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [pendingSheetOpen, setPendingSheetOpen] = useState(false);
  const [transferCandidates, setTransferCandidates] = useState<
    { id: string; name: string; side: TeamSide }[]
  >([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const fetchNotifications = useMatchStore((s) => s.fetchNotifications);
  const upsertProfile = useProfileStore((s) => s.upsertProfile);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const shouldScrollToEndRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const loadedSenderIdsRef = useRef(new Set<string>());
  const messagesRef = useRef<ChatMessage[]>([]);
  const hasMoreOlderRef = useRef(false);
  const canAutoLoadOlderRef = useRef(false);
  const insets = useSafeAreaInsets();

  const canUseChat = useMemo(
    () => (match && user ? canAccessMatchChat(match, user.id) : false),
    [match, user?.id]
  );

  const isOrganizer = Boolean(match && user && match.organizerId === user.id);

  const presentCount = useMemo(
    () => match?.attendees.filter((a) => a.status === 'present').length ?? 0,
    [match]
  );

  const friendCandidates = useMemo(() => {
    if (!match || !user) return [];
    const attendeeIds = new Set(
      match.attendees
        .filter((a) => a.userId && a.status !== 'absent')
        .map((a) => a.userId!)
    );
    return friendIds
      .filter((fid) => fid !== user.id && !attendeeIds.has(fid))
      .map((fid) => {
        const profile = profiles.find((p) => p.id === fid) ?? getProfile(fid);
        return { id: fid, name: profile?.name ?? 'Ami' };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [match, user, friendIds, profiles, getProfile]);

  const pendingProposals = useMemo(
    () =>
      Object.values(proposals)
        .filter((p) => p.status === 'pending')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [proposals]
  );

  const proposerNames = useMemo(() => {
    const names: Record<string, string> = {};
    pendingProposals.forEach((p) => {
      const profile = p.proposedBy === user?.id ? user : senders[p.proposedBy];
      if (profile?.name) names[p.proposedBy] = profile.name;
    });
    return names;
  }, [pendingProposals, senders, user]);

  useEffect(() => {
    if (!id || match) {
      setMatchLoading(false);
      return;
    }

    let active = true;
    setMatchLoading(true);
    refreshMatch(id)
      .catch(() => {})
      .finally(() => {
        if (active) setMatchLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, match, refreshMatch]);

  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);

  messagesRef.current = messages;
  hasMoreOlderRef.current = hasMoreOlder;

  const ensureProposalsLoaded = useCallback(async (msgs: ChatMessage[]) => {
    const ids = msgs
      .map((m) => m.proposalId)
      .filter((pid): pid is string => Boolean(pid));
    if (ids.length === 0) return;
    try {
      const rows = await fetchProposalsByIds(ids);
      if (rows.length === 0) return;
      setProposals((prev) => {
        const next = { ...prev };
        rows.forEach((p) => {
          next[p.id] = p;
        });
        return next;
      });
    } catch {
      // ignore — carte affichera le contenu texte
    }
  }, []);

  const mergeProposals = useCallback((rows: MatchProposal[]) => {
    if (rows.length === 0) return;
    setProposals((prev) => {
      const next = { ...prev };
      rows.forEach((p) => {
        next[p.id] = p;
      });
      return next;
    });
  }, []);

  const ensureSenderIdsLoaded = useCallback(
    (ids: string[]) => {
      ids.forEach((senderId) => {
        if (!senderId || senderId === 'system' || loadedSenderIdsRef.current.has(senderId)) return;
        loadedSenderIdsRef.current.add(senderId);
        fetchProfile(senderId).then((profile) => {
          if (profile) {
            upsertProfile(profile);
            setSenders((prev) => ({ ...prev, [senderId]: profile }));
          }
        });
      });
    },
    [upsertProfile]
  );

  const ensureSendersLoaded = useCallback(
    (msgs: ChatMessage[]) => {
      ensureSenderIdsLoaded(msgs.map((m) => m.senderId));
    },
    [ensureSenderIdsLoaded]
  );
  const scrollToLatest = useCallback((animated = true) => {
    shouldScrollToEndRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (shouldScrollToEndRef.current) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!match || loadingOlderRef.current || !hasMoreOlderRef.current || !canAutoLoadOlderRef.current) {
      return;
    }

    const current = messagesRef.current;
    if (current.length < CHAT_PAGE_SIZE) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    shouldScrollToEndRef.current = false;

    try {
      const older = await fetchOlderMessages(match.id, current[0].timestamp);
      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !ids.has(m.id));
        return [...unique, ...prev];
      });
      ensureSendersLoaded(older);
      ensureProposalsLoaded(older);
      setHasMoreOlder(older.length >= CHAT_PAGE_SIZE);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [match, ensureSendersLoaded, ensureProposalsLoaded]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    shouldScrollToEndRef.current = contentOffset.y <= 80;
    if (contentOffset.y > 120) {
      canAutoLoadOlderRef.current = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      shouldScrollToEndRef.current = true;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }, []),
  );

  const syncRead = useCallback(async () => {
    if (!match || !user) return;
    await markChatRead(match.id, user.id);
    await markChatNotificationsRead(match.id, user.id).catch(() => {});
    await fetchNotifications(user.id).catch(() => {});
  }, [match, user, fetchNotifications]);

  useEffect(() => {
    if (!user?.id || !canUseChat) return;
    fetchFriends(user.id).catch(() => {});
    fetchProfiles().catch(() => {});
  }, [user?.id, canUseChat, fetchFriends, fetchProfiles]);

  useEffect(() => {
    if (!match || !canUseChat) return;

    setActiveChatMatchId(match.id);
    setSuppressChatBannerMatchId(match.id);
    syncRead();

    return () => {
      setActiveChatMatchId(null);
      setSuppressChatBannerMatchId(null);
    };
  }, [match?.id, syncRead, canUseChat]);

  useEffect(() => {
    if (!match || !canUseChat) {
      setLoading(false);
      return;
    }

    let active = true;
    loadedSenderIdsRef.current.clear();
    canAutoLoadOlderRef.current = false;
    setMessages([]);
    setProposals({});
    setHasMoreOlder(false);
    setLoading(true);

    fetchRecentMessages(match.id)
      .then((msgs) => {
        if (!active) return;
        setMessages(msgs);
        setHasMoreOlder(msgs.length >= CHAT_PAGE_SIZE);
        ensureSendersLoaded(msgs);
        ensureProposalsLoaded(msgs);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchPendingProposals(match.id)
      .then((rows) => {
        if (!active) return;
        mergeProposals(rows);
        ensureSenderIdsLoaded(rows.map((p) => p.proposedBy));
      })
      .catch(() => {});

    const unsubscribeMessages = subscribeToMessages(match.id, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      ensureSendersLoaded([msg]);
      ensureProposalsLoaded([msg]);
      if (user && msg.senderId !== user.id) {
        syncRead();
      }
    });

    const unsubscribeProposals = subscribeToProposals(match.id, (proposal) => {
      setProposals((prev) => ({ ...prev, [proposal.id]: proposal }));
      ensureSenderIdsLoaded([proposal.proposedBy]);
      if (proposal.status === 'accepted') {
        refreshMatch(match.id).catch(() => {});
      }
    });

    return () => {
      active = false;
      unsubscribeMessages();
      unsubscribeProposals();
    };
  }, [
    match,
    user,
    syncRead,
    ensureSendersLoaded,
    ensureSenderIdsLoaded,
    ensureProposalsLoaded,
    mergeProposals,
    canUseChat,
    refreshMatch,
  ]);

  useEffect(() => {
    if (!match || !canUseChat) {
      setTransferCandidates([]);
      return;
    }

    let active = true;
    fetchMatchComposition(match.id)
      .then((composition) => {
        if (!active || !composition) {
          if (active) setTransferCandidates([]);
          return;
        }
        const candidates = composition.lineups.map((l) => {
          const profile = resolveParticipantUser(l.userId, match, getProfile);
          return {
            id: l.userId,
            name: profile?.name ?? 'Joueur',
            side: l.teamSide,
          };
        });
        setTransferCandidates(candidates);
      })
      .catch(() => {
        if (active) setTransferCandidates([]);
      });

    return () => {
      active = false;
    };
  }, [match, canUseChat, getProfile, proposals]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      const delay = Platform.OS === 'ios' ? event.duration ?? 250 : 100;
      setTimeout(() => scrollToLatest(), delay);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToLatest]);

  useEffect(() => {
    if (!loading && messages.length > 0 && shouldScrollToEndRef.current && !loadingOlderRef.current) {
      scrollToLatest(false);
    }
  }, [loading, messages.length, scrollToLatest]);

  const handleSend = async () => {
    if (!input.trim() || !user || !match || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(match.id, user.id, input.trim());
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setSenders((prev) => ({ ...prev, [user.id]: user }));
      setInput('');
      setTimeout(() => scrollToLatest(), 50);
    } finally {
      setSending(false);
    }
  };

  const handleProposeGuest = async (name: string, position: Position | null) => {
    if (!match || !user) return;
    const result = await createMatchProposal({
      matchId: match.id,
      proposalType: 'guest_add',
      payload: guestPayload(name, position),
      content: buildGuestProposalContent(name, position),
    });
    const proposal = await fetchProposalById(result.proposalId);
    if (proposal) {
      setProposals((prev) => ({ ...prev, [proposal.id]: proposal }));
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === result.messageId)) return prev;
      return [
        ...prev,
        {
          id: result.messageId,
          chatId: match.id,
          senderId: user.id,
          content: buildGuestProposalContent(name, position),
          timestamp: new Date().toISOString(),
          type: 'action',
          proposalId: result.proposalId,
        },
      ];
    });
    setSenders((prev) => ({ ...prev, [user.id]: user }));
    if (isOrganizer) {
      await refreshMatch(match.id).catch(() => {});
    }
    setTimeout(() => scrollToLatest(), 80);
  };

  const handleProposeTransfer = async (
    playerId: string,
    fromSide: TeamSide,
    toSide: TeamSide
  ) => {
    if (!match || !user) return;
    const candidate = transferCandidates.find((c) => c.id === playerId);
    const content = buildTransferProposalContent(
      candidate?.name ?? 'Un joueur',
      fromSide,
      toSide
    );
    const result = await createMatchProposal({
      matchId: match.id,
      proposalType: 'player_transfer',
      payload: transferPayload({
        playerId,
        playerName: candidate?.name ?? 'Un joueur',
        fromSide,
        toSide,
      }),
      content,
    });
    const proposal = await fetchProposalById(result.proposalId);
    if (proposal) {
      setProposals((prev) => ({ ...prev, [proposal.id]: proposal }));
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === result.messageId)) return prev;
      return [
        ...prev,
        {
          id: result.messageId,
          chatId: match.id,
          senderId: user.id,
          content,
          timestamp: new Date().toISOString(),
          type: 'action',
          proposalId: result.proposalId,
        },
      ];
    });
    setSenders((prev) => ({ ...prev, [user.id]: user }));
    if (isOrganizer) {
      await refreshMatch(match.id).catch(() => {});
    }
    setTimeout(() => scrollToLatest(), 80);
  };

  const handleProposeFriend = async (friendId: string, friendName: string) => {
    if (!match || !user) return;
    const content = buildFriendInviteProposalContent(friendName);
    const result = await createMatchProposal({
      matchId: match.id,
      proposalType: 'friend_invite',
      payload: friendInvitePayload(friendId, friendName),
      content,
    });
    const proposal = await fetchProposalById(result.proposalId);
    if (proposal) {
      setProposals((prev) => ({ ...prev, [proposal.id]: proposal }));
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === result.messageId)) return prev;
      return [
        ...prev,
        {
          id: result.messageId,
          chatId: match.id,
          senderId: user.id,
          content,
          timestamp: new Date().toISOString(),
          type: 'action',
          proposalId: result.proposalId,
        },
      ];
    });
    setSenders((prev) => ({ ...prev, [user.id]: user }));
    if (isOrganizer) {
      await refreshMatch(match.id).catch(() => {});
    }
    setTimeout(() => scrollToLatest(), 80);
  };

  const handleResolve = async (proposalId: string, accept: boolean) => {
    if (resolvingId) return;
    setResolvingId(proposalId);
    try {
      const updated = await resolveMatchProposal(proposalId, accept);
      setProposals((prev) => ({ ...prev, [updated.id]: updated }));
      if (accept && match) {
        await refreshMatch(match.id).catch(() => {});
      }
      const remaining = Object.values(proposals).filter(
        (p) => p.id !== proposalId && p.status === 'pending'
      ).length;
      if (remaining === 0) {
        setPendingSheetOpen(false);
      }
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible de traiter la proposition'
      );
    } finally {
      setResolvingId(null);
    }
  };

  const loadOlderFooter = hasMoreOlder ? (
    <View style={styles.loadOlder}>
      {loadingOlder ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Pressable
          onPress={() => {
            canAutoLoadOlderRef.current = true;
            loadOlderMessages();
          }}
          hitSlop={8}
        >
          <Text style={styles.loadOlderText}>Voir les messages précédents</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  if (matchLoading || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Match introuvable</Text>
        <Button title="Retour" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  if (!canUseChat) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedTitle}>Chat indisponible</Text>
        <Text style={styles.blockedText}>{getMatchChatAccessDeniedMessage()}</Text>
        <Button title="Retour au match" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const bottomInset = keyboardHeight > 0 ? keyboardHeight : insets.bottom;
  const canPropose = match.status === 'upcoming';

  return (
    <View style={styles.container}>
      {isOrganizer ? (
        <PendingProposalsBanner
          count={pendingProposals.length}
          onPress={() => setPendingSheetOpen(true)}
        />
      ) : null}

      <FlatList
        ref={listRef}
        inverted={displayMessages.length > 0}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          displayMessages.length === 0 && styles.listContentEmpty,
          { paddingTop: Spacing.md },
        ]}
        maintainVisibleContentPosition={
          displayMessages.length > 0 ? { minIndexForVisible: 0 } : undefined
        }
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.1}
        ListFooterComponent={loadOlderFooter}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        renderItem={({ item }) => {
          const sender = item.senderId === user?.id ? user : senders[item.senderId];
          const isOwn = item.senderId === user?.id;
          const canOpenProfile = !isOwn && item.senderId !== 'system' && !isDeletedUser(sender);
          const onSenderPress =
            canOpenProfile ? () => openUserProfile(router, item.senderId, sender) : undefined;

          if (item.type === 'action' && item.proposalId && proposals[item.proposalId]) {
            return (
              <ProposalCard
                proposal={proposals[item.proposalId]}
                isOrganizer={isOrganizer}
                senderName={sender?.name}
                senderAvatar={sender?.avatar}
                isOwn={isOwn}
                timestamp={item.timestamp}
                resolving={resolvingId === item.proposalId}
                onAccept={() => handleResolve(item.proposalId!, true)}
                onReject={() => handleResolve(item.proposalId!, false)}
                onSenderPress={onSenderPress}
              />
            );
          }

          return (
            <ChatBubble
              message={item}
              isOwn={isOwn}
              senderName={sender?.name}
              senderAvatar={sender?.avatar}
              onSenderPress={onSenderPress}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun message. Lance la conversation !</Text>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: Spacing.md + bottomInset }]}>
        {canPropose ? (
          <Pressable
            style={styles.proposeBtn}
            onPress={() => setProposeOpen(true)}
            hitSlop={6}
          >
            <Ionicons name="add" size={24} color={Colors.primary} />
          </Pressable>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          blurOnSubmit={false}
        />
        <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </Pressable>
      </View>

      <ProposeMenuModal
        visible={proposeOpen}
        onClose={() => setProposeOpen(false)}
        presentCount={presentCount}
        maxPlayers={match.maxPlayers}
        transferCandidates={transferCandidates}
        friendCandidates={friendCandidates}
        isOrganizer={isOrganizer}
        onProposeGuest={handleProposeGuest}
        onProposeTransfer={handleProposeTransfer}
        onProposeFriend={handleProposeFriend}
      />

      <PendingProposalsSheet
        visible={pendingSheetOpen}
        onClose={() => setPendingSheetOpen(false)}
        proposals={pendingProposals}
        proposerNames={proposerNames}
        resolvingId={resolvingId}
        onAccept={(proposalId) => handleResolve(proposalId, true)}
        onReject={(proposalId) => handleResolve(proposalId, false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  blockedTitle: { ...Typography.h3, color: Colors.text, textAlign: 'center' },
  blockedText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  loadOlder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  loadOlderText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: { color: Colors.textMuted, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  proposeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: Colors.background, fontSize: 18, fontWeight: '700' },
});
