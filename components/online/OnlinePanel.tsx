'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { OnlineUser, GameName } from '@/lib/presence';
import { DirectMessage, fetchThread, sendDirectMessage } from '@/lib/messages';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileMenu } from '@/components/online/ProfileMenu';

const GAME_LABELS: Record<GameName, string> = {
  pictionary: 'Pictionary',
  connections: 'Connections',
  classlink: 'Classlink',
};

// Users who are only online on the classlink hub show a plain status line
// (no game label) — just "Online" or "last seen Xm ago".
function statusText(user: OnlineUser): string {
  const label = user.game === 'classlink' ? '' : `${GAME_LABELS[user.game]} · `;
  if (user.online) return `${label}Online`;
  return user.lastActiveAt ? `${label}${lastSeenText(user.lastActiveAt)}` : label.trim() || 'Offline';
}

interface OnlinePanelProps {
  game: GameName;
  users: OnlineUser[];
  loading: boolean;
  activeThreadId: string | null;
  onOpenThread: (userId: string) => void;
  onCloseThread: () => void;
  onClose: () => void;
  liveMessage: DirectMessage | null;
}

export function OnlinePanel({
  game,
  users,
  loading,
  activeThreadId,
  onOpenThread,
  onCloseThread,
  onClose,
  liveMessage,
}: OnlinePanelProps) {
  const { data: session } = useSession();
  const me = session?.user?.id;

  // Order: online users first (this site before the other game), then offline
  // users (this site first, then most-recently-seen). The current user's own
  // profile is hidden from the list.
  const sortedUsers = useMemo(() => {
    return [...users]
      .filter((u) => u.id !== me)
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (a.game === game && b.game !== game) return -1;
        if (b.game === game && a.game !== game) return 1;
        return (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '');
      });
  }, [users, game, me]);

  return (
    <div className="fixed inset-0 z-50">
      {/* Scrim */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

      {/* Panel */}
      <aside
        className="animate-slide-in-right absolute top-0 right-0 bottom-0 flex w-full max-w-sm flex-col themed-scrollbar"
        style={{ backgroundColor: 'var(--modal-bg)', borderLeft: '1px solid var(--border)' }}
      >
        {activeThreadId ? (
          <ThreadView users={users} otherUserId={activeThreadId} onBack={onCloseThread} onClose={onClose} liveMessage={liveMessage} />
        ) : (
          <>
            <header
              className="flex items-center justify-between px-4 shrink-0"
              style={{
                height: 52,
                backgroundColor: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
              }}
            >
                <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  Players — {sortedUsers.length}
                </h2>
              <button
                onClick={onClose}
                className="btn-hover-ghost p-1 rounded-full"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close"
              >
                {/* ─────── ICON: CLOSE ─────── */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
                {/* ─────── END CLOSE ICON ─────── */}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto themed-scrollbar">
              {loading ? (
                <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Loading…
                </p>
              ) : sortedUsers.length === 0 ? (
                <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nobody is online right now.
                </p>
              ) : (
                sortedUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onMessage={() => onOpenThread(u.id)}
                  />
                ))
              )}
            </div>

            <footer
              className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
              style={{
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ProfileMenu align="left" placement="above" />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                    {session?.user?.name ?? 'Account'}
                  </p>
                </div>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function UserRow({
  user,
  onMessage,
}: {
  user: OnlineUser;
  onMessage: () => void;
}) {
  const dotColor = user.online ? '#0bd44a' : 'var(--border)';
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="relative shrink-0">
        <Avatar src={user.image} name={user.name} size={40} />
        {/* Presence dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2"
          style={{ backgroundColor: dotColor, borderColor: 'var(--modal-bg)' }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
          {user.displayName || user.firstName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {statusText(user)}
        </p>
      </div>

      <button
        onClick={onMessage}
        className="btn-hover-outline flex h-9 w-9 items-center justify-center rounded-full shrink-0"
        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
        aria-label={`Message ${user.displayName || user.firstName}`}
      >
        {/* ─────── ICON: MESSAGE ─────── */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {/* ─────── END MESSAGE ICON ─────── */}
      </button>
    </div>
  );
}

function lastSeenText(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Online';
  if (mins < 60) return `last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `last seen ${days}d ago`;
}

function ThreadView({
  users,
  otherUserId,
  onBack,
  onClose,
  liveMessage,
}: {
  users: OnlineUser[];
  otherUserId: string;
  onBack: () => void;
  onClose: () => void;
  liveMessage: DirectMessage | null;
}) {
  const { data: session } = useSession();
  const me = session?.user?.id;
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherFallback, setOtherFallback] = useState<OnlineUser | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Prefer the live presence list (it refreshes when names change); fall back
  // to a one-time fetch for users who aren't currently online.
  const other = useMemo(
    () => users.find((u) => u.id === otherUserId) ?? otherFallback,
    [users, otherUserId, otherFallback]
  );

  // Find the other user's profile from the presence list (fallback via fetch).
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch('/api/presence', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const found = (data?.users ?? []).find((u: OnlineUser) => u.id === otherUserId);
      if (active && found) setOtherFallback(found);
    })();
    return () => {
      active = false;
    };
  }, [otherUserId]);

  // Load the message history.
  useEffect(() => {
    let active = true;
    fetchThread(otherUserId).then((msgs) => {
      if (active) setMessages(msgs);
    });
    return () => {
      active = false;
    };
  }, [otherUserId]);

  // Live incoming DMs arrive via OnlineShell's single realtime subscription and
  // the unread-poll fallback, forwarded through the `liveMessage` prop. (This
  // thread used to subscribe to the same dm:<me> channel itself — that duplicate
  // topic join could knock out the toast channel, so it was removed.) Derived
  // during render rather than appended with a state-updating effect.
  const displayMessages = useMemo(() => {
    if (
      !liveMessage ||
      (liveMessage.senderId !== otherUserId && liveMessage.recipientId !== otherUserId) ||
      messages.some((m) => m.id === liveMessage.id)
    ) {
      return messages;
    }
    return [...messages, liveMessage];
  }, [messages, liveMessage, otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [displayMessages]);

  async function handleSend() {
    if (sending || !draft.trim()) return;
    setSending(true);
    setError(null);
    const result = await sendDirectMessage(otherUserId, draft);
    setSending(false);
    if (result.ok && result.message) {
      setDraft('');
      setMessages((prev) => (prev.some((m) => m.id === result.message!.id) ? prev : [...prev, result.message!]));
    } else {
      setError(result.error ?? 'Failed to send.');
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center gap-2 px-2 shrink-0"
        style={{
          height: 52,
          backgroundColor: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={onBack}
          className="btn-hover-ghost p-2 rounded-full"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Back to online list"
        >
          {/* ─────── ICON: BACK ARROW ─────── */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {/* ─────── END BACK ARROW ─────── */}
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar src={other?.image} name={other?.name} size={28} />
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
            {other?.displayName || other?.firstName || 'Player'}
          </p>
        </div>
        <div className="flex-1" />
        <button onClick={onClose} className="btn-hover-ghost p-2 rounded-full" style={{ color: 'var(--text-muted)' }} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto themed-scrollbar px-3 py-3 flex flex-col gap-1.5">
        {displayMessages.length === 0 ? (
          <p className="text-sm text-center mt-6" style={{ color: 'var(--text-muted)' }}>
            No messages yet. Say hi!
          </p>
        ) : (
          displayMessages.map((m) => {
            const mine = m.senderId === me;
            return (
              <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className="max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap break-words"
                  style={{
                    backgroundColor: mine ? 'var(--tile-selected)' : 'var(--tile-bg)',
                    color: mine ? 'var(--tile-selected-text)' : 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {m.body}
                  <p className="text-[10px] mt-1 text-right opacity-70" style={{ color: mine ? 'inherit' : 'var(--text-muted)' }}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="px-3 pb-1 text-xs" style={{ color: '#d23b3b' }}>
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 px-3 pb-3 pt-1 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          maxLength={1000}
          placeholder={`Message ${other?.displayName || other?.firstName || 'them'}…`}
          className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none themed-scrollbar"
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="btn-hover rounded-full px-4 py-2 text-sm font-bold shrink-0 disabled:opacity-40"
          style={{ backgroundColor: 'var(--button-bg)', color: 'var(--button-text)' }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}