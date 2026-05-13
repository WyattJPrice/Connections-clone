import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { containsProfanity } from '@/lib/profanity';
import { notifyNewSubmission } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const creatorName = searchParams.get('creatorName');
  const random = searchParams.get('random');
  const myId = searchParams.get('myId');
  const ids = searchParams.get('ids');

  const db = adminClient();

  // Fetch specific categories by ID list (for custom game play)
  if (ids) {
    const idList = ids.split(',').filter(Boolean);
    const { data, error } = await db
      .from('user_categories')
      .select('id, creator_id, creator_name, name, words, created_at, play_count')
      .in('id', idList);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      categories: (data ?? []).map((c) => ({
        id: c.id,
        creatorId: c.creator_id,
        creatorName: c.creator_name,
        name: c.name,
        words: c.words,
        createdAt: c.created_at,
        playCount: c.play_count ?? 0,
      })),
    });
  }

  let query = db
    .from('user_categories')
    .select('id, creator_id, creator_name, name, words, created_at, play_count', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (creatorName) {
    query = query.ilike('creator_name', `%${creatorName}%`);
  }

  if (myId) {
    query = query.eq('creator_id', myId);
  }

  if (random) {
    const r = Math.max(1, parseInt(random));
    const { data, error } = await query.limit(r * 10);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, r);
    return NextResponse.json({
      categories: shuffled.map((c) => ({
        id: c.id,
        creatorId: c.creator_id,
        creatorName: c.creator_name,
        name: c.name,
        words: c.words,
        createdAt: c.created_at,
        playCount: c.play_count ?? 0,
      })),
      total: shuffled.length,
    });
  }

  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '100')));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    categories: (data ?? []).map((c) => ({
      id: c.id,
      creatorId: c.creator_id,
      creatorName: c.creator_name,
      name: c.name,
      words: c.words,
      createdAt: c.created_at,
      playCount: c.play_count ?? 0,
    })),
    total: count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { creatorName, name, words } = body;

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
    .insert({
      creator_id: user.id,
      creator_name: creatorName,
      name: name.trim().toUpperCase(),
      words: words.map((w: string) => w.trim().toUpperCase()),
    })
    .select('id, creator_id, creator_name, name, words, created_at, play_count')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget Telegram notification (no-op if env not configured).
  notifyNewSubmission({
    id: data.id,
    name: data.name,
    words: data.words,
    creatorName: data.creator_name,
  });

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
