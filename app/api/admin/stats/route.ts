import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

function isAuthorized(req: NextRequest) {
  return req.cookies.get('admin_token')?.value === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabaseAdmin
    .from('game_results')
    .select('puzzle_date, won, mistakes, completed_at')
    .order('puzzle_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = rows ?? [];

  // Today's stats
  const todayRows = all.filter((r) => r.puzzle_date === today);
  const todayPlays = todayRows.length;
  const todayWins = todayRows.filter((r) => r.won).length;

  // All-time stats
  const totalPlays = all.length;
  const totalWins = all.filter((r) => r.won).length;

  // Mistake distribution (all-time, wins only)
  const mistakeDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of all) {
    mistakeDist[r.mistakes] = (mistakeDist[r.mistakes] ?? 0) + 1;
  }

  // Longest streak: consecutive days with at least one win
  const wonDates = [...new Set(all.filter((r) => r.won).map((r) => r.puzzle_date))].sort();
  let longestStreak = wonDates.length > 0 ? 1 : 0;
  let currentStreak = wonDates.length > 0 ? 1 : 0;
  for (let i = 1; i < wonDates.length; i++) {
    const prev = new Date(wonDates[i - 1] + 'T00:00:00');
    const curr = new Date(wonDates[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  // Per-puzzle breakdown (most recent 10)
  const byPuzzle: Record<string, { plays: number; wins: number; date: string }> = {};
  for (const r of all) {
    if (!byPuzzle[r.puzzle_date]) byPuzzle[r.puzzle_date] = { plays: 0, wins: 0, date: r.puzzle_date };
    byPuzzle[r.puzzle_date].plays++;
    if (r.won) byPuzzle[r.puzzle_date].wins++;
  }
  const puzzleBreakdown = Object.values(byPuzzle)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return NextResponse.json({
    today: { plays: todayPlays, wins: todayWins },
    allTime: { plays: totalPlays, wins: totalWins },
    longestStreak,
    mistakeDist,
    puzzleBreakdown,
  });
}
