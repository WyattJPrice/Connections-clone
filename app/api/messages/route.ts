import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { containsProfanity } from '@/lib/profanity';
import { auth } from '@/auth';
import { dmChannel } from '@/lib/realtime';
import { sendPushToUser } from '@/lib/push-server';

export const dynamic = 'force-dynamic';

// Sender profile snapshot so the recipient can render a toast / system
// notification with the right name and avatar without an extra fetch.
async function getSenderProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .schema('next_auth')
    .from('users')
    .select('id, name, email, image, display_name')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    senderName: data.display_name || (data.name ?? '').split(' ')[0] || (data.email ?? '').split('@')[0] || 'Player',
    senderImage: data.image ?? null,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = session.user.id;

  const { searchParams } = new URL(req.url);
  const withUserId = searchParams.get('with');

  if (!withUserId) return NextResponse.json({ messages: [] });

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`and(sender_id.eq.${me},recipient_id.eq.${withUserId}),and(sender_id.eq.${withUserId},recipient_id.eq.${me})`)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[messages] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark anything from the other person as read now that it's been fetched.
  const unread = (data ?? []).filter((m) => m.recipient_id === me && m.read_at === null);
  if (unread.length > 0) {
    await supabaseAdmin
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .in(
        'id',
        unread.map((m) => m.id)
      );
  }

  return NextResponse.json({
    messages: (data ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      recipientId: m.recipient_id,
      body: m.body,
      createdAt: m.created_at,
      readAt: m.read_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = session.user.id;

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.body === 'string' ? body.body : '';
  const recipientId = typeof body?.recipientId === 'string' ? body.recipientId : '';
  const text = raw.trim();

  if (!recipientId) return NextResponse.json({ error: 'Recipient is required.' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: 'Message is too long (max 1000 characters).' }, { status: 400 });
  if (containsProfanity(text)) {
    return NextResponse.json({ error: 'Inappropriate language detected' }, { status: 422 });
  }
  if (recipientId === me) {
    return NextResponse.json({ error: 'You cannot message yourself.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('direct_messages')
    .insert({ sender_id: me, recipient_id: recipientId, body: text })
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .single();

  if (error) {
    console.error('[messages] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sender = await getSenderProfile(me);

  // Fire-and-forget: push the DM to the recipient's subscriptions so they get
  // notified even when the site is closed. The service worker suppresses the
  // notification when the app is open (the live broadcast handles that case).
  // Fired BEFORE the live broadcast so offline delivery isn't delayed by the
  // realtime socket round-trip below.
  void sendPushToUser(recipientId, {
    title: `${sender?.senderName ?? 'Someone'} sent you a message`,
    body: data.body,
    tag: `dm:${me}`,
    url: '/',
  });

  // Deliver live to the recipient via their realtime broadcast channel.
  try {
    const channel = supabaseAdmin.channel(dmChannel(recipientId));
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: {
        id: data.id,
        senderId: data.sender_id,
        recipientId: data.recipient_id,
        body: data.body,
        createdAt: data.created_at,
        readAt: data.read_at,
        ...(sender ?? {}),
      },
    });
    await supabaseAdmin.removeChannel(channel);
  } catch (err) {
    console.error('[messages] broadcast error:', err);
  }

  return NextResponse.json({
    message: {
      id: data.id,
      senderId: data.sender_id,
      recipientId: data.recipient_id,
      body: data.body,
      createdAt: data.created_at,
      readAt: data.read_at,
    },
  });
}