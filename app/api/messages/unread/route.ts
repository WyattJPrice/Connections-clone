import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// Reliable DM toast path: the realtime broadcast fast-path can silently drop a
// message if the recipient's socket isn't joined to the channel at the send
// moment, so the client also polls this endpoint for unread DMs as a
// guaranteed fallback. Never marks messages read — that happens when the
// recipient opens the thread.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = session.user.id;

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .eq('recipient_id', me)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[messages/unread] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const senderIds = [...new Set(rows.map((m) => m.sender_id))];
  let profiles: { id: string; name: string | null; email: string | null; image: string | null; display_name: string | null }[] = [];
  if (senderIds.length > 0) {
    const { data: profData } = await supabaseAdmin
      .schema('next_auth')
      .from('users')
      .select('id, name, email, image, display_name')
      .in('id', senderIds);
    profiles = profData ?? [];
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const latest = rows.map((m) => {
    const p = byId.get(m.sender_id);
    return {
      id: m.id,
      senderId: m.sender_id,
      recipientId: m.recipient_id,
      senderName: p?.display_name || (p?.name ?? '').split(' ')[0] || (p?.email ?? '').split('@')[0] || 'Player',
      senderImage: p?.image ?? null,
      body: m.body,
      createdAt: m.created_at,
      readAt: m.read_at,
    };
  });

  return NextResponse.json({ total: rows.length, latest });
}