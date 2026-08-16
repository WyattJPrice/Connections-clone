import { Stats } from './types';

export interface StoredGameResult {
  user_id: string;
  dedupe_key: string;
  completion_type: 'daily' | 'custom';
  puzzle_date: string | null;
  won: boolean;
  mistakes: number;
  purple_first: boolean;
  played_at: string;
}

function previousDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Recompute the account-wide Stats object from a user's logged game results.
 * Mirrors the client-side accumulation in lib/stats.ts so streaks, mistake
 * distribution, perfect puzzles and purple-first all line up.
 */
export function computeStatsFromResults(rows: StoredGameResult[]): Stats {
  const daily = rows.filter((r) => r.completion_type === 'daily');
  const wonDaily = daily.filter((r) => r.won);

  const mistakeDistribution: Stats['mistakeDistribution'] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of daily) {
    mistakeDistribution[r.mistakes] = (mistakeDistribution[r.mistakes] ?? 0) + 1;
  }

  // Streak: count consecutive win dates; reset to 1 on a gap.
  const wonDates = [...new Set(wonDaily.map((r) => r.puzzle_date as string))].sort();
  let currentStreak = 0;
  let maxStreak = 0;
  let lastWon: string | null = null;
  for (const d of wonDates) {
    if (lastWon === null) {
      currentStreak = 1;
    } else if (lastWon === previousDate(d)) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    lastWon = d;
  }

  const playedDates = daily.map((r) => r.puzzle_date as string).sort();
  return {
    gamesPlayed: daily.length,
    gamesWon: wonDaily.length,
    currentStreak,
    maxStreak,
    mistakeDistribution,
    perfectPuzzles: wonDaily.filter((r) => r.mistakes === 0).length,
    purpleFirst: wonDaily.filter((r) => r.purple_first).length,
    lastPlayedDate: playedDates.length ? playedDates[playedDates.length - 1] : null,
    lastWonDate: lastWon,
    customWins: rows.filter((r) => r.completion_type === 'custom' && r.won).length,
  };
}