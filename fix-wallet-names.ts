// This script will fix any wallets with timestamp-based names in your database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixWalletNames() {
  console.log('FIXING WALLET NAMES WITH TIMESTAMP PATTERN');
  console.log('=========================================');
  
  // 1. Find wallets with timestamp pattern
  console.log('1. Searching for wallets with timestamp pattern names...');
  
  const { data: wallets, error: fetchError } = await supabase
    .from('wallets')
    .select('*')
    .like('name', 'Renamed Wallet %');
  
  if (fetchError) {
    console.error('Error fetching wallets:', fetchError);
    return;
  }
  
  if (!wallets || wallets.length === 0) {
    console.log('No wallets with timestamp pattern found. Everything is fine!');
    return;
  }
  
  console.log(`Found ${wallets.length} wallets with timestamp pattern names:`);
  
  // 2. Fix each wallet
  let fixCount = 0;
  for (const wallet of wallets) {
    console.log(`- Wallet ID: ${wallet.id}, Current name: ${wallet.name}`);
    
    // Generate a better name
    let newName = `Wallet ${fixCount + 1}`;
    
    console.log(`  Renaming to: ${newName}`);
    
    const { data, error } = await supabase
      .from('wallets')
      .update({ name: newName })
      .eq('id', wallet.id)
      .select();
    
    if (error) {
      console.error(`  Error updating wallet ${wallet.id}:`, error);
    } else {
      console.log(`  ✅ Successfully renamed wallet ${wallet.id} to "${newName}"`);
      fixCount++;
    }
  }
  
  console.log(`\nFix summary: Renamed ${fixCount} out of ${wallets.length} wallets`);
}

// Run the fix script
fixWalletNames()
  .catch(error => {
    console.error('Script failed with error:', error);
  })
  .finally(() => {
    console.log('\nFix wallet names script complete.');
  });
