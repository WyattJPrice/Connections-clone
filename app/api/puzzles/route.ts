import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('puzzles')
    .select('puzzle_date, puzzle_number')
    .order('puzzle_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    puzzles: (data ?? []).map((p) => ({
      puzzleDate: p.puzzle_date,
      puzzleNumber: p.puzzle_number,
    })),
  });
}
