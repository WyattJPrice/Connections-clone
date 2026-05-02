'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';

interface PuzzleRow {
  date: string;
  plays: number;
  wins: number;
}

interface StatsData {
  today: { plays: number; wins: number };
  allTime: { plays: number; wins: number };
  longestStreak: number;
  mistakeDist: Record<number, number>;
  puzzleBreakdown: PuzzleRow[];
}

function pct(wins: number, plays: number) {
  if (!plays) return '—';
  return Math.round((wins / plays) * 100) + '%';
}

export default function AdminStatsPage() {
  const router = useRouter();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load stats.'))
      .finally(() => setLoading(false));
  }, []);

  const maxMistake = data ? Math.max(...Object.values(data.mistakeDist), 1) : 1;

  return (
    <div className="min-h-screen px-4 py-6" style={{ backgroundColor: 'var(--bg)', paddingTop: NAVBAR_HEIGHT + 24 }}>
      <Navbar />
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="text-sm font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--text)' }}
          >
            ‹ Back
          </button>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            Player Stats
          </h1>
        </div>

        {loading && (
          <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        )}
        {error && (
          <p className="text-center py-12 text-red-500">{error}</p>
        )}

        {data && (
          <div className="flex flex-col gap-5">
            {/* Today */}
            <Section title="Today">
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Played" value={data.today.plays} />
                <Stat label="Solved" value={data.today.wins} />
                <Stat label="Win Rate" value={pct(data.today.wins, data.today.plays)} />
              </div>
            </Section>

            {/* All Time */}
            <Section title="All Time">
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Played" value={data.allTime.plays} />
                <Stat label="Solved" value={data.allTime.wins} />
                <Stat label="Win Rate" value={pct(data.allTime.wins, data.allTime.plays)} />
              </div>
              <div className="mt-4 pt-4 border-t flex justify-center" style={{ borderColor: 'var(--border)' }}>
                <Stat label="Longest Daily Streak" value={`${data.longestStreak} day${data.longestStreak !== 1 ? 's' : ''}`} />
              </div>
            </Section>

            {/* Mistake distribution */}
            <Section title="Mistake Distribution (All Time)">
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((n) => {
                  const count = data.mistakeDist[n] ?? 0;
                  const barPct = Math.round((count / maxMistake) * 100);
                  return (
                    <div key={n} className="flex items-center gap-3">
                      <span className="text-sm font-bold w-4 text-right" style={{ color: 'var(--text)' }}>{n}</span>
                      <div className="flex-1 flex items-center">
                        <div
                          className="h-6 rounded flex items-center justify-end pr-2 transition-all"
                          style={{
                            width: `${Math.max(barPct, 5)}%`,
                            minWidth: '28px',
                            backgroundColor: count > 0 ? '#6b6b63' : 'var(--border)',
                          }}
                        >
                          <span className="text-xs font-bold text-white">{count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                0 mistakes = perfect solve
              </p>
            </Section>

            {/* Per-puzzle breakdown */}
            {data.puzzleBreakdown.length > 0 && (
              <Section title="Recent Puzzles">
                <div className="flex flex-col gap-0">
                  <div className="grid grid-cols-4 gap-2 pb-2 mb-1 border-b text-xs font-bold uppercase tracking-wider" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <span className="col-span-2">Date</span>
                    <span className="text-center">Played</span>
                    <span className="text-center">Win %</span>
                  </div>
                  {data.puzzleBreakdown.map((row) => (
                    <div
                      key={row.date}
                      className="grid grid-cols-4 gap-2 py-2.5 border-b text-sm"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                      <span className="col-span-2 font-medium">
                        {format(parseISO(row.date), 'MMM d, yyyy')}
                      </span>
                      <span className="text-center">{row.plays}</span>
                      <span className="text-center font-bold">{pct(row.wins, row.plays)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2 className="font-black text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-3xl font-black" style={{ color: 'var(--text)' }}>{value}</span>
      <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
