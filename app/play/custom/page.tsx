'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { recordCompletion } from '@/lib/recordCompletion';
import { incrementCustomWins } from '@/lib/stats';
import { Puzzle, UserCategory, Color } from '@/lib/types';
import { GameBoard } from '@/components/game/GameBoard';
import { GameHeader } from '@/components/game/GameHeader';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';

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
          setLoading(false);
          return;
        }
        const counts = new Map<string, number>();
        for (const cat of cats) {
          const seen = new Set<string>();
          for (const word of cat.words) {
            const w = word.trim().toUpperCase();
            if (seen.has(w)) continue;
            seen.add(w);
            counts.set(w, (counts.get(w) ?? 0) + 1);
          }
        }
        const dupes = Array.from(counts.entries()).filter(([, n]) => n > 1).map(([w]) => w);
        if (dupes.length > 0) {
          const list = dupes.slice(0, 3).join(', ');
          const more = dupes.length > 3 ? ` +${dupes.length - 3} more` : '';
          setError(`These categories share word${dupes.length > 1 ? 's' : ''}: ${list}${more}. Pick a different mix.`);
          setLoading(false);
          return;
        }
        setPuzzle(buildPuzzle(cats));
        fetch('/api/user-categories/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
          .then(async (r) => {
            const json = await r.json().catch(() => ({}));
            if (!r.ok) console.error('[play count] failed:', r.status, json);
            else console.log('[play count] updated:', json);
          })
          .catch((err) => console.error('[play count] network error:', err));
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load categories.');
        setLoading(false);
      });
  }, [idsParam]);

  const handleWin = useCallback(() => {
    incrementCustomWins();
    recordCompletion('custom');
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <Navbar />
        <div
          className="flex flex-col items-center justify-center gap-4"
          style={{ paddingTop: NAVBAR_HEIGHT, minHeight: '100vh' }}
        >
          <p style={{ color: 'var(--text)' }}>{error ?? 'Something went wrong.'}</p>
          <button
            onClick={() => router.push('/custom')}
            className="px-6 py-2 rounded-full font-bold text-sm"
            style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
          >
            Back to Browse
          </button>
        </div>
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
          noStats
          onWin={handleWin}
          onBack={() => router.push('/custom')}
        />
      </div>
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
