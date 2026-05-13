import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ids: [] });

  const { data, error } = await supabaseAdmin
    .from('category_completions')
    .select('category_id')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ids: (data ?? []).map((r) => r.category_id) });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const incoming: unknown = body?.ids;
  const ids = Array.isArray(incoming)
    ? incoming.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  if (ids.length > 0) {
    const rows = ids.map((id) => ({ user_id: user.id, category_id: id }));
    const { error } = await supabaseAdmin
      .from('category_completions')
      .upsert(rows, { onConflict: 'user_id,category_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return the merged authoritative list so the client can update its cache.
  const { data, error } = await supabaseAdmin
    .from('category_completions')
    .select('category_id')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ids: (data ?? []).map((r) => r.category_id) });
}
