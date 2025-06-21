# Restart the BaseBuddy bot with the fixed session handling
Write-Host "Restarting BaseBuddy Bot with Fixed Session Handling" -ForegroundColor Cyan
Write-Host "--------------------------------------------------" -ForegroundColor Cyan

# First, stop any running instances
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$stopScript = Join-Path $scriptPath "stop-bots.ps1"

Write-Host "Stopping any running bot instances..." -ForegroundColor Yellow
& $stopScript

# Wait for processes to terminate
Start-Sleep -Seconds 2

# Start the bot
Write-Host "Starting bot with fixed session handling..." -ForegroundColor Green
$startScript = Join-Path $scriptPath "start-bot.ps1"
& $startScript

Write-Host ""
Write-Host "TESTING INSTRUCTIONS:" -ForegroundColor Magenta
Write-Host "------------------" -ForegroundColor Magenta
Write-Host "1. Test the /start command" -ForegroundColor White
Write-Host "2. Test all keyboard buttons" -ForegroundColor White
Write-Host "3. Test the wallets management buttons" -ForegroundColor White
Write-Host "4. Verify session handling is working properly" -ForegroundColor White
Write-Host ""
Write-Host "If any issues persist, please report them for further troubleshooting." -ForegroundColor Yellow
