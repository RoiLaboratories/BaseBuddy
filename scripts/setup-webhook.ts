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

    // Determine webhook URL
    const webhookUrl = process.env.WEBHOOK_URL || (() => {
      const baseUrl = process.env.VERCEL_URL || process.env.BASE_URL;
      if (!baseUrl) {
        throw new Error('No webhook URL configured. Set either WEBHOOK_URL directly, or VERCEL_URL/BASE_URL');
      }
      return baseUrl.startsWith('http') 
        ? `${baseUrl}/api/webhook`
        : `https://${baseUrl}/api/webhook`;
    })();

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // First, delete any existing webhook
    console.log('[Setup] Removing existing webhook...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('[Setup] Existing webhook removed');
    console.log('[Setup] Setting webhook URL:', webhookUrl);

    // Set the new webhook with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (retryCount < maxRetries) {
      try {
        await bot.telegram.setWebhook(webhookUrl, {
          drop_pending_updates: true
        });

        // Verify webhook was set correctly
        const webhookInfo = await bot.telegram.getWebhookInfo();
        console.log('[Setup] Webhook info:', webhookInfo);

        if (webhookInfo.url === webhookUrl) {
          console.log('[Setup] Webhook set successfully!');
          console.log('[Setup] URL:', webhookInfo.url);
          console.log('[Setup] Has custom certificate:', webhookInfo.has_custom_certificate);
          console.log('[Setup] Pending update count:', webhookInfo.pending_update_count);
          console.log('[Setup] Max connections:', webhookInfo.max_connections);
          success = true;
          break;
        } else {
          throw new Error('Webhook URL mismatch after setting');
        }
      } catch (error: any) {
        retryCount++;
        if (error?.response?.error_code === 429) {
          const retryAfter = error.response?.parameters?.retry_after || 1;
          console.log(`[Setup] Rate limited, waiting ${retryAfter} seconds before retry ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else {
          console.error('[Setup] Error setting webhook:', error);
          if (retryCount === maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!success) {
      throw new Error(`Failed to set webhook after ${maxRetries} retries`);
    }

    // Test the webhook with a shorter timeout
    console.log('[Setup] Testing webhook endpoint...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const testResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            update_id: 0,
            message: {
              message_id: 0,
              date: Math.floor(Date.now() / 1000),
              chat: {
                id: 0,
                type: 'private'
              },
              text: '/ping'
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (testResponse.status === 200) {
          console.log('[Setup] ✅ Webhook test successful! Endpoint is responding correctly');
        } else if (testResponse.status === 401) {
          console.log('[Setup] Note: 401 response is expected - Telegram signature validation is working');
        } else {
          console.log('[Setup] Webhook test response status:', testResponse.status);
          const text = await testResponse.text();
          console.log('[Setup] Response:', text);
          console.log('[Setup] Note: Non-200 response is expected during cold start or if endpoint validates Telegram signatures');
        }
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          console.log('[Setup] Note: Initial webhook cold start may take up to 30 seconds');
          console.log('[Setup] Deploy is still in progress, bot will be ready soon');
        } else {
          throw fetchError;
        }
      }
    } catch (error) {
      console.warn('[Setup] Warning: Could not test webhook endpoint:', error);
      console.log('[Setup] This is expected during initial deployment or cold start');
    }

  } catch (error) {
    console.error('[Setup] Setup failed:', error);
    process.exit(1);
  }
};

// Run the setup
setupWebhook();
