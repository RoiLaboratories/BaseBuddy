// /**
//  * Type Fix Demo - Demonstrates the TypeScript error and solution
//  * 
//  * The issue is with type compatibility when spreading objects with different types
//  * in Telegram bot reply options. The solution is to create properly typed objects.
//  */

// import { Telegraf, Context } from 'telegraf';

// // Example keyboard configuration
// const mainMenuKeyboard = {
//   reply_markup: {
//     remove_keyboard: true as const
//   }
// };

// // Original problematic pattern causing TypeScript errors
// async function problematicPattern(ctx: Context, chatType: string) {
//   const helpMessage = "Example message";
  
//   // This pattern causes TypeScript errors due to incompatible spread types
//   await ctx.reply(helpMessage, { 
//     parse_mode: 'HTML',
//     ...(chatType !== 'private' ? { message_thread_id: 123 } : {}),
//     ...mainMenuKeyboard // TypeScript error here
//   });
// }

// // Fixed pattern 1: Directly include reply_markup property
// async function fixedPattern1(ctx: Context, chatType: string) {
//   const helpMessage = "Example message";
  
//   // This pattern works because we're not spreading incompatible types
//   await ctx.reply(helpMessage, { 
//     parse_mode: 'HTML',
//     ...(chatType !== 'private' ? { message_thread_id: 123 } : {}),
//     reply_markup: mainMenuKeyboard.reply_markup
//   });
// }

// // Fixed pattern 2: Create options object first, then use it
// async function fixedPattern2(ctx: Context, chatType: string) {
//   const helpMessage = "Example message";
  
//   // Create a properly typed options object
//   const replyOptions: any = {
//     parse_mode: 'HTML',
//     reply_markup: mainMenuKeyboard.reply_markup
//   };
  
//   // Add conditional properties
//   if (chatType !== 'private') {
//     replyOptions.message_thread_id = 123;
//   }
  
//   // Use the prepared options object
//   await ctx.reply(helpMessage, replyOptions);
// }

// // Fixed pattern 3: Create a helper function
// function combineReplyOptions(options: {
//   parse_mode?: string;
//   message_thread_id?: number;
//   [key: string]: any;
// }) {
//   return {
//     parse_mode: options.parse_mode || 'HTML',
//     ...(options.message_thread_id ? { message_thread_id: options.message_thread_id } : {}),
//     reply_markup: mainMenuKeyboard.reply_markup
//   };
// }

// async function fixedPattern3(ctx: Context, chatType: string) {
//   const helpMessage = "Example message";
  
//   await ctx.reply(helpMessage, combineReplyOptions({
//     parse_mode: 'HTML',
//     ...(chatType !== 'private' ? { message_thread_id: 123 } : {})
//   }));
// }

// // To fix all instances in a file:
// // 1. Find all usages of ...mainMenuKeyboard in reply options
// // 2. Replace with reply_markup: mainMenuKeyboard.reply_markup
// // 3. Ensure other spread properties are properly typed
