import { Match } from '@/types';
import { isMatchAwaitingStats } from '@/utils/matchDates';

export type MatchActionId =
  | 'invite'
  | 'add_guest'
  | 'suggest_friend'
  | 'compose'
  | 'view_lineup'
  | 'close_recruitment'
  | 'reopen_recruitment'
  | 'open_stats'
  | 'finalize_stats'
  | 'close_simple'
  | 'cancel_match'
  | 'view_recap'
  | 'reopen_stats';

export interface MatchActionContext {
  match: Match;
  isOrganizer: boolean;
  presentCount: number;
  hasComposition: boolean;
  hasLineups: boolean;
  canCompose: boolean;
  composeLabel: string;
  canAddPlayers: boolean;
  canSuggest: boolean;
  isRegisteredPresent: boolean;
  now?: number;
}

export interface ResolvedMatchAction {
  id: MatchActionId;
  title: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  destructive?: boolean;
}

function actionMeta(
  id: MatchActionId,
  ctx: MatchActionContext
): Omit<ResolvedMatchAction, 'id'> {
  switch (id) {
    case 'invite':
      return { title: 'Inviter des joueurs', icon: 'person-add-outline', variant: 'outline' };
    case 'add_guest':
      return { title: 'Ajouter un joueur sans compte', icon: 'person-outline', variant: 'outline' };
    case 'suggest_friend':
      return { title: 'Proposer un ami', icon: 'person-add-outline', variant: 'outline' };
    case 'compose':
      return { title: ctx.composeLabel, icon: 'football-outline', variant: 'primary' };
    case 'view_lineup':
      return { title: 'Voir la composition', icon: 'eye-outline', variant: 'outline' };
    case 'close_recruitment':
      return { title: 'Fermer le recrutement', icon: 'lock-closed-outline', variant: 'outline' };
    case 'reopen_recruitment':
      return { title: 'Rouvrir le recrutement', icon: 'lock-open-outline', variant: 'outline' };
    case 'open_stats':
      return { title: 'Saisie détaillée des stats', icon: 'stats-chart-outline', variant: 'outline' };
    case 'finalize_stats':
      return {
        title: ctx.isOrganizer ? 'Finaliser les stats' : 'Saisir mes stats',
        icon: 'stats-chart-outline',
        variant: 'primary',
      };
    case 'close_simple':
      return { title: 'Clôturer le match', icon: 'checkmark-done-outline', variant: 'primary' };
    case 'cancel_match':
      return {
        title: 'Annuler le match',
        icon: 'close-circle-outline',
        variant: 'ghost',
        destructive: true,
      };
    case 'view_recap':
      return { title: 'Voir le résumé', icon: 'document-text-outline', variant: 'primary' };
    case 'reopen_stats':
      return { title: 'Rouvrir les stats', icon: 'refresh-outline', variant: 'outline' };
  }
}

function resolve(id: MatchActionId, ctx: MatchActionContext): ResolvedMatchAction {
  return { id, ...actionMeta(id, ctx) };
}

/** CTA principale selon la phase du match. */
export function getPrimaryMatchAction(ctx: MatchActionContext): ResolvedMatchAction | null {
  const { match, isOrganizer } = ctx;
  const now = ctx.now ?? Date.now();
  const status = match.status;

  const asPrimary = (id: MatchActionId): ResolvedMatchAction => ({
    ...resolve(id, ctx),
    variant: 'primary',
  });

  if (status === 'cancelled') {
    return ctx.hasLineups ? asPrimary('view_lineup') : null;
  }

  if (status === 'completed') {
    return asPrimary('view_recap');
  }

  if (status === 'pending_stats') {
    if (isOrganizer || ctx.isRegisteredPresent) {
      return asPrimary('finalize_stats');
    }
    return ctx.hasLineups ? asPrimary('view_lineup') : null;
  }

  // Post coup d'envoi : clôturer (simple) en priorité pour l'orga
  if (isOrganizer && isMatchAwaitingStats(match, now) && status !== 'pending_stats') {
    return asPrimary('close_simple');
  }

  if (!isOrganizer) {
    if (ctx.hasLineups) return asPrimary('view_lineup');
    if (ctx.canSuggest) return asPrimary('suggest_friend');
    return null;
  }

  // Orga, avant / pendant préparation
  if (status === 'live') {
    return asPrimary('close_simple');
  }

  if (status === 'upcoming') {
    const recruitmentClosed = match.recruitmentClosed === true;
    if (!ctx.hasComposition && ctx.presentCount >= 2 && ctx.canCompose) {
      return asPrimary('compose');
    }
    if (!recruitmentClosed && ctx.canAddPlayers) {
      return asPrimary('invite');
    }
    if (recruitmentClosed && !ctx.hasComposition && ctx.canCompose) {
      return asPrimary('compose');
    }
    if (ctx.hasLineups) {
      return asPrimary('view_lineup');
    }
    if (ctx.canCompose) {
      return asPrimary('compose');
    }
  }

  return null;
}

/** Actions secondaires (menu Plus), hors CTA primaire. */
export function getSecondaryMatchActions(ctx: MatchActionContext): ResolvedMatchAction[] {
  const { match, isOrganizer } = ctx;
  const primary = getPrimaryMatchAction(ctx);
  const primaryId = primary?.id;
  const ids: MatchActionId[] = [];
  const status = match.status;
  const terminal = status === 'completed' || status === 'cancelled';

  const push = (id: MatchActionId) => {
    if (id !== primaryId && !ids.includes(id)) ids.push(id);
  };

  if (isOrganizer && !terminal) {
    if (status === 'upcoming' && !match.recruitmentClosed) push('close_recruitment');
    if (status === 'upcoming' && match.recruitmentClosed) push('reopen_recruitment');
    if (ctx.canAddPlayers) {
      push('invite');
      push('add_guest');
    }
    if (ctx.canCompose) push('compose');
    if (ctx.hasLineups || (!ctx.canCompose && ctx.hasComposition)) push('view_lineup');

    // Stats : détaillées en secondaire ; clôture simple aussi (avant/après kickoff)
    if (status === 'upcoming' || status === 'live') {
      push('open_stats');
      push('close_simple');
    }

    if (status === 'pending_stats') {
      push('close_simple');
    }

    push('cancel_match');
  }

  if (isOrganizer && status === 'completed') {
    push('view_recap');
    if (!match.completedWithoutStats) push('reopen_stats');
    if (ctx.hasLineups) push('view_lineup');
  }

  if (isOrganizer && status === 'cancelled' && ctx.hasLineups) {
    push('view_lineup');
  }

  if (!isOrganizer) {
    if (status === 'pending_stats' && ctx.isRegisteredPresent) push('finalize_stats');
    if (ctx.hasLineups) push('view_lineup');
    if (ctx.canSuggest && !terminal) push('suggest_friend');
  }

  return ids.map((id) => resolve(id, ctx));
}
