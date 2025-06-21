import { Telegraf, Context } from 'telegraf';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

console.log('Starting simple bot test...');

// Create bot instance
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Define a simple keyboard
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ['📊 Test 1', '📱 Test 2'],
      ['⚙️ Test 3']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// Define command handlers
async function test1Handler(ctx: Context) {
  console.log('Test 1 handler called');
  await ctx.reply('Test 1 command executed!');
}

async function test2Handler(ctx: Context) {
  console.log('Test 2 handler called');
  await ctx.reply('Test 2 command executed!');
}

async function test3Handler(ctx: Context) {
  console.log('Test 3 handler called');
  await ctx.reply('Test 3 command executed!');
}

// Register command handlers
bot.command('test1', test1Handler);
bot.command('test2', test2Handler);
bot.command('test3', test3Handler);

// Start command
bot.command('start', async (ctx) => {
  console.log('Start command received');
  await ctx.reply('Welcome to the test bot! Choose an option:', mainKeyboard);
});

// Register keyboard handlers
bot.hears('📊 Test 1', test1Handler);
bot.hears('📱 Test 2', test2Handler);
bot.hears('⚙️ Test 3', test3Handler);

// Launch the bot
console.log('Launching bot...');
bot.launch()
  .then(() => {
    console.log('Bot launched successfully!');
    console.log('Send /start to the bot to begin testing');
  })  .catch(error => {
    console.error('Error launching bot:', error);
    if (error instanceof Error && error.message && error.message.includes('409: Conflict')) {
      console.error('ERROR: Another bot instance is already running!');
      console.error('Please run the stop-bots.ps1 script to kill all running instances before starting again.');
    }
  });

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  console.log('Bot stopped due to SIGINT');
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  console.log('Bot stopped due to SIGTERM');
});
