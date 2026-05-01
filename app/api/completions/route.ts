import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  if (!user) return NextResponse.json({ ok: false });

  const body = await req.json();
  const { completionType, puzzleDate, userName } = body as {
    completionType: 'daily' | 'custom';
    puzzleDate?: string;
    userName: string;
  };

  // Use user's own token to respect RLS
  const authHeader = req.headers.get('authorization')!;
  const token = authHeader.slice(7);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  await db.from('puzzle_completions').insert({
    user_id: user.id,
    user_name: userName,
    completion_type: completionType,
    puzzle_date: completionType === 'daily' ? (puzzleDate ?? null) : null,
  });

  return NextResponse.json({ ok: true });
}
