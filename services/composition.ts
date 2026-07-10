import { guestPlayerId, parseGuestPlayerId } from '@/utils/guestAttendees';
import { supabase } from '@/lib/supabase';
import { LineupPlacement, MatchComposition, TeamSide } from '@/types/lineup';

export async function fetchMatchComposition(matchId: string): Promise<MatchComposition | null> {
  const [metaRes, lineupsRes] = await Promise.all([
    supabase.from('match_compositions').select('*').eq('match_id', matchId).maybeSingle(),
    supabase.from('match_lineups').select('*').eq('match_id', matchId),
  ]);

  if (metaRes.error) throw new Error(metaRes.error.message);
  if (lineupsRes.error) throw new Error(lineupsRes.error.message);

  if (!metaRes.data && (lineupsRes.data?.length ?? 0) === 0) return null;

  const meta = metaRes.data;
  return {
    matchId,
    formationA: meta?.formation_a ?? 'auto',
    formationB: meta?.formation_b ?? 'auto',
    captainAId: meta?.captain_a_id ?? undefined,
    captainBId: meta?.captain_b_id ?? undefined,
    validatedAt: meta?.validated_at ?? undefined,
    lineups: (lineupsRes.data ?? []).map((row) => ({
      userId: row.user_id ?? guestPlayerId(row.attendee_id),
      teamSide: row.team_side as TeamSide,
      slotId: row.slot_id,
      posX: row.pos_x ?? undefined,
      posY: row.pos_y ?? undefined,
    })),
  };
}

export async function saveMatchComposition(
  matchId: string,
  formationA: string,
  formationB: string,
  lineups: LineupPlacement[],
  options?: { publish?: boolean; editSide?: TeamSide | null }
): Promise<void> {
  const { error } = await supabase.rpc('save_match_composition', {
    p_match_id: matchId,
    p_formation_a: formationA,
    p_formation_b: formationB,
    p_lineups: lineups.map((l) => {
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
    p_publish: options?.publish ?? false,
    p_edit_side: options?.editSide ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function assignMatchCaptains(
  matchId: string,
  captainAId: string | null,
  captainBId: string | null
): Promise<void> {
  const { error } = await supabase.rpc('assign_match_captains', {
    p_match_id: matchId,
    p_captain_a_id: captainAId,
    p_captain_b_id: captainBId,
  });

  if (error) throw new Error(error.message);
}

export function getTeamPlayerIds(composition: MatchComposition | null, side: TeamSide): string[] {
  if (!composition) return [];
  return composition.lineups.filter((l) => l.teamSide === side).map((l) => l.userId);
}

export function getSlotAssignments(
  composition: MatchComposition | null,
  side: TeamSide
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!composition) return map;
  composition.lineups
    .filter((l) => l.teamSide === side && l.slotId)
    .forEach((l) => {
      map[l.slotId!] = l.userId;
    });
  return map;
}

export function buildLineupsFromState(
  teamAIds: string[],
  teamBIds: string[],
  slotsA: Record<string, string>,
  slotsB: Record<string, string>,
  formationSlotsA: { id: string; x: number; y: number }[],
  formationSlotsB: { id: string; x: number; y: number }[]
): LineupPlacement[] {
  const posMapA = Object.fromEntries(formationSlotsA.map((s) => [s.id, s]));
  const posMapB = Object.fromEntries(formationSlotsB.map((s) => [s.id, s]));
  const lineups: LineupPlacement[] = [];

  const uniqueA = [...new Set(teamAIds)];
  const uniqueB = [...new Set(teamBIds)].filter((id) => !uniqueA.includes(id));

  const addTeam = (
    ids: string[],
    side: TeamSide,
    assignments: Record<string, string>,
    posMap: Record<string, { x: number; y: number }>
  ) => {
    const slotByUser = Object.fromEntries(
      Object.entries(assignments).map(([slotId, userId]) => [userId, slotId])
    );
    const added = new Set<string>();
    ids.forEach((userId) => {
      if (added.has(userId)) return;
      added.add(userId);
      const slotId = slotByUser[userId] ?? 'bench';
      const pos = slotId !== 'bench' ? posMap[slotId] : undefined;
      lineups.push({
        userId,
        teamSide: side,
        slotId: slotId === 'bench' ? null : slotId,
        posX: pos?.x,
        posY: pos?.y,
      });
    });
  };

  addTeam(uniqueA, 'A', slotsA, posMapA);
  addTeam(uniqueB, 'B', slotsB, posMapB);
  return lineups;
}

export function normalizeTeamRosters(teamAIds: string[], teamBIds: string[]): {
  teamAIds: string[];
  teamBIds: string[];
} {
  const teamA = [...new Set(teamAIds)];
  const teamB = [...new Set(teamBIds)].filter((id) => !teamA.includes(id));
  return { teamAIds: teamA, teamBIds: teamB };
}

export function filterRostersToPresent(
  teamAIds: string[],
  teamBIds: string[],
  presentIds: string[]
): { teamAIds: string[]; teamBIds: string[]; removedIds: string[] } {
  const presentSet = new Set(presentIds);
  const removedIds = [...new Set([...teamAIds, ...teamBIds])].filter((id) => !presentSet.has(id));
  return {
    teamAIds: teamAIds.filter((id) => presentSet.has(id)),
    teamBIds: teamBIds.filter((id) => presentSet.has(id)),
    removedIds,
  };
}

export function filterSlotAssignmentsToPresent(
  slots: Record<string, string>,
  presentIds: string[]
): Record<string, string> {
  const presentSet = new Set(presentIds);
  const next = { ...slots };
  for (const [slotId, userId] of Object.entries(next)) {
    if (!presentSet.has(userId)) delete next[slotId];
  }
  return next;
}
