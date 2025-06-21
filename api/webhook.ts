import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { bot } from '../src/telegramBot';

// Add middleware to validate Telegram webhook
const validateTelegramWebhook = (req: VercelRequest) => {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }
  
  // Optionally validate secret token header
  // const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  // if (!secretHeader || secretHeader !== process.env.WEBHOOK_SECRET) {
  //   throw new Error('Invalid secret token');
  // }
  
  return true;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Handle preflight requests for CORS
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Method not allowed',
        allowedMethods: ['POST']
      });
    }

    // Validate the request
    validateTelegramWebhook(req);

    // Handle the update
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
}
