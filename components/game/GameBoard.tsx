'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Puzzle, Category, Color } from '@/lib/types';
import { Tile } from './Tile';
import { CategoryRow } from './CategoryRow';
import { MistakeDots } from './MistakeDots';
import { Toast } from '@/components/ui/Toast';
import { saveGameState, getSavedGameState, recordGameResult } from '@/lib/stats';
import { markCategoryCompleted } from '@/lib/customProgress';
import { useKey } from '@/lib/useKey';
import { useModals } from '@/components/modals/ModalsProvider';

const DIFFICULTY_ORDER: Color[] = ['yellow', 'blue', 'green', 'purple'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function guessKey(words: string[]): string {
  return [...words].sort().join('|');
}

interface GameBoardProps {
  puzzle: Puzzle;
  noStats?: boolean;
  onWin?: () => void;
  onBack?: () => void;
}

interface SavedState {
  tiles: string[];
  solvedColors: Color[];
  mistakes: number;
  gameOver: boolean;
  won: boolean;
  previousGuesses: string[];
  firstSolvedColor: Color | null;
}

export function GameBoard({ puzzle, noStats = false, onWin, onBack }: GameBoardProps) {
  const { openStats } = useModals();
  const allWords = puzzle.categories.flatMap((c) => c.words);
  const wordToCategory = useCallback(
    (word: string): Category => {
      const cat = puzzle.categories.find((c) => c.words.includes(word));
      if (!cat) throw new Error(`Word "${word}" not found in puzzle ${puzzle.puzzleDate}`);
      return cat;
    },
    [puzzle]
  );

  const rawSaved = typeof window !== 'undefined'
    ? getSavedGameState(puzzle.puzzleDate) as SavedState | null
    : null;

  // Discard save if any stored tile is not in this puzzle (stale/mismatched save)
  const savedIsValid = rawSaved?.tiles?.length
    ? rawSaved.tiles.every((w) => allWords.includes(w))
    : false;
  const saved = savedIsValid ? rawSaved : null;

  const [tiles, setTiles] = useState<string[]>(() => saved?.tiles ?? shuffle(allWords));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [solvedColors, setSolvedColors] = useState<Color[]>(() => saved?.solvedColors ?? []);
  const [mistakes, setMistakes] = useState(saved?.mistakes ?? 0);
  const [gameOver, setGameOver] = useState(saved?.gameOver ?? false);
  const [won, setWon] = useState(saved?.won ?? false);
  const [previousGuesses, setPreviousGuesses] = useState<Set<string>>(
    () => new Set(saved?.previousGuesses ?? [])
  );
  const [submittedWrong, setSubmittedWrong] = useState(false);
  const [shakingTiles, setShakingTiles] = useState<Set<string>>(new Set());
  const [jumpingTiles, setJumpingTiles] = useState<Map<string, number>>(new Map());
  const [mergingTiles, setMergingTiles] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [newSolvedColor, setNewSolvedColor] = useState<Color | null>(null);
  const [revealedFailColors, setRevealedFailColors] = useState<Color[]>(() =>
    saved?.gameOver && !saved?.won
      ? DIFFICULTY_ORDER.filter((c) => !(saved?.solvedColors ?? []).includes(c))
      : []
  );

  // Persist the first-solved color across sessions for purpleFirst tracking
  const firstSolvedColor = useRef<Color | null>(saved?.firstSolvedColor ?? null);
  // Prevent double-recording when revisiting a completed game
  const statsRecorded = useRef(saved?.gameOver === true);
  const failRevealRan = useRef(saved?.gameOver === true && !saved?.won);

  const solvedCategories = DIFFICULTY_ORDER.filter((c) => solvedColors.includes(c)).map(
    (color) => puzzle.categories.find((cat) => cat.color === color)!
  );

  const remainingTiles = tiles.filter(
    (w) => !solvedColors.includes(wordToCategory(w).color)
  );

  // Persist all state (including game-over final state) — skip for custom games
  useEffect(() => {
    if (noStats) return;
    const state: SavedState = {
      tiles,
      solvedColors,
      mistakes,
      gameOver,
      won,
      previousGuesses: Array.from(previousGuesses),
      firstSolvedColor: firstSolvedColor.current,
    };
    saveGameState(puzzle.puzzleDate, state);
  }, [tiles, solvedColors, mistakes, gameOver, won, previousGuesses, puzzle.puzzleDate, noStats]);

  // Staggered reveal of remaining categories on loss
  useEffect(() => {
    if (!gameOver || won || failRevealRan.current) return;
    failRevealRan.current = true;
    const unsolvedColors = DIFFICULTY_ORDER.filter((c) => !solvedColors.includes(c));
    const timers = unsolvedColors.map((color, idx) =>
      setTimeout(
        () => setRevealedFailColors((prev) => [...prev, color]),
        idx * 600
      )
    );
    return () => timers.forEach(clearTimeout);
  }, [gameOver, won, solvedColors]);

  function toggleSelect(word: string) {
    if (gameOver) return;
    if (solvedColors.includes(wordToCategory(word).color)) return;
    setSubmittedWrong(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else if (next.size < 4) {
        next.add(word);
      }
      return next;
    });
  }

  function handleShuffle() {
    setTiles((prev) => {
      const unsolved = prev.filter((w) => !solvedColors.includes(wordToCategory(w).color));
      const solved = prev.filter((w) => solvedColors.includes(wordToCategory(w).color));
      return [...solved, ...shuffle(unsolved)];
    });
  }

  function handleDeselectAll() {
    setSubmittedWrong(false);
    setSelected(new Set());
  }

  async function handleSubmit() {
    if (selected.size !== 4 || gameOver || submittedWrong) return;

    const selectedWords = Array.from(selected);
    const key = guessKey(selectedWords);

    if (previousGuesses.has(key)) {
      setToast('Already guessed!');
      return;
    }

    const categories = selectedWords.map((w) => wordToCategory(w).color);
    const allSame = categories.every((c) => c === categories[0]);

    setPreviousGuesses((prev) => new Set([...prev, key]));

    if (allSame) {
      const color = categories[0] as Color;

      if (!firstSolvedColor.current) firstSolvedColor.current = color;

      // Staggered bounce
      const staggerMap = new Map(selectedWords.map((w, i) => [w, i * 100]));
      setJumpingTiles(staggerMap);
      await new Promise((r) => setTimeout(r, 900));
      setJumpingTiles(new Map());

      // Merge up
      setMergingTiles(new Set(selectedWords));
      await new Promise((r) => setTimeout(r, 300));
      setMergingTiles(new Set());

      // Determine if this is the last solve (check before any async, value is captured)
      const isLastSolve = solvedColors.length + 1 === puzzle.categories.length;

      // Track completed community categories for the browse page
      if (noStats) {
        const solvedCat = puzzle.categories.find((c) => c.color === color);
        if (solvedCat) markCategoryCompleted(solvedCat.id);
      }

      // Record stats once, right here, with exact values
      if (isLastSolve && !statsRecorded.current && !noStats) {
        statsRecorded.current = true;
        const purpleFirst = firstSolvedColor.current === 'purple';
        recordGameResult(puzzle.puzzleDate, mistakes, true, purpleFirst);
      }

      if (isLastSolve) onWin?.();

      const newSolvedColors = [...solvedColors, color];
      setSolvedColors(newSolvedColors);
      setNewSolvedColor(color);
      setTimeout(() => setNewSolvedColor(null), 600);
      setSelected(new Set());

      if (isLastSolve) {
        setGameOver(true);
        setWon(true);
      }
    } else {
      const colorCounts = categories.reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
      const maxSame = Math.max(...Object.values(colorCounts));
      if (maxSame === 3) setToast('One away…');

      setShakingTiles(new Set(selectedWords));
      setTimeout(() => setShakingTiles(new Set()), 600);

      setSubmittedWrong(true);

      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);

      if (newMistakes >= 4) {
        // Record stats before updating state
        if (!statsRecorded.current && !noStats) {
          statsRecorded.current = true;
          recordGameResult(puzzle.puzzleDate, newMistakes, false, false);
        }
        setGameOver(true);
        setWon(false);
        setSelected(new Set());
      }
    }
  }

  const canSubmit = selected.size === 4 && !gameOver && !submittedWrong;

  useKey('Enter', () => { if (canSubmit) handleSubmit(); }, canSubmit);

  return (
    <div className="flex flex-col items-center w-full max-w-170 mx-auto px-3 pb-8">
      <p className="text-base text-center py-3" style={{ color: 'var(--text-muted)' }}>
        Create four groups of four!
      </p>

      {/* Board */}
      <div className="w-full flex flex-col gap-2">
        {solvedCategories.map((cat) => (
          <CategoryRow
            key={cat.color}
            category={cat}
            animate={cat.color === newSolvedColor}
          />
        ))}

        {!gameOver && (
          <div className="grid grid-cols-[repeat(4,144px)] sm:grid-cols-[repeat(4,150px)] gap-2 mx-auto w-fit">
            {remainingTiles.map((word) => (
              <Tile
                key={word}
                word={word}
                selected={selected.has(word)}
                solved={false}
                shaking={shakingTiles.has(word)}
                jumping={jumpingTiles.has(word)}
                merging={mergingTiles.has(word)}
                jumpDelay={jumpingTiles.get(word) ?? 0}
                onClick={() => toggleSelect(word)}
              />
            ))}
          </div>
        )}

        {gameOver && !won && (
          <>
            {revealedFailColors.map((color) => {
              const cat = puzzle.categories.find((c) => c.color === color)!;
              return <CategoryRow key={color} category={cat} animate={true} />;
            })}
          </>
        )}
      </div>

      {/* Game over message */}
      {gameOver && (
        <div className="mt-6 text-center animate-fade-in">
          <p className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>
            {won ? 'Impressive!' : 'Better luck next time!'}
          </p>
          <button
            onClick={openStats}
            className="btn-hover mt-3 px-8 py-3 rounded-full font-bold text-sm"
            style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
          >
            View Statistics
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="btn-hover-outline mt-2 px-8 py-3 rounded-full font-bold text-sm border"
              style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)', backgroundColor: 'transparent' }}
            >
              Go Back
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      {!gameOver && (
        <div className="mt-6 flex flex-col items-center gap-4 w-full">
          <MistakeDots remaining={4 - mistakes} />
          <div className="flex gap-3">
            <button
              onClick={handleShuffle}
              className="btn-hover-outline px-5 py-2.5 rounded-full font-bold text-base border"
              style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)', backgroundColor: 'transparent' }}
            >
              Shuffle
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={selected.size === 0}
              className="btn-hover-outline px-5 py-2.5 rounded-full font-bold text-base border disabled:opacity-40"
              style={{ borderColor: 'var(--outline-button-border)', color: 'var(--text)', backgroundColor: 'transparent' }}
            >
              Deselect All
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-hover px-5 py-2.5 rounded-full font-bold text-base disabled:opacity-40"
              style={
                canSubmit
                  ? { backgroundColor: 'var(--button-bg)', color: 'var(--button-text)', border: 'none' }
                  : { backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--outline-button-border)' }
              }
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
