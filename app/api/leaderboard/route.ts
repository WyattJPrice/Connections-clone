import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export interface LeaderboardEntry {
  userName: string;
  dailyCount: number;
  customCount: number;
  totalCount: number;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('puzzle_completions')
    .select('user_id, user_name, completion_type');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byUser = new Map<string, { userName: string; daily: number; custom: number }>();
  for (const row of data ?? []) {
    const existing = byUser.get(row.user_id) ?? { userName: row.user_name, daily: 0, custom: 0 };
    if (row.completion_type === 'daily') existing.daily += 1;
    else existing.custom += 1;
    byUser.set(row.user_id, existing);
  }

  const entries: LeaderboardEntry[] = Array.from(byUser.values())
    .map((u) => ({
      userName: u.userName,
      dailyCount: u.daily,
      customCount: u.custom,
      totalCount: u.daily + u.custom,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 50);

  return NextResponse.json({ entries });
}
