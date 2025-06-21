import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { storeUserProfile, createWallet } from './supabaseClient';

const pendingVerifications = new Map<string, { nonce: string; timestamp: number }>();

export function generateVerificationNonce(telegramId: string): string {
  const nonce = uuidv4();
  pendingVerifications.set(telegramId, {
    nonce,
    timestamp: Date.now()
  });
  return nonce;
}

export function getVerificationMessage(nonce: string): string {
  return `Welcome to BaseBuddy!\n\nThis signature will be used to verify your Coinbase Wallet ownership. No transactions will be initiated without your explicit approval.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
}

export async function verifyWalletSignature(
  telegramId: string,
  telegramUsername: string,
  signature: string
): Promise<boolean> {
  const verification = pendingVerifications.get(telegramId);
  
  if (!verification) {
    throw new Error('No pending verification found');
  }

  if (Date.now() - verification.timestamp > 5 * 60 * 1000) {
    pendingVerifications.delete(telegramId);
    throw new Error('Verification expired');
  }
  try {
    const message = getVerificationMessage(verification.nonce);
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // First ensure user profile exists
    const profileCreated = await storeUserProfile({
      telegram_id: telegramId,
      telegram_username: telegramUsername,
      created_at: new Date(),
      updated_at: new Date()
    });

    if (!profileCreated) {
      console.error('Failed to create/update user profile');
      return false;
    }

    // Create a new wallet entry
    const wallet = await createWallet({
      telegram_id: telegramId,
      address: recoveredAddress,
      name: 'Verified Wallet',
      is_primary: true
    });

    if (!wallet) {
      console.error('Failed to create wallet');
      return false;
    }

    pendingVerifications.delete(telegramId);
    return true;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}
