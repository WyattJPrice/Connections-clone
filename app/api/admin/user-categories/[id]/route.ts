import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

function isAuthorized(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_PASSWORD;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const { name, words } = body;

  if (!name?.trim() || !Array.isArray(words) || words.length !== 4) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  if (words.some((w: unknown) => typeof w !== 'string' || !w.trim())) {
    return NextResponse.json({ error: 'All 4 words must be non-empty strings' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('user_categories')
    .update({
      name: name.trim().toUpperCase(),
      words: words.map((w: string) => w.trim().toUpperCase()),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, creator_id, creator_name, name, words, created_at, play_count')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    category: {
      id: data.id,
      creatorId: data.creator_id,
      creatorName: data.creator_name,
      name: data.name,
      words: data.words,
      createdAt: data.created_at,
      playCount: data.play_count ?? 0,
    },
  });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const { error } = await supabaseAdmin
    .from('user_categories')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
