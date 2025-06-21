# Delete or rename test scripts to prevent them from running
Write-Host "Disabling test scripts that may be interfering with your bot..." -ForegroundColor Yellow

# Create backup directory if it doesn't exist
$backupDir = ".\test-scripts-backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# Move test scripts to backup directory
$testScripts = @(
    "test-wallet-rename.ts",
    "test-fixed-name.ts",
    "test-rename-bot.ps1",
    "test-db-rename.ps1",
    "verify-rename-fix.ps1",
    "test-rename-wallet.ps1"
)

foreach ($script in $testScripts) {
    if (Test-Path $script) {
        Write-Host "Moving $script to backup..." -ForegroundColor Cyan
        Move-Item -Path $script -Destination "$backupDir\$script.bak" -Force
    }
}

Write-Host "`nAll test scripts have been moved to $backupDir" -ForegroundColor Green
Write-Host "This will prevent them from running and interfering with the bot" -ForegroundColor Green
Write-Host "`nNow run the bot with:" -ForegroundColor White
Write-Host ".\run-simple.bat" -ForegroundColor Cyan
