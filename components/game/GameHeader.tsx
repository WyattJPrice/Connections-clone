'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import type { Session } from '@supabase/supabase-js';

export function GameHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPlayPage = pathname === '/play' || pathname === '/play/custom';
  const dateParam = searchParams.get('date');
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isPastDate = pathname === '/play' && !!dateParam && dateParam !== todayStr;
  const isTodayActive = pathname === '/play' && !isPastDate;
  const isCustomActive = pathname === '/play/custom' || isPastDate;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const user = session?.user;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = user?.user_metadata?.full_name as string | undefined;

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    router.refresh();
  }

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-2"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Left — back link on non-play pages, mode switch on play pages */}
      {!isPlayPage ? (
        <button
          onClick={() => router.push('/')}
          className="btn-hover-ghost flex items-center gap-1.5 font-black text-lg tracking-tight"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-karnak)' }}
        >
          <span className="text-xl leading-none">‹</span>
          Connections
        </button>
      ) : (
        <div className="flex items-center gap-1 p-1 rounded-full" style={{ backgroundColor: 'var(--tile-bg)' }}>
          <button
            onClick={() => router.push('/play')}
            className={`${isTodayActive ? 'btn-hover' : 'btn-hover-ghost'} px-4 py-1.5 rounded-full font-bold text-sm`}
            style={
              isTodayActive
                ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }
                : { backgroundColor: 'transparent', color: 'var(--text)', opacity: 0.6 }
            }
          >
            Today's
          </button>
          <button
            onClick={() => router.push('/custom')}
            className={`${isCustomActive ? 'btn-hover' : 'btn-hover-ghost'} px-4 py-1.5 rounded-full font-bold text-sm`}
            style={
              isCustomActive
                ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }
                : { backgroundColor: 'transparent', color: 'var(--text)', opacity: 0.6 }
            }
          >
            Custom
          </button>
        </div>
      )}

      {/* Account button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => {
            if (!user) {
              router.push('/create');
            } else {
              setMenuOpen((v) => !v);
            }
          }}
          className="btn-hover w-9 h-9 rounded-full overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}
          aria-label="Account"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName ?? 'Account'} className="w-full h-full object-cover" />
          ) : (
            <PersonIcon />
          )}
        </button>

        {menuOpen && user && (
          <div
            className="absolute right-0 top-11 z-50 rounded-xl shadow-lg border py-2 min-w-[160px]"
            style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--border)' }}
          >
            <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                {fullName?.split(' ')[0] ?? 'Account'}
              </p>
            </div>
            <button
              onClick={() => { setMenuOpen(false); router.push('/create'); }}
              className="btn-hover-ghost w-full text-left px-4 py-2.5 text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              My Categories
            </button>
            <button
              onClick={handleSignOut}
              className="btn-hover-ghost w-full text-left px-4 py-2.5 text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
