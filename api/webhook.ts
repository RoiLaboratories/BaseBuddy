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
  
  // Verify the request is from Telegram
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    console.error('[Webhook] TELEGRAM_BOT_TOKEN is not set');
    return res.status(500).json({ error: 'Configuration error' });
  }

  console.log('[Webhook] Request received:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    bodySize: req.body ? JSON.stringify(req.body).length : 0
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Verify request method
  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['POST']
    });
  }

  try {
    // Verify we have a request body
    if (!req.body) {
      console.log('No request body received');
      return res.status(400).json({ error: 'No request body' });
    }    // Type check and validate the update
    const update = req.body as Update;
    if (!update || typeof update !== 'object' || !('update_id' in update)) {
      console.error('[Webhook] Invalid update object received:', update);
      return res.status(400).json({ error: 'Invalid update object' });
    }

    const updateType = getUpdateType(update);
    
    console.log('[Webhook] Processing update:', {
      timestamp: new Date().toISOString(),
      update_id: update.update_id,
      update_type: updateType,
      message_type: updateType === 'message' && 'message' in update ? getMessageType(update.message) : undefined,
      chat_type: updateType === 'message' && 'message' in update ? update.message.chat.type : undefined,
      chat_id: updateType === 'message' && 'message' in update ? update.message.chat.id : undefined,
      from: updateType === 'message' && 'message' in update ? update.message.from?.username : undefined
    });

    // Handle the update
    await bot.handleUpdate(update, res);
    const processTime = Date.now() - startTime;
    console.log('[Webhook] Update processed successfully:', {
      timestamp: new Date().toISOString(),
      update_id: update.update_id,
      processTime: `${processTime}ms`
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const processTime = Date.now() - startTime;
    console.error('[Webhook] Error processing update:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      processTime: `${processTime}ms`
    });
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
}
