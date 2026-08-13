'use client';

import { getSession } from 'next-auth/react';
import { getDisplayName } from './auth';

export async function recordCompletion(
  completionType: 'daily' | 'custom',
  puzzleDate?: string
) {
  try {
    const session = await getSession();
    if (!session?.user) return;
    const userName = getDisplayName(session.user);

    await fetch('/api/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completionType, puzzleDate, userName }),
    });
  } catch {
    // Non-critical — silently ignore
  }
}