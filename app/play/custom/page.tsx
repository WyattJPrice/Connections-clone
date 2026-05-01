'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { recordCompletion } from '@/lib/recordCompletion';
import { Puzzle, UserCategory, Color } from '@/lib/types';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { LeaderboardModal } from '@/components/modals/LeaderboardModal';
import { SettingsModal } from '@/components/modals/SettingsModal';

const COLORS: Color[] = ['yellow', 'blue', 'green', 'purple'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPuzzle(categories: UserCategory[]): Puzzle {
  const shuffledColors = shuffle(COLORS);
  return {
    id: 'custom-' + Date.now(),
    puzzleDate: 'custom',
    puzzleNumber: 0,
    categories: categories.map((uc, i) => ({
      id: uc.id,
      name: uc.name,
      color: shuffledColors[i],
      words: uc.words,
      creatorName: uc.creatorName,
    })),
  };
}

function CustomPlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('categories') ?? '';

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length !== 4) {
      setError('Please select exactly 4 categories.');
      setLoading(false);
      return;
    }

    fetch(`/api/user-categories?ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then((data) => {
        const cats: UserCategory[] = data.categories ?? [];
        if (cats.length !== 4) {
          setError('Could not load all 4 categories.');
        } else {
          setPuzzle(buildPuzzle(cats));
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load categories.');
        setLoading(false);
      });
  }, [idsParam]);

  const handleWin = useCallback(() => recordCompletion('custom'), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--bg)' }}>
        <GameHeader />
        <p style={{ color: 'var(--text)' }}>{error ?? 'Something went wrong.'}</p>
        <button
          onClick={() => router.push('/custom')}
          className="px-6 py-2 rounded-full font-bold text-sm"
          style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
        >
          Back to Browse
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4" style={{ backgroundColor: 'var(--bg)' }}>
      <GameHeader />
      <GameBoard
        puzzle={puzzle}
        onOpenStats={() => setShowStats(true)}
        onOpenSettings={() => setShowSettings(true)}
        noStats
        onWin={handleWin}
        onBack={() => router.push('/custom')}
      />
      {showStats && <LeaderboardModal onClose={() => setShowStats(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default function CustomPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </div>
      }
    >
      <CustomPlayContent />
    </Suspense>
  );
}
