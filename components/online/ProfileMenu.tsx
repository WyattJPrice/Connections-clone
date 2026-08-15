'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut, getDisplayName, hasDisplayNameSet, updateDisplayName } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';

interface ProfileMenuProps {
  align?: 'left' | 'right';
  /** Where the dropdown opens relative to the avatar button. */
  placement?: 'below' | 'above';
}

export function ProfileMenu({ align = 'right', placement = 'below' }: ProfileMenuProps) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user;
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const displayName = getDisplayName(user);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingName) {
          setEditingName(false);
          setNameError(null);
        }
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editingName]);

  useEffect(() => {
    if (editingName) {
      requestAnimationFrame(() => nameInputRef.current?.select());
    }
  }, [editingName]);

  if (!user) return null;

  function startEdit() {
    setNameDraft(displayName);
    setNameError(null);
    setEditingName(true);
  }

  function cancelEdit() {
    setEditingName(false);
    setNameError(null);
  }

  async function saveName() {
    if (nameSaving) return;
    setNameSaving(true);
    setNameError(null);
    const result = await updateDisplayName(nameDraft);
    setNameSaving(false);
    if (!result.ok) {
      setNameError(result.error ?? 'Failed to save.');
      return;
    }
    await update();
    setEditingName(false);
  }

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-hover flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--tile-bg)' }}
        aria-label="Account"
      >
        <Avatar src={user.image} name={user.name} size={32} />
      </button>

      {open && (
        <div
          className={`absolute z-50 rounded-xl border py-2 shadow-lg min-w-55 ${
            placement === 'above' ? 'bottom-11' : 'top-11'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--border)' }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            {editingName ? (
              <div className="flex flex-col gap-2">
                {!hasDisplayNameSet(user) && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    What should we call you?
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameDraft}
                    maxLength={30}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveName();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    disabled={nameSaving}
                    className="flex-1 min-w-0 px-2 py-1 rounded-md border text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                    }}
                    placeholder="Display name"
                  />
                  <button
                    onClick={saveName}
                    disabled={nameSaving || !nameDraft.trim()}
                    className="btn-hover px-2.5 py-1 rounded-md font-bold text-xs disabled:opacity-40"
                    style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
                  >
                    {nameSaving ? '…' : 'Save'}
                  </button>
                </div>
                {nameError && <p className="text-xs" style={{ color: '#d23b3b' }}>{nameError}</p>}
                {hasDisplayNameSet(user) && !nameError && (
                  <button
                    onClick={cancelEdit}
                    className="self-start text-xs underline"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                  {displayName || 'Account'}
                </p>
                <button
                  onClick={startEdit}
                  className="btn-hover-ghost shrink-0 p-1 rounded-md"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Edit display name"
                >
                  {/* ─────── ICON: EDIT NAME ─────── */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M5 3c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7H5V5h7V3zm12.78 1a.7.7 0 0 0-.48.2l-1.22 1.21l2.5 2.5L19.8 6.7c.26-.26.26-.7 0-.95L18.25 4.2c-.13-.13-.3-.2-.47-.2m-2.41 2.12L8 13.5V16h2.5l7.37-7.38z"/>
                  </svg>
                  {/* ─────── END EDIT ICON ─────── */}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left btn-hover-ghost"
            style={{ color: 'var(--text)' }}
          >
            <span className="w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}