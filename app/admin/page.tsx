'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

interface PuzzleSummary {
  puzzleDate: string;
  puzzleNumber: number;
}

export default function AdminCalendarPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [puzzleDates, setPuzzleDates] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPuzzles();
  }, []);

  async function fetchPuzzles() {
    try {
      const res = await fetch('/api/admin/puzzles');
      const data = await res.json();
      setPuzzleDates(data.puzzles ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  function getPuzzleForDate(date: Date): PuzzleSummary | undefined {
    const dateStr = format(date, 'yyyy-MM-dd');
    return puzzleDates.find((p) => p.puzzleDate === dateStr);
  }

  function renderCalendar() {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);

    const rows: React.ReactNode[] = [];
    let day = calStart;

    while (day <= calEnd) {
      const week: React.ReactNode[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const inMonth = isSameMonth(currentDay, currentMonth);
        const puzzle = getPuzzleForDate(currentDay);
        const todayFlag = isToday(currentDay);

        week.push(
          <button
            key={currentDay.toISOString()}
            onClick={() =>
              inMonth && router.push(`/admin/puzzle/${format(currentDay, 'yyyy-MM-dd')}`)
            }
            className={`
              aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all
              ${inMonth ? 'hover:opacity-80 cursor-pointer' : 'opacity-20 cursor-default'}
              ${todayFlag ? 'ring-2' : ''}
            `}
            style={{
              backgroundColor: puzzle
                ? '#a0c35a'
                : inMonth
                ? 'var(--tile-bg)'
                : 'transparent',
              color: puzzle ? '#1a1a1a' : 'var(--text)',
              outline: todayFlag ? '2px solid var(--text)' : undefined,
              outlineOffset: '2px',
            }}
          >
            <span className={todayFlag ? 'font-black' : ''}>{format(currentDay, 'd')}</span>
            {puzzle && (
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
    <div className="min-h-screen px-4 py-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            Puzzle Admin
          </h1>
          <button
            onClick={handleLogout}
            className="text-sm font-bold px-4 py-2 rounded-full border transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)' }}
          >
            Logout
          </button>
        </div>

        {/* Calendar card */}
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: 'var(--text)' }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <h2 className="font-black text-lg" style={{ color: 'var(--text)' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg transition-opacity hover:opacity-70"
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
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">{renderCalendar()}</div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#a0c35a' }} />
            <span>Has puzzle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'var(--tile-bg)' }} />
            <span>No puzzle — click to create</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          {puzzleDates.length} puzzle{puzzleDates.length !== 1 ? 's' : ''} created
        </div>
      </div>
    </div>
  );
}
