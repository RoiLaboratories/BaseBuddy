@echo off
echo Stopping any existing node processes...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Starting BaseBuddy bot with fixed wallet rename functionality...
npx ts-node src/telegramBot.ts
pause
