import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-server';
import { containsProfanity } from '@/lib/profanity';

export const dynamic = 'force-dynamic';

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data } = await anonClient().auth.getUser(token);
  return data.user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.name === 'string' ? body.name : '';
  const name = raw.trim();

  if (!name) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
  if (name.length > 30) return NextResponse.json({ error: 'Name is too long (max 30 characters).' }, { status: 400 });
  if (containsProfanity(name)) {
    return NextResponse.json({ error: 'Inappropriate language detected' }, { status: 422 });
  }

  // Backfill the denormalized name in every table that snapshots it.
  const [catsRes, completionsRes] = await Promise.all([
    supabaseAdmin
      .from('user_categories')
      .update({ creator_name: name })
      .eq('creator_id', user.id),
    supabaseAdmin
      .from('puzzle_completions')
      .update({ user_name: name })
      .eq('user_id', user.id),
  ]);

  if (catsRes.error) return NextResponse.json({ error: catsRes.error.message }, { status: 500 });
  if (completionsRes.error) return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
