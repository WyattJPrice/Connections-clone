import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { containsProfanity } from '@/lib/profanity';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user;

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.name === 'string' ? body.name : '';
  const name = raw.trim();

  if (!name) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
  if (name.length > 30) return NextResponse.json({ error: 'Name is too long (max 30 characters).' }, { status: 400 });
  if (containsProfanity(name)) {
    return NextResponse.json({ error: 'Inappropriate language detected' }, { status: 422 });
  }

  // Update the Auth.js profile (drives the session) and backfill the
  // denormalized name in every table that snapshots it.
  const [profileRes, catsRes, completionsRes] = await Promise.all([
    supabaseAdmin.schema('next_auth').from('users').update({ display_name: name }).eq('id', user.id),
    supabaseAdmin
      .from('user_categories')
      .update({ creator_name: name })
      .eq('creator_id', user.id),
    supabaseAdmin
      .from('puzzle_completions')
      .update({ user_name: name })
      .eq('user_id', user.id),
  ]);

  if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  if (catsRes.error) return NextResponse.json({ error: catsRes.error.message }, { status: 500 });
  if (completionsRes.error) return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}