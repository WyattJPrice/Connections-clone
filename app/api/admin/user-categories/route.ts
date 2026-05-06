import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const creatorName = searchParams.get('creatorName');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('user_categories')
    .select('id, creator_id, creator_name, name, words, created_at, play_count', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (creatorName) {
    query = query.ilike('creator_name', `%${creatorName}%`);
  }

  const { data, error, count } = await query;

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
    page,
    limit,
  });
}
