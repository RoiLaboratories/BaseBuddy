@echo off
echo =======================================
echo    COMPLETE FIX FOR WALLET RENAMING
echo =======================================
echo.
echo This script will:
echo 1. Stop any running bots
echo 2. Fix all existing wallet names with timestamp pattern
echo 3. Start the bot with the fixed code
echo.
echo Press any key to continue...
pause > nul

echo.
echo Step 1: Stopping any running bots...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak > nul

echo.
echo Step 2: Fixing any wallet names with timestamp pattern...
npx ts-node -r dotenv/config fix-wallet-names.ts
echo.
echo Wallet names fixed! All "Renamed Wallet [timestamp]" names have been cleaned up.
echo.

echo Step 3: Starting the bot with fixed code...
echo.
echo The bot will now start. Test the wallet rename functionality by:
echo 1. Send /wallets to the bot
echo 2. Click the "Rename" button
echo 3. Choose a wallet
echo 4. Enter a name like "Trading" or "Savings"
echo.
echo Press Ctrl+C to stop the bot when you're done testing.
echo.
echo Starting bot...
npx ts-node src/telegramBot.ts
