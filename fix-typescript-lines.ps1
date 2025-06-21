## PowerShell Script to Fix TypeScript Errors in telegramBot.ts
## This script directly modifies specific line ranges to fix type compatibility issues

# Path to the file
$filePath = "C:\Users\USER\Desktop\BaseBuddy\src\telegramBot.ts"

# Create a backup of the original file
Copy-Item -Path $filePath -Destination "$filePath.typebak" -Force
Write-Host "Created backup at $filePath.typebak"

# Read the file content
$content = Get-Content -Path $filePath -Raw

# Function to set content for a specific line range
function Set-ContentLines {
    param (
        [string]$content,
        [int]$startLine,
        [int]$endLine,
        [string]$replacement
    )
    
    $lines = $content -split "`n"
    $before = $lines[0..($startLine-1)]
    $after = $lines[$endLine..$lines.Count]
    
    $replacementLines = $replacement -split "`n"
    $newLines = $before + $replacementLines + $after
    
    return $newLines -join "`n"
}

# 1. Fix the portfolio command at around line 150
$portfolioReplacement = @'
      await ctx.reply(portfolioMessage, {
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard.reply_markup
      });
'@

$content = Set-ContentLines -content $content -startLine 149 -endLine 151 -replacement $portfolioReplacement

# 2. Fix portfolio command at around line 983
$content = Set-ContentLines -content $content -startLine 982 -endLine 984 -replacement $portfolioReplacement

# 3. Fix portfolio command at around line 1268
$content = Set-ContentLines -content $content -startLine 1267 -endLine 1269 -replacement $portfolioReplacement

# 4. Fix portfolio command at around line 1680
$content = Set-ContentLines -content $content -startLine 1679 -endLine 1681 -replacement $portfolioReplacement

# 5. Fix portfolio command at around line 1960
$content = Set-ContentLines -content $content -startLine 1959 -endLine 1961 -replacement $portfolioReplacement

# Write the modified content back to the file
Set-Content -Path $filePath -Value $content

Write-Host "Fixed TypeScript errors in $filePath"
Write-Host "All instances of '...mainMenuKeyboard' have been replaced with 'reply_markup: mainMenuKeyboard.reply_markup'"
