import { ethers } from 'ethers';
import { toDataURL, QRCodeToDataURLOptions } from 'qrcode';
import { JsonRpcProvider } from 'ethers';

// Constants
const BASE_CHAIN_ID = 8453;
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PROJECT_ID = process.env.WALLET_CONNECT_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error('WALLET_CONNECT_PROJECT_ID is required');
}

/**
 * Creates a WalletConnect URI for Coinbase Wallet
 */
export const createWalletLink = async (messageToSign: string, telegramId: string): Promise<string> => {
  // WalletConnect v2 URI format
  const wcUri = `wc:${PROJECT_ID}@2?relay-protocol=irn&chainId=${BASE_CHAIN_ID}&method=personal_sign&message=${encodeURIComponent(messageToSign)}`;
  
  // Create deep link for Coinbase Wallet
  const walletUrl = new URL('https://wallet.coinbase.com/wc');
  walletUrl.searchParams.set('uri', wcUri);
  walletUrl.searchParams.set('returnInline', 'false');

  return walletUrl.toString();
};

/**
 * Creates a QR code for wallet connection
 * Returns a data URL that can be used as an image source
 */
export const createWalletQR = async (link: string): Promise<string> => {
  try {
    const qrOptions: QRCodeToDataURLOptions = {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 512,
      color: {
        dark: '#000000',
        light: '#ffffff',
      }
    };
    return await toDataURL(link, qrOptions);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

/**
 * Verifies a wallet signature
 */
export const verifySignature = async (
  message: string,
  signature: string
): Promise<{ isValid: boolean; address: string }> => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return {
      isValid: true,
      address: recoveredAddress
    };
  } catch {
    return {
      isValid: false,
      address: ''
    };
  }
};

/**
 * Gets the provider for Base network
 */
export const getProvider = (): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider(BASE_RPC_URL);
};
