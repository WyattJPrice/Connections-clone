'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { UserCategory } from '@/lib/types';
import { GameHeader } from '@/components/game/GameHeader';
import { Toast } from '@/components/ui/Toast';
import { getCompletedCategoryIds } from '@/lib/customProgress';

interface PuzzleDate {
  puzzleDate: string;
  puzzleNumber: number;
}

export default function CustomPage() {
  const router = useRouter();

  // Calendar state
  const [viewMonth, setViewMonth] = useState(new Date());
  const [puzzleDates, setPuzzleDates] = useState<PuzzleDate[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // Community state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserCategory[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setCompletedIds(getCompletedCategoryIds());
  }, []);

  useEffect(() => {
    fetch('/api/puzzles')
      .then((r) => r.json())
      .then((d) => setPuzzleDates(d.puzzles ?? []))
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
  }, []);

  const searchCategories = useCallback(async (name: string) => {
    setSearchLoading(true);
    try {
      const url = name.trim()
        ? `/api/user-categories?creatorName=${encodeURIComponent(name.trim())}`
        : '/api/user-categories';
      const r = await fetch(url);
      const d = await r.json();
      setResults(d.categories ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => searchCategories(search), 350);
    return () => clearTimeout(id);
  }, [search, searchCategories]);

  async function handleShuffle() {
    setSearchLoading(true);
    try {
      const r = await fetch('/api/user-categories?random=4');
      const d = await r.json();
      const cats: UserCategory[] = d.categories ?? [];
      if (cats.length < 4) {
        setToast('Not enough community categories yet!');
        return;
      }
      router.push(`/play/custom?categories=${cats.map((c) => c.id).join(',')}`);
    } catch {
      setToast('Failed to load categories.');
    } finally {
      setSearchLoading(false);
    }
  }

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

  function handlePlay() {
    if (selected.size !== 4) return;
    router.push(`/play/custom?categories=${Array.from(selected).join(',')}`);
  }

  // Calendar helpers
  const puzzleDateSet = new Set(puzzleDates.map((p) => p.puzzleDate));
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <GameHeader />

      <div className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto flex flex-col gap-8">

          {/* ── Section 1: Previous Daily Puzzles ── */}
          <section>
            <h2 className="text-lg font-black mb-3" style={{ color: 'var(--text)' }}>
              Previous Daily Puzzles
            </h2>

            {calendarLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {/* Month navigation */}
                <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: 'var(--tile-bg)' }}>
                  <button
                    onClick={() => setViewMonth((m) => subMonths(m, 1))}
                    className="btn-hover-ghost p-1 rounded"
                    style={{ color: 'var(--text)' }}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                    {format(viewMonth, 'MMMM yyyy')}
                  </span>
                  <button
                    onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    className="btn-hover-ghost p-1 rounded"
                    style={{ color: 'var(--text)' }}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 px-2 pt-2" style={{ backgroundColor: 'var(--bg)' }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="text-center text-xs font-bold py-1" style={{ color: 'var(--text-muted)' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-y-1 px-2 pb-3" style={{ backgroundColor: 'var(--bg)' }}>
                  {Array.from({ length: leadingBlanks }).map((_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const hasPuzzle = puzzleDateSet.has(dateStr);
                    const today = isSameDay(day, new Date());
                    const inMonth = isSameMonth(day, viewMonth);
                    return (
                      <button
                        key={dateStr}
                        onClick={() => hasPuzzle && router.push(`/play?date=${dateStr}`)}
                        disabled={!hasPuzzle}
                        className="relative flex flex-col items-center py-1 rounded-lg transition-all"
                        style={{
                          opacity: inMonth ? 1 : 0.3,
                          cursor: hasPuzzle ? 'pointer' : 'default',
                          backgroundColor: today ? 'var(--tile-selected)' : 'transparent',
                        }}
                      >
                        <span
                          className="text-sm font-bold"
                          style={{ color: today ? 'var(--tile-selected-text, var(--bg))' : 'var(--text)' }}
                        >
                          {format(day, 'd')}
                        </span>
                        {hasPuzzle && (
                          <span
                            className="w-1.5 h-1.5 rounded-full mt-0.5"
                            style={{ backgroundColor: '#ba81c5' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── Section 2: Community Categories ── */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>
                Community Categories
              </h2>
              <button
                onClick={() => router.push('/create')}
                className="btn-hover px-4 py-1.5 rounded-full font-bold text-sm"
                style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
              >
                + Create Your Own
              </button>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              Select 4 categories to build your own puzzle.
            </p>

            {/* Search + shuffle row */}
            <div className="flex gap-2 mb-4 items-center">
              <input
                type="text"
                placeholder="Search by creator name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: 'var(--tile-bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
              {/* Shuffle button with tooltip */}
              <div className="relative group">
                <button
                  onClick={handleShuffle}
                  disabled={searchLoading}
                  className="btn-hover-outline w-10 h-10 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
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
            </div>

            {/* Selected count + play button */}
            {selected.size > 0 && (
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--tile-bg)' }}>
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
            )}

            {/* Results */}
            {searchLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {search ? 'No categories found.' : 'No community categories yet. Be the first to create one!'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map((cat) => {
                  const isCompleted = completedIds.has(cat.id);
                  const isSelected = selected.has(cat.id);

                  if (isCompleted) {
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleSelect(cat.id)}
                        className="card-hover w-full text-left rounded-xl border px-4 py-3 transition-all"
                        style={{
                          borderColor: isSelected ? '#ba81c5' : '#a0c35a',
                          borderWidth: isSelected ? '2px' : '1px',
                          backgroundColor: isSelected ? 'rgba(186,129,197,0.12)' : 'rgba(160,195,90,0.08)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="font-black text-sm uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                            {cat.name}
                          </p>
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: isSelected ? '#ba81c5' : '#a0c35a',
                              color: '#fff',
                            }}
                          >
                            {isSelected ? '✓ Selected' : '✓ Solved'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {cat.words.map((w) => (
                            <span
                              key={w}
                              className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: isSelected ? '#ba81c5' : 'var(--border)',
                                color: isSelected ? '#fff' : 'var(--text)',
                              }}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          by {cat.creatorName} · {format(new Date(cat.createdAt), 'MMM d, yyyy')}
                        </p>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleSelect(cat.id)}
                      className="card-hover w-full text-left rounded-xl border transition-all"
                      style={{
                        borderColor: isSelected ? '#ba81c5' : 'var(--border)',
                        borderWidth: isSelected ? '2px' : '1px',
                        backgroundColor: isSelected ? 'rgba(186,129,197,0.12)' : 'var(--tile-bg)',
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{
                            borderColor: isSelected ? '#ba81c5' : 'var(--border)',
                            backgroundColor: isSelected ? '#ba81c5' : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                            by {cat.creatorName}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {format(new Date(cat.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                          style={{
                            backgroundColor: isSelected ? '#ba81c5' : 'var(--border)',
                            color: isSelected ? '#fff' : 'var(--text-muted)',
                          }}
                        >
                          4 words
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

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
