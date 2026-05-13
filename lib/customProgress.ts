'use client';

import { getSupabase } from './supabase';

const KEY = 'connections_completed_categories';

function readCache(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeCache(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage unavailable — silent fail
  }
}

/** Synchronous read from the localStorage cache (no network). */
export function getCompletedCategoryIds(): Set<string> {
  return readCache();
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the authoritative list from the server (when logged in), merge any
 * local-only IDs up, and refresh the cache. Returns the merged set.
 * Falls back to the local cache when logged out or offline.
 */
export async function loadCompletedCategoryIds(): Promise<Set<string>> {
  const token = await getAccessToken();
  const local = readCache();
  if (!token) return local;

  try {
    const res = await fetch('/api/category-completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: Array.from(local) }),
    });
    if (!res.ok) return local;
    const data: { ids?: string[] } = await res.json();
    const merged = new Set([...(data.ids ?? []), ...local]);
    writeCache(merged);
    return merged;
  } catch {
    return local;
  }
}

/**
 * Mark a category solved. Always updates the localStorage cache; also POSTs
 * to the server when logged in (fire-and-forget — failures are non-critical
 * since the next `loadCompletedCategoryIds` call will push it up).
 */
export function markCategoryCompleted(id: string): void {
  const ids = readCache();
  ids.add(id);
  writeCache(ids);

  void (async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      await fetch('/api/category-completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // Non-critical — the next hydrate will reconcile.
    }
  })();
}
