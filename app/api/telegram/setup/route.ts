import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, isTelegramConfigured } from '@/lib/telegram';

function isAuthorized(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set' },
      { status: 400 },
    );
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'TELEGRAM_WEBHOOK_SECRET is not set' },
      { status: 400 },
    );
  }

  const host = req.headers.get('host') ?? '';
  const webhookUrl = `https://${host}/api/telegram/webhook`;

  const result = await setWebhook(webhookUrl, secret);
  if (!result.ok) {
    return NextResponse.json({ error: result.description ?? 'setWebhook failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, webhookUrl });
}
