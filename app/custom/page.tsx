'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  format, startOfMonth, endOfMonth,
  isSameMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, addDays, isFuture,
} from 'date-fns';
import { UserCategory } from '@/lib/types';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';
import { Toast } from '@/components/ui/Toast';
import { getCompletedCategoryIds } from '@/lib/customProgress';
import { useKey } from '@/lib/useKey';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSort, setModalSort] = useState<'all' | 'completed' | 'unsolved'>('all');

  useKey('Escape', () => setModalOpen(false), modalOpen);

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
      const r = await fetch(url, { cache: 'no-store' });
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
  function getPuzzleForDate(date: Date): PuzzleDate | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');
    return puzzleDates.find((p) => p.puzzleDate === dateStr);
  }

  function renderCalendar() {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);

    const rows: React.ReactNode[] = [];
    let day = calStart;

    while (day <= calEnd) {
      const week: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const inMonth = isSameMonth(currentDay, viewMonth);
        const puzzle = getPuzzleForDate(currentDay);
        const isFutureDate = isFuture(currentDay);

        week.push(
          <button
            key={currentDay.toISOString()}
            onClick={() =>
              puzzle && !isFutureDate && router.push(`/play?date=${format(currentDay, 'yyyy-MM-dd')}`)
            }
            disabled={!puzzle || isFutureDate}
            className={`
              aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all
              ${inMonth && puzzle && !isFutureDate ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}
              ${!inMonth ? 'opacity-20' : ''}
            `}
            style={{
              backgroundColor: puzzle && !isFutureDate
                ? '#a0c35a'
                : inMonth
                ? 'var(--tile-bg)'
                : 'transparent',
              color: puzzle && !isFutureDate ? '#1a1a1a' : 'var(--text)',
            }}
          >
            <span className="font-black text-sm">{format(currentDay, 'd')}</span>
            {puzzle && !isFutureDate && (
              <span className="text-xs opacity-70">#{puzzle.puzzleNumber}</span>
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toISOString()} className="grid grid-cols-7 gap-1.5">
          {week}
        </div>
      );
    }
    return rows;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />

      <div className="flex-1 px-4 py-6" style={{ paddingTop: NAVBAR_HEIGHT + 24 }}>
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

                {/* Day of week headers */}
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs font-bold py-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="flex flex-col gap-1.5">{renderCalendar()}</div>
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

            {/* Results - Tile View */}
            {searchLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {search ? 'No categories found.' : 'No community categories yet. Be the first to create one!'}
              </p>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {results
                    .filter((cat) => !completedIds.has(cat.id))
                    .slice(0, 10)
                    .map((cat) => {
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
                              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                                by {cat.creatorName}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {format(new Date(cat.createdAt), 'MMM d, yyyy')} · {cat.playCount ?? 0} {(cat.playCount ?? 0) === 1 ? 'play' : 'plays'}
                              </p>
                            </>
                          )}
                        </div>
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

                {(() => {
                  const unsolvedShown = Math.min(
                    10,
                    results.filter((c) => !completedIds.has(c.id)).length
                  );
                  return results.length > unsolvedShown ? (
                    <button
                      onClick={() => setModalOpen(true)}
                      className="btn-hover w-full py-2.5 rounded-lg font-bold text-sm"
                      style={{ backgroundColor: 'var(--tile-bg)', color: 'var(--text)' }}
                    >
                      View All {results.length} Categories ›
                    </button>
                  ) : null;
                })()}
              </div>
            )}

            {/* Modal - Browse All Categories */}
            {modalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
                onClick={() => setModalOpen(false)}
              >
                <div
                  className="rounded-2xl w-full max-w-4xl flex flex-col overflow-hidden"
                  style={{ backgroundColor: 'var(--bg)', maxHeight: '85vh' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="border-b px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <h3 className="font-black text-lg" style={{ color: 'var(--text)' }}>
                      All Categories
                      <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                        {results.length} total
                      </span>
                    </h3>
                    <button
                      onClick={() => setModalOpen(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold btn-hover-ghost"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Modal Controls */}
                  <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <input
                      type="text"
                      placeholder="Search by name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--tile-bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                    <div className="flex gap-1.5 shrink-0">
                      {(['all', 'completed', 'unsolved'] as const).map((sort) => (
                        <button
                          key={sort}
                          onClick={() => setModalSort(sort)}
                          className="text-xs font-bold px-3 py-1.5 rounded-full border transition-all"
                          style={
                            modalSort === sort
                              ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)', borderColor: 'var(--button-bg)' }
                              : { backgroundColor: 'transparent', color: 'var(--text)', borderColor: 'var(--border)' }
                          }
                        >
                          {sort === 'all' ? 'All' : sort === 'completed' ? 'Solved' : 'Unsolved'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="overflow-y-auto flex-1 px-6 py-4">
                    <div className="grid grid-cols-2 gap-2">
                      {results
                        .filter((cat) => {
                          if (modalSort === 'completed') return completedIds.has(cat.id);
                          if (modalSort === 'unsolved') return !completedIds.has(cat.id);
                          return true;
                        })
                        .sort((a, b) => {
                          const aCompleted = completedIds.has(a.id) ? 1 : 0;
                          const bCompleted = completedIds.has(b.id) ? 1 : 0;
                          return aCompleted - bCompleted;
                        })
                        .map((cat) => {
                          const isCompleted = completedIds.has(cat.id);
                          const isSelected = selected.has(cat.id);

                          return (
                            <button
                              key={cat.id}
                              onClick={() => toggleSelect(cat.id)}
                              className="rounded-lg border transition-all flex items-center gap-3 px-4 text-left"
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

                              {/* Content */}
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
                                    <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                                      by {cat.creatorName}
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
                  </div>

                  {/* Modal Footer */}
                  {selected.size > 0 && (
                    <div className="border-t px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                        {selected.size} / 4 selected
                      </span>
                      <div className="flex gap-2">
                        {selected.size === 4 && (
                          <button
                            onClick={() => { setModalOpen(false); handlePlay(); }}
                            className="btn-hover px-5 py-2 rounded-full font-bold text-sm"
                            style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
                          >
                            Play Selected ›
                          </button>
                        )}
                        <button
                          onClick={() => setModalOpen(false)}
                          className="btn-hover-outline px-4 py-2 rounded-full font-bold text-sm border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                  {selected.size === 0 && (
                    <div className="border-t px-6 py-4 flex justify-end shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => setModalOpen(false)}
                        className="btn-hover-outline px-4 py-2 rounded-full font-bold text-sm border"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
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
