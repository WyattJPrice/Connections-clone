'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';
import { format } from 'date-fns';
import { getSupabase } from '@/lib/supabase';

const NOTIF_STORAGE_KEY = 'admin_user_categories_notif_enabled';

interface UserCategory {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  words: string[];
  createdAt: string;
  playCount: number;
}

interface EditState {
  name: string;
  words: string[];
}

export default function AdminUserCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftCreator, setDraftCreator] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', words: ['', '', '', ''] });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [tgSetupBusy, setTgSetupBusy] = useState(false);
  const [tgSetupMsg, setTgSetupMsg] = useState<string | null>(null);
  // Latest fetch args, so realtime callbacks always refresh with current filters.
  const fetchArgsRef = useRef({ page: 1, search: '', creator: '' });

  const LIMIT = 50;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        setError('You can only select 4 categories for a game.');
        return prev;
      }
      setError(null);
      return next;
    });
  }

  function playSelected() {
    if (selected.size !== 4) return;
    const chosen = categories.filter((c) => selected.has(c.id));
    const wordCounts = new Map<string, number>();
    for (const cat of chosen) {
      const seen = new Set<string>();
      for (const w of cat.words) {
        const key = w.trim().toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        wordCounts.set(key, (wordCounts.get(key) ?? 0) + 1);
      }
    }
    const dupes = Array.from(wordCounts.entries()).filter(([, n]) => n > 1).map(([w]) => w);
    if (dupes.length > 0) {
      const list = dupes.slice(0, 3).join(', ');
      const more = dupes.length > 3 ? ` +${dupes.length - 3} more` : '';
      setError(`Selected categories share word${dupes.length > 1 ? 's' : ''}: ${list}${more}.`);
      return;
    }
    router.push(`/play/custom?categories=${Array.from(selected).join(',')}`);
  }

  const fetchCategories = useCallback(async (p: number, s: string, c: string) => {
    fetchArgsRef.current = { page: p, search: s, creator: c };
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (s) params.set('search', s);
      if (c) params.set('creatorName', c);
      const res = await fetch(`/api/admin/user-categories?${params}`);
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCategories(data.categories);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCategories(page, search, creatorFilter);
  }, [page, search, creatorFilter, fetchCategories]);

  // Restore notification preference + permission state on mount.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotifPermission(Notification.permission);
    const stored = localStorage.getItem(NOTIF_STORAGE_KEY) === '1';
    if (stored && Notification.permission === 'granted') {
      setNotifEnabled(true);
    }
  }, []);

  // Subscribe to Supabase realtime when notifications are enabled.
  useEffect(() => {
    if (!notifEnabled) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel('admin-user-categories')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_categories' },
        (payload) => {
          const row = payload.new as { name?: string; creator_name?: string };
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('New community category', {
              body: `${row.name ?? '(unnamed)'} — by ${row.creator_name ?? 'unknown'}`,
              tag: 'community-submission',
            });
          }
          const { page, search, creator } = fetchArgsRef.current;
          fetchCategories(page, search, creator);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [notifEnabled, fetchCategories]);

  async function toggleNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Browser notifications are not supported here.');
      return;
    }
    if (notifEnabled) {
      setNotifEnabled(false);
      localStorage.removeItem(NOTIF_STORAGE_KEY);
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    setNotifPermission(perm);
    if (perm !== 'granted') {
      setError('Notification permission denied. Enable it in your browser settings.');
      return;
    }
    setNotifEnabled(true);
    localStorage.setItem(NOTIF_STORAGE_KEY, '1');
    new Notification('Notifications enabled', {
      body: 'You’ll get a popup whenever a new category is submitted.',
    });
  }

  async function registerTelegramWebhook() {
    setTgSetupBusy(true);
    setTgSetupMsg(null);
    try {
      const res = await fetch('/api/telegram/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Setup failed');
      setTgSetupMsg(`Webhook registered: ${data.webhookUrl}`);
    } catch (e) {
      setTgSetupMsg(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setTgSetupBusy(false);
    }
  }

  function applySearch() {
    setPage(1);
    setSearch(draftSearch);
    setCreatorFilter(draftCreator);
  }

  function clearSearch() {
    setDraftSearch('');
    setDraftCreator('');
    setPage(1);
    setSearch('');
    setCreatorFilter('');
  }

  function startEdit(cat: UserCategory) {
    setEditingId(cat.id);
    setEditState({ name: cat.name, words: [...cat.words] });
    setDeleteConfirmId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editState.name.trim() || editState.words.some((w) => !w.trim())) {
      setError('Category name and all 4 words are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/user-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editState.name, words: editState.words }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: data.category.name, words: data.category.words } : c))
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/user-categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Delete failed');
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => t - 1);
      setDeleteConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div className="flex-1 px-4 py-6" style={{ paddingTop: NAVBAR_HEIGHT + 24 }}>
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="text-sm font-bold transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                ← Admin
              </button>
              <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
                Community Categories
              </h1>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {total} total
            </span>
          </div>

          {/* Notification settings */}
          <div
            className="rounded-2xl border p-4 mb-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                  Desktop notifications
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {notifPermission === 'denied'
                    ? 'Blocked by browser — enable in site settings.'
                    : notifEnabled
                    ? 'On — you’ll get a popup for each new submission.'
                    : 'Off — click to enable popups for new submissions.'}
                </div>
              </div>
              <button
                onClick={toggleNotifications}
                disabled={notifPermission === 'denied'}
                className="px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{
                  backgroundColor: notifEnabled ? '#a0c35a' : 'var(--tile-bg)',
                  color: notifEnabled ? '#1a1a1a' : 'var(--text)',
                  border: notifEnabled ? 'none' : '1px solid var(--outline-button-border)',
                }}
              >
                {notifEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
            <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--border)' }}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                  Telegram bot
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {tgSetupMsg ?? 'Register the webhook so your bot can deliver submissions to your phone.'}
                </div>
              </div>
              <button
                onClick={registerTelegramWebhook}
                disabled={tgSetupBusy}
                className="px-4 py-2 rounded-full text-sm font-bold border transition-opacity hover:opacity-70 disabled:opacity-50"
                style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
              >
                {tgSetupBusy ? 'Working…' : 'Register webhook'}
              </button>
            </div>
          </div>

          {/* Search / filter bar */}
          <div
            className="rounded-2xl border p-4 mb-4 flex flex-col sm:flex-row gap-3"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <input
              type="text"
              placeholder="Search by category name…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--tile-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
            <input
              type="text"
              placeholder="Filter by creator name…"
              value={draftCreator}
              onChange={(e) => setDraftCreator(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--tile-bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={applySearch}
                className="px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--text)', color: 'var(--bg)' }}
              >
                Search
              </button>
              {(search || creatorFilter) && (
                <button
                  onClick={clearSearch}
                  className="px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-70 border"
                  style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
            >
              {error}
            </div>
          )}

          {/* Category list */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p style={{ color: 'var(--text-muted)' }}>No categories found.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {categories.map((cat) => {
                  const isSelected = selected.has(cat.id);
                  return (
                  <div
                    key={cat.id}
                    className="p-4 transition-colors"
                    style={{ backgroundColor: isSelected ? 'rgba(186,129,197,0.10)' : 'transparent' }}
                  >
                    {editingId === cat.id ? (
                      /* ── Edit form ── */
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          value={editState.name}
                          onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                          placeholder="Category name"
                          className="px-3 py-2 rounded-lg text-sm font-bold outline-none"
                          style={{
                            backgroundColor: 'var(--tile-bg)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                          }}
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {editState.words.map((w, i) => (
                            <input
                              key={i}
                              type="text"
                              value={w}
                              onChange={(e) =>
                                setEditState((s) => {
                                  const words = [...s.words];
                                  words[i] = e.target.value;
                                  return { ...s, words };
                                })
                              }
                              placeholder={`Word ${i + 1}`}
                              className="px-3 py-2 rounded-lg text-sm outline-none"
                              style={{
                                backgroundColor: 'var(--tile-bg)',
                                color: 'var(--text)',
                                border: '1px solid var(--border)',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(cat.id)}
                            disabled={saving}
                            className="px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ backgroundColor: '#a0c35a', color: '#1a1a1a' }}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="px-4 py-2 rounded-full text-sm font-bold border transition-opacity hover:opacity-70"
                            style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Display row ── */
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-black text-sm" style={{ color: 'var(--text)' }}>
                              {cat.name}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              by {cat.creatorName}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {cat.words.map((w, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: 'var(--tile-bg)', color: 'var(--text)' }}
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {format(new Date(cat.createdAt), 'MMM d, yyyy')} · {cat.playCount} play{cat.playCount !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {deleteConfirmId === cat.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                              Delete?
                            </span>
                            <button
                              onClick={() => confirmDelete(cat.id)}
                              disabled={deleting}
                              className="px-3 py-1.5 rounded-full text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                              style={{ backgroundColor: '#ef4444', color: '#fff' }}
                            >
                              {deleting ? '…' : 'Yes, delete'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-opacity hover:opacity-70"
                              style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toggleSelect(cat.id)}
                              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                              style={
                                isSelected
                                  ? { backgroundColor: '#ba81c5', borderColor: '#ba81c5', color: '#fff' }
                                  : { borderColor: 'var(--outline-button-border)', color: 'var(--text)' }
                              }
                              aria-pressed={isSelected}
                            >
                              {isSelected ? '✓ Selected' : 'Select'}
                            </button>
                            <button
                              onClick={() => startEdit(cat)}
                              className="px-3 py-1.5 rounded-full text-xs font-bold border transition-opacity hover:opacity-70"
                              style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setDeleteConfirmId(cat.id); setEditingId(null); }}
                              className="px-3 py-1.5 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                              style={{ backgroundColor: '#ef4444', color: '#fff' }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-full text-sm font-bold border transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
              >
                ← Prev
              </button>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-full text-sm font-bold border transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky selection bar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t px-4 py-3 flex items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-3">
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {selected.size} / 4 selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="px-4 py-2 rounded-full text-sm font-bold border transition-opacity hover:opacity-70"
                style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
              >
                Clear
              </button>
              <button
                onClick={playSelected}
                disabled={selected.size !== 4}
                className="px-5 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
              >
                Play Selected ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
