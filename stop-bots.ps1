# PowerShell script to stop all running Node.js processes that might be running Telegram bots
Write-Host "Searching for running bot processes..." -ForegroundColor Yellow

# Find all Node.js processes that might be running our bot
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*telegramBot.ts*" -or 
    $_.CommandLine -like "*simple-bot.ts*" -or
    $_.CommandLine -like "*BaseBuddy*"
}

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) bot processes running. Stopping them..." -ForegroundColor Yellow
    
    foreach ($process in $nodeProcesses) {
        Write-Host "Stopping process ID: $($process.Id)" -ForegroundColor Cyan
        Stop-Process -Id $process.Id -Force
    }
    
    Write-Host "All bot processes have been terminated." -ForegroundColor Green
} else {
    Write-Host "No running bot processes found." -ForegroundColor Green
}

# Extra check to make sure no lingering processes are running
Start-Sleep -Seconds 1
$remainingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*telegramBot.ts*" -or 
    $_.CommandLine -like "*simple-bot.ts*" -or
    $_.CommandLine -like "*BaseBuddy*"
}

if ($remainingProcesses) {
    Write-Host "WARNING: Some bot processes are still running. Attempting forceful termination..." -ForegroundColor Red
    foreach ($process in $remainingProcesses) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Bot cleanup completed." -ForegroundColor Green
