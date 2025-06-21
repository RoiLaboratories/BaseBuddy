@echo off
echo =======================================
echo    DATABASE CLEANUP FOR WALLET NAMES
echo =======================================
echo.
echo This script will fix any wallets with "Renamed Wallet [timestamp]" names
echo in your database, without starting the bot.
echo.
echo Press any key to continue...
pause > nul

echo.
echo Fixing wallet names in the database...
npx ts-node -r dotenv/config fix-wallet-names.ts
echo.
echo Wallet names fixed! All "Renamed Wallet [timestamp]" names have been cleaned up.
echo.
echo You can now run the bot using start-bot.ps1 or fix-and-run.bat
echo.
pause
