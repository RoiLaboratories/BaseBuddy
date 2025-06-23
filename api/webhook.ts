import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { bot } from '../src/telegramBot';
import { Message, Update } from 'telegraf/types';

function getUpdateType(update: Update): string {
  if ('message' in update) return 'message';
  if ('callback_query' in update) return 'callback_query';
  if ('inline_query' in update) return 'inline_query';
  return 'other';
}

function getMessageType(message: Message): string {
  if ('text' in message) return 'text';
  if ('photo' in message) return 'photo';
  return 'other';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // Log every request immediately
  console.log('[Webhook] Request received:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
  });

  try {
    // Verify the request is from Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
      console.error('[Webhook] TELEGRAM_BOT_TOKEN is not set');
      return res.status(500).json({ error: 'Configuration error' });
    }

    // Log the request body
    if (req.body) {
      console.log('[Webhook] Update received:', JSON.stringify(req.body, null, 2));
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('[Webhook] Invalid method:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Process the update
    const update: Update = req.body;
    const updateType = getUpdateType(update);
    console.log(`[Webhook] Processing ${updateType} update`);

    try {
      await bot.handleUpdate(update, res);
      console.log('[Webhook] Update processed successfully');
    } catch (error) {
      console.error('[Webhook] Error processing update:', error);
      return res.status(500).json({ error: 'Failed to process update' });
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Request completed in ${duration}ms`);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Unhandled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
