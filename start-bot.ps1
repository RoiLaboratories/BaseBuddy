# PowerShell script to safely start the BaseBuddy Telegram bot
Write-Host "Starting BaseBuddy Telegram Bot..." -ForegroundColor Cyan

# Load environment variables from .env file
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

# First, ensure no other bot instances are running
Write-Host "Checking for existing bot instances..." -ForegroundColor Yellow
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$stopScript = Join-Path $scriptPath "stop-bots.ps1"

if (Test-Path $stopScript) {
    Write-Host "Running stop-bots.ps1 to ensure clean startup..." -ForegroundColor Yellow
    & $stopScript
} else {
    Write-Host "WARNING: stop-bots.ps1 not found. Manually checking for processes..." -ForegroundColor Red
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*telegramBot.ts*" -or 
        $_.CommandLine -like "*simple-bot.ts*" -or
        $_.CommandLine -like "*BaseBuddy*"
    }
    
    if ($nodeProcesses) {
        foreach ($process in $nodeProcesses) {
            Stop-Process -Id $process.Id -Force
        }
    }
}

# Wait a moment to ensure processes are fully terminated
Start-Sleep -Seconds 2

# Start the bot
Write-Host "Starting the BaseBuddy bot..." -ForegroundColor Green
$env:NODE_OPTIONS="--no-warnings"

# Optional debug mode - uncomment to enable Telegraf debug output
# $env:DEBUG="telegraf:*"

# Determine which script to run based on existence
$mainBotPath = Join-Path $scriptPath "src\telegramBot.ts"
$simpleBotPath = Join-Path $scriptPath "src\simple-bot.ts"

if (Test-Path $mainBotPath) {
    Write-Host "Starting main bot (telegramBot.ts)..." -ForegroundColor Green
    
    try {
        npx ts-node $mainBotPath
    } catch {
        Write-Host "ERROR: Bot crashed with message: $_" -ForegroundColor Red
        Write-Host "Check your bot code for errors." -ForegroundColor Yellow
        exit 1
    }
} elseif (Test-Path $simpleBotPath) {
    Write-Host "Main bot not found. Starting simple bot (simple-bot.ts)..." -ForegroundColor Yellow
    
    try {
        npx ts-node $simpleBotPath
    } catch {
        Write-Host "ERROR: Bot crashed with message: $_" -ForegroundColor Red
        Write-Host "Check your bot code for errors." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "ERROR: No bot script found!" -ForegroundColor Red
    exit 1
}

Write-Host "Bot startup script completed." -ForegroundColor Green
