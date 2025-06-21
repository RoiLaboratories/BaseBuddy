export interface Wallet {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

export interface WalletWithBalance extends Wallet {
  balance: string;
}
