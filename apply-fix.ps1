# PowerShell script to apply the fixed telegramBot.ts file

Write-Host "Applying fixed telegramBot.ts file..." -ForegroundColor Cyan

# First, ensure no bot instances are running
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$stopScript = Join-Path $scriptPath "stop-bots.ps1"

Write-Host "Running stop-bots.ps1 to ensure no running instances..." -ForegroundColor Yellow
& $stopScript

# Wait a moment to ensure processes are fully terminated
Start-Sleep -Seconds 2

# Create a backup of the original file
$originalFile = Join-Path $scriptPath "src\telegramBot.ts"
$fixedFile = Join-Path $scriptPath "src\telegramBot.ts.fixed"
$backupFile = Join-Path $scriptPath "src\telegramBot.ts.bak"

if (-not (Test-Path $fixedFile)) {
    Write-Host "ERROR: Fixed file not found at: $fixedFile" -ForegroundColor Red
    exit 1
}

# Backup original if needed
if (Test-Path $originalFile) {
    Write-Host "Creating backup of original telegramBot.ts..." -ForegroundColor Yellow
    
    # Only create backup if it doesn't exist yet
    if (-not (Test-Path $backupFile)) {
        Copy-Item -Path $originalFile -Destination $backupFile -Force
        Write-Host "Backup created at: $backupFile" -ForegroundColor Green
    } else {
        Write-Host "Backup already exists at: $backupFile" -ForegroundColor Green
    }
}

# Apply the fixed version
Write-Host "Applying fixed version..." -ForegroundColor Yellow
Copy-Item -Path $fixedFile -Destination $originalFile -Force
Write-Host "Fixed version applied successfully" -ForegroundColor Green

Write-Host "You can now start the bot with: .\start-bot.ps1" -ForegroundColor Magenta
Write-Host "All commands should now work properly!" -ForegroundColor Green
