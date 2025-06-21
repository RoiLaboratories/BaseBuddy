# Testing BaseBuddy Bot After Fixes

This document outlines how to test the BaseBuddy Telegram bot after applying the command handler fixes.

## Prerequisites

1. Make sure you have the `.env` file with the necessary environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `BASE_RPC_URL`
   - Any other required environment variables

2. Ensure you've installed all dependencies:
   ```
   npm install
   ```

## Testing Process

### Automated Testing

1. Run the test script:
   ```powershell
   .\test-fixed-bot.ps1
   ```

2. This script will:
   - Stop any running bot instances
   - Apply the fixed implementation
   - Start the bot in a new window
   - Provide instructions for manual testing

### Manual Testing

Test each of the following commands in your Telegram bot chat:

1. **Basic Commands**
   - `/start` - Should welcome you and create a wallet (if you don't have one)
   - `/help` - Should display help information
   - `/portfolio` - Should display your portfolio information
   - `/wallets` - Should list your wallets
   - `/newwallet` - Should create a new wallet
   - `/send` - Should provide instructions for sending ETH
   - `/swap` - Should provide instructions for swapping tokens
   - `/gas` - Should display current gas prices

2. **Keyboard Buttons**
   - Click on all keyboard buttons to verify they work correctly
   - Verify that they trigger the corresponding commands

3. **Edge Cases**
   - Test in a group chat to verify bot behavior
   - Test with invalid input to verify error handling

## Checking for 409 Conflict Errors

To test handling of 409 Conflict errors (which occur when multiple bot instances run simultaneously):

1. Start the bot with `.\start-bot.ps1`
2. Try to start another instance in a new terminal
3. Verify that the second instance fails with a clear error message
4. Verify that the first instance continues running correctly

## Reporting Issues

If you encounter any issues:

1. Note the exact command that failed
2. Check the error message in the bot terminal window
3. Try to reproduce the issue
4. Document the steps to reproduce

## Cleanup

When done testing, run:
```powershell
.\stop-bots.ps1
```

This will terminate all running bot instances.
