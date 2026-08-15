'use client';

export type GameName = 'pictionary' | 'connections' | 'classlink';

export interface OnlineUser {
  id: string;
  name: string | null;
  image: string | null;
  displayName: string | null;
  firstName: string;
  game: GameName;
  online: boolean;
  lastSeenAt: string | null;
  lastActiveAt: string | null;
}

export async function sendHeartbeat(game: GameName, opts: { inRoom?: boolean; background?: boolean; leaving?: boolean } = {}): Promise<void> {
  try {
    await fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, in_room: opts.inRoom === true, background: opts.background === true, leaving: opts.leaving === true }),
    });
  } catch {
    // Presence is best-effort — never block the UI on it.
  }
}

export async function fetchOnlineUsers(): Promise<OnlineUser[]> {
  try {
    const res = await fetch('/api/presence', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

/**
 * Pings the presence endpoint immediately and then every `intervalMs` while the
 * page is open, so the user shows up as online across sites. While the tab is
 * hidden a slower `background` ping keeps last_active_at fresh (still "online"
 * in messaging lists) without touching last_seen_at.
 */
export function startHeartbeat(game: GameName, intervalMs = 15000): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let backgroundTimer: ReturnType<typeof setInterval> | null = null;
  let leaveSent = false;

  const ping = () => {
    if (!stopped) sendHeartbeat(game);
  };

  const start = () => {
    if (stopped || timer) return;
    ping();
    timer = setInterval(ping, intervalMs);
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const backgroundPing = () => {
    if (!stopped) sendHeartbeat(game, { background: true });
  };

  const startBackground = () => {
    if (stopped || backgroundTimer) return;
    // Don't ping immediately on hide — that can race the close-leave beacon and
    // re-stamp last_active_at fresh, keeping the user "online" after closing.
    backgroundTimer = setInterval(backgroundPing, 60000);
  };

  const stopBackground = () => {
    if (backgroundTimer) {
      clearInterval(backgroundTimer);
      backgroundTimer = null;
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      stopBackground();
      start();
    } else {
      stop();
      startBackground();
    }
  };

  // The "user is leaving" signal. `pagehide` fires at the START of the unload
  // sequence while the page is still visible, so gate on visibilityState would
  // silently drop every close. Fire unconditionally; skip back/forward cache
  // restores (event.persisted). best-effort.
  const sendLeave = () => {
    if (leaveSent) return;
    leaveSent = true;
    try {
      const body = JSON.stringify({ game, leaving: true });
      const sent = navigator.sendBeacon?.('/api/presence', new Blob([body], { type: 'application/json' }));
      if (!sent) {
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // best-effort
    }
  };

  const onPageHide = (event: PageTransitionEvent) => {
    stop();
    stopBackground();
    if (event.persisted) return;
    sendLeave();
  };

  start();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', sendLeave);

  return () => {
    stopped = true;
    stop();
    stopBackground();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', sendLeave);
  };
}