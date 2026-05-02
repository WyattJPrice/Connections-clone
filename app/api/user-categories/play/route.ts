import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    const db = adminClient();

    const { data, error: selectError } = await db
      .from('user_categories')
      .select('id, play_count')
      .in('id', ids);

    if (selectError) {
      console.error('[play] select error:', selectError);
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const updates = await Promise.all(
      data.map((row) =>
        db
          .from('user_categories')
          .update({ play_count: (row.play_count ?? 0) + 1 })
          .eq('id', row.id)
          .select('id, play_count')
          .single()
      )
    );

    const failed = updates.filter((u) => u.error);
    if (failed.length) {
      console.error('[play] update errors:', failed.map((f) => f.error));
    }

    return NextResponse.json({
      ok: true,
      updated: updates.length - failed.length,
      results: updates.map((u) => u.data),
    });
  } catch (err) {
    console.error('[play] handler error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
