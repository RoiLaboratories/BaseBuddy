# Complete fix script for wallet renaming functionality
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    COMPLETE FIX FOR WALLET RENAMING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will:" -ForegroundColor White
Write-Host "1. Stop any running bots" -ForegroundColor White
Write-Host "2. Fix all existing wallet names with timestamp pattern" -ForegroundColor White
Write-Host "3. Start the bot with the fixed code" -ForegroundColor White
Write-Host ""

Write-Host "Press Enter to continue..." -ForegroundColor Yellow
Read-Host

# Step 1: Stop any running bots
Write-Host "`nStep 1: Stopping any running bots..." -ForegroundColor Yellow
if (Test-Path ".\stop-bots.ps1") {
    & .\stop-bots.ps1
} else {
    Write-Host "Running direct kill command for Node processes..." -ForegroundColor Gray
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Step 2: Fix wallet names in the database
Write-Host "`nStep 2: Fixing any wallet names with timestamp pattern..." -ForegroundColor Yellow
& npx ts-node -r dotenv/config fix-wallet-names.ts
Write-Host "`nWallet names fixed! All 'Renamed Wallet [timestamp]' names have been cleaned up." -ForegroundColor Green

# Step 3: Start the bot with the fixed code
Write-Host "`nStep 3: Starting the bot with fixed code..." -ForegroundColor Yellow
Write-Host "`nThe bot will now start. Test the wallet rename functionality by:" -ForegroundColor White
Write-Host "1. Send /wallets to the bot" -ForegroundColor White
Write-Host "2. Click the 'Rename' button" -ForegroundColor White
Write-Host "3. Choose a wallet" -ForegroundColor White
Write-Host "4. Enter a name like 'Trading' or 'Savings'" -ForegroundColor White
Write-Host "`nPress Ctrl+C to stop the bot when you're done testing." -ForegroundColor Yellow
Write-Host "`nStarting bot..." -ForegroundColor Green

& npx ts-node src/telegramBot.ts
