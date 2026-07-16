import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  GuestAddProposalPayload,
  MatchProposal,
  MatchProposalPayload,
  MatchProposalType,
  PlayerTransferProposalPayload,
  Position,
  FriendInviteProposalPayload,
  TeamSplitProposalPayload,
} from '@/types';
import { LineupPlacement } from '@/types/lineup';
import { parseGuestPlayerId } from '@/utils/guestAttendees';

type ProposalRow = {
  id: string;
  match_id: string;
  proposed_by: string;
  proposal_type: string;
  payload: MatchProposalPayload;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

type ProposalListener = (proposal: MatchProposal) => void;

type ProposalChannel = {
  channel: RealtimeChannel;
  listeners: Set<ProposalListener>;
};

const proposalChannels = new Map<string, ProposalChannel>();

function mapProposal(row: ProposalRow): MatchProposal {
  return {
    id: row.id,
    matchId: row.match_id,
    proposedBy: row.proposed_by,
    proposalType: row.proposal_type as MatchProposalType,
    payload: row.payload,
    status: row.status as MatchProposal['status'],
    resolvedBy: row.resolved_by ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchProposalsByIds(ids: string[]): Promise<MatchProposal[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from('match_proposals')
    .select('*')
    .in('id', unique);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapProposal(row as ProposalRow));
}

export async function fetchPendingProposals(matchId: string): Promise<MatchProposal[]> {
  const { data, error } = await supabase
    .from('match_proposals')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapProposal(row as ProposalRow));
}

export async function createMatchProposal(params: {
  matchId: string;
  proposalType: MatchProposalType;
  payload: MatchProposalPayload;
  content: string;
}): Promise<{ messageId: string; proposalId: string }> {
  const { data, error } = await supabase.rpc('create_match_proposal', {
    p_match_id: params.matchId,
    p_proposal_type: params.proposalType,
    p_payload: params.payload,
    p_content: params.content,
  });

  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.message_id || !row?.proposal_id) {
    throw new Error('Réponse proposition invalide');
  }

  return {
    messageId: row.message_id as string,
    proposalId: row.proposal_id as string,
  };
}

export async function fetchProposalById(id: string): Promise<MatchProposal | null> {
  const { data, error } = await supabase
    .from('match_proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProposal(data as ProposalRow);
}

export async function resolveMatchProposal(
  proposalId: string,
  accept: boolean
): Promise<MatchProposal> {
  const { data, error } = await supabase.rpc('resolve_match_proposal', {
    p_proposal_id: proposalId,
    p_accept: accept,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Proposition introuvable');

  return mapProposal(data as ProposalRow);
}

export function subscribeToProposals(
  matchId: string,
  onProposal: ProposalListener
): () => void {
  let entry = proposalChannels.get(matchId);

  if (!entry) {
    const listeners = new Set<ProposalListener>();
    const channel = supabase
      .channel(`proposals:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_proposals',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as ProposalRow | undefined;
          if (!row?.id) return;
          if (payload.new) {
            listeners.forEach((listener) => listener(mapProposal(payload.new as ProposalRow)));
          }
        }
      )
      .subscribe();

    entry = { channel, listeners };
    proposalChannels.set(matchId, entry);
  }

  entry.listeners.add(onProposal);

  return () => {
    const current = proposalChannels.get(matchId);
    if (!current) return;
    current.listeners.delete(onProposal);
    if (current.listeners.size === 0) {
      supabase.removeChannel(current.channel);
      proposalChannels.delete(matchId);
    }
  };
}

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Gardien',
  DEF: 'Défenseur',
  MID: 'Milieu',
  FWD: 'Attaquant',
};

export function buildGuestProposalContent(
  name: string,
  position: Position | null
): string {
  if (position) {
    return `Propose d'ajouter ${name} (${POSITION_LABELS[position]}, sans compte)`;
  }
  return `Propose d'ajouter ${name} (sans compte)`;
}

export function buildTransferProposalContent(
  playerName: string,
  fromSide: 'A' | 'B',
  toSide: 'A' | 'B'
): string {
  return `Propose de transférer ${playerName} : équipe ${fromSide} → ${toSide}`;
}

export function buildTeamSplitProposalContent(
  teamACount: number,
  teamBCount: number
): string {
  return `Propose une composition : ${teamACount} vs ${teamBCount}`;
}

export function buildFriendInviteProposalContent(friendName: string): string {
  return `Propose d'inviter ${friendName}`;
}

export function guestPayload(
  name: string,
  position: Position | null
): GuestAddProposalPayload {
  return {
    guest_name: name.trim(),
    guest_position: position,
  };
}

export function friendInvitePayload(
  userId: string,
  userName: string
): FriendInviteProposalPayload {
  return {
    user_id: userId,
    user_name: userName.trim() || 'Un ami',
  };
}

export function transferPayload(params: {
  playerId: string;
  playerName: string;
  fromSide: 'A' | 'B';
  toSide: 'A' | 'B';
}): PlayerTransferProposalPayload {
  return {
    player_id: params.playerId,
    player_name: params.playerName,
    from_side: params.fromSide,
    to_side: params.toSide,
  };
}

export function teamSplitPayload(params: {
  formationA: string;
  formationB: string;
  teamANames: string[];
  teamBNames: string[];
  lineups: LineupPlacement[];
}): TeamSplitProposalPayload {
  return {
    formation_a: params.formationA,
    formation_b: params.formationB,
    team_a_names: params.teamANames,
    team_b_names: params.teamBNames,
    lineups: params.lineups.map((l) => {
      const attendeeId = parseGuestPlayerId(l.userId);
      if (attendeeId) {
        return {
          attendee_id: attendeeId,
          team_side: l.teamSide,
          slot_id: l.slotId ?? '',
          pos_x: l.posX != null ? String(l.posX) : '',
          pos_y: l.posY != null ? String(l.posY) : '',
        };
      }
      return {
        user_id: l.userId,
        team_side: l.teamSide,
        slot_id: l.slotId ?? '',
        pos_x: l.posX != null ? String(l.posX) : '',
        pos_y: l.posY != null ? String(l.posY) : '',
      };
    }),
  };
}
