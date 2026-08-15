import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// How recently a heartbeat must be to count the user as online. Matches
// Pictionary so both apps' messaging lists treat "online" the same way, and is
// comfortably larger than the 60s hidden-tab background ping (which browsers
// throttle to ~once a minute for backgrounded pages).
const ONLINE_WINDOW_SECONDS = 120;

export async function GET() {
  const cutoffMs = Date.now() - ONLINE_WINDOW_SECONDS * 1000;

  // Everyone who has ever been present, freshest first, deduped by user — so
  // offline players still show up with their last-seen time and can be DMed.
  const { data: presences, error: presenceError } = await supabaseAdmin
    .from('presence_heartbeats')
    .select('user_id, game, last_seen_at, last_active_at')
    .order('last_active_at', { ascending: false });

  if (presenceError) {
    console.error('[presence] presence query error:', presenceError);
    return NextResponse.json({ error: presenceError.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const distinct = (presences ?? []).filter((p) => {
    const id = p.user_id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (distinct.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const { data: profiles, error: profileError } = await supabaseAdmin
    .schema('next_auth')
    .from('users')
    .select('id, name, email, image, display_name')
    .in('id', distinct.map((p) => p.user_id));

  if (profileError) {
    console.error('[presence] profile query error:', profileError);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users = distinct
    .map((p) => {
      const profile = profileById.get(p.user_id as string);
      if (!profile) return null;
      const lastSeenAt = (p.last_seen_at as string) ?? null;
      const lastActiveAt = (p.last_active_at as string) ?? lastSeenAt;
      return {
        id: profile.id,
        name: profile.name ?? null,
        image: profile.image ?? null,
        displayName: profile.display_name ?? null,
        firstName:
          (profile.name ?? '').split(' ')[0] ||
          (profile.email ?? '').split('@')[0] ||
          'Player',
        game: p.game,
        // "Online" = the app is open (visible or backgrounded): last_active_at
        // stays fresh via hidden-tab pings, while last_seen_at is untouched.
        online: !!lastActiveAt && new Date(lastActiveAt).getTime() > cutoffMs,
        lastSeenAt,
        lastActiveAt,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const game = body?.game;
  if (game !== 'pictionary' && game !== 'connections') {
    return NextResponse.json({ error: 'Invalid game' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Background (hidden-tab) ping: keeps the user marked online in messaging
  // lists without refreshing last_seen_at.
  if (body?.background === true) {
    await supabaseAdmin
      .from('presence_heartbeats')
      .update({ last_active_at: nowIso })
      .eq('game', game)
      .eq('user_id', session.user.id);
    return NextResponse.json({ ok: true });
  }

  // Tab closed / user left: drop both timestamps so they stop showing as
  // online right away.
  if (body?.leaving === true) {
    const staleIso = new Date(Date.now() - (ONLINE_WINDOW_SECONDS + 60) * 1000).toISOString();
    await supabaseAdmin.from('presence_heartbeats').upsert(
      { user_id: session.user.id, game, last_seen_at: staleIso, last_active_at: staleIso, in_room: false },
      { onConflict: 'user_id,game' }
    );
    return NextResponse.json({ ok: true });
  }

  // One row per (user, game) so a player on both sites keeps separate rows —
  // otherwise the `user_id`-only conflict would overwrite the game column.
  const { error } = await supabaseAdmin.from('presence_heartbeats').upsert(
    { user_id: session.user.id, game, last_seen_at: nowIso, last_active_at: nowIso },
    { onConflict: 'user_id,game' }
  );

  if (error) {
    console.error('[presence] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}