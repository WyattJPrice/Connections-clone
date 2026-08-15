'use client';

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface SendMessageResult {
  ok: boolean;
  error?: string;
  message?: DirectMessage;
}

export async function fetchThread(withUserId: string): Promise<DirectMessage[]> {
  try {
    const res = await fetch(`/api/messages?with=${encodeURIComponent(withUserId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

export async function sendDirectMessage(
  recipientId: string,
  body: string
): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Message cannot be empty.' };
  if (trimmed.length > 1000) return { ok: false, error: 'Message is too long (max 1000 characters).' };

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, body: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? 'Failed to send message.' };
    return { ok: true, message: data?.message };
  } catch {
    return { ok: false, error: 'Failed to send message.' };
  }
}

export interface UnreadMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

// DB-backed fallback for DM delivery: realtime broadcasts are fire-and-forget,
// so this gives the client a way to recover toasts that were dropped.
export async function fetchUnreadMessages(): Promise<UnreadMessage[]> {
  try {
    const res = await fetch('/api/messages/unread', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.latest) ? data.latest : [];
  } catch {
    return [];
  }
}

export async function markMessagesRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await fetch('/api/messages/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // best-effort
  }
}