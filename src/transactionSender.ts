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

// Execute transfer from user's wallet
export async function executeTransfer(
  fromAddress: string,
  toAddress: string,
  amount: string,
  tokenAddress?: string
): Promise<TransferResult> {
  const provider = (await getProvider()) as ethers.JsonRpcProvider;
  
  try {
    if (!tokenAddress) {      // For ETH transfers
      const balance = await provider.getBalance(fromAddress);
      const amountWei = ethers.parseEther(amount);
      const gasEstimate = await provider.estimateGas({
        to: toAddress,
        value: amountWei,
        from: fromAddress
      });
      const totalNeeded = amountWei + gasEstimate;

      if (balance < totalNeeded) {
        throw new Error('Insufficient ETH balance (including gas fees)');
      }

      // Execute ETH transfer from user's wallet
      const txResponse = await provider.send('eth_sendTransaction', [{
        from: fromAddress,
        to: toAddress,
        value: `0x${amountWei.toString(16)}`, // Convert to hex
        gas: `0x${gasEstimate.toString(16)}` // Convert to hex
      }]);

      // Wait for transaction confirmation
      const receipt = await provider.waitForTransaction(txResponse);
      
      if (!receipt) {
        throw new Error('Transaction failed: no receipt');
      }
      
      return {
        hash: receipt.hash,
        amount,
        token: 'ETH',
        recipient: toAddress
      };
    } else {
      // For token transfers
      const erc20Abi = [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address, uint256) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
      const tokenInfo = getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        throw new Error('Invalid token');
      }

      const balance = await tokenContract.balanceOf(fromAddress);
      const amountInTokenDecimals = ethers.parseUnits(amount, tokenInfo.decimals);
      
      if (balance < amountInTokenDecimals) {
        throw new Error(`Insufficient ${tokenInfo.symbol} balance`);
      }

      // Check ETH balance for gas
      const ethBalance = await provider.getBalance(fromAddress);
      const transferData = tokenContract.interface.encodeFunctionData('transfer', [toAddress, amountInTokenDecimals]);
      const gasEstimate = await provider.estimateGas({
        from: fromAddress,
        to: tokenAddress,
        data: transferData
      });
      
      if (ethBalance < gasEstimate) {
        throw new Error('Insufficient ETH for gas fees');
      }      // Execute token transfer using eth_sendTransaction from user's wallet
      const txResponse = await provider.send('eth_sendTransaction', [{
        from: fromAddress,
        to: tokenAddress,
        data: transferData,
        gas: `0x${gasEstimate.toString(16)}`, // Convert to hex
        gasPrice: await provider.getFeeData().then(data => 
          data.gasPrice ? `0x${data.gasPrice.toString(16)}` : undefined
        )
      }]);

      const receipt = await provider.waitForTransaction(txResponse);
      
      if (!receipt || !receipt.status) {
        throw new Error('Transaction failed');
      }

      return {
        hash: receipt.hash,
        amount,
        token: tokenInfo.symbol,
        recipient: toAddress
      };
    }
  } catch (error: unknown) {
    console.error('Transfer error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Transfer failed: ${errorMessage}`);
  }
}
