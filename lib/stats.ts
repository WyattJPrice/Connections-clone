'use client';

import { Stats } from './types';

const STATS_KEY = 'connections_stats';
const PLAYED_DATES_KEY = 'connections_played_dates';

const defaultStats: Stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  mistakeDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  perfectPuzzles: 0,
  purpleFirst: 0,
  lastPlayedDate: null,
  lastWonDate: null,
};

export function getStats(): Stats {
  if (typeof window === 'undefined') return defaultStats;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats;
    return { ...defaultStats, ...JSON.parse(raw) };
  } catch {
    return defaultStats;
  }
}

export function saveStats(stats: Stats): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function hasPlayedToday(puzzleDate: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PLAYED_DATES_KEY);
    const dates: string[] = raw ? JSON.parse(raw) : [];
    return dates.includes(puzzleDate);
  } catch {
    return false;
  }
}

export function getSavedGameState(puzzleDate: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`connections_game_${puzzleDate}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGameState(puzzleDate: string, state: object): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`connections_game_${puzzleDate}`, JSON.stringify(state));
}

export function recordGameResult(
  puzzleDate: string,
  mistakes: number,
  won: boolean,
  purpleFirst: boolean
): Stats {
  const stats = getStats();

  stats.gamesPlayed += 1;

  const today = puzzleDate;
  const yesterday = getPreviousDate(today);

  if (won) {
    stats.gamesWon += 1;
    const lastWon = stats.lastWonDate;
    if (lastWon === yesterday) {
      stats.currentStreak += 1;
    } else if (lastWon !== today) {
      stats.currentStreak = 1;
    }
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.lastWonDate = today;
    if (mistakes === 0) stats.perfectPuzzles += 1;
    if (purpleFirst) stats.purpleFirst += 1;
  } else {
    stats.currentStreak = 0;
  }

  stats.mistakeDistribution[mistakes] = (stats.mistakeDistribution[mistakes] ?? 0) + 1;
  stats.lastPlayedDate = today;

  // Record played date
  try {
    const raw = localStorage.getItem(PLAYED_DATES_KEY);
    const dates: string[] = raw ? JSON.parse(raw) : [];
    if (!dates.includes(puzzleDate)) {
      dates.push(puzzleDate);
      localStorage.setItem(PLAYED_DATES_KEY, JSON.stringify(dates));
    }
  } catch {
    // ignore
  }

  saveStats(stats);

  // Fire-and-forget to server for aggregate admin stats
  fetch('/api/game/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ puzzleDate, mistakes, won }),
  }).catch(() => {});

  return stats;
}

function getPreviousDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
