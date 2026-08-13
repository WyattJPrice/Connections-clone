import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false });

  const body = await req.json();
  const { completionType, puzzleDate, userName } = body as {
    completionType: 'daily' | 'custom';
    puzzleDate?: string;
    userName: string;
  };

  await supabaseAdmin.from('puzzle_completions').insert({
    user_id: session.user.id,
    user_name: userName,
    completion_type: completionType,
    puzzle_date: completionType === 'daily' ? (puzzleDate ?? null) : null,
  });

  return NextResponse.json({ ok: true });
}