'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserCategory } from '@/lib/types';

interface Props {
  onSelect: (cat: UserCategory) => void;
  onClose: () => void;
}

export function CommunityBrowserModal({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const url = name.trim()
        ? `/api/user-categories?creatorName=${encodeURIComponent(name.trim())}`
        : '/api/user-categories';
      const r = await fetch(url);
      const d = await r.json();
      setResults(d.categories ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => fetchCategories(search), 350);
    return () => clearTimeout(id);
  }, [search, fetchCategories]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--modal-bg)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-black" style={{ color: 'var(--text)' }}>Browse Community Categories</h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-opacity hover:opacity-70"
            style={{ color: 'var(--text)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <input
            type="text"
            placeholder="Search by creator name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none"
            style={{
              backgroundColor: 'var(--tile-bg)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2">
          {loading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
          {!loading && results.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No categories found.' : 'No community categories yet.'}
            </p>
          )}
          {results.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border px-4 py-3 flex items-start justify-between gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}
            >
              <div className="min-w-0">
                <p className="font-black text-sm uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                  {cat.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {cat.words.join(', ')}
                </p>
                <p className="text-xs mt-1 font-bold" style={{ color: 'var(--text-muted)' }}>
                  by {cat.creatorName}
                </p>
              </div>
              <button
                onClick={() => { onSelect(cat); onClose(); }}
                className="shrink-0 px-3 py-1.5 rounded-full font-bold text-xs transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
              >
                Use
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
