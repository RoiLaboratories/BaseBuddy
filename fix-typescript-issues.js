/**
 * Fix TypeScript Issues - mainMenuKeyboard Spreading
 * 
 * This script manually fixes TypeScript errors in telegramBot.ts 
 * by replacing problematic spread patterns with properly typed objects.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'telegramBot.ts');

// Make a backup
const backupPath = `${filePath}.typefix.bak`;
fs.copyFileSync(filePath, backupPath);
console.log(`Created backup at ${backupPath}`);

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace all instances of spreading mainMenuKeyboard in reply options
const replacementCount = content.match(/\.\.\.mainMenuKeyboard/g)?.length || 0;

// Replace all instances of ...mainMenuKeyboard with properly typed reply_markup
content = content.replace(
  /\.\.\.mainMenuKeyboard/g, 
  'reply_markup: mainMenuKeyboard.reply_markup'
);

// Update the helper function for combining options if it exists
const helperFunctionPattern = /function combineReplyOptions/;
if (!helperFunctionPattern.test(content)) {
  // Add helper function to the file after the mainMenuKeyboard definition
  const mainMenuKeyboardPattern = /const mainMenuKeyboard = \{[^}]+\};/;
  content = content.replace(
    mainMenuKeyboardPattern,
    (match) => `${match}\n
// Helper function to safely combine reply options
function combineReplyOptions(options: {
  parse_mode?: string;
  message_thread_id?: number;
  [key: string]: any;
}) {
  return {
    parse_mode: options.parse_mode || 'HTML',
    ...(options.message_thread_id ? { message_thread_id: options.message_thread_id } : {}),
    reply_markup: mainMenuKeyboard.reply_markup
  };
}\n`
  );
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log(`Fixed ${replacementCount} instances of ...mainMenuKeyboard in ${filePath}`);
console.log('TypeScript errors should now be resolved.');
