import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const { puzzleDate, puzzleNumber, won, mistakes } = await req.json();

  if (!puzzleDate || typeof won !== 'boolean' || typeof mistakes !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('game_results').insert({
    puzzle_date: puzzleDate,
    puzzle_number: puzzleNumber ?? null,
    won,
    mistakes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
