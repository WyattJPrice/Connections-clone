import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// Marks DMs as read. The client calls this when a live message is shown inside
// an open thread, so a message the user already saw isn't re-toasted by the
// unread poll after they close the thread.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = session.user.id;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string') : [];
  if (ids.length === 0) return NextResponse.json({ ok: false });

  const { error } = await supabaseAdmin
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me)
    .in('id', ids);

  if (error) {
    console.error('[messages/read] error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}