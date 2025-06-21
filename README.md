# BaseBuddy - Base Chain DeFi Telegram Bot

BaseBuddy is a Telegram bot that helps users interact with DeFi protocols on Base chain using natural language commands.

## Features

- Wallet linking with secure signature verification
- Native ETH and token transfers between users
- Token swaps via Uniswap integration
- Portfolio tracking
- DeFi alerts via XMTP
- Multi-wallet support with primary wallet designation
- Gas price monitoring
- **New: Group chat support for tagging the bot to send ETH and buy tokens**

## Group Chat Features

BaseBuddy now supports being tagged in group chats for various operations:

- **Send ETH to other users**: Tag the bot and use `send 0.1 ETH to @username`
- **Buy tokens from Uniswap**: Tag the bot and use `buy 50 USDC with 0.1 ETH`
- **Check gas prices**: Tag the bot and use the `/gas` command

Tag the bot in any of these formats:
- `@BaseBuddy send 0.1 ETH to @user`
- `BaseBuddy: buy 50 USDC with 0.1 ETH`
- `Hey @BaseBuddy, what can you do?`

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in the required values:
   - `TELEGRAM_BOT_TOKEN`: Get from [@BotFather](https://t.me/BotFather)
   - `SUPABASE_URL` and `SUPABASE_KEY`: Your Supabase project wallet
   - `BASE_RPC_URL`: Base chain RPC URL (defaults to mainnet)
3. Install dependencies:
```bash
npm install
```

4. Start the bot using the provided scripts:
```powershell
.\start-bot.ps1  # Start the bot
.\stop-bots.ps1  # Stop all bot instances
```

For development:
```bash
npm run dev
```

## Commands

The bot supports the following commands:

- `/start` - Get started with BaseBuddy, create your first wallet
- `/portfolio` - View your token balances on Base
- `/wallets` - Manage your connected wallets
- `/newwallet` - Create an additional wallet
- `/send` - Send ETH to other users or addresses
- `/swap` - Swap tokens using Uniswap
- `/gas` - Check current gas prices on Base
- `/help` - View help information

The bot also supports keyboard-based navigation with buttons for all major functions.

## Recent Fixes

The following issues have been fixed in the latest update:

1. **Command Responsiveness**: Fixed issues where commands (except /start) were not responding
2. **Keyboard Menu Buttons**: Fixed functionality of all keyboard menu buttons
3. **Error Handling**: Improved error handling with descriptive messages
4. **409 Conflict Errors**: Fixed handling of conflicts when multiple bot instances run simultaneously

Documentation on these fixes:
- `COMMAND-FIXES.md` - Overview of command response fixes
- `COMMAND-FIX-IMPLEMENTATION.md` - Technical details of fixes
- `BOT-MANAGEMENT.md` - Guide to properly managing bot instances
- `TESTING-GUIDE.md` - Guide for testing the bot after fixes

## Database Schema

Create the following tables in your Supabase project:

```sql
-- User profiles table
create table user_profiles (
  telegram_id text primary key,
  telegram_username text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User wallets table
create table user_wallets (
  id uuid primary key default uuid_generate_v4(),
  telegram_id text references user_profiles(telegram_id),
  address text not null,
  name text,
  is_primary boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_telegram_username on user_profiles(telegram_username);
create index idx_telegram_id on user_wallets(telegram_id);
create index idx_wallet_address on user_wallets(address);
```

## Security

- All wallet operations require signature verification
- Private keys are never stored in the database
- Message signing uses UUID nonces
- Wallet addresses are verified on-chain

## Contributing

Contributions are welcome! Please check the issues page for current tasks or create a new issue to discuss your ideas.
