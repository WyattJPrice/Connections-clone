'use client';

import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { containsProfanity } from './profanity';

export async function signInWithGoogle() {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

export async function getSession() {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

/**
 * Returns the user's chosen display name if set, falling back to the first
 * word of their Google `full_name`, then to email prefix, then 'Player'.
 */
export function getDisplayName(user: User | null | undefined): string {
  if (!user) return '';
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const displayName = typeof meta?.display_name === 'string' ? meta.display_name.trim() : '';
  if (displayName) return displayName;
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : null;
  return getFirstName(fullName) || user.email?.split('@')[0] || 'Player';
}

export function hasDisplayNameSet(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return typeof meta?.display_name === 'string' && meta.display_name.trim().length > 0;
}

export interface UpdateDisplayNameResult {
  ok: boolean;
  error?: string;
}

export async function updateDisplayName(name: string): Promise<UpdateDisplayNameResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Name cannot be empty.' };
  if (trimmed.length > 30) return { ok: false, error: 'Name is too long (max 30 characters).' };
  if (containsProfanity(trimmed)) return { ok: false, error: 'Inappropriate language detected' };

  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
  if (error) return { ok: false, error: error.message };

  // Backfill the new name into denormalized snapshots (user_categories.creator_name,
  // puzzle_completions.user_name) so older rows reflect the rename.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      const res = await fetch('/api/profile/display-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body?.error ?? 'Failed to update existing records.' };
      }
    }
  } catch {
    return { ok: false, error: 'Failed to update existing records.' };
  }

  return { ok: true };
}
