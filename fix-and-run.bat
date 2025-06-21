@echo off
echo ===== BaseBuddy Wallet Rename Fix =====
echo This script will fix the wallet renaming issue and start the bot

echo Stopping any existing node processes...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Disabling test scripts...
mkdir test-scripts-backup 2>nul
if exist test-wallet-rename.ts move test-wallet-rename.ts test-scripts-backup\ >nul
if exist test-fixed-name.ts move test-fixed-name.ts test-scripts-backup\ >nul
if exist test-rename-bot.ps1 move test-rename-bot.ps1 test-scripts-backup\ >nul
if exist test-db-rename.ps1 move test-db-rename.ps1 test-scripts-backup\ >nul
if exist verify-rename-fix.ps1 move verify-rename-fix.ps1 test-scripts-backup\ >nul
if exist test-rename-wallet.ps1 move test-rename-wallet.ps1 test-scripts-backup\ >nul

echo Fixing existing wallet names in the database...
npx ts-node -r dotenv/config fix-wallet-names.ts

echo Starting BaseBuddy bot...
npx ts-node src/telegramBot.ts
pause
