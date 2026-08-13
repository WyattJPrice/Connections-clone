'use client';

const KEY = 'connections_completed_categories';

// In-memory cache used while signed in. Account solves are never written to
// the device; this holds them for the current page session instead. Reset on
// sign-out so a signed-out user sees only their device solves.
let memoryCache: Set<string> | null = null;

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

function clearCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Synchronous read — in-memory account cache when signed in, else device. */
export function getCompletedCategoryIds(): Set<string> {
  return memoryCache ?? readCache();
}

/**
 * Drop the in-memory account cache. Call when a user signs out so their
 * account solves don't stay visible on this device afterwards.
 */
export function resetCompletedCategoryCache(): void {
  memoryCache = null;
}

/**
 * Load the solved categories for the current state.
 * - Signed in (isLoggedIn true): push any device solves up to the account
 *   (one-time migration), then clear the device cache so account solves live
 *   only in the account.
 * - Signed out: return the device cache.
 *
 * `isLoggedIn` must come from the live session context (e.g. useSession), not
 * from an internal re-check, so the result reflects sign-out immediately.
 */
export async function loadCompletedCategoryIds(isLoggedIn: boolean): Promise<Set<string>> {
  if (!isLoggedIn) {
    memoryCache = null;
    return readCache();
  }

  try {
    const local = readCache();
    const res = await fetch('/api/category-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(local) }),
    });
    if (!res.ok) return readCache();
    const data: { ids?: string[] } = await res.json();
    // Device solves are now on the account — clear the device so account data
    // isn't left behind.
    clearCache();
    memoryCache = new Set(data.ids ?? []);
    return memoryCache;
  } catch {
    return readCache();
  }
}

/**
 * Mark a category solved.
 * - Signed in (isLoggedIn true): save to the account only (in-memory cache +
 *   server POST).
 * - Signed out: save to the device.
 */
export function markCategoryCompleted(id: string, isLoggedIn: boolean): void {
  if (isLoggedIn) {
    memoryCache?.add(id);
    void fetch('/api/category-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {
      // Non-critical — the next hydrate will reconcile.
    });
    return;
  }
  const ids = readCache();
  ids.add(id);
  writeCache(ids);
}