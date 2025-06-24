import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { BASE_TOKENS, getTokenInfo, getTokenPrice, getTokenBalance, retryOperation, getProvider } from './utils/token-utils';

dotenv.config();

export interface TokenBalance {
  symbol: string;
  balance: string;
  usdValue: number;
}

export interface TransferResult {
  hash: string;
  amount: string;
  token: string;
  recipient: string;
}

export interface TransactionData {
  to: string;
  value?: bigint;
  from: string;
  data?: string;
  type: 'eth' | 'token';
  tokenSymbol?: string;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
  error?: string;
}

// Get all token balances for a wallet
export async function getAllTokenBalances(address: string): Promise<TokenBalance[]> {
  const balances: TokenBalance[] = [];

  try {
    // Get ETH balance first with retry
    const ethBalance = await retryOperation(async () => {
      const provider = await getProvider();
      return provider.getBalance(address);
    });
    
    const formattedEthBalance = ethers.formatEther(ethBalance);
    try {
      const ethPrice = await retryOperation(() => getTokenPrice('ETH'));
      balances.push({
        symbol: 'ETH',
        balance: formattedEthBalance,
        usdValue: parseFloat(formattedEthBalance) * ethPrice
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('Error getting ETH price:', error);
      balances.push({
        symbol: 'ETH',
        balance: formattedEthBalance,
        usdValue: parseFloat(formattedEthBalance) * 2000
      });
    }

    // Get balances for all other tracked tokens
    for (const token of BASE_TOKENS) {
      if (token.symbol === 'ETH') continue;

      try {
        const balance = await retryOperation(() => getTokenBalance(address, token.address));
        if (parseFloat(balance) > 0) {  // Only include non-zero balances
          console.log(`Got balance for ${token.symbol}: ${balance}`);
          
          try {
            const price = await retryOperation(() => getTokenPrice(token.address));
            console.log(`Got price for ${token.symbol}: $${price}`);
            balances.push({
              symbol: token.symbol,
              balance: balance,
              usdValue: parseFloat(balance) * price
            });
          } catch (e: unknown) {
            const error = e instanceof Error ? e : new Error(String(e));
            console.error(`Error fetching price for ${token.symbol}:`, error);
            // Still show balance even if price is unavailable
            balances.push({
              symbol: token.symbol,
              balance: balance,
              usdValue: 0
            });
          }
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Error fetching balance for ${token.symbol}:`, error);
      }
    }

    return balances;
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('Error fetching all token balances:', error);
    return [];
  }
}

// Execute transfer between addresses (requires sender's private key)
export async function executeTransfer(
  fromAddress: string,
  toAddress: string,
  amount: string,
  tokenAddress?: string // If undefined, it's an ETH transfer
): Promise<TransferResult> {
  try {
    const provider = (await getProvider()) as ethers.JsonRpcProvider;

    // For ETH transfers
    if (!tokenAddress) {
      const balance = await provider.getBalance(fromAddress);
      const amountWei = ethers.parseEther(amount);
      
      if (balance < amountWei) {
        throw new Error('Insufficient ETH balance');
      }

      return {
        to: toAddress,
        value: amountWei,
        from: fromAddress,
        type: 'eth'
      };
    }

    // For token transfers
    const token = BASE_TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!token) {
      throw new Error('Unsupported token');
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
      provider
    );

    const balance = await tokenContract.balanceOf(fromAddress);
    const decimals = await tokenContract.decimals();
    const amountInTokenDecimals = ethers.parseUnits(amount, decimals);

    if (balance < amountInTokenDecimals) {
      throw new Error(`Insufficient ${token.symbol} balance`);
    }

    const transferData = new ethers.Interface([
      'function transfer(address, uint256) returns (bool)'
    ]).encodeFunctionData('transfer', [toAddress, amountInTokenDecimals]);

    return {
      to: tokenAddress,
      from: fromAddress,
      data: transferData,
      type: 'token',
      tokenSymbol: token.symbol
    };

  } catch (error: unknown) {
    console.error('Transfer error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Transfer failed: ${errorMessage}`);
  }
}
