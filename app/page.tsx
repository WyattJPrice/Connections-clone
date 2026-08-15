'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Image from 'next/image';
import { UserCategory } from '@/lib/types';
import { Toast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { CategoryTilesSkeleton, ListSkeleton } from '@/components/ui/Skeleton';
import { getCompletedCategoryIds, loadCompletedCategoryIds } from '@/lib/customProgress';
import { useSession } from 'next-auth/react';
import type { LeaderboardEntry } from '@/app/api/leaderboard/route';

interface TodayInfo {
  puzzleNumber: number;
  puzzleDate: string;
  exists: boolean;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function SplashPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const [info, setInfo] = useState<TodayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState<UserCategory[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [catsLoading, setCatsLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fetch(`/api/puzzle/today?date=${localDate}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch a pool of community categories (newest first), matching /custom.
  useEffect(() => {
    fetch('/api/user-categories?page=0&pageSize=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAllCategories(d.categories ?? []))
      .catch(() => {})
      .finally(() => setCatsLoading(false));
  }, []);

  // Completion status: paint from local cache immediately, then sync server.
  useEffect(() => {
    setCompletedIds(getCompletedCategoryIds());
    loadCompletedCategoryIds(isLoggedIn).then(setCompletedIds).catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setEntries((d.entries ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, []);

  const formattedDate = info?.puzzleDate
    ? format(new Date(info.puzzleDate + 'T00:00:00'), 'MMMM d, yyyy')
    : format(new Date(), 'MMMM d, yyyy');

  // Show the same top tiles /custom would: unsolved newest-first. If the user
  // has completed every category, fall back to a random set of 6.
  const shown = (() => {
    const unsolved = allCategories.filter((c) => !completedIds.has(c.id));
    if (unsolved.length > 0) return unsolved.slice(0, 6);
    return [...allCategories].sort(() => Math.random() - 0.5).slice(0, 6);
  })();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        setToast('Select exactly 4 categories to play.');
      }
      return next;
    });
  }

  function findDuplicateWords(cats: UserCategory[]): string[] {
    const counts = new Map<string, number>();
    for (const cat of cats) {
      const seenInThisCat = new Set<string>();
      for (const word of cat.words) {
        const w = word.trim().toUpperCase();
        if (seenInThisCat.has(w)) continue;
        seenInThisCat.add(w);
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).filter(([, n]) => n > 1).map(([w]) => w);
  }

  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Same as /custom: prefer unfinished categories, then finished as filler,
  // and greedily pick 4 categories with no shared words.
  function handleShuffle() {
    const pool = allCategories;
    if (pool.length < 4) {
      setToast('Not enough community categories yet!');
      return;
    }

    const unfinished = pool.filter((c) => !completedIds.has(c.id));
    const finished = pool.filter((c) => completedIds.has(c.id));

    for (let attempt = 0; attempt < 5; attempt++) {
      const ordered = [...shuffle(unfinished), ...shuffle(finished)];
      const picked: UserCategory[] = [];
      const usedWords = new Set<string>();
      for (const cat of ordered) {
        const words = cat.words.map((w) => w.trim().toUpperCase());
        if (words.some((w) => usedWords.has(w))) continue;
        picked.push(cat);
        words.forEach((w) => usedWords.add(w));
        if (picked.length === 4) break;
      }
      if (picked.length === 4) {
        router.push(`/play/custom?categories=${picked.map((c) => c.id).join(',')}`);
        return;
      }
    }
    setToast('Couldn’t find 4 categories without shared words. Try again.');
  }

  function handlePlay() {
    if (selected.size !== 4) return;
    const selectedCats = allCategories.filter((c) => selected.has(c.id));
    if (selectedCats.length === 4) {
      const dupes = findDuplicateWords(selectedCats);
      if (dupes.length > 0) {
        const list = dupes.slice(0, 3).join(', ');
        const more = dupes.length > 3 ? ` +${dupes.length - 3} more` : '';
        setToast(`Selected categories share word${dupes.length > 1 ? 's' : ''}: ${list}${more}. Pick a different category.`);
        return;
      }
    }
    router.push(`/play/custom?categories=${Array.from(selected).join(',')}`);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      {/* ── Hero ── */}
      <div
        style={{ backgroundColor: '#ba81c5' }}
        className="flex flex-col items-center justify-center px-6 pt-20 pb-16"
      >
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          {/* Logo */}
          <div className="w-25 h-25 rounded-xl overflow-hidden">
            <Image
              src="/connections.svg"
              alt="Connections"
              width={80}
              height={80}
              className="w-full h-full"
            />
          </div>

          {/* Title */}
          <div className="text-center">
            <h1
              className="text-5xl font-black tracking-tight"
              style={{ color: '#1a1a1a', fontFamily: 'var(--font-karnak)' }}
            >
              Connections
            </h1>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 w-full mt-2">
            <button
              onClick={() => info?.exists && router.push('/play')}
              disabled={loading || !info?.exists}
              className="btn-hover w-full py-4 rounded-full font-bold text-lg"
              style={{
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                opacity: loading || !info?.exists ? 0.5 : 1,
                cursor: loading || !info?.exists ? 'default' : 'pointer',
              }}
            >
              {loading ? 'Loading…' : info?.exists ? "Play Today's" : 'No puzzle today'}
            </button>
            <button
              onClick={() => router.push('/custom')}
              className="btn-hover-outline w-full py-3 rounded-full font-bold text-base"
              style={{
                backgroundColor: 'transparent',
                color: '#1a1a1a',
                border: '2px solid #1a1a1a',
                cursor: 'pointer',
                opacity: 0.85,
              }}
            >
              Play Custom
            </button>
            <a
              href="https://pictionary.classlink.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-hover-outline w-full py-3 rounded-full font-bold text-base text-center no-underline"
              style={{
                backgroundColor: 'transparent',
                color: '#1a1a1a',
                border: '2px solid #1a1a1a',
                opacity: 0.7,
              }}
            >
              Play Pictionary
            </a>
          </div>

          {/* Date and puzzle number */}
          <div className="text-center" style={{ color: '#1a1a1a' }}>
            <p className="font-bold text-lg">{formattedDate}</p>
            {info?.puzzleNumber != null && (
              <p className="text-base opacity-80">No. {info.puzzleNumber}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Community Categories (mirrors /custom) ── */}
      <section className="max-w-lg w-full mx-auto px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>
            Community Categories
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button
                onClick={handleShuffle}
                disabled={catsLoading}
                className="btn-hover-outline w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', backgroundColor: 'var(--tile-bg)' }}
                aria-label="Shuffle — pick 4 random categories"
              >
                <ShuffleIcon />
              </button>
              <div
                className="absolute right-0 top-full mt-2 z-20 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'var(--text)', color: 'var(--bg)' }}
              >
                Pick 4 random community categories
              </div>
            </div>
            <button
              onClick={() => router.push('/custom')}
              className="btn-hover-ghost text-sm font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              View All ›
            </button>
          </div>
        </div>

        {/* Selected count + play button — fixed height so the grid never shifts */}
        <div className="mb-3" style={{ height: '38px' }}>
          <div className="flex items-center justify-between h-full px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--tile-bg)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {selected.size} / 4 selected
            </span>
            {selected.size === 4 && (
              <button
                onClick={handlePlay}
                className="btn-hover px-5 py-1.5 rounded-full font-bold text-sm"
                style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
              >
                Play Selected ›
              </button>
            )}
          </div>
        </div>

        {catsLoading ? (
          <CategoryTilesSkeleton count={6} columns="grid-cols-2 sm:grid-cols-3" />
        ) : shown.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No community categories yet. Be the first to create one!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {shown.map((cat) => {
              const isCompleted = completedIds.has(cat.id);
              const isSelected = selected.has(cat.id);

              return (
                <button
                  key={cat.id}
                  onClick={() => toggleSelect(cat.id)}
                  className="rounded-xl border transition-all flex items-center gap-3 px-4 text-left"
                  style={{
                    height: '80px',
                    borderColor: isSelected ? '#ba81c5' : isCompleted ? '#a0c35a' : 'var(--border)',
                    borderWidth: isSelected ? '2px' : '1px',
                    backgroundColor: isSelected ? 'rgba(186,129,197,0.12)' : isCompleted ? 'rgba(160,195,90,0.08)' : 'var(--tile-bg)',
                  }}
                >
                  {/* Selection indicator */}
                  <span
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{
                      borderColor: isSelected ? '#ba81c5' : isCompleted ? '#a0c35a' : 'var(--border)',
                      backgroundColor: isSelected ? '#ba81c5' : isCompleted ? '#a0c35a' : 'transparent',
                    }}
                  >
                    {(isSelected || isCompleted) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>

                  {/* Content — same as /custom */}
                  <div className="flex-1 min-w-0">
                    {isCompleted ? (
                      <>
                        <p className="font-black text-sm uppercase tracking-wide truncate" style={{ color: 'var(--text)' }}>
                          {cat.name}
                        </p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {format(new Date(cat.createdAt), 'MMM d, yyyy')} · {cat.playCount ?? 0} {(cat.playCount ?? 0) === 1 ? 'play' : 'plays'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-sm flex items-center gap-2 truncate" style={{ color: 'var(--text)' }}>
                          <Avatar src={cat.creatorImage} name={cat.creatorName} size={32} />
                          {cat.creatorName}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {format(new Date(cat.createdAt), 'MMM d, yyyy')} · {cat.playCount ?? 0} {(cat.playCount ?? 0) === 1 ? 'play' : 'plays'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Status badge */}
                  {isCompleted && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? '#ba81c5' : '#a0c35a', color: '#fff' }}
                    >
                      {isSelected ? 'Selected' : 'Solved'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Top Players ── */}
      <section className="max-w-lg w-full mx-auto px-4 pt-8 pb-16">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>
            Top Players
          </h2>
          <button
            onClick={() => router.push('/leaderboard')}
            className="btn-hover-ghost text-sm font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            Full Leaderboard ›
          </button>
        </div>

        {lbLoading ? (
          <ListSkeleton rows={5} />
        ) : entries.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No completions yet — be the first to solve a puzzle!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
              <div
                key={`${entry.userName}-${i}`}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: i < 3 ? 'var(--tile-bg)' : 'transparent',
                  border: '1px solid var(--border)',
                }}
              >
                <span className="text-base font-black" style={{ color: 'var(--text)' }}>
                  {i < 3
                    ? MEDAL[i]
                    : <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  }
                </span>
                <span className="flex items-center gap-2 min-w-0">
                  <Avatar src={entry.userImage} name={entry.userName} size={24} />
                  <span className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                    {entry.userName}
                  </span>
                </span>
                <span className="font-black text-sm tabular-nums" style={{ color: 'var(--text)' }}>
                  {entry.totalCount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function ShuffleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path fill="currentColor" d="M14 20v-2h2.6l-3.175-3.175L14.85 13.4L18 16.55V14h2v6zm-8.6 0L4 18.6L16.6 6H14V4h6v6h-2V7.4zm3.775-9.425L4 5.4L5.4 4l5.175 5.175z"/>
    </svg>
  );
}
