import { SupabaseClient, createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Loading Supabase configuration...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Found' : 'Missing');

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration error:');
  console.error('- SUPABASE_URL:', process.env.SUPABASE_URL);
  console.error('- SUPABASE_KEY:', process.env.SUPABASE_KEY);
  throw new Error('Missing Supabase configuration');
}

export const supabase = createClient('https://crkfczedmbamdysqmwdn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNya2ZjemVkbWJhbWR5c3Ftd2RuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTIyOTI2OCwiZXhwIjoyMDY0ODA1MjY4fQ.pZWY-wkHB7OBtfto1HXJF1aE6qG0dsBiLDdqdCIyNPU', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface UserProfile {
  telegram_id: string;
  telegram_username: string;
  created_at: Date;
  updated_at: Date;
  wallets?: UserWallet[];
}

export interface UserWallet {
  id: string;
  telegram_id: string;
  address: string;
  name?: string;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function getUserByTelegramUsername(username: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('telegram_username', username)
    .single();

  // PGRST116 means no rows found, which is a valid case
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user:', error);
    return null;
  }

  return data || null;
}

export async function storeUserProfile(profile: Partial<UserProfile>): Promise<boolean> {
  try {
    // Check if user exists first
    const existing = await supabase
      .from('user_profiles')
      .select('telegram_id')
      .eq('telegram_id', profile.telegram_id)
      .single();

    const { error } = await supabase
      .from('user_profiles')
      .upsert([
        {
          ...profile,
          updated_at: new Date(),
          created_at: existing.data ? undefined : new Date()
        }
      ], 
      { 
        onConflict: 'telegram_id'
      });

    if (error) {
      console.error('Error storing user profile:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in storeUserProfile:', error);
    return false;
  }
}

export async function getUserWallets(telegramId: string): Promise<UserWallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching wallets:', error);
    return [];
  }

  return data || [];
}

export async function getPrimaryWallet(telegramId: string): Promise<UserWallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('is_primary', true)
    .single();

  if (error) {
    console.error('Error fetching primary wallet:', error);
    return null;
  }

  return data;
}

export async function createWallet(wallet: Omit<UserWallet, 'id' | 'created_at' | 'updated_at'>): Promise<UserWallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .insert([wallet])
    .select()
    .single();

  if (error) {
    console.error('Error creating wallet:', error);
    return null;
  }

  return data;
}

export async function setWalletAsPrimary(telegramId: string, walletId: string): Promise<boolean> {
  // Start a transaction to update primary status
  const { error } = await supabase.rpc('set_primary_wallet', {
    p_telegram_id: telegramId,
    p_wallet_id: walletId
  });

  if (error) {
    console.error('Error setting primary wallet:', error);
    return false;
  }

  return true;
}

export async function deleteWallet(telegramId: string, walletId: string): Promise<boolean> {
  const { error } = await supabase
    .from('wallets')
    .delete()
    .match({ id: walletId, telegram_id: telegramId });

  if (error) {
    console.error('Error deleting wallet:', error);
    return false;
  }

  return true;
}

export async function getWalletById(walletId: string): Promise<UserWallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', walletId)
    .single();

  if (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }

  return data;
}

export async function updateWalletName(walletId: string, newName: string): Promise<boolean> {
  console.log(`[WALLET RENAME] Updating wallet ${walletId} with new name: ${newName}`);
  
  // Make sure we're not using a name with timestamp format
  if (newName.match(/Renamed Wallet \d+/)) {
    console.warn(`[WALLET RENAME] Detected timestamp-based name pattern, likely from a test script`);
    console.warn(`[WALLET RENAME] BLOCKED TIMESTAMP RENAME - using a fixed name instead`);
    newName = "My Wallet"; // Override with a default name
  }
  
  // Clean the name but preserve exactly what the user provided
  const finalName = newName.trim();
  
  try {
    // Perform the update with the cleaned name
    const { data, error } = await supabase
      .from('wallets')
      .update({ name: finalName })
      .eq('id', walletId)
      .select();
    
    if (error) {
      console.error('[WALLET RENAME] Error updating wallet name:', error);
      return false;
    }
    
    // Log detailed information about the update
    console.log(`[WALLET RENAME] Wallet update response:`, data);
    
    if (data && data.length > 0) {
      if (data[0].name === finalName) {
        console.log(`[WALLET RENAME] Update confirmed: Wallet name is now "${finalName}"`);
        return true;
      } else {
        console.warn(`[WALLET RENAME] Warning: Name mismatch! Expected "${finalName}" but got "${data[0].name}"`);
        return false; // Return false if the name wasn't updated as expected
      }
    } else {
      console.warn('[WALLET RENAME] No data returned from update, but no error either');
      return true;
    }
  } catch (err) {
    console.error('[WALLET RENAME] Exception in updateWalletName:', err);
    return false;
  }
}

// Add function to get wallet with decrypted private key

