import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

function isAuthorized(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('puzzles')
    .select('id, puzzle_date, puzzle_number')
    .order('puzzle_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    puzzles: (data ?? []).map((p) => ({
      puzzleDate: p.puzzle_date,
      puzzleNumber: p.puzzle_number,
    })),
  });
}
