import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const setupWebhook = async () => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
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
    });

    // Verify the webhook
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('[Setup] Webhook info:', webhookInfo);

    if (webhookInfo.url !== webhookUrl) {
      throw new Error(`Webhook URL mismatch. Expected: ${webhookUrl}, Got: ${webhookInfo.url}`);
    }

    console.log('[Setup] Webhook setup completed successfully');
  } catch (error) {
    console.error('[Setup] Error setting up webhook:', error);
    process.exit(1);
  }
};

setupWebhook();
