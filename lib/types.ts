export type Color = 'yellow' | 'blue' | 'green' | 'purple';

export interface Category {
  id: string;
  name: string;
  color: Color;
  words: string[];
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
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';
