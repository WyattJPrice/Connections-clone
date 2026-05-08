'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { signOut, getDisplayName, hasDisplayNameSet, updateDisplayName } from '@/lib/auth';
import { useKey } from '@/lib/useKey';
import { useModals } from '@/components/modals/ModalsProvider';
import { useTheme } from '@/components/ThemeProvider';
import type { Session } from '@supabase/supabase-js';

export const NAVBAR_HEIGHT = 48; // px — used for fixed-positioning offsets

export function Navbar() {
  const router = useRouter();
  const { openStats, openLeaderboard } = useModals();
  const { resolvedTheme, setTheme } = useTheme();

  const [session, setSession] = useState<Session | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const promptedFirstTime = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useKey(
    'Escape',
    () => {
      if (editingName) { setEditingName(false); setNameError(null); }
      setMenuOpen(false);
      setAccountOpen(false);
    },
    menuOpen || accountOpen || editingName
  );

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const user = session?.user;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = user?.user_metadata?.full_name as string | undefined;
  const displayName = getDisplayName(user);

  // First-time sign-in: open the avatar dropdown into edit mode so the user
  // can confirm or change the name pulled from their Google profile.
  useEffect(() => {
    if (!user) {
      promptedFirstTime.current = false;
      return;
    }
    if (promptedFirstTime.current) return;
    if (!hasDisplayNameSet(user)) {
      promptedFirstTime.current = true;
      setAccountOpen(true);
      setNameDraft(displayName);
      setEditingName(true);
    }
  }, [user, displayName]);

  // Focus the name input whenever edit mode opens
  useEffect(() => {
    if (editingName) {
      requestAnimationFrame(() => nameInputRef.current?.select());
    }
  }, [editingName]);

  async function handleSignOut() {
    await signOut();
    setAccountOpen(false);
    router.refresh();
  }

  function startEditName() {
    setNameDraft(displayName);
    setNameError(null);
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameError(null);
  }

  async function saveName() {
    if (nameSaving) return;
    setNameSaving(true);
    setNameError(null);
    const result = await updateDisplayName(nameDraft);
    setNameSaving(false);
    if (!result.ok) {
      setNameError(result.error ?? 'Failed to save.');
      return;
    }
    // Refresh session so the new metadata is reflected
    const { data } = await getSupabase().auth.getSession();
    setSession(data.session);
    setEditingName(false);
  }

  function navigateAndClose(path: string) {
    setMenuOpen(false);
    router.push(path);
  }

  function leaderboardAndClose() {
    setMenuOpen(false);
    openLeaderboard();
  }

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
      style={{
        height: NAVBAR_HEIGHT,
        backgroundColor: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* ── Left: hamburger + wordmark ───────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="navbar-icon-btn"
            aria-label="Open menu"
          >
            {/* ─────── ICON: HAMBURGER (replace svg below — final size 32×32) ─────── */}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
            {/* ─────── END HAMBURGER ICON ─────── */}
          </button>

          {menuOpen && (
            <div
              className="absolute left-0 top-12 z-50 rounded-xl shadow-lg border py-2 min-w-55"
              style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--border)' }}
            >
              <MenuItem onClick={() => navigateAndClose('/play')}>
                {/* ─────── ICON: TODAY'S PUZZLE (replace svg below) ─────── */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {/* ─────── END TODAY'S PUZZLE ICON ─────── */}
                <span>Today&apos;s Puzzle</span>
              </MenuItem>

              <MenuItem onClick={() => navigateAndClose('/custom')}>
                {/* ─────── ICON: CUSTOM GAME (replace svg below) ─────── */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                {/* ─────── END CUSTOM GAME ICON ─────── */}
                <span>Custom Game</span>
              </MenuItem>

              <MenuItem onClick={() => navigateAndClose('/create')}>
                {/* ─────── ICON: CREATE CATEGORIES (replace svg below) ─────── */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {/* ─────── END CREATE CATEGORIES ICON ─────── */}
                <span>Create Categories</span>
              </MenuItem>

              <MenuItem onClick={leaderboardAndClose}>
                {/* ─────── ICON: LEADERBOARD (replace svg below) ─────── */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                  <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                  <path d="M17 4h3v3a3 3 0 0 1-3 3" />
                  <path d="M7 4H4v3a3 3 0 0 0 3 3" />
                </svg>
                {/* ─────── END LEADERBOARD ICON ─────── */}
                <span>Leaderboard</span>
              </MenuItem>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/')}
          className="font-black text-2xl tracking-tight px-2 py-1 rounded-md"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-karnak)' }}
        >
          Connections
        </button>
      </div>

      {/* ── Right: stats / settings / account ────────────────────────────── */}
      <div className="flex items-center">
        <button onClick={openStats} className="navbar-icon-btn" aria-label="Statistics">
          {/* ─────── ICON: STATS / BAR CHART (NYT — 20×18) ─────── */}
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="26" height="23.4" viewBox="4 4 24 24">
            <path fill="currentColor" d="M21.3332 14.6667V4H10.6665V12H2.6665V28H29.3332V14.6667H21.3332ZM13.3332 6.66667H18.6665V25.3333H13.3332V6.66667ZM5.33317 14.6667H10.6665V25.3333H5.33317V14.6667ZM26.6665 25.3333H21.3332V17.3333H26.6665V25.3333Z" />
          </svg>
          {/* ─────── END STATS ICON ─────── */}

          
        </button>

        <button onClick={toggleTheme} className="navbar-icon-btn" aria-label="Toggle dark mode">
          {/* ─────── ICON: SETTINGS / GEAR (NYT — 21×21) ─────── */}

          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path fill="currentColor" d="M16.718 5.515a8 8 0 0 0-3.468-1.437V0h-2.5v4.078a8 8 0 0 0-3.467 1.437L4.399 2.63L2.63 4.399l2.884 2.884a8 8 0 0 0-1.437 3.467H0v2.5h4.078a8 8 0 0 0 1.437 3.468L2.63 19.6l1.768 1.768l2.883-2.883a8 8 0 0 0 3.468 1.437V24h2.5v-4.077a8 8 0 0 0 3.468-1.437l2.883 2.883l1.768-1.768l-2.883-2.883a8 8 0 0 0 1.437-3.468H24v-2.5h-4.077a8 8 0 0 0-1.437-3.468L21.368 4.4l-1.766-1.77zM9.496 7.08a5.52 5.52 0 0 1 7.424 7.423A6.77 6.77 0 0 1 9.496 7.08" clipRule="evenodd"/></svg>
          {/* ─────── END SETTINGS ICON ─────── */}
        </button>

        <div className="relative ml-3" ref={accountRef}>
          <button
            onClick={() => {
              if (!user) router.push('/create');
              else setAccountOpen((v) => !v);
            }}
            className="w-9 h-9 rounded-full overflow-hidden border-2 flex items-center justify-center transition-transform hover:scale-105"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}
            aria-label="Account"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={fullName ?? 'Account'} className="w-full h-full object-cover" />
            ) : (
              /* ─────── ICON: ACCOUNT FALLBACK / PERSON (replace svg below) ─────── */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              /* ─────── END ACCOUNT FALLBACK ICON ─────── */
            )}
          </button>

          {accountOpen && user && (
            <div
              className="absolute right-0 top-11 z-50 rounded-xl shadow-lg border py-2 min-w-55"
              style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--border)' }}
            >
              <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                {editingName ? (
                  <div className="flex flex-col gap-2">
                    {!hasDisplayNameSet(user) && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        What should we call you?
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={nameDraft}
                        maxLength={30}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveName(); }
                          else if (e.key === 'Escape') { e.preventDefault(); cancelEditName(); }
                        }}
                        disabled={nameSaving}
                        className="flex-1 min-w-0 px-2 py-1 rounded-md border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                        }}
                        placeholder="Display name"
                      />
                      <button
                        onClick={saveName}
                        disabled={nameSaving || !nameDraft.trim()}
                        className="btn-hover px-2.5 py-1 rounded-md font-bold text-xs disabled:opacity-40"
                        style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
                      >
                        {nameSaving ? '…' : 'Save'}
                      </button>
                    </div>
                    {nameError && (
                      <p className="text-xs" style={{ color: '#d23b3b' }}>{nameError}</p>
                    )}
                    {hasDisplayNameSet(user) && !nameError && (
                      <button
                        onClick={cancelEditName}
                        className="self-start text-xs underline"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {displayName || 'Account'}
                    </p>
                    <button
                      onClick={startEditName}
                      className="shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Edit display name"
                    >
                      {/* ─────── ICON: EDIT NAME ─────── */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M5 3c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7H5V5h7V3zm12.78 1a.7.7 0 0 0-.48.2l-1.22 1.21l2.5 2.5L19.8 6.7c.26-.26.26-.7 0-.95L18.25 4.2c-.13-.13-.3-.2-.47-.2m-2.41 2.12L8 13.5V16h2.5l7.37-7.38z"/>
                      </svg>
                      {/* ─────── END EDIT ICON ─────── */}
                    </button>
                  </div>
                )}
              </div>
              <MenuItem onClick={() => { setAccountOpen(false); router.push('/create'); }}>
                <span className="w-5" />
                <span>My Categories</span>
              </MenuItem>
              <MenuItem onClick={handleSignOut}>
                <span className="w-5" />
                <span>Sign Out</span>
              </MenuItem>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

interface MenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
}

function MenuItem({ onClick, children }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="navbar-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </button>
  );
}
