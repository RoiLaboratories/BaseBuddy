# PowerShell script to test the bot commands in sequence

Write-Host "Testing BaseBuddy Telegram Bot Commands..." -ForegroundColor Cyan

# First, stop any running bot instances
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$stopScript = Join-Path $scriptPath "stop-bots.ps1"

Write-Host "Running stop-bots.ps1 to ensure clean startup..." -ForegroundColor Yellow
& $stopScript

# Wait a moment to ensure processes are fully terminated
Start-Sleep -Seconds 2

# Run the bot with additional debug output
Write-Host "Starting the bot in debug mode..." -ForegroundColor Green
$env:DEBUG="telegraf:*"
$env:NODE_OPTIONS="--no-warnings"

# Start the bot using ts-node with extra debugging
$mainBotPath = Join-Path $scriptPath "src\telegramBot.ts"
npx ts-node $mainBotPath
