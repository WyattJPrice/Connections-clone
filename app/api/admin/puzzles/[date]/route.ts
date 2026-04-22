import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

function isAuthorized(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_PASSWORD;
}

type RouteContext = { params: Promise<{ date: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date } = await ctx.params;

  const { data: puzzle } = await supabaseAdmin
    .from('puzzles')
    .select('id, puzzle_date, puzzle_number, categories(id, name, color, words)')
    .eq('puzzle_date', date)
    .single();

  if (!puzzle) return NextResponse.json({ puzzle: null });

  return NextResponse.json({
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

export async function POST(req: NextRequest, ctx: RouteContext) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date } = await ctx.params;
  const body = await req.json();

  const { data: puzzle, error: puzzleError } = await supabaseAdmin
    .from('puzzles')
    .insert({ puzzle_date: date, puzzle_number: body.puzzleNumber })
    .select('id')
    .single();

  if (puzzleError || !puzzle) {
    return NextResponse.json({ error: puzzleError?.message ?? 'Insert failed' }, { status: 500 });
  }

  const { error: catError } = await supabaseAdmin.from('categories').insert(
    body.categories.map((c: { color: string; name: string; words: string[] }) => ({
      puzzle_id: puzzle.id,
      color: c.color,
      name: c.name,
      words: c.words,
    }))
  );

  if (catError) {
    // Rollback puzzle
    await supabaseAdmin.from('puzzles').delete().eq('id', puzzle.id);
    return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date } = await ctx.params;
  const body = await req.json();

  // Update puzzle metadata
  const { data: puzzle, error: puzzleError } = await supabaseAdmin
    .from('puzzles')
    .update({ puzzle_number: body.puzzleNumber, updated_at: new Date().toISOString() })
    .eq('puzzle_date', date)
    .select('id')
    .single();

  if (puzzleError || !puzzle) {
    return NextResponse.json({ error: puzzleError?.message ?? 'Update failed' }, { status: 500 });
  }

  // Delete old categories and re-insert
  await supabaseAdmin.from('categories').delete().eq('puzzle_id', puzzle.id);

  const { error: catError } = await supabaseAdmin.from('categories').insert(
    body.categories.map((c: { color: string; name: string; words: string[] }) => ({
      puzzle_id: puzzle.id,
      color: c.color,
      name: c.name,
      words: c.words,
    }))
  );

  if (catError) {
    return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date } = await ctx.params;

  const { error } = await supabaseAdmin
    .from('puzzles')
    .delete()
    .eq('puzzle_date', date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
