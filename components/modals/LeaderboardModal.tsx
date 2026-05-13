'use client';

import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@/app/api/leaderboard/route';
import { useKey } from '@/lib/useKey';

const MEDAL = ['🥇', '🥈', '🥉'];

type Tab = 'total' | 'daily' | 'custom' | 'created';

interface LeaderboardModalProps {
  onClose: () => void;
}

export function LeaderboardModal({ onClose }: LeaderboardModalProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('total');
  useKey('Escape', onClose);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = tab === 'created' ? entries.filter((e) => e.createdCount > 0) : entries;
  const sorted = [...visible].sort((a, b) => {
    if (tab === 'daily') return b.dailyCount - a.dailyCount;
    if (tab === 'custom') return b.customCount - a.customCount;
    if (tab === 'created') return b.createdCount - a.createdCount;
    return b.totalCount - a.totalCount;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl animate-fade-in flex flex-col"
        style={{ backgroundColor: 'var(--modal-bg)', color: 'var(--text)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-2xl font-black tracking-tight">Leaderboard</h2>
          <button
            onClick={onClose}
            className="btn-hover-ghost text-2xl leading-none opacity-60"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <hr style={{ borderColor: 'var(--border)' }} className="mx-6 shrink-0" />

        {/* Tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: 'var(--tile-bg)' }}>
            {(['total', 'daily', 'custom', 'created'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`${tab === t ? 'btn-hover' : 'btn-hover-ghost'} flex-1 py-2 rounded-full font-bold text-xs`}
                style={
                  tab === t
                    ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }
                    : { backgroundColor: 'transparent', color: 'var(--text)', opacity: 0.6 }
                }
              >
                {t === 'total' ? 'All' : t === 'daily' ? 'Daily' : t === 'custom' ? 'Custom' : 'Created'}
              </button>
            ))}
          </div>
        </div>

        {/* Table — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
              {tab === 'created' ? 'No categories created yet — make the first one!' : 'No completions yet — be the first!'}
            </p>
          ) : tab === 'created' ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-4 pb-1">
                <div />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Player</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: '#c2410c' }}>Made</span>
              </div>

              {sorted.map((entry, i) => (
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
                  <span className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                    {entry.userName}
                  </span>
                  <span className="font-black text-sm tabular-nums" style={{ color: '#c2410c' }}>
                    {entry.createdCount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 px-4 pb-1">
                <div />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Player</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: '#ba81c5' }}>Daily</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: '#a0c35a' }}>Custom</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: 'var(--text-muted)' }}>Total</span>
              </div>

              {sorted.map((entry, i) => (
                <div
                  key={`${entry.userName}-${i}`}
                  className="grid grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-3 px-4 py-3 rounded-xl"
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
                  <span className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                    {entry.userName}
                  </span>
                  <span className="font-black text-sm tabular-nums" style={{ color: '#ba81c5' }}>
                    {entry.dailyCount}
                  </span>
                  <span className="font-black text-sm tabular-nums" style={{ color: '#a0c35a' }}>
                    {entry.customCount}
                  </span>
                  <span className="font-black text-sm tabular-nums" style={{ color: 'var(--text)' }}>
                    {entry.totalCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
