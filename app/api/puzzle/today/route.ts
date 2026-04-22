import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: puzzle, error } = await supabaseAdmin
    .from('puzzles')
    .select('id, puzzle_date, puzzle_number, categories(id, name, color, words)')
    .eq('puzzle_date', today)
    .single();

  if (error || !puzzle) {
    return NextResponse.json({ exists: false, puzzleDate: today });
  }

  return NextResponse.json({
    exists: true,
    puzzleDate: puzzle.puzzle_date,
    puzzleNumber: puzzle.puzzle_number,
    puzzle: {
      id: puzzle.id,
      puzzleDate: puzzle.puzzle_date,
      puzzleNumber: puzzle.puzzle_number,
      categories: (puzzle.categories as Array<{id: string; name: string; color: string; words: string[]}>).map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        words: c.words,
      })),
    },
  });
}
