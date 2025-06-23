// Bot initialization and configuration
import { Context, Telegraf, session } from 'telegraf';
import { CallbackQuery, Update, Message } from 'telegraf/typings/core/types/typegram';
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types';
import dotenv from 'dotenv';
// No need for SessionFlavor, we'll use a simpler approach
import { ethers } from 'ethers';
import { 
  getUserByTelegramUsername, 
  storeUserProfile, 
  getUserWallets, 
  createWallet, 
  setWalletAsPrimary,
  getWalletById,
  deleteWallet,
  updateWalletName,
  type UserProfile,
  type UserWallet 
} from './supabaseClient';
import { executeTransfer, getAllTokenBalances, type TokenBalance, type TransactionData } from './transactionSender';
import { BASE_TOKENS } from './utils/token-utils';
import { estimateGasCost } from './transactionTracker';
import { generateWallet } from './utils/generate-wallet';
import { XMTPAgent } from './xmtpAgent';

// Load environment variables and validate
dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || '');
export { provider };

// Session typing
interface SessionData {
  state?: string;
  wallet?: UserWallet;
  token?: string;
  amount?: string;
  recipient?: string;
  sensitiveMessageId?: number;
  renameWalletId?: string;
}

// Message type
type TextMessage = {
  message: {
    text: string;
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
  };
};

// Import the necessary types from telegraf
import type { Update as TelegrafUpdate, Message as TelegrafMessage } from 'telegraf/typings/core/types/typegram';

// import type { Context } from 'telegraf';
// Custom context type with all required properties
interface BotContext extends Context<Update> {
  session: SessionData;
  match: RegExpExecArray | null;
}

// Initialize bot with proper error handling and session
const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 90000 // Set timeout to 90s
});
export { bot };

// Configure basic middleware
bot.use(session());

// Add logging middleware
bot.use(async (ctx: BotContext, next: () => Promise<void>) => {
  const start = Date.now();
  const updateId = ctx.update.update_id;
  
  console.log('[Bot] Processing update:', {
    timestamp: new Date().toISOString(),
    update_id: updateId,
    type: ctx.updateType,
    from: ctx.from?.username,
    chat_id: ctx.chat?.id,
    chat_type: ctx.chat?.type,
    message: 'message' in ctx.update && ctx.update.message && 'text' in ctx.update.message ? ctx.update.message.text : undefined
  });
  
  try {
    await next();
    const ms = Date.now() - start;
    console.log('[Bot] Update processed:', {
      timestamp: new Date().toISOString(),
      update_id: updateId,
      process_time: `${ms}ms`,
      from: ctx.from?.username,
      chat_id: ctx.chat?.id
    });
  } catch (error) {
    const ms = Date.now() - start;
    console.error('[Bot] Error in middleware:', {
      timestamp: new Date().toISOString(),
      update_id: updateId,
      process_time: `${ms}ms`,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      from: ctx.from?.username,
      chat_id: ctx.chat?.id
    });
    throw error; // Re-throw to let the error handler handle it
  }
});

// Add error handler with detailed logging
bot.catch((err: unknown, ctx: BotContext) => {
  console.error('[Bot] Error while handling update:', err);
  // Log the full error details
  if (err instanceof Error) {
    console.error('[Bot] Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
  }
  ctx.reply('An error occurred while processing your request. Please try again.').catch(console.error);
});

// Bot initialization and startup
export async function initializeBot() {
  try {
    // Configure metadata
    await setupBot();
    
    // Start in appropriate mode
    if (process.env.NODE_ENV === 'production') {
      // In production, we'll use webhooks
      console.log('[Bot] Running in webhook mode');
    } else {
      // In development, use polling
      await bot.launch();
      console.log('[Bot] Running in polling mode');
    }

    const botInfo = await bot.telegram.getMe();
    console.log('[Bot] Initialized successfully:', {
      timestamp: new Date().toISOString(),
      username: botInfo.username,
      id: botInfo.id,
      can_join_groups: botInfo.can_join_groups,
      can_read_all_group_messages: botInfo.can_read_all_group_messages
    });
  } catch (error) {
    console.error('[Bot] Failed to initialize:', error);
    throw error;
  }
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Start bot if this file is run directly
if (require.main === module) {
  initializeBot().catch((error: unknown) => {
    console.error('Failed to start bot:', error);
    process.exit(1);
  });
}

// Initialize XMTP agent
const xmtpAgent = new XMTPAgent();

// Global error handler
bot.catch(async (err: unknown, ctx: BotContext) => {
  console.error('Bot error:', err);
  try {
    await ctx.reply('An error occurred while processing your request.');
  } catch (replyError) {
    console.error('Failed to send error message:', replyError);
  }
});

// Command handler function
const handleCommand = async (ctx: BotContext, commandHandler: () => Promise<any>) => {
  try {
    // Log which command is being executed
    let commandText = 'unknown command';    if (ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string') {
      commandText = ctx.message.text;
    }
    console.log(`Executing command handler for: ${commandText}`);
    return await commandHandler();
  } catch (error) {
    console.error('Command error:', error);
    await ctx.reply('An error occurred while processing your request. Please try again.');
    return null;
  }
};

// Helper function to validate and get user profile
const validateUser = async (username: string): Promise<{ user: UserProfile; error?: undefined } | { user?: undefined; error: string }> => {
  try {
    const user = await getUserByTelegramUsername(username);
    if (!user) {
      return { error: 'Please use /start to create your account first.' };
    }
    return { user };
  } catch (error) {
    console.error('Error validating user:', error);
    return { error: 'Error validating user profile. Please try again.' };
  }
};

// Helper to check if a message has text and narrow its type
const hasText = (ctx: BotContext): ctx is BotContext & {
  message: Message.TextMessage;
} => {
  return Boolean(
    ctx.message && 
    'text' in ctx.message &&
    typeof ctx.message.text === 'string'
  );
};

// COMMAND HANDLERS
// ---------------

// Command: /start
bot.command('start', async (ctx: BotContext) => {
  try {
    console.log('Start command received directly');
    const telegramId = ctx.from?.id.toString();
    const username = ctx.from?.username;
    
    if (!telegramId || !username) {
      return ctx.reply('Error: Could not identify user');
    }

    // Create or validate user profile
    const userProfile: UserProfile = {
      telegram_id: telegramId,
      telegram_username: username,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Check existing wallets
    const userWallets: UserWallet[] = await getUserWallets(telegramId);
    
    // For existing users with wallets
    if (userWallets.length > 0) {      return ctx.reply(
        `Welcome back to BaseBuddy! 🚀\n\n` +
        `You already have ${userWallets.length} wallet${userWallets.length > 1 ? 's' : ''}. ` +
        `Use /wallets to manage them or /newwallet to create another one.`
      );
    }
    
    // For new users
    await storeUserProfile(userProfile);

    await ctx.reply(
      `<b>Welcome to BaseBuddy! 🚀</b>\n\n` +
      `I'll help you create your first wallet on Base chain.\n\n` +
      `⚠️ <b>IMPORTANT:</b> In the next message, I will show you your:\n` +
      `• Wallet Address\n` +
      `• Private Key\n` +
      `• Backup Phrase\n\n` +
      `You MUST save these somewhere safe and never share them with anyone!\n\n` +
      `Ready? Let's create your wallet!`,
      { parse_mode: 'HTML' }
    );

    const wallet = generateWallet();
    
    const storedWallet = await createWallet({
      telegram_id: telegramId,
      address: wallet.address,
      name: 'Primary Wallet',
      is_primary: true
    });

    if (!storedWallet) {
      await ctx.reply('❌ Error creating wallet. Please try again.');
      return;
    }

    if (ctx.chat?.type !== 'private') {
      await ctx.reply('🔐 I\'ve sent your new wallet details in a private message. Click "Start" to view them.');
      return;
    }

    const sensitiveInfo = await ctx.reply(
      `<b>🔐 Your New Wallet Is Ready!</b>\n\n` +
      `<b>Wallet Address:</b>\n` +
      `<code>${wallet.address}</code>\n\n` +
      `<b>Private Key:</b>\n` +
      `<code>${wallet.privateKey}</code>\n\n` +
      `<b>Backup Phrase:</b>\n` +
      `<code>${wallet.mnemonic}</code>\n\n` +
      `⚠️ <b>WARNING:</b> This message will self-destruct once you confirm saving these details.\n` +
      `Copy and store this information securely NOW!`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ I've Safely Saved My Wallet Details", callback_data: 'confirm_wallet_save' }
          ]]
        }
      }
    );

    ctx.session.sensitiveMessageId = sensitiveInfo.message_id;
  } catch (error) {
    console.error('Start command error:', error);
    await ctx.reply('An error occurred while processing your start request.');
  }
});

// Command: /portfolio
bot.command('portfolio', async (ctx: BotContext) => {
  try {
    console.log('Portfolio command received directly');
    const username = ctx.from?.username;

    if (!username) {
      return ctx.reply('Error: Could not identify user');
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      return ctx.reply('Please use /start to create your account first.');
    }

    // Get user's primary wallet
    const wallets: UserWallet[] = await getUserWallets(user.telegram_id);
    const primaryWallet: UserWallet | undefined = wallets.find(w => w.is_primary);
    if (!primaryWallet) {
      return ctx.reply(
        'You have no primary wallet set. Use /wallets to manage your wallets or /start to create one.'
      );
    }

    try {
      const tokenBalances = await getAllTokenBalances(primaryWallet.address);
        // Filter out zero balances
      const nonZeroBalances = tokenBalances.filter((token: TokenBalance) => 
        parseFloat(token.balance) > 0
      );
      
      if (nonZeroBalances.length === 0) {
        return ctx.reply('No token balances found in this wallet.');
      }

      let totalUsdValue = 0;
      const balanceLines = nonZeroBalances.map((token: TokenBalance) => {
        const tokenValue = token.usdValue || 0;
        totalUsdValue += tokenValue;
        
        let line = `${token.symbol}: ${token.balance}`;
        if (token.usdValue) {
          line += `\n≈ $${token.usdValue.toFixed(2)} USD`;
        }
        return line;
      }).join('\n\n');

      const portfolioMessage = `
<b>💼 Portfolio for @${username}</b>

<code>
${balanceLines}
${totalUsdValue > 0 ? `\nTotal Value: $${totalUsdValue.toFixed(2)} USD` : ''}
</code>

<b>🔍 Quick Actions:</b>
/send - Send ETH/tokens`;      const options: { parse_mode: 'HTML' | 'Markdown' | 'MarkdownV2', message_thread_id?: number } = {
        parse_mode: 'HTML',
        message_thread_id: ctx.message?.message_thread_id
      };

      await ctx.reply(portfolioMessage, options);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      await ctx.reply(
        '❌ Error fetching your portfolio. Please try again later.\n' +
        'If the problem persists, check your wallet connection.'
      );
    }
  } catch (error) {
    console.error('Portfolio command error:', error);
    await ctx.reply('An error occurred while processing your portfolio request.');
  }
});

// Command: /wallets
bot.command('wallets', async (ctx: BotContext) => {
  try {
    console.log('Wallets command received directly');
    const username = ctx.from?.username;
    const chatType = ctx.chat?.type;

    if (!username) {
      return ctx.reply('Error: Could not identify user');
    }

    if (chatType !== 'private') {
      const options = ctx.message?.message_thread_id 
        ? { message_thread_id: ctx.message.message_thread_id }
        : undefined;
      return ctx.reply(
        `@${username}, for privacy reasons, please manage your wallets in our private chat.`,
        options
      );
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      return ctx.reply('Please use /start to create your account first.');
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (!wallets.length) {
      return ctx.reply(
        '❌ You have no wallets yet.\n\n' +
        'Use /start to create your first wallet!'
      );
    }    // Generate wallet list with copy buttons
    const inlineKeyboard: InlineKeyboardButton[][] = [];
    const walletsList = wallets.map((wallet, index) => {
      const name = wallet.name || `Wallet ${index + 1}`;
      const isPrimary = wallet.is_primary ? ' (Primary)' : '';
      const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
      
      // Add copy button for each wallet
      inlineKeyboard.push([
        { text: `📋 Copy ${name} Address`, callback_data: `copy_${wallet.id}` }
      ]);
      
      return `${index + 1}. ${name}${isPrimary}\n   ${shortAddress}`;
    }).join('\n\n');

    // Add wallet management buttons
    inlineKeyboard.push(
      [
        { text: '➕ New Wallet', callback_data: 'new_wallet' },
        { text: '🔄 Set Primary', callback_data: 'set_primary' }
      ],
      [
        // { text: '✏️ Rename', callback_data: 'rename_wallet' },
        { text: '🗑️ Delete', callback_data: 'delete_wallet' }
      ]
    );

    await ctx.reply(
      `<b>🏦 Your Wallets</b>\n\n` +
      `${walletsList}\n\n` +
      `<i>Select an action:</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }
    );
  } catch (error) {
    console.error('Wallets command error:', error);
    await ctx.reply('An error occurred while processing your wallets request.');
  }
});

// Command: /send
bot.command('send', async (ctx: BotContext) => {
  try {
    console.log('Send command received directly');    await ctx.reply(      '<b>💸 How to Send Tokens</b>\n\n' +
      'Use this format:\n' +
      '<code>send [amount] [token] to @username</code>\n\n' +
      'Examples:\n' +
      '<code>send 0.1 ETH to @john</code>\n' +
      '<code>send 100 ENB to @alice</code>\n' +
      '<code>send 50 PUMP to @bob</code>\n\n' +
      '💡 Tips:\n' +
      '• Transfers are instant and use the bot wallet\n' +
      '• Double-check the recipient username\n' +
      '• In group chats, mention me: <code>@BaseBuddyBot send 100 ENB to @user</code>\n' +
      '• Supported tokens: ETH, USDC, PUMP, ENB</code>',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Send command error:', error);
    await ctx.reply('An error occurred while processing your send request.');
  }
});



// Command: /gas
bot.command('gas', async (ctx: BotContext) => {
  try {
    console.log('Gas command received directly');
    try {
      const feeData = await provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
      
      if (!maxFeePerGas) {
        throw new Error('Could not get gas price');
      }

      const gasMessage = `
<b>⛽️ Current Base Gas Prices</b>

<code>
Max Fee:     ${ethers.formatUnits(maxFeePerGas, 'gwei')} Gwei
Priority:    ${feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'N/A'} Gwei
</code>

<i>💡 Gas prices on Base are typically very low!</i>

Estimated costs:
• ETH Transfer: ~0.0001 ETH
• Token Transfer: ~0.0002 ETH
`;

      await ctx.reply(gasMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      await ctx.reply(
        '❌ Error fetching gas prices. Please try again later.\n' +
        'If the problem persists, there may be network issues.'
      );
    }
  } catch (error) {
    console.error('Gas command error:', error);
    await ctx.reply('An error occurred while processing your gas price request.');
  }
});

// Command: /newwallet
bot.command('newwallet', async (ctx: BotContext) => {
  try {
    console.log('New wallet command received directly');
    const username = ctx.from?.username;
    const chatType = ctx.chat?.type;

    if (!username) {
      return ctx.reply('Error: Could not identify user');
    }
    
    if (chatType !== 'private') {
      const options = ctx.message?.message_thread_id 
        ? { message_thread_id: ctx.message.message_thread_id }
        : undefined;
      return ctx.reply(
        `@${username}, for security reasons, please create wallets in our private chat.`,
        options
      );
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      return ctx.reply('Please use /start to create your account first.');
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (wallets.length >= 5) {
      return ctx.reply(
        '❌ Maximum wallet limit reached (5).\n\n' +
        'Use /wallets to manage your existing wallets.'
      );
    }

    const wallet = generateWallet();
    const walletNumber = wallets.length + 1;
    
    const storedWallet = await createWallet({
      telegram_id: user.telegram_id,
      address: wallet.address,
      name: `Wallet ${walletNumber}`,
      is_primary: false
    });

    if (!storedWallet) {
      return ctx.reply('❌ Error creating wallet. Please try again.');
    }

    const sensitiveInfo = await ctx.reply(
      `<b>🔐 Your New Wallet Is Ready!</b>\n\n` +
      `<b>Wallet Address:</b>\n` +
      `<code>${wallet.address}</code>\n\n` +
      `<b>Private Key:</b>\n` +
      `<code>${wallet.privateKey}</code>\n\n` +
      `<b>Backup Phrase:</b>\n` +
      `<code>${wallet.mnemonic}</code>\n\n` +
      `⚠️ <b>WARNING:</b> This message will self-destruct once you confirm saving these details.\n` +
      `Copy and store this information securely NOW!`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ I've Safely Saved My Wallet Details", callback_data: 'confirm_wallet_save' }
          ]]
        }
      }
    );

    ctx.session.sensitiveMessageId = sensitiveInfo.message_id;
  } catch (error) {
    console.error('New wallet command error:', error);
    await ctx.reply('An error occurred while creating a new wallet.');
  }
});

// Command: /help
bot.command('help', async (ctx: BotContext) => {
  try {
    console.log('Help command received directly');
    await ctx.reply(
      `<b>🤖 BaseBuddy Help Guide</b>\n\n` +
      `<b>Available Commands:</b>\n\n` +      `/start - Create your first wallet\n` +
      `/portfolio - View your wallet balances\n` +
      `/wallets - Manage your wallets\n` +
      `/newwallet - Create additional wallet\n` +
      `/send - Send ETH or tokens to others\n` +
      `/gas - Check current gas prices\n` +
      `/help - Show this help message\n\n` +
      `<b>Quick Commands:</b>\n` +
      `Private Chat:\n` +
      `• <code>send 0.1 ETH to @user</code>\n` +
      `• <code>send 100 ENB to @user</code>\n\n` +
      `Group Chat:\n` +
      `• <code>@BaseBuddyBot send 0.1 ETH to @user</code>\n` +
      `• <code>@BaseBuddyBot send 50 PUMP to @user</code>\n\n` +
      `<b>Need More Help?</b>\n` +
      `• Use each command to see detailed instructions\n` +
      `• Keep your wallet details safe\n` +
      `• Never share your private keys\n\n` +
      `<i>🔐 For security, use private chat for sensitive operations</i>`,      { 
        parse_mode: 'HTML'
      }
    );
  } catch (error) {
    console.error('Help command error:', error);
    await ctx.reply('An error occurred while processing your help request.');
  }
});

// Handle wallet action callbacks

// Handle copy address callback
bot.action(/^copy_(.+)$/, async (ctx: BotContext) => {
  try {
    if (!ctx.match) {
      console.error('No match found in callback query');
      await ctx.answerCbQuery('Invalid callback data');
      return;
    }
    const walletId = ctx.match[1];
    const wallet = await getWalletById(walletId);
    
    if (!wallet) {
      await ctx.answerCbQuery('Wallet not found');
      return;
    }

    await ctx.reply(
      `<b>📋 Wallet Address</b>\n\n` +
      `<code>${wallet.address}</code>`,
      { parse_mode: 'HTML' }
    );
    await ctx.answerCbQuery('Address copied to message');
  } catch (error) {
    console.error('Error handling copy address:', error);
    await ctx.answerCbQuery('Error copying address');
  }
});

// Handle set primary wallet callback
bot.action('set_primary', async (ctx: BotContext) => {
  try {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (!wallets.length) {
      await ctx.answerCbQuery('You have no wallets to set as primary');
      return;
    }

    const inlineKeyboard = wallets.map(wallet => [{
      text: `${wallet.name || 'Unnamed Wallet'} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`,
      callback_data: `primary_${wallet.id}`
    }]);

    await ctx.reply(
      '<b>🔄 Select Primary Wallet</b>\n\n' +
      'Choose which wallet to set as primary:',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error showing primary wallet selection:', error);
    await ctx.answerCbQuery('Error showing wallet selection');
  }
});

// Handle primary wallet selection
bot.action(/^primary_(.+)$/, async (ctx: BotContext) => {
  try {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      console.error('No callback data found');
      await ctx.answerCbQuery('Invalid callback data');
      return;
    }
    const walletId = callbackQuery.data.split('_')[1];
    if (!walletId) {
      console.error('No wallet ID found in callback data');
      await ctx.answerCbQuery('Invalid callback data');
      return;
    }
    const username = ctx.from?.username;
    
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const success = await setWalletAsPrimary(user.telegram_id, walletId);
    if (success) {
      await ctx.reply('✅ Primary wallet updated successfully');
      // Refresh the wallet list
      await ctx.reply('Updating wallet list...');
      const wallets = await getUserWallets(user.telegram_id);
      const walletsList = wallets.map((wallet, index) => {
        const name = wallet.name || `Wallet ${index + 1}`;
        const isPrimary = wallet.is_primary ? ' (Primary)' : '';
        const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
        return `${index + 1}. ${name}${isPrimary}\n   ${shortAddress}`;
      }).join('\n\n');

      const inlineKeyboard = [];
      wallets.forEach((wallet) => {
        inlineKeyboard.push([{ 
          text: `📋 Copy ${wallet.name || 'Wallet'} Address`,
          callback_data: `copy_${wallet.id}`
        }]);
      });

      inlineKeyboard.push(
        [
          { text: '➕ New Wallet', callback_data: 'new_wallet' },
          { text: '🔄 Set Primary', callback_data: 'set_primary' }
        ],
        [
          // { text: '✏️ Rename', callback_data: 'rename_wallet' },
          { text: '🗑️ Delete', callback_data: 'delete_wallet' }
        ]
      );

      await ctx.reply(
        `<b>🏦 Your Wallets</b>\n\n` +
        `${walletsList}\n\n` +
        `<i>Select an action:</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        }
      );
    } else {
      await ctx.reply('❌ Failed to update primary wallet');
    }
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error setting primary wallet:', error);
    await ctx.answerCbQuery('Error setting primary wallet');
  }
});

// Handle rename wallet callback
bot.action('rename_wallet', async (ctx: BotContext) => {
  try {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (!wallets.length) {
      await ctx.answerCbQuery('You have no wallets to rename');
      return;
    }

    const inlineKeyboard = wallets.map(wallet => [{
      text: `${wallet.name || 'Unnamed Wallet'} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`,
      callback_data: `rename_select_${wallet.id}`
    }]);

    await ctx.reply(
      '<b>✏️ Rename Wallet</b>\n\n' +
      'Choose which wallet to rename:',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error showing rename wallet selection:', error);
    await ctx.answerCbQuery('Error showing wallet selection');
  }
});

// Handle rename wallet selection
bot.action(/^rename_select_(.+)$/, async (ctx: BotContext) => {
  try {
    const query = ctx.callbackQuery;
    if (!query || !('data' in query)) {
      await ctx.answerCbQuery('Invalid callback data');
      return;
    }
    
    const targetId = query.data.split('_')[2];
    if (!targetId) {
      await ctx.answerCbQuery('Invalid wallet ID');
      return;
    }

    const targetWallet = await getWalletById(targetId);
    if (!targetWallet) {
      await ctx.answerCbQuery('Wallet not found');
      return;
    }

    ctx.session.renameWalletId = targetId;

    await ctx.reply(
      `<b>✏️ Rename Wallet</b>\n\n` +
      `Current name: ${targetWallet.name || 'Unnamed Wallet'}\n` +
      `Address: ${targetWallet.address.slice(0, 6)}...${targetWallet.address.slice(-4)}\n\n` +
      `Reply with the new name for this wallet:`,
      { parse_mode: 'HTML' }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error handling rename wallet selection:', error);
    await ctx.answerCbQuery('Error selecting wallet to rename');
  }
});

// Handle delete wallet callback
bot.action('delete_wallet', async (ctx: BotContext) => {
  try {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (!wallets.length) {
      await ctx.answerCbQuery('You have no wallets to delete');
      return;
    }

    const inlineKeyboard = wallets.map(wallet => [{
      text: `${wallet.name || 'Unnamed Wallet'} (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`,
      callback_data: `delete_${wallet.id}`
    }]);

    await ctx.reply(
      '<b>🗑️ Delete Wallet</b>\n\n' +
      'Choose which wallet to delete:',
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error showing delete wallet selection:', error);
    await ctx.answerCbQuery('Error showing wallet selection');
  }
});

// Handle delete wallet selection
bot.action(/^delete_(.+)$/, async (ctx: BotContext) => {
  try {
    const query = ctx.callbackQuery;
    if (!query || !("data" in query)) {
      await ctx.answerCbQuery('Invalid callback data');
      return;
    }
    
    const deleteId = query.data.split('_')[1];
    if (!deleteId) {
      await ctx.answerCbQuery('Invalid wallet ID');
      return;
    }

    const deleteWallet = await getWalletById(deleteId);
    if (!deleteWallet) {
      await ctx.answerCbQuery('Wallet not found');
      return;
    }    await ctx.editMessageText(
      `<b>🗑️ Confirm Delete Wallet</b>\n\n` +
      `Are you sure you want to delete this wallet?\n\n` +
      `Name: ${deleteWallet.name || 'Unnamed Wallet'}\n` +
      `Address: ${deleteWallet.address.slice(0, 6)}...${deleteWallet.address.slice(-4)}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: 'back_to_wallets' },
            { text: '✅ Confirm Delete', callback_data: `confirm_delete_${deleteId}` }
          ]]
        }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error handling delete wallet selection:', error);
    await ctx.answerCbQuery('Error selecting wallet to delete');
  }
});

// Handle delete wallet confirmation
bot.action(/^confirm_delete_(.+)$/, async (ctx: BotContext) => {
  try {
    const query = ctx.callbackQuery;
    if (!query || !("data" in query)) {
      await ctx.answerCbQuery('Invalid callback data');
      return;
    }
    
    const confirmId = query.data.split('_')[2];
    if (!confirmId) {
      await ctx.answerCbQuery('Invalid wallet ID');
      return;
    }

    const confirmWallet = await getWalletById(confirmId);
    if (!confirmWallet) {
      await ctx.answerCbQuery('❌ Wallet not found');
      return;
    }

    const username = ctx.from?.username;
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const success = await deleteWallet(user.telegram_id, confirmId);
    if (success) {
      await ctx.reply('✅ Wallet deleted successfully');
      // Refresh the wallet list
      const wallets = await getUserWallets(user.telegram_id);
      const walletsList = wallets.map((wallet, index) => {
        const name = wallet.name || `Wallet ${index + 1}`;
        const isPrimary = wallet.is_primary ? ' (Primary)' : '';
        const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
        return `${index + 1}. ${name}${isPrimary}\n   ${shortAddress}`;
      }).join('\n\n');

      const inlineKeyboard = [];
      wallets.forEach((wallet) => {
        inlineKeyboard.push([{ 
          text: `📋 Copy ${wallet.name || 'Wallet'} Address`,
          callback_data: `copy_${wallet.id}`
        }]);
      });

      inlineKeyboard.push(
        [
          { text: '➕ New Wallet', callback_data: 'new_wallet' },
          { text: '🔄 Set Primary', callback_data: 'set_primary' }
        ],
        [
          // { text: '✏️ Rename', callback_data: 'rename_wallet' },
          { text: '🗑️ Delete', callback_data: 'delete_wallet' }
        ]
      );

      await ctx.reply(
        `<b>🏦 Your Wallets</b>\n\n` +
        `${walletsList}\n\n` +
        `<i>Select an action:</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        }
      );
    } else {
      await ctx.reply('❌ Failed to delete wallet');
    }
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error deleting wallet:', error);
    await ctx.answerCbQuery('Error deleting wallet');
  }
});

// Handle delete wallet cancellation
bot.action('delete_cancel', async (ctx: BotContext) => {
  try {
    // Edit the message instead of sending a new one
    await ctx.editMessageText(
      '❌ Wallet deletion cancelled.\n\n' +
      'Return to the wallet list with /wallets',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📝 Return to Wallet List', callback_data: 'back_to_wallets' }
          ]]
        }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error handling delete cancellation:', error);
    await ctx.answerCbQuery('Error cancelling deletion');
  }
});

/**
 * Handle text messages with commands
 * - In private chat: send [amount] [token] to @username
 * - In groups: @BaseBuddy send [amount] [token] to @username
 */
bot.on('message', async (ctx: BotContext) => {
  try {    if (!hasText(ctx)) {
      return;
    }

    const text = ctx.message.text;
    const chatType = ctx.chat?.type;
    
    // For groups, only respond to messages that mention the bot
    if (chatType !== 'private' && !text.includes(`@${ctx.botInfo?.username}`)) {
      return;
    }

    // Remove bot mention from message in groups
    const cleanMessage = chatType !== 'private' 
      ? text.replace(`@${ctx.botInfo?.username}`, '').trim()
      : text;

    // Handle token transfers
    const sendMatch = cleanMessage.match(/^send ([\d.]+) (ETH|[A-Z]+) to @(\w+)/i);
    if (!sendMatch) {
      return; // Not a send command
    }

    const [, amount, token, recipient] = sendMatch;
    const senderUsername = ctx.from?.username;

    if (!senderUsername) {
      return ctx.reply('Error: Could not identify sender');
    }
    
    const sender = await getUserByTelegramUsername(senderUsername);
    const recipientUser = await getUserByTelegramUsername(recipient);
    
    if (!sender || !recipientUser) {
      if (chatType === 'private') {
        return ctx.reply('Recipient has not created a wallet yet');
      } else {
        return ctx.reply(`@${recipient} needs to create a wallet first. Ask them to DM me and use /start`);
      }
    }

    try {
      // Get sender and recipient primary wallets
      if (!sender.wallets?.length || !recipientUser.wallets?.length) {
        if (chatType === 'private') {
          return ctx.reply('No wallets found. Please create a wallet first');
        } else {
          return ctx.reply('One or more users have not created a wallet yet');
        }
      }

      const senderPrimary = sender.wallets[0];
      const recipientPrimary = recipientUser.wallets[0];

      if (!senderPrimary || !recipientPrimary) {
        if (chatType === 'private') {
          return ctx.reply('Could not find primary wallet for sender or recipient');
        } else {
          return ctx.reply('Could not find primary wallet for one of the users');
        }
      }

      // Get token info if not ETH
      const tokenInfo = token.toUpperCase() !== 'ETH' 
        ? BASE_TOKENS.find(t => t.symbol.toUpperCase() === token.toUpperCase())
        : undefined;

      // Validate token and get address
      const tokenAddress = token.toUpperCase() === 'ETH' 
        ? undefined // For ETH transfers, we don't need a token address
        : tokenInfo?.address;

      // Validate token is supported
      if (!tokenInfo && token.toUpperCase() !== 'ETH') {
        return ctx.reply(`Unsupported token: ${token}`);
      }

      // Validate token address exists if not ETH
      if (token.toUpperCase() !== 'ETH' && !tokenAddress) {
        return ctx.reply(`Token ${token} has no contract address configured`);
      }

      // Create message options with thread ID for group chats
      const msgOptions = {
        parse_mode: 'HTML' as const,
        ...(chatType !== 'private' && ctx.message?.message_thread_id
          ? { message_thread_id: ctx.message.message_thread_id }
          : {})
      };

      // Send transfer progress message
      const progressMsg = await ctx.reply(
        `<b>💸 Processing Transfer...</b>\n\n` +
        `Sending ${amount} ${token.toUpperCase()} to @${recipient}...`,
        { parse_mode: 'HTML' }
      );
      
      try {        // Execute the transfer directly from the user's wallet
        const result = await executeTransfer(
          senderPrimary.address,
          recipientPrimary.address,
          amount,
          tokenAddress
        );

        // Delete progress message
        if (!ctx.chat) {
          console.error('Chat context is undefined');
          return;
        }
        await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id).catch(() => {});

        // Send success message to user
        await ctx.reply(
          `<b>✅ Transfer Successful!</b>\n\n` +
          `Successfully sent ${result.amount} ${result.token} to @${recipient}\n\n` +
          `<b>Transaction Hash:</b> <code>${result.hash}</code>`,
          msgOptions
        );      } catch (error: unknown) {
        // Delete progress message
        if (!ctx.chat) {
          console.error('Chat context is undefined');
          return;
        }
        await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id).catch(() => {});
        
        // Send error message to user
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await ctx.reply(
          `<b>❌ Transfer Failed</b>\n\n` +
          `Failed to send ${amount} ${token.toUpperCase()} to @${recipient}\n\n` +
          `<b>Error:</b> ${errorMessage}`,
          msgOptions
        );

        // Log the error
        console.error('Transfer execution error:', error);
      }
    } catch (error: unknown) {
      console.error('Transfer handler error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing your request';
      await ctx.reply(errorMessage);
    }
  } catch (error: unknown) {
    console.error('Message handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    await ctx.reply(errorMessage);
  }
});



// Bot setup function
const setupBot = async () => {
  try {
    await bot.telegram.setMyDescription(
      'BaseBuddy - Your DeFi companion on Base chain! Send and receive tokens and track your portfolio easily.'
    );
    
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot and create your first wallet' },
      { command: 'portfolio', description: 'View your portfolio' },
      { command: 'wallets', description: 'Manage your wallets' },
      { command: 'newwallet', description: 'Create an additional wallet' },
      { command: 'send', description: 'Send ETH or tokens to others' },
      { command: 'gas', description: 'Check current gas prices' },
      { command: 'help', description: 'Get help with commands' }
    ]);
    
    await bot.telegram.setMyShortDescription(
      '🚀 Easy crypto transactions on Base chain'
    );
    
    console.log('Bot metadata configured successfully');
  } catch (error) {
    console.error('Error setting up bot metadata:', error);
  }
};

// Handle back to wallets action

// Handle back to wallets action
bot.action('back_to_wallets', async (ctx: BotContext) => {
  try {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (!wallets.length) {
      await ctx.editMessageText(
        '❌ You have no wallets yet.\n\n' +
        'Use /start to create your first wallet!'
      );
      await ctx.answerCbQuery();
      return;
    }

    const walletsList = wallets.map((wallet, index) => {
      const name = wallet.name || `Wallet ${index + 1}`;
      const isPrimary = wallet.is_primary ? ' (Primary)' : '';
      const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
      return `${index + 1}. ${name}${isPrimary}\n   ${shortAddress}`;
    }).join('\n\n');

    const inlineKeyboard = [];
    wallets.forEach((wallet) => {
      inlineKeyboard.push([{
        text: `📋 Copy ${wallet.name || 'Wallet'} Address`,
        callback_data: `copy_${wallet.id}`
      }]);
    });

    inlineKeyboard.push(
      [
        { text: '➕ New Wallet', callback_data: 'new_wallet' },
        { text: '🔄 Set Primary', callback_data: 'set_primary' }
      ],
      [
        // { text: '✏️ Rename', callback_data: 'rename_wallet' },
        { text: '🗑️ Delete', callback_data: 'delete_wallet' }
      ]
    );

    await ctx.editMessageText(
      `<b>🏦 Your Wallets</b>\n\n` +
      `${walletsList}\n\n` +
      `<i>Select an action:</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error returning to wallets list:', error);
    await ctx.answerCbQuery('Error showing wallet list');
  }
});

// Handle new wallet button
bot.action('new_wallet', async (ctx: BotContext) => {
  try {
    const username = ctx.from?.username;
    if (!username) {
      await ctx.answerCbQuery('Could not identify user');
      return;
    }

    const user = await getUserByTelegramUsername(username);
    if (!user) {
      await ctx.answerCbQuery('User profile not found');
      return;
    }

    const wallets = await getUserWallets(user.telegram_id);
    if (wallets.length >= 5) {
      await ctx.answerCbQuery('❌ Maximum wallet limit reached (5)');
      return;
    }

    const wallet = generateWallet();
    const walletNumber = wallets.length + 1;
    
    const storedWallet = await createWallet({
      telegram_id: user.telegram_id,
      address: wallet.address,
      name: `Wallet ${walletNumber}`,
      is_primary: false
    });

    if (!storedWallet) {
      await ctx.answerCbQuery('❌ Error creating wallet');
      return;
    }

    // Send sensitive info in a new message
    const sensitiveInfo = await ctx.reply(
      `<b>🔐 Your New Wallet Is Ready!</b>\n\n` +
      `<b>Wallet Address:</b>\n` +
      `<code>${wallet.address}</code>\n\n` +
      `<b>Private Key:</b>\n` +
      `<code>${wallet.privateKey}</code>\n\n` +
      `<b>Backup Phrase:</b>\n` +
      `<code>${wallet.mnemonic}</code>\n\n` +
      `⚠️ <b>WARNING:</b> This message will self-destruct once you confirm saving these details.\n` +
      `Copy and store this information securely NOW!`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ I've Safely Saved My Wallet Details", callback_data: 'confirm_wallet_save' }
          ]]
        }
      }
    );

    ctx.session.sensitiveMessageId = sensitiveInfo.message_id;

    // Update the wallet list
    const updatedWallets = await getUserWallets(user.telegram_id);
    const walletsList = updatedWallets.map((w, index) => {
      const name = w.name || `Wallet ${index + 1}`;
      const isPrimary = w.is_primary ? ' (Primary)' : '';
      const shortAddress = `${w.address.slice(0, 6)}...${w.address.slice(-4)}`;
      return `${index + 1}. ${name}${isPrimary}\n   ${shortAddress}`;
    }).join('\n\n');

    const inlineKeyboard = [];
    updatedWallets.forEach((w) => {
      inlineKeyboard.push([{
        text: `📋 Copy ${w.name || 'Wallet'} Address`,
        callback_data: `copy_${w.id}`
      }]);
    });

    inlineKeyboard.push(
      [
        { text: '➕ New Wallet', callback_data: 'new_wallet' },
        { text: '🔄 Set Primary', callback_data: 'set_primary' }
      ],
      [
        // { text: '✏️ Rename', callback_data: 'rename_wallet' },
        { text: '🗑️ Delete', callback_data: 'delete_wallet' }
      ]
    );

    // Update the original message with the new wallet list
    await ctx.editMessageText(
      `<b>🏦 Your Wallets</b>\n\n` +
      `${walletsList}\n\n` +
      `<i>Select an action:</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }
    );
    
    await ctx.answerCbQuery('✅ New wallet created successfully!');
  } catch (error) {
    console.error('Error creating new wallet:', error);
    await ctx.answerCbQuery('❌ Error creating new wallet');
  }
});

// Handle wallet save confirmation
bot.action('confirm_wallet_save', async (ctx: BotContext) => {
  try {
    // Delete the sensitive information message
    if (ctx.session.sensitiveMessageId) {
      try {
        await ctx.deleteMessage(ctx.session.sensitiveMessageId);
        delete ctx.session.sensitiveMessageId;
      } catch (error) {
        console.error('Error deleting sensitive message:', error);
        await ctx.reply('❌ Could not delete the message. Please delete it manually.');
      }
    }

    // Get updated wallet list
    const username = ctx.from?.username;
    if (username) {
      const user = await getUserByTelegramUsername(username);
      if (user) {
        const wallets = await getUserWallets(user.telegram_id);
        const walletsList = wallets.map((wallet, index) => {
          const name = wallet.name || `Wallet ${index + 1}`;
          const isPrimary = wallet.is_primary ? ' (Primary)' : '';
          const shortAddress = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
          return `${index + 1}. ${name}${isPrimary}\n   ${shortAddress}`;
        }).join('\n\n');

        const inlineKeyboard = [];
        wallets.forEach((wallet) => {
          inlineKeyboard.push([{
            text: `📋 Copy ${wallet.name || 'Wallet'} Address`,
            callback_data: `copy_${wallet.id}`
          }]);
        });

        inlineKeyboard.push(
          [
            { text: '➕ New Wallet', callback_data: 'new_wallet' },
            { text: '🔄 Set Primary', callback_data: 'set_primary' }
          ],
          [
            // { text: '✏️ Rename', callback_data: 'rename_wallet' },
            { text: '🗑️ Delete', callback_data: 'delete_wallet' }
          ]
        );

        await ctx.reply(
          `✅ Great! I've deleted the sensitive information.\n\n` +
          `<b>🏦 Your Updated Wallet List:</b>\n\n` +
          `${walletsList}\n\n` +
          `<i>Select an action:</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: inlineKeyboard
            }
          }
        );
      }
    }

    await ctx.answerCbQuery('✅ Wallet information deleted');
  } catch (error) {
    console.error('Error handling wallet save confirmation:', error);
    await ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

// Handle rename wallet messages
bot.on('message', async (ctx: BotContext) => {
  try {
    // Only handle messages in private chat and when a wallet is being renamed
    if (
      !ctx.message ||
      ctx.chat?.type !== 'private' ||
      !ctx.session?.renameWalletId ||
      ctx.message?.hasOwnProperty('text') !== true
    ) {
      return;
    }
    // Type guard: only proceed if ctx.message is a text message
    const textMsg = ctx.message as Message.TextMessage;
    if (typeof textMsg.text !== 'string') {
      return;
    }

    if (!('text' in ctx.message) || typeof ctx.message.text !== 'string') {
      return;
    }
    const newName = ctx.message.text.trim();
    if (newName.length > 50) {
      await ctx.reply('❌ Wallet name too long. Please use a shorter name (max 50 characters).');
      return;
    }

    if (newName.length < 1) {
      await ctx.reply('❌ Please provide a valid wallet name.');
      return;
    }

    const success = await updateWalletName(ctx.session.renameWalletId, newName);
    if (success) {
      await ctx.reply(
        `✅ Wallet renamed successfully to "${newName}"\n\n` +
        'Use /wallets to see your updated wallet list.'
      );
      // Clear the rename session
      ctx.session.renameWalletId = undefined;
    } else {
      await ctx.reply('❌ Failed to rename wallet. Please try again.');
    }
  } catch (error) {
    console.error('Error handling rename message:', error);
    await ctx.reply('An error occurred while renaming the wallet.');
  }
});

// Start the bot
if (require.main === module) {
  // Initialize bot
  bot.telegram.getMe()
    .then((botInfo) => {
      console.log('[Bot] Initialized successfully:', {
        timestamp: new Date().toISOString(),
        username: botInfo.username,
        id: botInfo.id,
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages
      });
      return initializeBot();
    })
    .catch((error: unknown) => {
      console.error('Failed to start bot:', error);
      process.exit(1);
    });
}

