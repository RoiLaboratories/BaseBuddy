import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

export interface TransactionStatus {
  hash: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  effectiveGasPrice?: string;
}

export async function getTransactionStatus(txHash: string): Promise<TransactionStatus> {
  try {    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash)
    ]);

    if (!tx) {
      return {
        hash: txHash,
        confirmations: 0,
        status: 'pending'
      };
    }

    if (!receipt) {
      const blockNumber = await provider.getBlockNumber();
      const confirmations = tx.blockNumber ? blockNumber - tx.blockNumber + 1 : 0;
      
      return {
        hash: txHash,
        confirmations,
        status: 'pending'
      };
    }

    const blockNumber = await provider.getBlockNumber();
    const confirmations = receipt.blockNumber ? blockNumber - receipt.blockNumber + 1 : 0;

    return {
      hash: txHash,
      confirmations,
      status: receipt.status ? 'confirmed' : 'failed',
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.fee?.toString() || '0'
    };
  } catch (error) {
    console.error('Error getting transaction status:', error);
    throw error;
  }
}

export async function estimateGasCost(txRequest: {
  to: string;
  data?: string;
  value?: string;
}): Promise<{
  estimatedGas: string;
  maxFeePerGas: string;
  totalCost: string;
}> {
  try {    // Convert value to bigint if present
    const txRequestWithBigInt = {
      ...txRequest,
      value: txRequest.value ? ethers.parseEther(txRequest.value) : undefined
    };    const [gasEstimate, feeData] = await Promise.all([
      provider.estimateGas(txRequestWithBigInt),
      provider.getFeeData()
    ]);

    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
    if (!maxFeePerGas) throw new Error('Could not get gas price');

    // Use the priority fee if available, otherwise use 10% of max fee
    const priorityFee = feeData.maxPriorityFeePerGas || (maxFeePerGas * BigInt(10) / BigInt(100));
    
    // Calculate actual gas cost using Base's typical gas prices
    // Use priority fee plus a small buffer (20%) instead of max fee
    const effectiveGasPrice = priorityFee + (priorityFee * BigInt(20) / BigInt(100));
    const totalCost = gasEstimate * effectiveGasPrice;

    return {
      estimatedGas: gasEstimate.toString(),
      maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei'),
      totalCost: ethers.formatEther(totalCost)
    };
  } catch (error) {
    console.error('Error estimating gas:', error);
    throw error;
  }
}
