'use client';

import { signIn as nextSignIn, signOut as nextSignOut } from 'next-auth/react';
import { containsProfanity } from './profanity';

export async function signInWithGoogle() {
  await nextSignIn('google', { callbackUrl: '/create' });
}

export async function signOut() {
  await nextSignOut({ callbackUrl: '/' });
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

/**
 * Returns the user's chosen display name if set, falling back to the first
 * word of their Google `name`, then to email prefix, then 'Player'.
 */
export function getDisplayName(
  user:
    | { name?: string | null; email?: string | null; displayName?: string | null }
    | null
    | undefined
): string {
  if (!user) return '';
  const displayName = user.displayName?.trim();
  if (displayName) return displayName;
  return getFirstName(user.name) || user.email?.split('@')[0] || 'Player';
}

export function hasDisplayNameSet(
  user:
    | { displayName?: string | null }
    | null
    | undefined
): boolean {
  return !!user?.displayName?.trim();
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

  try {
    const res = await fetch('/api/profile/display-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? 'Failed to update existing records.' };
    }
  } catch {
    return { ok: false, error: 'Failed to update existing records.' };
  }

  return { ok: true };
}