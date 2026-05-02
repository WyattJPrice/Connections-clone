'use client';

import { useEffect, useState } from 'react';
import { getStats } from '@/lib/stats';
import { Stats } from '@/lib/types';
import { useKey } from '@/lib/useKey';

interface StatsModalProps {
  onClose: () => void;
}

export function StatsModal({ onClose }: StatsModalProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  useKey('Escape', onClose);

  useEffect(() => {
    // Read immediately, then re-read after a tick in case stats were just written
    setStats(getStats());
    const t = setTimeout(() => setStats(getStats()), 50);
    return () => clearTimeout(t);
  }, []);

  const winPct = stats && stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;

  const maxMistake = stats
    ? Math.max(...Object.values(stats.mistakeDistribution), 1)
    : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-fade-in"
        style={{ backgroundColor: 'var(--modal-bg)', color: 'var(--text)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black tracking-tight">Statistics</h2>
          <button onClick={onClose} className="text-2xl leading-none opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>

        <hr style={{ borderColor: 'var(--border)' }} className="mb-5" />

        {!stats ? (
          <p className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { label: 'Completed', value: stats.gamesPlayed },
                { label: 'Win %', value: winPct },
                { label: 'Current\nStreak', value: stats.currentStreak },
                { label: 'Max Streak', value: stats.maxStreak },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-3xl font-black">{value}</span>
                  <span className="text-xs text-center leading-tight mt-0.5 whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <hr style={{ borderColor: 'var(--border)' }} className="mb-5" />

            {/* All-time finishes */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black">{stats.gamesWon}</span>
                <span className="text-xs text-center leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>Daily Wins</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black">{stats.customWins ?? 0}</span>
                <span className="text-xs text-center leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>Custom Wins</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black">{stats.gamesWon + (stats.customWins ?? 0)}</span>
                <span className="text-xs text-center leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Finishes</span>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border)' }} className="mb-5" />

            {/* Secondary stats */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black">{stats.perfectPuzzles}</span>
                <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Perfect Puzzles</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black">{stats.purpleFirst}</span>
                <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Purple First</span>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border)' }} className="mb-5" />

            {/* Mistake distribution */}
            <div>
              <h3 className="font-black text-sm tracking-widest uppercase mb-3">
                Mistake Distribution
              </h3>
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((n) => {
                  const count = stats.mistakeDistribution[n] ?? 0;
                  const pct = Math.round((count / maxMistake) * 100);
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-sm font-bold w-3 text-right">{n}</span>
                      <div className="flex-1 flex items-center">
                        <div
                          className="h-6 rounded flex items-center justify-end pr-2 min-w-7 transition-all"
                          style={{
                            width: `${Math.max(pct, 8)}%`,
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
