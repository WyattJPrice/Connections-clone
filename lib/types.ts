export type Color = 'yellow' | 'blue' | 'green' | 'purple';

export interface Category {
  id: string;
  name: string;
  color: Color;
  words: string[];
  creatorName?: string;
}

export interface UserCategory {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  words: string[];
  createdAt: string;
  playCount: number;
}

export interface UserProfile {
  id: string;
  firstName: string;
  email: string;
}

export interface Puzzle {
  id: string;
  puzzleDate: string; // YYYY-MM-DD
  puzzleNumber: number;
  categories: Category[];
}

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  mistakeDistribution: Record<number, number>;
  perfectPuzzles: number;
  purpleFirst: number;
  lastPlayedDate: string | null;
  lastWonDate: string | null;
  customWins: number;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';
