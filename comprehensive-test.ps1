# Comprehensive test script for BaseBuddy Telegram bot
# This script provides a complete test suite for all command functionality

Write-Host "BaseBuddy Comprehensive Test Suite" -ForegroundColor Cyan
Write-Host "----------------------------------" -ForegroundColor Cyan

# Get the absolute path to the project directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Function to check if a file exists
function Test-FileExists {
    param (
        [string]$Path,
        [string]$Description
    )
    
    Write-Host "Checking $Description... " -ForegroundColor Yellow -NoNewline
    if (Test-Path $Path) {
        Write-Host "OK" -ForegroundColor Green
        return $true
    } else {
        Write-Host "MISSING" -ForegroundColor Red
        return $false
    }
}

# Function to create a colored status indicator
function Write-Status {
    param (
        [string]$Text,
        [string]$Status,
        [string]$Color
    )
    
    Write-Host $Text -NoNewline
    Write-Host " [$Status]" -ForegroundColor $Color
}

# Check for required files
Write-Host "Checking required files:" -ForegroundColor Yellow

$allFilesExist = $true
$allFilesExist = $allFilesExist -and (Test-FileExists -Path "$projectDir\.env" -Description ".env file")
$allFilesExist = $allFilesExist -and (Test-FileExists -Path "$projectDir\src\telegramBot.ts" -Description "Main bot file")
$allFilesExist = $allFilesExist -and (Test-FileExists -Path "$projectDir\src\telegramBot.ts.fixed" -Description "Fixed bot file")
$allFilesExist = $allFilesExist -and (Test-FileExists -Path "$projectDir\stop-bots.ps1" -Description "Stop bots script")
$allFilesExist = $allFilesExist -and (Test-FileExists -Path "$projectDir\apply-fix.ps1" -Description "Apply fix script")
$allFilesExist = $allFilesExist -and (Test-FileExists -Path "$projectDir\start-bot.ps1" -Description "Start bot script")

if (-not $allFilesExist) {
    Write-Host "Some required files are missing. Please check the output above." -ForegroundColor Red
    exit 1
}

# Stop any running bot instances
Write-Host "Stopping any running bot instances..." -ForegroundColor Yellow
& "$projectDir\stop-bots.ps1"

# Apply the fix
Write-Host "Applying the fixed implementation..." -ForegroundColor Yellow
& "$projectDir\apply-fix.ps1"

# Now run through a testing checklist
Write-Host ""
Write-Host "BaseBuddy Testing Checklist" -ForegroundColor Magenta
Write-Host "---------------------------" -ForegroundColor Magenta

$testChecklist = @(
    "1. Start the bot with .\start-bot.ps1",
    "2. Test the /start command - Should welcome and create wallet",
    "3. Test the /portfolio command - Should show wallet balance",
    "4. Test the /wallets command - Should list wallets",
    "5. Test the /newwallet command - Should offer to create new wallet",
    "6. Test the /send command - Should provide send instructions",
    "7. Test the /swap command - Should provide swap instructions",
    "8. Test the /gas command - Should show gas prices",
    "9. Test the /help command - Should show help information",
    "10. Test keyboard buttons - Should work like their command counterparts",
    "11. Test in a group chat - Commands should respond appropriately",
    "12. Test error handling - Invalid inputs should show helpful messages",
    "13. Test conflict handling - Running multiple instances should give clear error"
)

# Display the test checklist
foreach ($item in $testChecklist) {
    Write-Host " [ ] $item" -ForegroundColor White
}

# Ask if user wants to start the bot now
Write-Host ""
$startBot = Read-Host "Do you want to start the bot now for testing? (y/n)"

if ($startBot -eq "y") {
    Write-Host "Starting the bot in a new window..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$projectDir'; .\start-bot.ps1`""
    
    Write-Host ""
    Write-Host "Bot is starting in a new window." -ForegroundColor Green
    Write-Host "Follow the checklist items to test all functionality." -ForegroundColor Yellow
    Write-Host "When done, run .\stop-bots.ps1 to terminate the bot." -ForegroundColor Yellow
} else {
    Write-Host "You can start the bot later with .\start-bot.ps1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test Completion Form" -ForegroundColor Cyan
Write-Host "------------------" -ForegroundColor Cyan
Write-Host "After testing, you can document your results in TESTING-RESULTS.md" -ForegroundColor White
Write-Host "Simply note which tests passed and which failed, along with any observations." -ForegroundColor White
