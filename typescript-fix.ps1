/**
 * Typescript Fix Script
 * 
 * This script finds all instances of '...mainMenuKeyboard' in telegramBot.ts and 
 * replaces them with the type-safe version 'reply_markup: mainMenuKeyboard.reply_markup'
 */

// Using PowerShell to perform the changes
// First, create a backup of the file
$originalFile = "c:\Users\USER\Desktop\BaseBuddy\src\telegramBot.ts"
$backupFile = "c:\Users\USER\Desktop\BaseBuddy\src\telegramBot.ts.backup"

Copy-Item -Path $originalFile -Destination $backupFile -Force

# Read file content
$content = Get-Content -Path $originalFile -Raw

# Replace all instances of '...mainMenuKeyboard' with 'reply_markup: mainMenuKeyboard.reply_markup'
$newContent = $content -replace '(?<=parse_mode: .HTML.,\s+)\.\.\.mainMenuKeyboard', 'reply_markup: mainMenuKeyboard.reply_markup'

# Write the modified content back to the file
Set-Content -Path $originalFile -Value $newContent

Write-Host "Typescript fix applied to $originalFile"
Write-Host "A backup was created at $backupFile"

# If needed, you can verify the changes using:
# Write-Host "Checking for any remaining instances..."
# Select-String -Path $originalFile -Pattern "...mainMenuKeyboard"
