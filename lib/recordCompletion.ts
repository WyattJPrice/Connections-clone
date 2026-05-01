'use client';

import { supabase } from './supabase';
import { getFirstName } from './auth';

export async function recordCompletion(
  completionType: 'daily' | 'custom',
  puzzleDate?: string
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const fullName = session.user.user_metadata?.full_name as string | undefined;
    const userName = getFirstName(fullName) || session.user.email?.split('@')[0] || 'Player';

    await fetch('/api/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ completionType, puzzleDate, userName }),
    });
  } catch {
    // Non-critical — silently ignore
  }
}
