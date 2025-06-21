import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const setupWebhook = async () => {
  console.log('Starting webhook setup...');
  
  try {
    // Validate environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }
    
    if (!process.env.VERCEL_URL) {
      throw new Error('VERCEL_URL is not set. Please deploy to Vercel first.');
    }

    if (!process.env.VERCEL_URL && !process.env.BASE_URL) {
      throw new Error('Neither VERCEL_URL nor BASE_URL is set');
    }

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // First, delete any existing webhook
    console.log('[Setup] Removing existing webhook...');
    await bot.telegram.deleteWebhook();

    // Get the base URL
    const baseUrl = process.env.VERCEL_URL || process.env.BASE_URL;
    const webhookUrl = `https://${baseUrl}/api/webhook`;
    console.log('[Setup] Setting webhook URL:', webhookUrl);

    // Set the new webhook
    await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true
    });    // Verify the webhook
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('[Setup] Webhook info:', webhookInfo);

    // Verify the webhook is set correctly
    if (webhookInfo.url !== webhookUrl) {
      throw new Error(`Webhook URL mismatch. Expected: ${webhookUrl}, Got: ${webhookInfo.url}`);
    }

    // Test the webhook with a sample update
    console.log('[Setup] Testing webhook endpoint...');
    
    try {
      const testResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          update_id: 0,
          message: {
            message_id: 0,
            from: { id: 0, first_name: 'test', is_bot: false },
            chat: { id: 0, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: '/test'
          }
        })
      });
    console.log('[Setup] Webhook test response:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        body: await testResponse.text()
      });
    } catch (error) {
      console.error('[Setup] Webhook test failed:', error);
    }

    console.log('[Setup] Webhook setup completed successfully!');
  } catch (error) {
    console.error('[Setup] Error:', error);
    process.exit(1);
  }
};

// Run the setup
setupWebhook().catch(error => {
  console.error('[Setup] Fatal error:', error);
  process.exit(1);
});

setupWebhook();
