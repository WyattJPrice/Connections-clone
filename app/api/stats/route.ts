import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { computeStatsFromResults, StoredGameResult } from '@/lib/stats-server';

const TABLE = 'user_game_results';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ stats: null }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select('*')
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stats: computeStatsFromResults((data ?? []) as StoredGameResult[]) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { type, puzzleDate, won, mistakes, purpleFirst } = body ?? {};

  if (type !== 'daily' && type !== 'custom') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (typeof won !== 'boolean') {
    return NextResponse.json({ error: 'Invalid won' }, { status: 400 });
  }
  if (!Number.isInteger(mistakes) || mistakes < 0 || mistakes > 4) {
    return NextResponse.json({ error: 'Invalid mistakes' }, { status: 400 });
  }
  if (type === 'daily' && typeof puzzleDate !== 'string') {
    return NextResponse.json({ error: 'Missing puzzleDate' }, { status: 400 });
  }

  const dedupeKey =
    type === 'daily' ? `daily:${puzzleDate}` : `custom:${crypto.randomUUID()}`;

  const supabase = getSupabaseAdmin();

  // Daily puzzles are recorded once per date. If a result already exists,
  // prefer a win and the fewest mistakes so replaying on another device
  // doesn't inflate or degrade the account's history.
  const existing = await supabase
    .from(TABLE)
    .select('won, mistakes, purple_first')
    .eq('user_id', session.user.id)
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        won: existing.data.won || won,
        mistakes: Math.min(existing.data.mistakes, mistakes),
        purple_first: won ? !!purpleFirst : existing.data.purple_first,
      })
      .eq('user_id', session.user.id)
      .eq('dedupe_key', dedupeKey);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from(TABLE).insert({
    user_id: session.user.id,
    dedupe_key: dedupeKey,
    completion_type: type,
    puzzle_date: type === 'daily' ? puzzleDate : null,
    won,
    mistakes,
    purple_first: type === 'daily' ? !!purpleFirst : false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}