'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Puzzle } from '@/lib/types';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';
import { recordCompletion } from '@/lib/recordCompletion';

function PlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleWin = useCallback(() => {
    if (puzzle) recordCompletion('daily', puzzle.puzzleDate);
  }, [puzzle]);

  useEffect(() => {
    const d = new Date();
    const todayDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const targetDate = dateParam ?? todayDate;

    if (dateParam && targetDate > todayDate) {
      setError('That puzzle isn’t available yet — try a past date.');
      setLoading(false);
      return;
    }

    fetch(`/api/puzzle/today?date=${targetDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.exists) {
          setError('No puzzle available for this date.');
        } else {
          setPuzzle(data.puzzle);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load puzzle.');
        setLoading(false);
      });
  }, [dateParam]);

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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div style={{ paddingTop: NAVBAR_HEIGHT }}>
        <GameHeader />
        <GameBoard
          puzzle={puzzle}
          onWin={handleWin}
          onBack={() => router.push('/')}
        />
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading puzzle…</p>
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
