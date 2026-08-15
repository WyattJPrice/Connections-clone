'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { startHeartbeat, sendHeartbeat, fetchOnlineUsers, OnlineUser, GameName } from '@/lib/presence';
import { getSupabase } from '@/lib/supabase';
import { OnlinePanel } from '@/components/online/OnlinePanel';
import { Avatar } from '@/components/ui/Avatar';
import { DirectMessage, markMessagesRead } from '@/lib/messages';
import { subscribeLiveThreads, subscribeLiveToasts, LiveDm } from '@/lib/dm-live';

interface ToastState {
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  body: string;
}

interface OnlineShellProps {
  game: GameName;
}

export function OnlineShell({ game }: OnlineShellProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const heartbeatCleanup = useRef<(() => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live message routed to the open thread (the panel no longer subscribes to
  // the realtime channel itself).
  const [liveMessage, setLiveMessage] = useState<DirectMessage | null>(null);
  const prevUserId = useRef<string | undefined>(undefined);

  // Only signed-in users can view who's online and send messages.
  const isAuthenticated = status === 'authenticated' && !!userId;

  useEffect(() => {
    const prev = prevUserId.current;
    prevUserId.current = userId;
    if (prev && !userId) {
      sendHeartbeat(game, { leaving: true });
    }
  }, [userId, game]);

  // Heartbeat: keep this user visible as online across both sites.
  useEffect(() => {
    if (!userId) return;
    heartbeatCleanup.current?.();
    heartbeatCleanup.current = startHeartbeat(game);
    return () => {
      heartbeatCleanup.current?.();
      heartbeatCleanup.current = null;
    };
  }, [userId, game]);

  // Load the online list in the background so the button badge stays fresh
  // even before the panel is opened.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOnlineUsers().then(setUsers).catch(() => {});
  }, [isAuthenticated]);

  const refreshUsers = useCallback(async () => {
    const list = await fetchOnlineUsers();
    setUsers(list);
    setLoading(false);
  }, []);

  // Live presence: subscribe to postgres_changes on presence_heartbeats.
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel('presence-heartbeats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presence_heartbeats' },
        () => {
          fetchOnlineUsers().then(setUsers).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Live incoming DMs: subscription + unread-poll fallback live in the dm-live
  // singleton so there is exactly ONE realtime channel on dm:<me> in the app.
  // (Components used to each subscribe to that topic, and the duplicate
  // join/leave while opening/closing a thread could knock the toast channel
  // out — toasts then silently stopped until refresh.)
  const notify = useCallback((msg: LiveDm) => {
    const senderName = msg.senderName || 'Someone';
    const senderImage = msg.senderImage ?? null;

    // Tab is hidden → skip; classlink.fun owns notifications.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    // Visible → in-app toast.
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ senderId: msg.senderId, senderName, senderImage, body: msg.body });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  // Route a DM to the panel's open thread, or toast it. Used by the singleton's
  // thread subscription (panel is viewing that sender) and toast subscription.
  const handleLiveMessage = useCallback(
    (msg: LiveDm) => {
      if (!msg || !msg.id) return;
      if (open && activeThreadId === msg.senderId) {
        setLiveMessage({
          id: msg.id,
          senderId: msg.senderId,
          recipientId: msg.recipientId ?? msg.senderId,
          body: msg.body,
          createdAt: msg.createdAt,
          readAt: msg.readAt ?? null,
        });
        return;
      }
      notify(msg);
    },
    [open, activeThreadId, notify]
  );

  // Messages for the thread currently open in the panel.
  useEffect(() => {
    if (!userId) return;
    return subscribeLiveThreads(userId, open ? activeThreadId : null, (msg) => {
      if (open && activeThreadId === msg.senderId) {
        setLiveMessage({
          id: msg.id,
          senderId: msg.senderId,
          recipientId: msg.recipientId ?? msg.senderId,
          body: msg.body,
          createdAt: msg.createdAt,
          readAt: msg.readAt ?? null,
        });
        // It's shown in the open thread, so it's read — otherwise the unread
        // poll would re-toast it after the thread closes.
        if (msg.senderId !== userId) markMessagesRead([msg.id]);
      }
    });
  }, [userId, open, activeThreadId]);

  // Toasts for messages not shown in any open thread.
  useEffect(() => {
    if (!userId) return;
    return subscribeLiveToasts(userId, handleLiveMessage);
  }, [userId, handleLiveMessage]);

  function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
      refreshUsers();
    }
  }

  function closeThread() {
    setActiveThreadId(null);
  }

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={handleToggle}
        className="btn-hover fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          backgroundColor: 'var(--button-bg)',
          color: 'var(--button-text)',
          border: '1px solid var(--border)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
        }}
        aria-label={open ? 'Close online friends' : 'Open online friends'}
      >
        {/* ─────── ICON: FRIENDS / USERS ─────── */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
          <circle cx="17.5" cy="9" r="2.75" />
          <path d="M16.5 14.6c2.8.2 5 1.9 5 5.4" />
        </svg>
        {/* ─────── END FRIENDS ICON ─────── */}
      </button>

      {open && (
        <OnlinePanel
          game={game}
          users={users}
          loading={loading}
          activeThreadId={activeThreadId}
          onOpenThread={setActiveThreadId}
          onCloseThread={closeThread}
          onClose={() => setOpen(false)}
          liveMessage={liveMessage}
        />
      )}

      {/* In-app message toast */}
      {toast && (
        <div
          className="animate-toast-in fixed right-6 bottom-24 z-[60] flex flex-col gap-2 rounded-xl border px-3 py-2.5 shadow-lg"
          style={{
            backgroundColor: 'var(--modal-bg)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={toast.senderImage} name={toast.senderName} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold" style={{ color: 'var(--text)' }}>
                {toast.senderName}
              </span>
              <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {toast.body}
              </span>
            </span>
          </div>
          <button
            onClick={() => {
              setOpen(true);
              setActiveThreadId(toast.senderId);
              if (toastTimer.current) clearTimeout(toastTimer.current);
              setToast(null);
              fetchOnlineUsers().then(setUsers).catch(() => {});
            }}
            className="btn-hover self-end rounded-full px-4 py-1.5 text-sm font-bold"
            style={{
              backgroundColor: 'var(--button-bg)',
              color: 'var(--button-text)',
            }}
          >
            Respond
          </button>
        </div>
      )}
    </>
  );
}