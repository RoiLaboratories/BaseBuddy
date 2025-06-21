import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL || process.env.DEPLOY_URL;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
}

if (!VERCEL_URL) {
  throw new Error('VERCEL_URL or DEPLOY_URL is not set in environment variables');
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: boolean;
}

async function setWebhook() {
  const webhookUrl = `https://${VERCEL_URL}/api/webhook`;
  const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
  
  try {
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
      }),
    });

    const data = await response.json() as TelegramResponse;
    
    if (data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`🔗 Webhook URL: ${webhookUrl}`);
    } else {
      console.error('❌ Failed to set webhook:', data.description);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error);
  }
}

setWebhook();
