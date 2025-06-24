import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { bot, startBot } from '../src/telegramBot';
import { Message, Update } from 'telegraf/types';

// Keep track of bot initialization
let botInitialized = false;

async function ensureBotInitialized() {
  if (!botInitialized) {
    try {
      await startBot();
      botInitialized = true;
      console.log('[Webhook] Bot initialized successfully');
    } catch (error) {
      console.error('[Webhook] Failed to initialize bot:', error);
      throw error;
    }
  }
}

// Verify update structure is valid
function isValidUpdate(update: any): update is Update {
  return (
    typeof update === 'object' &&
    update !== null &&
    typeof update.update_id === 'number' &&
    (
      ('message' in update && typeof update.message === 'object') ||
      ('callback_query' in update && typeof update.callback_query === 'object')
    )
  );
}

// Webhook handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    // Initialize bot if needed
    await ensureBotInitialized();

    // Log request info
    console.log('[Webhook] Request received:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      contentType: req.headers['content-type']
    });

    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('[Webhook] Invalid method:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate request body
    if (!req.body) {
      console.error('[Webhook] No request body');
      return res.status(400).json({ error: 'No request body' });
    }

    // Validate update structure
    if (!isValidUpdate(req.body)) {
      console.error('[Webhook] Invalid update structure');
      return res.status(400).json({ error: 'Invalid update structure' });
    }

    const update: Update = req.body;
    
    // Log minimal update info
    console.log('[Webhook] Update received:', {
      timestamp: new Date().toISOString(),
      update_id: update.update_id,
      type: 'message' in update ? 'message' : 
            'callback_query' in update ? 'callback_query' : 'other',
      chat_id: 'message' in update ? update.message?.chat?.id : undefined,
      from: 'message' in update ? update.message?.from?.username : undefined
    });

    // Handle the update
    await bot.handleUpdate(update);
    
    // Log success
    const duration = Date.now() - startTime;
    console.log('[Webhook] Update processed successfully:', {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      update_id: update.update_id
    });
    
    return res.status(200).json({ ok: true });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Webhook] Error processing update:', {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });

    // Don't expose internal errors to Telegram
    return res.status(500).json({ ok: false, description: 'Internal server error' });
  }
}
