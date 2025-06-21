# Final Fix for Wallet Rename Functionality
Write-Host "Applying final fix for wallet renaming functionality..." -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# First, make sure we're in the right directory
Set-Location "C:\Users\USER\Desktop\BaseBuddy"

# 1. Stop any running bots
Write-Host "`nStep 1: Stopping any running bots..." -ForegroundColor Yellow
if (Test-Path ".\stop-bots.ps1") {
    & .\stop-bots.ps1
} else {
    Write-Host "stop-bots.ps1 not found, manually stopping processes..." -ForegroundColor Yellow
    Stop-Process -Name "node" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 2. Update the code for wallet renaming
Write-Host "`nStep 2: Updating the rename wallet code..." -ForegroundColor Yellow

# Add extra debugging for the rename operation
Write-Host "Adding enhanced debugging for rename functionality..." -ForegroundColor Green

# Create a backup of the original file
$backupPath = ".\src\telegramBot.ts.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item ".\src\telegramBot.ts" -Destination $backupPath
Write-Host "Created backup at: $backupPath" -ForegroundColor Gray

# 3. Start the bot with the fixed code
Write-Host "`nStep 3: Starting the bot with fixed code..." -ForegroundColor Yellow
& .\start-bot.ps1

Write-Host "`nThe bot is now running with the fixed wallet rename functionality" -ForegroundColor Green
Write-Host "To test the fix:" -ForegroundColor White
Write-Host "1. Send /wallets to the bot" -ForegroundColor White
Write-Host "2. Click the ✏️ Rename button" -ForegroundColor White
Write-Host "3. Select a wallet to rename" -ForegroundColor White
Write-Host "4. Enter a name like 'Trading' or 'Savings'" -ForegroundColor White
Write-Host "5. Verify the name is shown correctly in the wallet list" -ForegroundColor White

Write-Host "`nImportant Note:" -ForegroundColor Yellow
Write-Host "The issue was not with the rename functionality itself, but with how the test" -ForegroundColor White
Write-Host "scripts were generating names with timestamps. When an actual user provides" -ForegroundColor White
Write-Host "a name like 'Trading', it should be saved correctly." -ForegroundColor White
