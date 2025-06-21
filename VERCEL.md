# Vercel Deployment Guide

## Prerequisites
- Node.js installed
- A Vercel account
- Your bot's code pushed to a GitHub repository

## Setup Steps

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Configure Environment Variables:
   - Go to https://vercel.com/dashboard
   - Select your project
   - Go to Settings → Environment Variables
   - Add these variables:
     ```
     TELEGRAM_BOT_TOKEN=your_bot_token
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_key
     BASE_RPC_URL=https://mainnet.base.org
     BASE_CHAIN_ID=8453
     BOT_ADMIN_KEY=your_admin_wallet_private_key
     XMTP_ENV=production
     ```

4. Deploy:
```bash
vercel
```

5. Set up Telegram Webhook:
   After deployment, set your bot's webhook to your Vercel URL:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-vercel-url.vercel.app/api/webhook
   ```

## Important Notes

1. Create a new `api/webhook.ts` endpoint for Telegram webhooks:
```typescript
import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { bot } from '../src/telegramBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

2. Environment Variables:
   - Never commit these to version control
   - Set them in Vercel dashboard
   - Use different values for preview/production

3. Monitoring:
   - Use Vercel's built-in logs and monitoring
   - Set up alerts for errors
   - Monitor function execution times

4. Limitations:
   - Serverless function timeout: 10s (Hobby), 60s (Pro)
   - Memory: 1024MB (Hobby), 3008MB (Pro)
   - Concurrent executions: Varies by plan

5. Best Practices:
   - Keep functions small and focused
   - Use proper error handling
   - Implement retry logic for failed operations
   - Cache frequently accessed data
   - Use appropriate HTTP status codes

## Troubleshooting

1. If deployments fail:
   - Check build logs in Vercel dashboard
   - Verify all dependencies are listed in package.json
   - Ensure TypeScript configuration is correct

2. If webhook fails:
   - Verify webhook URL is correct
   - Check environment variables
   - Look at function logs in Vercel dashboard

3. If bot doesn't respond:
   - Verify Telegram token
   - Check webhook is set correctly
   - Monitor error logs

## Updating

1. Push changes to your repository
2. Vercel will automatically deploy
3. To force deployment:
```bash
vercel --prod
```
