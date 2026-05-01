import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { containsProfanity } from '@/lib/profanity';

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data } = await anonClient().auth.getUser(token);
  return data.user ?? null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const { name, words } = body;

  if (!name?.trim() || !Array.isArray(words) || words.length !== 4) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const allText = [name, ...words].join(' ');
  if (containsProfanity(allText)) {
    return NextResponse.json({ error: 'Inappropriate content detected' }, { status: 422 });
  }

  const db = adminClient();
  const { data, error } = await db
    .from('user_categories')
    .update({
      name: name.trim().toUpperCase(),
      words: words.map((w: string) => w.trim().toUpperCase()),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('creator_id', user.id)
    .select('id, creator_id, creator_name, name, words, created_at')
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
    },
  });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = adminClient();

  const { error } = await db
    .from('user_categories')
    .delete()
    .eq('id', id)
    .eq('creator_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
