import { Wallet, HDNodeWallet } from 'ethers';
import type { Wallet as WalletType } from '../src/types/wallet';

/**
 * Generates a new Ethereum wallet with a random private key
 */
export function generateWallet(): WalletType {
  // Create a random wallet
  const wallet: HDNodeWallet = Wallet.createRandom();
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase
  };
}

// If script is run directly, generate and display a wallet
if (require.main === module) {
  const wallet = generateWallet();
  console.log('\n🔐 New Wallet Generated:\n');
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  if (wallet.mnemonic) {
    console.log(`\n⚠️ Backup Phrase (keep this safe!):\n${wallet.mnemonic}`);
  }
  console.log('\n⚠️ Keep your private key and backup phrase safe and secret!');
}