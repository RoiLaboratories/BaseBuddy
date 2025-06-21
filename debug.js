// Simple script to test the Telegram bot setup

console.log('Starting debug script...');

try {
  console.log('Checking if we can load the bot module...');
  
  // Try to require the compiled version first
  try {
    require('./dist/telegramBot.js');
    console.log('Successfully loaded compiled bot module');
  } catch (e) {
    console.log('Could not load compiled module:', e.message);
    
    // Try loading with ts-node
    console.log('Attempting to load TS file directly...');
    require('ts-node/register');
    require('./src/telegramBot.ts');
    console.log('Successfully loaded TS bot module');
  }
  
  console.log('Bot module was loaded without errors');
} catch (error) {
  console.error('Failed to load bot module:', error);
}
