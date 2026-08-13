import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export interface LeaderboardEntry {
  userName: string;
  userImage?: string;
  dailyCount: number;
  customCount: number;
  createdCount: number;
  totalCount: number;
}

export async function GET() {
  const [completionsRes, categoriesRes] = await Promise.all([
    supabaseAdmin
      .from('puzzle_completions')
      .select('user_id, user_name, completion_type'),
    supabaseAdmin
      .from('user_categories')
      .select('creator_id, creator_name, creator_avatar, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (completionsRes.error) {
    return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });
  }
  if (categoriesRes.error) {
    return NextResponse.json({ error: categoriesRes.error.message }, { status: 500 });
  }

  const byUser = new Map<
    string,
    { user_id: string; userName: string; userImage?: string; daily: number; custom: number; created: number }
  >();

  for (const row of completionsRes.data ?? []) {
    const existing = byUser.get(row.user_id) ?? {
      user_id: row.user_id,
      userName: row.user_name,
      daily: 0,
      custom: 0,
      created: 0,
    };
    if (row.completion_type === 'daily') existing.daily += 1;
    else existing.custom += 1;
    byUser.set(row.user_id, existing);
  }

  // Categories are ordered newest-first; take the first non-empty name we see
  // per user as their most recent display name + avatar.
  const namedFromCategories = new Set<string>();
  for (const row of categoriesRes.data ?? []) {
    const existing = byUser.get(row.creator_id);
    if (existing) {
      existing.created += 1;
      if (!namedFromCategories.has(row.creator_id) && row.creator_name) {
        existing.userName = row.creator_name;
        existing.userImage = row.creator_avatar ?? undefined;
        namedFromCategories.add(row.creator_id);
      }
    } else {
      byUser.set(row.creator_id, {
        user_id: row.creator_id,
        userName: row.creator_name,
        userImage: row.creator_avatar ?? undefined,
        daily: 0,
        custom: 0,
        created: 1,
      });
      namedFromCategories.add(row.creator_id);
    }
  }

  const userImages = new Map<string, string>();
  const ids = Array.from(byUser.keys());
  if (ids.length > 0) {
    const { data: users, error: usersError } = await supabaseAdmin
      .schema('next_auth')
      .from('users')
      .select('id, image')
      .in('id', ids);
    if (!usersError) {
      for (const u of users ?? []) {
        if (u.image) userImages.set(u.id, u.image);
      }
    }
  }

  const entries: LeaderboardEntry[] = Array.from(byUser.values())
    .map((u) => ({
      userName: u.userName,
      userImage: userImages.get(u.user_id) ?? u.userImage,
      dailyCount: u.daily,
      customCount: u.custom,
      createdCount: u.created,
      totalCount: u.daily + u.custom,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 50);

  return NextResponse.json({ entries });
}
