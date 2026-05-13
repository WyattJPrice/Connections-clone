// Thin wrapper over the Telegram Bot API.
// Docs: https://core.telegram.org/bots/api

const API = 'https://api.telegram.org';

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return t;
}

export function isTelegramConfigured() {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

export function adminChatId() {
  return process.env.TELEGRAM_CHAT_ID ?? '';
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface SendMessageBody {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
  reply_to_message_id?: number;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  reply_to_message?: TelegramMessage;
}

async function call<T>(method: string, body: object): Promise<TelegramResponse<T>> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TelegramResponse<T>;
}

export function sendMessage(body: SendMessageBody) {
  return call<TelegramMessage>('sendMessage', body);
}

export function editMessageText(body: {
  chat_id: string | number;
  message_id: number;
  text: string;
  parse_mode?: 'HTML';
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
}) {
  return call<TelegramMessage>('editMessageText', body);
}

export function answerCallbackQuery(callback_query_id: string, text?: string) {
  return call('answerCallbackQuery', { callback_query_id, text });
}

export function setWebhook(url: string, secret_token: string) {
  return call('setWebhook', {
    url,
    secret_token,
    allowed_updates: ['message', 'callback_query'],
  });
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ───────────────────────────────────────────────
// High-level helpers for the category-submission flow
// ───────────────────────────────────────────────

interface CategoryPayload {
  id: string;
  name: string;
  words: string[];
  creatorName: string;
}

export function buildSubmissionMessage(cat: CategoryPayload) {
  const wordsLine = cat.words.map(escapeHtml).join(' · ');
  return (
    `🆕 <b>New community category</b>\n` +
    `<b>${escapeHtml(cat.name)}</b>\n` +
    `${wordsLine}\n` +
    `<i>by ${escapeHtml(cat.creatorName)}</i>`
  );
}

export function submissionKeyboard(categoryId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✏️ Edit name', callback_data: `edit_name:${categoryId}` },
        { text: '✏️ Edit words', callback_data: `edit_words:${categoryId}` },
      ],
      [{ text: '🗑 Delete', callback_data: `delete:${categoryId}` }],
    ],
  };
}

export function deleteConfirmKeyboard(categoryId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Yes, delete', callback_data: `delete_confirm:${categoryId}` },
        { text: '❌ Cancel', callback_data: `delete_cancel:${categoryId}` },
      ],
    ],
  };
}

export async function notifyNewSubmission(cat: CategoryPayload) {
  if (!isTelegramConfigured()) return;
  try {
    await sendMessage({
      chat_id: adminChatId(),
      text: buildSubmissionMessage(cat),
      parse_mode: 'HTML',
      reply_markup: submissionKeyboard(cat.id),
    });
  } catch (e) {
    console.error('Telegram notify failed:', e);
  }
}
