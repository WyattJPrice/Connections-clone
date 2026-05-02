'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getFirstName } from '@/lib/auth';
import { containsProfanity } from '@/lib/profanity';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';
import { Toast } from '@/components/ui/Toast';
import { UserCategory } from '@/lib/types';
import { useKey } from '@/lib/useKey';
import type { Session } from '@supabase/supabase-js';

type Tab = 'mine' | 'create';

interface EditState {
  id: string;
  name: string;
  words: [string, string, string, string];
}

export default function CreatePage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('mine');
  const [myCategories, setMyCategories] = useState<UserCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newWords, setNewWords] = useState<[string, string, string, string]>(['', '', '', '']);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useKey('Escape', () => setEditState(null), !!editState);
  useKey(
    'Enter',
    () => {
      if (editState && !editSaving) handleEditSave();
      else if (tab === 'create' && !saving) handleCreate();
    },
    !!editState || tab === 'create'
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user;
  const firstName = getFirstName(user?.user_metadata?.full_name);

  useEffect(() => {
    if (!user) return;
    setLoadingCats(true);
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const r = await fetch(`/api/user-categories?myId=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setMyCategories(d.categories ?? []);
      setLoadingCats(false);
    });
  }, [user]);

  function handleNewNameChange(val: string) {
    setNewName(val);
  }

  function handleNewWordChange(i: number, val: string) {
    const next = [...newWords] as [string, string, string, string];
    next[i] = val;
    setNewWords(next);
  }

  async function handleCreate() {
    if (!user) return;
    if (!newName.trim() || newWords.some((w) => !w.trim())) {
      setToast('Fill in all fields.');
      return;
    }
    if ([newName, ...newWords].some((t) => t.trim() && containsProfanity(t))) {
      setToast('Inappropriate language detected');
      return;
    }
    setSaving(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const r = await fetch('/api/user-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creatorName: firstName, name: newName, words: newWords }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed');
      setMyCategories((prev) => [d.category, ...prev]);
      setNewName('');
      setNewWords(['', '', '', '']);
      setTab('mine');
      setToast('Category created!');
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return;
    const { data: { session: s } } = await supabase.auth.getSession();
    const token = s?.access_token;
    await fetch(`/api/user-categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMyCategories((prev) => prev.filter((c) => c.id !== id));
    setToast('Deleted.');
  }

  function startEdit(cat: UserCategory) {
    setEditState({ id: cat.id, name: cat.name, words: [...cat.words] as [string, string, string, string] });
  }

  async function handleEditSave() {
    if (!editState) return;
    if ([editState.name, ...editState.words].some((t) => t.trim() && containsProfanity(t))) {
      setToast('Inappropriate language detected');
      return;
    }
    setEditSaving(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const r = await fetch(`/api/user-categories/${editState.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editState.name, words: editState.words }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed');
      setMyCategories((prev) => prev.map((c) => c.id === editState.id ? d.category : c));
      setEditState(null);
      setToast('Saved!');
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  }

  // Loading auth
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6" style={{ paddingTop: NAVBAR_HEIGHT }}>
          <div className="text-center">
            <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-karnak)' }}>
              Create Categories
            </h1>
            <p className="text-base" style={{ color: 'var(--text-muted)' }}>
              Sign in to create and share your own Connections categories.
            </p>
          </div>
          <GoogleSignInButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div className="flex-1 px-4 py-6" style={{ paddingTop: NAVBAR_HEIGHT + 24 }}>
      <div className="max-w-lg mx-auto">
        {/* Greeting */}
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Hi, {firstName}!</p>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-full mb-6" style={{ backgroundColor: 'var(--tile-bg)' }}>
          {(['mine', 'create'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`${tab === t ? 'btn-hover' : 'btn-hover-ghost'} flex-1 py-2 rounded-full font-bold text-sm`}
              style={
                tab === t
                  ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }
                  : { backgroundColor: 'transparent', color: 'var(--text)', opacity: 0.6 }
              }
            >
              {t === 'mine' ? 'My Categories' : 'Create New'}
            </button>
          ))}
        </div>

        {/* My Categories tab */}
        {tab === 'mine' && (
          <div className="flex flex-col gap-3">
            {loadingCats && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!loadingCats && myCategories.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No categories yet. Create your first one!
              </p>
            )}
            {myCategories.map((cat) =>
              editState?.id === cat.id ? (
                /* Inline edit */
                <div key={cat.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: '#ba81c5', backgroundColor: 'var(--tile-bg)' }}>
                  <input
                    type="text"
                    value={editState.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditState((s) => s ? { ...s, name: v } : s);
                    }}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none uppercase font-bold"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    placeholder="Category name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {editState.words.map((w, i) => (
                      <input
                        key={i}
                        type="text"
                        value={w}
                        onChange={(e) => {
                          const next = [...editState.words] as [string, string, string, string];
                          next[i] = e.target.value;
                          setEditState((s) => s ? { ...s, words: next } : s);
                        }}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none uppercase font-bold"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        placeholder={`Word ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="btn-hover flex-1 py-2 rounded-full font-bold text-sm disabled:opacity-40"
                      style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
                    >
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditState(null)}
                      className="btn-hover-outline px-4 py-2 rounded-full font-bold text-sm border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display */
                <div key={cat.id} className="rounded-xl border px-4 py-3 flex items-start justify-between gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}>
                  <div className="min-w-0">
                    <p className="font-black text-sm uppercase tracking-wide" style={{ color: 'var(--text)' }}>{cat.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cat.words.join(', ')}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(cat)} className="btn-hover-outline text-xs font-bold px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(cat.id)} className="btn-hover-outline text-xs font-bold px-3 py-1.5 rounded-full border border-red-300 text-red-500">
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Create tab */}
        {tab === 'create' && (
          <div className="rounded-xl border p-4 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                CATEGORY NAME
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => handleNewNameChange(e.target.value)}
                placeholder="e.g. THINGS IN A TOOLBOX"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none uppercase font-bold"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                WORDS (4)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {newWords.map((w, i) => (
                  <input
                    key={i}
                    type="text"
                    value={w}
                    onChange={(e) => handleNewWordChange(i, e.target.value)}
                    placeholder={`Word ${i + 1}`}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none uppercase font-bold"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="btn-hover w-full py-3 rounded-full font-bold text-sm disabled:opacity-40"
              style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
            >
              {saving ? 'Saving…' : 'Create Category'}
            </button>
          </div>
        )}
      </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} duration={2500} />}
    </div>
  );
}
