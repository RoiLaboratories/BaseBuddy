# Test script for the fixed BaseBuddy Telegram bot
Write-Host "Testing Fixed BaseBuddy Bot" -ForegroundColor Cyan
Write-Host "---------------------------" -ForegroundColor Cyan

# Get the bot token from .env file if it exists
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Write-Host "Loading environment variables from .env file..." -ForegroundColor Yellow
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value)
            Write-Host "Set environment variable: $key" -ForegroundColor Green
        }
    }
} else {
    Write-Host "ERROR: .env file not found. Please create one with TELEGRAM_BOT_TOKEN set." -ForegroundColor Red
    exit 1
}

# Check if TELEGRAM_BOT_TOKEN is set
if (-not [Environment]::GetEnvironmentVariable("TELEGRAM_BOT_TOKEN")) {
    Write-Host "ERROR: TELEGRAM_BOT_TOKEN is not set in .env file." -ForegroundColor Red
    exit 1
}

# First, ensure no bot instances are running
$stopScript = Join-Path $PSScriptRoot "stop-bots.ps1"
Write-Host "Running stop-bots.ps1 to ensure clean startup..." -ForegroundColor Yellow
& $stopScript

# Check if telegramBot.ts.fixed exists
$fixedBotPath = Join-Path $PSScriptRoot "src\telegramBot.ts.fixed"

if (-not (Test-Path $fixedBotPath)) {
    Write-Host "ERROR: Fixed bot file not found at: $fixedBotPath" -ForegroundColor Red
    exit 1
}

# Apply the fix if it hasn't been applied
Write-Host "Applying fixed bot implementation..." -ForegroundColor Yellow
$applyFixScript = Join-Path $PSScriptRoot "apply-fix.ps1"
& $applyFixScript

# Start the bot in a new window
Write-Host "Starting bot in a new window. Monitor that window for any errors." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot'; .\start-bot.ps1`""

# Wait for the bot to initialize
Start-Sleep -Seconds 5

Write-Host "`n=== TESTING INSTRUCTIONS ===" -ForegroundColor Magenta
Write-Host "Please test the following in Telegram:"
Write-Host "1. Run /wallets command and test the 'Copy Address' buttons" -ForegroundColor Yellow
Write-Host "   - Verify that you receive a message with the copyable address" -ForegroundColor Yellow
Write-Host "2. Test all other commands to ensure they're responsive:" -ForegroundColor Yellow
Write-Host "   - /start, /portfolio, /help, /send, /swap, /gas" -ForegroundColor Yellow
Write-Host "3. Check for any errors in the bot window" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== NEW FIXES IMPLEMENTED ===" -ForegroundColor Green
Write-Host "1. Fixed syntax errors in the code" -ForegroundColor White
Write-Host "2. Implemented wallet address copy functionality" -ForegroundColor White
Write-Host "3. Fixed duplicate session middleware issue" -ForegroundColor White
Write-Host "4. Added proper session safety checks" -ForegroundColor White
Write-Host "5. Fixed TypeScript type errors" -ForegroundColor White
Write-Host ""
Write-Host "When finished testing, press Enter to stop the bot and complete testing."
Read-Host

# Stop the bot when testing is complete
Write-Host "Stopping the bot..." -ForegroundColor Yellow
& $stopScript

Write-Host "`nTesting completed! Please document your results in TESTING-RESULTS.md" -ForegroundColor Cyan
Write-Host "Waiting for bot to initialize (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test instructions
Write-Host ""
Write-Host "BOT TESTING INSTRUCTIONS:" -ForegroundColor Magenta
Write-Host "---------------------------" -ForegroundColor Magenta
Write-Host "1. Open Telegram and navigate to your bot" -ForegroundColor White
Write-Host "2. Test each of the following commands:" -ForegroundColor White
Write-Host "   - /start" -ForegroundColor Cyan
Write-Host "   - /portfolio" -ForegroundColor Cyan
Write-Host "   - /wallets" -ForegroundColor Cyan
Write-Host "   - /newwallet" -ForegroundColor Cyan
Write-Host "   - /send" -ForegroundColor Cyan
Write-Host "   - /swap" -ForegroundColor Cyan
Write-Host "   - /gas" -ForegroundColor Cyan
Write-Host "   - /help" -ForegroundColor Cyan
Write-Host "3. Test the keyboard buttons to ensure they work properly" -ForegroundColor White
Write-Host "4. When done, run .\stop-bots.ps1 to terminate the bot" -ForegroundColor Yellow
Write-Host ""
Write-Host "The bot is now running in a separate window. You can close this window." -ForegroundColor Green
