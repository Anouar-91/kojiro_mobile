export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
export type Foot = 'Gauche' | 'Droit' | 'Ambidextre';
export type AttendanceStatus = 'present' | 'absent' | 'maybe' | 'pending';
export type MatchFormat = 5 | 7 | 11;
export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  position: Position;
  foot: Foot;
  level: number;
  xp: number;
  xpToNextLevel: number;
  rating: number;
  city: string;
  bio?: string;
  badges: Badge[];
  stats: PlayerStats;
  createdAt: string;
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
  date: string;
  time: string;
  location: Location;
  pricePerPlayer: number;
  description?: string;
  organizerId: string;
  maxPlayers: number;
  status: MatchStatus;
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
  userId: string;
  status: AttendanceStatus;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
  averageLevel: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'system';
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
  type: 'match_invite' | 'match_reminder' | 'team_assigned' | 'social' | 'tournament';
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
  goals: number;
  assists: number;
  mvp: boolean;
}
