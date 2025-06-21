import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { bot } from '../src/telegramBot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Received webhook request:', {
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
    }

    console.log('Processing update:', JSON.stringify(req.body));

    // Handle the update
    await bot.handleUpdate(req.body);
    console.log('Update processed successfully');

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
}
