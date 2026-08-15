import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-server';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? '';
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@classlink.fun';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

// Sends a push notification to every active subscription registered for a user.
// Fire-and-forget from callers. Stale subscriptions (404/410) are pruned.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    // If the recipient is on a site right now, the live realtime broadcast +
    // in-page toast/hidden-tab notification already handle it — pushing too
    // would double-notify (or fire from the other app's origin).
    const onlineCutoff = new Date(Date.now() - 120 * 1000).toISOString();
    const { data: onlineCheck } = await supabaseAdmin
      .from('presence_heartbeats')
      .select('user_id')
      .eq('user_id', userId)
      .gt('last_active_at', onlineCutoff)
      .limit(1)
      .maybeSingle();
    if (onlineCheck) return;

    // Offline notifications are delivered exclusively through classlink.fun's
    // service worker — this app no longer registers subscriptions. Filtering
    // by origin also keeps any stale rows from other domains from firing.
    const { data } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('origin', 'https://classlink.fun');
    if (!data || data.length === 0) return;

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      url: payload.url,
    });

    await Promise.all(
      data.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
          // 404 (gone) / 410 (expired) → the browser dropped this subscription.
          if (statusCode === 404 || statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      })
    );
  } catch (err) {
    console.error('[push] send error:', err);
  }
}
