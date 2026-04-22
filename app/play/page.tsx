'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Puzzle } from '@/lib/types';
import { GameBoard } from '@/components/game/GameBoard';
import { StatsModal } from '@/components/modals/StatsModal';
import { SettingsModal } from '@/components/modals/SettingsModal';

export default function PlayPage() {
  const router = useRouter();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch('/api/puzzle/today')
      .then((r) => r.json())
      .then((data) => {
        if (!data.exists) {
          setError('No puzzle available for today.');
        } else {
          setPuzzle(data.puzzle);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load puzzle.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading puzzle…</p>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text)' }}>{error ?? 'Something went wrong.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 rounded-full font-bold text-sm"
          style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4" style={{ backgroundColor: 'var(--bg)' }}>
      <GameBoard
        puzzle={puzzle}
        onOpenStats={() => setShowStats(true)}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
