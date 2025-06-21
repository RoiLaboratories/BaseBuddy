import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { ethers } from 'ethers';
import { getUserWallets } from './supabaseClient';
import { generateWallet } from './utils/generate-wallet';

// Load environment variables
dotenv.config();

console.log('BaseBuddy Debug Script');
console.log('-----------------');
console.log('Environment check:');
console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('BASE_RPC_URL exists:', !!process.env.BASE_RPC_URL);
console.log('BASE_CHAIN_ID exists:', !!process.env.BASE_CHAIN_ID);
console.log('-----------------');

console.log('Testing imports...');
try {
  console.log('Telegraf import successful');
  console.log('Ethers import successful');
  console.log('Supabase client import successful');
  console.log('Wallet generator import successful');
  
  console.log('-----------------');
  console.log('Attempting to create Telegraf instance...');
  
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
  
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  console.log('Bot instance created successfully');
  
  console.log('Testing basic bot command...');
  bot.command('debug', (ctx) => {
    ctx.reply('Debug command works!');
  });
  
  console.log('Command registered. Attempting bot.launch()...');
  bot.launch()
    .then(() => {
      console.log('Bot launched successfully!');
      console.log('Test the bot by sending /debug to it on Telegram');
      
      // Keep the process alive
      process.once('SIGINT', () => {
        bot.stop('SIGINT');
        console.log('Bot stopped due to SIGINT');
      });
      process.once('SIGTERM', () => {
        bot.stop('SIGTERM');
        console.log('Bot stopped due to SIGTERM');
      });
    })
    .catch(error => {
      console.error('Failed to launch bot:', error);
    });
} catch (error) {
  console.error('Error in debug script:', error);
}
