'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Color, Category, UserCategory } from '@/lib/types';
import { CommunityBrowserModal } from '@/components/admin/CommunityBrowserModal';
import { Navbar, NAVBAR_HEIGHT } from '@/components/layout/Navbar';
import { useKey } from '@/lib/useKey';

const COLORS: Color[] = ['yellow', 'blue', 'green', 'purple'];
const COLOR_LABELS: Record<Color, string> = {
  yellow: 'Yellow (easiest)',
  blue: 'Blue',
  green: 'Green',
  purple: 'Purple (hardest)',
};
const COLOR_HEX: Record<Color, string> = {
  yellow: '#f9df6d',
  blue: '#b4d3ee',
  green: '#a0c35a',
  purple: '#ba81c5',
};

interface EditorCategory {
  id: string;
  color: Color;
  name: string;
  words: [string, string, string, string];
  creatorName?: string;
}

function emptyCategory(color: Color): EditorCategory {
  return { id: crypto.randomUUID(), color, name: '', words: ['', '', '', ''] };
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

export default function PuzzleEditorPage() {
  const router = useRouter();
  const params = useParams();
  const dateStr = params.date as string;

  const [puzzleNumber, setPuzzleNumber] = useState<number | null>(null);
  const [categories, setCategories] = useState<EditorCategory[]>(
    COLORS.map(emptyCategory)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [browserForColor, setBrowserForColor] = useState<Color | null>(null);

  useKey(
    'Enter',
    () => { if (!saving && !deleting && !browserForColor) handleSave(); },
    !loading && !browserForColor
  );

  const formattedDate = (() => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  })();

  useEffect(() => {
    const existing = fetch(`/api/admin/puzzles/${dateStr}`).then((r) => r.json());
    const allPuzzles = fetch('/api/admin/puzzles').then((r) => r.json());

    Promise.all([existing, allPuzzles])
      .then(([data, listData]) => {
        if (data.puzzle) {
          setExistingId(data.puzzle.id);
          setPuzzleNumber(data.puzzle.puzzleNumber);
          setCategories(
            COLORS.map((color) => {
              const cat: Category | undefined = data.puzzle.categories.find(
                (c: Category) => c.color === color
              );
              return {
                id: cat?.id ?? makeId(),
                color,
                name: cat?.name ?? '',
                words: cat ? (cat.words as [string, string, string, string]) : ['', '', '', ''],
                creatorName: cat?.creatorName,
              };
            })
          );
        } else {
          // Auto-assign next number for new puzzle
          const nums: number[] = (listData.puzzles ?? []).map((p: { puzzleNumber: number }) => p.puzzleNumber);
          const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
          setPuzzleNumber(next);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateStr]);

  function updateCategory(color: Color, field: 'name', value: string): void;
  function updateCategory(color: Color, field: 'words', wordIndex: number, value: string): void;
  function updateCategory(color: Color, field: 'name' | 'words', valueOrIndex: string | number, wordValue?: string) {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.color !== color) return cat;
        if (field === 'name') {
          return { ...cat, name: valueOrIndex as string, creatorName: undefined };
        } else {
          const newWords = [...cat.words] as [string, string, string, string];
          newWords[valueOrIndex as number] = wordValue ?? '';
          return { ...cat, words: newWords };
        }
      })
    );
  }

  function applyCommunityCategory(color: Color, uc: UserCategory) {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.color !== color) return cat;
        return {
          ...cat,
          name: uc.name,
          words: uc.words as [string, string, string, string],
          creatorName: uc.creatorName,
        };
      })
    );
  }

  function validate(): string[] {
    const errs: string[] = [];
    for (const cat of categories) {
      if (!cat.name.trim()) errs.push(`${COLOR_LABELS[cat.color]}: category name is required.`);
      if (cat.words.some((w) => !w.trim())) {
        errs.push(`${COLOR_LABELS[cat.color]}: all 4 words are required.`);
      }
    }
    // Check for duplicate words
    const allWords = categories.flatMap((c) => c.words.map((w) => w.trim().toUpperCase()));
    const unique = new Set(allWords);
    if (unique.size < allWords.length) errs.push('All 16 words must be unique.');
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    try {
      const body = {
        puzzleDate: dateStr,
        puzzleNumber: puzzleNumber ?? 1,
        categories: categories.map((cat) => ({
          color: cat.color,
          name: cat.name.trim(),
          words: cat.words.map((w) => w.trim().toUpperCase()),
          creatorName: cat.creatorName ?? null,
        })),
      };
      const res = await fetch(`/api/admin/puzzles/${dateStr}`, {
        method: existingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      router.push('/admin');
    } catch {
      setErrors(['Failed to save puzzle. Please try again.']);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingId) return;
    if (!confirm('Delete this puzzle? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/puzzles/${dateStr}`, { method: 'DELETE' });
      router.push('/admin');
    } catch {
      setErrors(['Failed to delete puzzle.']);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div className="flex-1 px-4 py-6" style={{ paddingTop: NAVBAR_HEIGHT + 24 }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: 'var(--text)' }}
            aria-label="Back"
          >
            ‹ Back
          </button>
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text)' }}>
              {existingId ? 'Edit Puzzle' : 'Create Puzzle'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{formattedDate}</p>
          </div>
        </div>

        {/* Puzzle number — auto-assigned, shown read-only */}
        {puzzleNumber != null && (
          <div className="mb-5 flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Puzzle</span>
            <span
              className="px-3 py-1 rounded-full text-sm font-black"
              style={{ backgroundColor: 'var(--tile-bg)', color: 'var(--text)' }}
            >
              No. {puzzleNumber}
            </span>
          </div>
        )}

        {/* Categories */}
        <div className="flex flex-col gap-5">
          {categories.map((cat) => (
            <div
              key={cat.color}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Color header */}
              <div
                className="px-4 py-2.5 flex items-center justify-between gap-2"
                style={{ backgroundColor: COLOR_HEX[cat.color] }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-black text-sm text-black/80 uppercase tracking-widest">
                    {cat.color}
                  </span>
                  <span className="text-xs text-black/60">— {COLOR_LABELS[cat.color]}</span>
                  {cat.creatorName && (
                    <span className="text-xs text-black/60 italic truncate">· by {cat.creatorName}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBrowserForColor(cat.color)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-black/70 transition-opacity hover:opacity-60 shrink-0"
                  style={{ backgroundColor: 'rgba(0,0,0,0.12)' }}
                  title="Browse community categories"
                  aria-label="Browse community categories"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M11 13H6q-.425 0-.712-.288T5 12t.288-.712T6 11h5V6q0-.425.288-.712T12 5t.713.288T13 6v5h5q.425 0 .713.288T19 12t-.288.713T18 13h-5v5q0 .425-.288.713T12 19t-.712-.288T11 18z"/>
                  </svg>
                </button>
              </div>

              <div className="p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--surface)' }}>
                {/* Category name */}
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                    CATEGORY NAME
                  </label>
                  <input
                    type="text"
                    value={cat.name}
                    onChange={(e) => updateCategory(cat.color, 'name', e.target.value)}
                    placeholder="e.g. U.S. MOUNTAIN STATES"
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none uppercase font-bold"
                    style={{
                      backgroundColor: 'var(--tile-bg)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                {/* Words */}
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                    WORDS (4)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.words.map((word, i) => (
                      <input
                        key={i}
                        type="text"
                        value={word}
                        onChange={(e) => updateCategory(cat.color, 'words', i, e.target.value)}
                        placeholder={`Word ${i + 1}`}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none uppercase font-bold"
                        style={{
                          backgroundColor: 'var(--tile-bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200">
            {errors.map((e) => (
              <p key={e} className="text-sm text-red-600">{e}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-full font-bold text-sm transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
          >
            {saving ? 'Saving…' : existingId ? 'Save Changes' : 'Create Puzzle'}
          </button>
          {existingId && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-3 rounded-full font-bold text-sm border transition-opacity hover:opacity-70 disabled:opacity-50 text-red-600 border-red-300"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
      </div>

      {browserForColor && (
        <CommunityBrowserModal
          onSelect={(uc) => applyCommunityCategory(browserForColor, uc)}
          onClose={() => setBrowserForColor(null)}
        />
      )}
    </div>
  );
}
