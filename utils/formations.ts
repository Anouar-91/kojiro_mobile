import { FormationSlot } from '@/types/lineup';
import { Position } from '@/types';

export interface FormationLayout {
  def: number;
  mid: number;
  fwd: number;
}

const DEFAULT_FIELD_LAYOUTS: Record<number, FormationLayout> = {
  4: { def: 2, mid: 1, fwd: 1 },
  5: { def: 2, mid: 2, fwd: 1 },
  6: { def: 2, mid: 3, fwd: 1 },
  7: { def: 2, mid: 3, fwd: 2 },
  8: { def: 3, mid: 3, fwd: 2 },
  9: { def: 3, mid: 4, fwd: 2 },
  10: { def: 4, mid: 4, fwd: 2 },
  14: { def: 4, mid: 5, fwd: 4 },
};

export function getFieldPlayerCount(playersPerTeam: number): number {
  return Math.max(playersPerTeam - 1, 1);
}

export function formatFormationLabel(layout: FormationLayout): string {
  return `${layout.def}-${layout.mid}-${layout.fwd}`;
}

export function parseFormationLabel(label: string): FormationLayout | null {
  const parts = label.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => isNaN(n) || n < 0)) return null;
  return { def: parts[0], mid: parts[1], fwd: parts[2] };
}

export function isValidFormation(layout: FormationLayout, playersPerTeam: number): boolean {
  const field = getFieldPlayerCount(playersPerTeam);
  const total = layout.def + layout.mid + layout.fwd;
  return total === field && layout.def >= 1 && layout.fwd >= 1 && layout.mid >= 0;
}

export function getDefaultFormation(playersPerTeam: number): FormationLayout {
  const field = getFieldPlayerCount(playersPerTeam);
  return (
    DEFAULT_FIELD_LAYOUTS[field] ?? {
      def: 2,
      mid: Math.max(field - 4, 1),
      fwd: 2,
    }
  );
}

/** Toutes les formations valides pour ce format, triées (plus de DEF d'abord). */
export function getValidFormations(playersPerTeam: number): FormationLayout[] {
  const field = getFieldPlayerCount(playersPerTeam);
  const results: FormationLayout[] = [];
  const seen = new Set<string>();

  for (let def = 1; def <= Math.min(5, field - 1); def++) {
    for (let fwd = 1; fwd <= Math.min(4, field - def); fwd++) {
      const mid = field - def - fwd;
      if (mid < 0) continue;
      const layout = { def, mid, fwd };
      const key = formatFormationLabel(layout);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(layout);
      }
    }
  }

  return results.sort((a, b) => b.def - a.def || b.mid - a.mid);
}

function spreadRow(count: number, y: number, role: FormationSlot['role'], prefix: string): FormationSlot[] {
  if (count <= 0) return [];
  const slots: FormationSlot[] = [];
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0.5 : 0.15 + (0.7 * i) / (count - 1);
    slots.push({
      id: `${prefix}-${i}`,
      label: role,
      role,
      x,
      y,
    });
  }
  return slots;
}

export function buildFormationSlotsFromLayout(layout: FormationLayout): FormationSlot[] {
  return [
    { id: 'gk', label: 'GK', role: 'GK', x: 0.5, y: 0.88 },
    ...spreadRow(layout.def, 0.72, 'DEF', 'def'),
    ...spreadRow(layout.mid, 0.5, 'MID', 'mid'),
    ...spreadRow(layout.fwd, 0.28, 'FWD', 'fwd'),
  ];
}

export function buildFormationSlots(playersPerTeam: number, layout?: FormationLayout): FormationSlot[] {
  const resolved = layout ?? getDefaultFormation(playersPerTeam);
  return buildFormationSlotsFromLayout(resolved);
}

/** @deprecated Utiliser formatFormationLabel(getDefaultFormation(n)) */
export function getFormationLabel(playersPerTeam: number): string {
  return formatFormationLabel(getDefaultFormation(playersPerTeam));
}

export function autoFillLineup(
  playerIds: string[],
  slots: FormationSlot[],
  getPosition?: (playerId: string) => Position | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  const pool = [...playerIds];

  const takePlayer = (role?: Position): string | undefined => {
    if (role && getPosition) {
      const idx = pool.findIndex((id) => getPosition(id) === role);
      if (idx >= 0) return pool.splice(idx, 1)[0];
    }
    return pool.shift();
  };

  for (const slot of slots) {
    const player = takePlayer(getPosition ? slot.role : undefined);
    if (player) map[player] = slot.id;
  }

  for (const id of pool) {
    map[id] = 'bench';
  }

  return map;
}

/** Retire les assignations dont le slot n'existe plus après changement de formation. */
export function pruneSlotAssignments(
  assignments: Record<string, string>,
  validSlotIds: Set<string>
): Record<string, string> {
  const next: Record<string, string> = {};
  Object.entries(assignments).forEach(([slotId, userId]) => {
    if (validSlotIds.has(slotId)) next[slotId] = userId;
  });
  return next;
}
