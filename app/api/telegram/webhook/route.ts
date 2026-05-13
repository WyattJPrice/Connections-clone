import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
  buildSubmissionMessage,
  submissionKeyboard,
  deleteConfirmKeyboard,
  escapeHtml,
  adminChatId,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

interface TgUser { id: number }
interface TgChat { id: number }
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
}
interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}
interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

interface CategoryRow {
  id: string;
  name: string;
  words: string[];
  creator_name: string;
}

function verifySecret(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  return req.headers.get('x-telegram-bot-api-secret-token') === expected;
}

function isAdminChat(chatId: number | string) {
  const allowed = adminChatId();
  return !!allowed && String(chatId) === String(allowed);
}

async function fetchCategory(id: string): Promise<CategoryRow | null> {
  const { data } = await supabaseAdmin
    .from('user_categories')
    .select('id, name, words, creator_name')
    .eq('id', id)
    .single();
  return (data as CategoryRow | null) ?? null;
}

async function setPendingEdit(
  chatId: string,
  action: 'edit_name' | 'edit_words',
  categoryId: string,
  promptMessageId: number,
) {
  await supabaseAdmin.from('telegram_admin_state').upsert({
    chat_id: chatId,
    action,
    category_id: categoryId,
    prompt_message_id: promptMessageId,
  });
}

async function clearPendingEdit(chatId: string) {
  await supabaseAdmin.from('telegram_admin_state').delete().eq('chat_id', chatId);
}

async function getPendingEdit(chatId: string) {
  const { data } = await supabaseAdmin
    .from('telegram_admin_state')
    .select('action, category_id, prompt_message_id')
    .eq('chat_id', chatId)
    .single();
  return data as { action: 'edit_name' | 'edit_words'; category_id: string; prompt_message_id: number | null } | null;
}

async function handleCallback(cq: TgCallbackQuery) {
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  const data = cq.data;
  if (!chatId || !messageId || !data) {
    await answerCallbackQuery(cq.id, 'Invalid callback');
    return;
  }
  if (!isAdminChat(chatId)) {
    await answerCallbackQuery(cq.id, 'Not authorized');
    return;
  }

  const [action, categoryId] = data.split(':');

  switch (action) {
    case 'edit_name':
    case 'edit_words': {
      const cat = await fetchCategory(categoryId);
      if (!cat) {
        await answerCallbackQuery(cq.id, 'Category no longer exists');
        return;
      }
      const prompt =
        action === 'edit_name'
          ? `Reply with the new <b>name</b> for "${escapeHtml(cat.name)}":`
          : `Reply with the 4 new <b>words</b> (comma-separated) for "${escapeHtml(cat.name)}":`;
      const sent = await sendMessage({
        chat_id: chatId,
        text: prompt,
        parse_mode: 'HTML',
        reply_to_message_id: messageId,
      });
      const promptId = sent.result?.message_id ?? 0;
      await setPendingEdit(String(chatId), action as 'edit_name' | 'edit_words', categoryId, promptId);
      await answerCallbackQuery(cq.id);
      return;
    }

    case 'delete': {
      const cat = await fetchCategory(categoryId);
      if (!cat) {
        await answerCallbackQuery(cq.id, 'Already gone');
        return;
      }
      await editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: `${buildSubmissionMessage({ id: cat.id, name: cat.name, words: cat.words, creatorName: cat.creator_name })}\n\n<b>Delete this category?</b>`,
        parse_mode: 'HTML',
        reply_markup: deleteConfirmKeyboard(categoryId),
      });
      await answerCallbackQuery(cq.id);
      return;
    }

    case 'delete_confirm': {
      const { error } = await supabaseAdmin.from('user_categories').delete().eq('id', categoryId);
      if (error) {
        await answerCallbackQuery(cq.id, 'Delete failed');
        return;
      }
      await editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: '🗑 <b>Deleted.</b>',
        parse_mode: 'HTML',
      });
      await answerCallbackQuery(cq.id, 'Deleted');
      return;
    }

    case 'delete_cancel': {
      const cat = await fetchCategory(categoryId);
      if (!cat) {
        await editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: 'Category no longer exists.',
        });
        await answerCallbackQuery(cq.id);
        return;
      }
      await editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: buildSubmissionMessage({ id: cat.id, name: cat.name, words: cat.words, creatorName: cat.creator_name }),
        parse_mode: 'HTML',
        reply_markup: submissionKeyboard(categoryId),
      });
      await answerCallbackQuery(cq.id);
      return;
    }

    default:
      await answerCallbackQuery(cq.id, 'Unknown action');
  }
}

async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  // Public helper that anyone can use to discover their chat id during setup.
  if (text === '/chatid' || text === '/start') {
    await sendMessage({
      chat_id: chatId,
      text: `Your chat ID is: <code>${chatId}</code>\n\nSet <code>TELEGRAM_CHAT_ID</code> to this value to receive submissions.`,
      parse_mode: 'HTML',
    });
    return;
  }

  if (!isAdminChat(chatId)) return;

  if (text === '/cancel') {
    await clearPendingEdit(String(chatId));
    await sendMessage({ chat_id: chatId, text: 'Cancelled pending edit.' });
    return;
  }

  const pending = await getPendingEdit(String(chatId));
  if (!pending) return; // Nothing to do with random messages.

  if (pending.action === 'edit_name') {
    const newName = text.toUpperCase();
    const { data, error } = await supabaseAdmin
      .from('user_categories')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', pending.category_id)
      .select('id, name, words, creator_name')
      .single();
    await clearPendingEdit(String(chatId));
    if (error || !data) {
      await sendMessage({ chat_id: chatId, text: `❌ Update failed: ${error?.message ?? 'not found'}` });
      return;
    }
    await sendMessage({
      chat_id: chatId,
      text: `✅ Name updated.\n\n${buildSubmissionMessage({ id: data.id, name: data.name, words: data.words, creatorName: data.creator_name })}`,
      parse_mode: 'HTML',
    });
    return;
  }

  if (pending.action === 'edit_words') {
    const words = text.split(',').map((w) => w.trim()).filter(Boolean);
    if (words.length !== 4) {
      await sendMessage({
        chat_id: chatId,
        text: `❌ Need exactly 4 comma-separated words (got ${words.length}). Try again, or /cancel.`,
      });
      return;
    }
    const upper = words.map((w) => w.toUpperCase());
    const { data, error } = await supabaseAdmin
      .from('user_categories')
      .update({ words: upper, updated_at: new Date().toISOString() })
      .eq('id', pending.category_id)
      .select('id, name, words, creator_name')
      .single();
    await clearPendingEdit(String(chatId));
    if (error || !data) {
      await sendMessage({ chat_id: chatId, text: `❌ Update failed: ${error?.message ?? 'not found'}` });
      return;
    }
    await sendMessage({
      chat_id: chatId,
      text: `✅ Words updated.\n\n${buildSubmissionMessage({ id: data.id, name: data.name, words: data.words, creatorName: data.creator_name })}`,
      parse_mode: 'HTML',
    });
  }
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (e) {
    console.error('Telegram webhook error:', e);
  }

  // Always 200 OK so Telegram doesn't keep retrying.
  return NextResponse.json({ ok: true });
}
