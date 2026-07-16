export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Foot = 'Gauche' | 'Droit' | 'Ambidextre';
export type AttendanceStatus = 'present' | 'absent' | 'maybe' | 'pending' | 'waitlist';
/** Nombre de joueurs par équipe (ex. 9 = 9v9) */
export type MatchFormat = number;

export const MATCH_FORMAT_PRESETS = [5, 6, 7, 8, 9, 11] as const;
export const SUBSTITUTE_PRESETS = [0, 1, 2, 3, 5] as const;
export type MatchStatus = 'upcoming' | 'live' | 'pending_stats' | 'completed' | 'cancelled';
export type MatchVisibility = 'public' | 'friends_only';

export interface User {
  id: string;
  email: string;
  name: string;
  /** Joueur ajouté manuellement par l'organisateur (sans compte Kojiro) */
  isGuest?: boolean;
  avatar: string;
  position: Position;
  foot: Foot;
  level: number;
  xp: number;
  xpToNextLevel: number;
  rating: number;
  city: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  badges: Badge[];
  stats: PlayerStats;
  createdAt: string;
  deletedAt?: string | null;
}

export interface PlayerStats {
  matchesPlayed: number;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
  mvpCount: number;
  averageRating: number;
  averageFairPlay: number;
  averageDefensiveRating: number;
  fairPlayScore: number;
  shotsOnTarget: number;
  passAccuracy: number;
  minutesPlayed: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: string;
}

export interface Match {
  id: string;
  title: string;
  format: MatchFormat;
  substitutesPerTeam: number;
  visibility: MatchVisibility;
  date: string;
  time: string;
  location: Location;
  pricePerPlayer: number;
  description?: string;
  organizerId: string;
  maxPlayers: number;
  status: MatchStatus;
  /** Organisateur a clos le recrutement (inscriptions / invitations) */
  recruitmentClosed?: boolean;
  attendees: MatchAttendee[];
  teams?: Team[];
  chatId: string;
  imageUrl?: string;
  tournamentId?: string;
}

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface MatchAttendee {
  id?: string;
  userId?: string;
  guestName?: string;
  guestPosition?: Position;
  status: AttendanceStatus;
  teamId?: string;
  joinedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
  averageLevel: number;
}

export type MatchProposalType = 'guest_add' | 'player_transfer' | 'team_split' | 'friend_invite';
export type MatchProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface GuestAddProposalPayload {
  guest_name: string;
  guest_position?: Position | null;
}

export interface PlayerTransferProposalPayload {
  player_id: string;
  player_name: string;
  from_side: 'A' | 'B';
  to_side: 'A' | 'B';
}

export interface FriendInviteProposalPayload {
  user_id: string;
  user_name: string;
}

export interface TeamSplitProposalPayload {
  formation_a: string;
  formation_b: string;
  team_a_names?: string[];
  team_b_names?: string[];
  lineups: {
    user_id?: string;
    attendee_id?: string;
    team_side: 'A' | 'B';
    slot_id?: string;
    pos_x?: string;
    pos_y?: string;
  }[];
}

export type MatchProposalPayload =
  | GuestAddProposalPayload
  | PlayerTransferProposalPayload
  | TeamSplitProposalPayload
  | FriendInviteProposalPayload;

export interface MatchProposal {
  id: string;
  matchId: string;
  proposedBy: string;
  proposalType: MatchProposalType;
  payload: MatchProposalPayload;
  status: MatchProposalStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'system' | 'action';
  proposalId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  format: MatchFormat;
  startDate: string;
  endDate: string;
  location: Location;
  maxTeams: number;
  registeredTeams: number;
  prize?: string;
  status: 'registration' | 'ongoing' | 'completed';
  organizerId: string;
}

export interface SocialPost {
  id: string;
  authorId: string;
  type: 'photo' | 'video' | 'result';
  content: string;
  mediaUrl?: string;
  matchId?: string;
  likes: number;
  comments: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
  change?: number;
}

export interface Notification {
  id: string;
  type: 'match_invite' | 'match_invite_suggestion' | 'match_reminder' | 'match_recap' | 'match_stats' | 'match_waitlist' | 'team_assigned' | 'chat_message' | 'social' | 'tournament' | 'friend_request' | 'friend_match_created';
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, string>;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  category: string;
  publishedAt: string;
}

export interface MatchHistory {
  id: string;
  matchId: string;
  title: string;
  date: string;
  result: string;
  score: string;
  rating: number;
  fairPlay: number;
  defRating: number;
  goals: number;
  assists: number;
  mvp: boolean;
}

export interface MatchRecapPlayer {
  userId: string;
  name: string;
  avatarUrl: string | null;
  team: 'A' | 'B';
  goals: number;
  assists: number;
  rating: number;
  fairPlay: number;
  defRating: number;
  mvp: boolean;
  result: string;
  isGuest?: boolean;
}

export interface MatchRecap {
  matchId: string;
  title: string;
  date: string;
  locationName: string;
  format: number;
  score: string;
  teamAScore: number;
  teamBScore: number;
  players: MatchRecapPlayer[];
  mvp: { userId: string; name: string; isGuest?: boolean } | null;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
}
