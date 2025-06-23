import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { bot, initializeBot } from '../src/telegramBot';
import { Message, Update } from 'telegraf/types';

// Initialize bot when the module is loaded
let botInitialized = false;

async function ensureBotInitialized() {
  if (!botInitialized) {
    await initializeBot();
    botInitialized = true;
  }
}

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
    // Initialize bot if needed
    await ensureBotInitialized();

    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('[Webhook] Invalid method:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Process the update
    if (!req.body) {
      console.error('[Webhook] No request body');
      return res.status(400).json({ error: 'No request body' });
    }

    const update: Update = req.body;
    const updateType = getUpdateType(update);
    console.log(`[Webhook] Processing ${updateType} update`);

    // Handle the update
    await bot.handleUpdate(update, res);
    
    // Log success
    const duration = Date.now() - startTime;
    console.log(`[Webhook] Update processed in ${duration}ms`);
    
    return res.status(200).json({ ok: true });

  } catch (error) {
    // Log any errors
    console.error('[Webhook] Error processing update:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
