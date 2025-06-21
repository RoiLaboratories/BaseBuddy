# BaseBuddy Bot Management

This guide explains how to properly manage your BaseBuddy Telegram bot to avoid common issues.

## Common Issues Fixed

1. **409 Conflict Error**: This happens when multiple instances of the bot are trying to connect to Telegram's API simultaneously.
2. **TypeScript Errors**: Fixed type checking for message and callback query objects.
3. **Command Responsiveness**: Fixed command handlers to properly respond to all commands.

## How to Use the Scripts

### To Stop All Running Bot Instances

Run the `stop-bots.ps1` script:

```powershell
.\stop-bots.ps1
```

This script will:
- Find all Node.js processes that might be running your bot
- Terminate them properly
- Double-check to ensure no lingering processes remain

### To Start the Bot Safely

Run the `start-bot.ps1` script:

```powershell
.\start-bot.ps1
```

This script will:
1. Check for and stop any existing bot instances
2. Wait for processes to fully terminate
3. Start the bot with proper configuration to avoid conflicts

### To Test Commands with Debug Output

Run the `test-commands.ps1` script:

```powershell
.\test-commands.ps1
```

This script will:
1. Stop any existing bot instances
2. Start the bot with Telegraf debug mode enabled
3. Show detailed command processing information

## Best Practices

1. Always use the provided scripts to start and stop the bot
2. If you get a "409 Conflict" error, run `stop-bots.ps1` first, then try `start-bot.ps1` again
3. Only run one instance of the bot at a time
4. Check the console output for errors if commands aren't working

## Command Reference

- `/start` - Create a new wallet
- `/portfolio` - View portfolio
- `/wallets` - Manage wallets
- `/newwallet` - Create additional wallet
- `/send` - Send ETH
- `/swap` - Swap tokens
- `/gas` - Check gas prices
- `/help` - Show help

Keyboard shortcuts are also available in the bot interface.

## Technical Details

The fix includes:
- Improved command handler registration for better responsiveness
- Proper type checking for Telegraf context objects
- Enhanced error handling with descriptive messages
- PowerShell scripts with error handling for bot management
