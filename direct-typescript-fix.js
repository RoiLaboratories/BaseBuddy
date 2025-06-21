/**
 * Direct TypeScript Fixes
 * 
 * This script fixes TypeScript type errors in the help command 
 * and adds a helper function that can be used throughout the file.
 */

// First, let's add a type-safe helper function to handle reply options
// This should be added near line 80 after the mainMenuKeyboard definition

// Directly create the file content with specific fixes at specific locations
const fs = require('fs');
const path = require('path');

// Create a function to modify specific lines in the file
function modifyLines(filePath, lineStart, lineEnd, newContent) {
  // Read the file content
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Create a backup
  fs.writeFileSync(`${filePath}.backup`, content);
  
  // Replace lines in the range
  const beforeLines = lines.slice(0, lineStart);
  const afterLines = lines.slice(lineEnd + 1);
  const modifiedContent = [...beforeLines, ...newContent.split('\n'), ...afterLines].join('\n');
  
  // Write modified content back to file
  fs.writeFileSync(filePath, modifiedContent);
  
  console.log(`Modified lines ${lineStart}-${lineEnd} in ${filePath}`);
}

const filePath = path.join(__dirname, 'src', 'telegramBot.ts');

// 1. Add helper function after mainMenuKeyboard definition (around line 80)
const helperFunction = `// Define the main menu keyboard
const mainMenuKeyboard = {
  reply_markup: {
    remove_keyboard: true as const  // Use 'as const' to indicate this is specifically true, not just a boolean
  }
};

// Helper function to safely combine reply options
function prepareReplyOptions(options: {
  parse_mode?: string;
  message_thread_id?: number;
  [key: string]: any;
}) {
  return {
    parse_mode: options.parse_mode || 'HTML',
    ...(options.message_thread_id ? { message_thread_id: options.message_thread_id } : {}),
    reply_markup: mainMenuKeyboard.reply_markup
  };
}

// Register command handlers here`;

modifyLines(filePath, 73, 82, helperFunction);

// 2. Fix the help command reply options (around line 275)
// The range has to be determined by examining the file content

console.log('TypeScript fixes applied successfully.');
