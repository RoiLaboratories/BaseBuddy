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

interface TelegramResponseBase {
  ok: boolean;
  description?: string;
}

interface SetWebhookResponse extends TelegramResponseBase {
  result: boolean;
}

interface WebhookInfo extends TelegramResponseBase {
  result?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
}

async function setWebhook() {
  // We can safely use VERCEL_URL here because we checked it above
  const baseUrl = VERCEL_URL!.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const webhookUrl = `https://${baseUrl}/api/webhook`;
  const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
  
  // Debug information
  console.log('\n🔍 Debug Information:');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Full Webhook URL: ${webhookUrl}`);
  
  try {
    // First, get current webhook info
    console.log('\n📡 Checking current webhook configuration...');
    const getWebhookInfo = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const webhookInfo = await getWebhookInfo.json() as WebhookInfo;
    
    if (webhookInfo.result) {
      console.log('Current webhook URL:', webhookInfo.result.url || 'None');
      if (webhookInfo.result.last_error_message) {
        console.log('Last error:', webhookInfo.result.last_error_message);
      }
    }

    // If there's an existing webhook with the same URL, no need to change it
    if (webhookInfo.result?.url === webhookUrl) {
      console.log('\n✅ Webhook is already set to the correct URL!');
      return;
    }

    console.log('\n🔄 Setting new webhook...');
    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true
      }),
    });

    const data = await response.json() as SetWebhookResponse;
    
    if (data.ok) {
      console.log('\n✅ Webhook set successfully!');
      console.log(`🔗 Webhook URL: ${webhookUrl}`);
      
      // Verify the webhook was set
      console.log('\n🔍 Verifying webhook configuration...');
      const verifyWebhook = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const verifyData = await verifyWebhook.json() as WebhookInfo;
      
      if (verifyData.result?.url === webhookUrl) {
        console.log('✅ Verification successful! Webhook is properly configured.');
      } else {
        console.log('⚠️ Verification shows a different URL:', verifyData.result?.url);
      }
    } else {
      console.error('\n❌ Failed to set webhook:', data.description);
      console.log('\n🔍 Response Data:', JSON.stringify(data, null, 2));
      console.log('\n📋 Troubleshooting:');
      console.log('1. Verify your VERCEL_URL is correct in .env');
      console.log(`   Current value: ${VERCEL_URL}`);
      console.log('2. Make sure your domain has a valid SSL certificate');
      console.log('3. Ensure the URL is accessible from the internet');
      console.log('4. Check that /api/webhook endpoint exists and responds to POST requests');
      console.log('\nTry visiting the webhook URL in your browser to ensure it\'s accessible:');
      console.log(webhookUrl);
    }
  } catch (error) {
    console.error('\n❌ Error setting webhook:', error);
  }
}

setWebhook();
