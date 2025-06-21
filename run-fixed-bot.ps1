# Simple script to run the bot with fixed wallet rename functionality
Write-Host "Starting BaseBuddy bot with fixed wallet rename functionality..." -ForegroundColor Cyan

# Stop any running processes
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Start the bot
Write-Host "Starting the bot..." -ForegroundColor Green
npx ts-node src/telegramBot.ts
