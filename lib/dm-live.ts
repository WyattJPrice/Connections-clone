'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { dmChannel } from '@/lib/realtime';
import { fetchUnreadMessages } from '@/lib/messages';

export interface LiveDm {
  id: string;
  senderId: string;
  recipientId?: string;
  senderName?: string;
  senderImage?: string | null;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

// ONE realtime subscription (plus an unread-poll fallback) shared by every
// component that wants live DMs. Components used to each subscribe to the same
// dm:<me> topic, and the duplicate join/leave while opening/closing a thread
// could knock the toast channel out — so toasts silently stopped until refresh.
// Everything now routes through this module singleton.
let channel: RealtimeChannel | null = null;
let subscribedUserId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollCleanup: (() => void) | null = null;
const threadHandlers = new Set<(msg: LiveDm) => void>();
const toastHandlers = new Set<(msg: LiveDm) => void>();
const openThreads = new Set<string>();
const toastedIds = new Set<string>();

function isHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function handle(msg: LiveDm) {
  if (!msg || !msg.id) return;
  // Someone is viewing this conversation — send it to the open thread(s).
  if (openThreads.has(msg.senderId)) {
    threadHandlers.forEach((h) => h(msg));
    return;
  }
  // Otherwise toast it, deduped across the broadcast and the poll. Hidden-tab
  // behavior (system notifications on classlink, nothing elsewhere) is each
  // site's toast handler's job.
  if (toastedIds.has(msg.id)) return;
  toastedIds.add(msg.id);
  toastHandlers.forEach((h) => h(msg));
}

async function poll() {
  if (isHidden()) return;
  const unread = await fetchUnreadMessages().catch(() => []);
  const unreadIds = new Set(unread.map((m) => m.id));
  // Forget ids that have since been read so the set doesn't grow forever.
  for (const id of Array.from(toastedIds)) {
    if (!unreadIds.has(id)) toastedIds.delete(id);
  }
  // Only surface recent unread to avoid spamming a stale backlog.
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const msg of unread) {
    if (new Date(msg.createdAt).getTime() < cutoff) continue;
    handle(msg);
  }
}

function ensureSubscribed(userId: string) {
  if (subscribedUserId === userId && channel) return;
  const supabase = getSupabase();
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (pollCleanup) {
    pollCleanup();
    pollCleanup = null;
  }
  subscribedUserId = userId;
  channel = supabase
    .channel(dmChannel(userId))
    .on('broadcast', { event: 'message' }, (payload) => {
      handle(payload.payload as LiveDm);
    })
    .subscribe();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 10000);
  const onActive = () => {
    if (document.visibilityState === 'visible') poll();
  };
  document.addEventListener('visibilitychange', onActive);
  window.addEventListener('focus', onActive);
  pollCleanup = () => {
    document.removeEventListener('visibilitychange', onActive);
    window.removeEventListener('focus', onActive);
  };
  poll();
}

// Register as a viewer of `threadId` (or null for none) to receive messages for
// that conversation live. Safe to call from several components at once.
export function subscribeLiveThreads(
  userId: string | undefined,
  threadId: string | null,
  handler: (msg: LiveDm) => void
): () => void {
  threadHandlers.add(handler);
  if (threadId) openThreads.add(threadId);
  if (userId) ensureSubscribed(userId);
  return () => {
    threadHandlers.delete(handler);
    if (threadId) openThreads.delete(threadId);
  };
}

// Register to receive toast-worthy messages (i.e. not for an open thread).
export function subscribeLiveToasts(
  userId: string | undefined,
  handler: (msg: LiveDm) => void
): () => void {
  toastHandlers.add(handler);
  if (userId) ensureSubscribed(userId);
  return () => {
    toastHandlers.delete(handler);
  };
}