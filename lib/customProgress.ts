const KEY = 'connections_completed_categories';

export function getCompletedCategoryIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markCategoryCompleted(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getCompletedCategoryIds();
    ids.add(id);
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage unavailable — silent fail
  }
}
