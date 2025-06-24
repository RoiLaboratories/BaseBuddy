import { ethers, type BigNumberish } from 'ethers';
import { Token, CurrencyAmount } from '@uniswap/sdk-core';
import { Pool, FeeAmount } from '@uniswap/v3-sdk';
import { Contract } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Create provider with Alchemy
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY environment variable is required');
}

const BASE_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
let _provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';

// Common Base tokens with their contract addresses
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

// Interface for token price configuration
interface TokenPriceConfig {
  usePool?: boolean;
  staticPrice?: number;  // Fallback price
  poolAddress?: string;  // Direct pool address
  pairWith?: 'USDC' | 'WETH';  // Which token to check pool against
  poolFee?: FeeAmount;  // Fee tier for V3 pool
}

export const BASE_TOKENS: TokenInfo[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000', // Native ETH
    decimals: 18
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6
  },
  {
    symbol: 'PUMP',
    name: 'PUMP',
    address: '0x32c43d8D7245924f9232D69200fbE139aC05227B',
    decimals: 18
  },
  {
    symbol: 'ENB',
    name: 'Everybody Needs Base',
    address: '0xF73978B3A7D1d4974abAE11f696c1b4408c027A0',
    decimals: 18
  }
];

// Get token info by address
export function getTokenInfo(address: string): TokenInfo | undefined {
  return BASE_TOKENS.find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
}

// Format token amount according to its decimals
export function formatTokenAmount(amount: BigNumberish, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

// Get ETH price in USD by checking WETH/USDC pool
async function getEthPriceFromPool(): Promise<number> {  try {
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const ETH_USDC_POOL = '0xFb53Fe0c27ABEF48602cCA25be1314D8f94Af9E6';
    const USDC_DECIMALS = 6;

    const poolContract = new Contract(
      ETH_USDC_POOL,
      ['function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'],
      _provider
    );

    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96.toString());

    // Calculate price from sqrtPriceX96
    const Q96 = 2n ** 96n;
    const ethPrice = Number((sqrtPriceX96 * sqrtPriceX96 * (10n ** BigInt(USDC_DECIMALS))) / (Q96 * Q96) / (10n ** 18n));
    
    return ethPrice;
  } catch (error) {
    console.error('Error fetching ETH price from USDC/ETH pool:', error);
    return getEthPriceFromCbeth().catch(e => {
      console.error('Error fetching ETH price from cbETH fallback:', e);
      return 2000; // Final fallback if both methods fail
    });
  }
}

// Get ETH price using cbETH/WETH and cbETH/USDC pools
async function getEthPriceFromCbeth(): Promise<number> {
  if (!process.env.BASE_CHAIN_ID) {
    throw new Error('BASE_CHAIN_ID not configured');
  }
  const CBETH_ADDRESS = '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22';
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  // Create token instances
  const cbeth = new Token(
    Number(process.env.BASE_CHAIN_ID),
    CBETH_ADDRESS,
    18,
    'CBETH'
  );

  const weth = new Token(
    Number(process.env.BASE_CHAIN_ID),
    WETH_ADDRESS,
    18,
    'WETH'
  );

  const usdc = new Token(
    Number(process.env.BASE_CHAIN_ID),
    USDC_ADDRESS,
    6,
    'USDC'
  );

  // Get cbETH prices
  const poolAddresses = {
    ethPool: computePoolAddress({
      factoryAddress: UNISWAP_V3_FACTORY,
      tokenA: cbeth,
      tokenB: weth,
      fee: FeeAmount.LOW
    }),
    usdcPool: computePoolAddress({
      factoryAddress: UNISWAP_V3_FACTORY,
      tokenA: cbeth,
      tokenB: usdc,
      fee: FeeAmount.MEDIUM
    })
  };

  const poolAbi = [
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function liquidity() external view returns (uint128)'
  ];

  // Get data from both pools
  const ethPoolContract = new Contract(poolAddresses.ethPool, poolAbi, _provider);
  const usdcPoolContract = new Contract(poolAddresses.usdcPool, poolAbi, _provider);

  const [[ethSlot0, ethLiquidity], [usdcSlot0, usdcLiquidity]] = await Promise.all([
    Promise.all([ethPoolContract.slot0(), ethPoolContract.liquidity()]),
    Promise.all([usdcPoolContract.slot0(), usdcPoolContract.liquidity()])
  ]);

  // Create pool instances
  const cbethEthPool = new Pool(
    cbeth,
    weth,
    FeeAmount.LOW,
    ethSlot0.sqrtPriceX96.toString(),
    ethLiquidity.toString(),
    ethSlot0.tick
  );

  const cbethUsdcPool = new Pool(
    cbeth,
    usdc,
    FeeAmount.MEDIUM,
    usdcSlot0.sqrtPriceX96.toString(),
    usdcLiquidity.toString(),
    usdcSlot0.tick
  );

  // Calculate ETH price from cbETH/USDC and cbETH/ETH rates
  const cbethPrice = parseFloat(cbethUsdcPool.token0Price.toSignificant(6));
  const ethInCbeth = parseFloat(cbethEthPool.token0Price.toSignificant(6));
  
  return cbethPrice * ethInCbeth;
}

// Token configurations with V3 pools
const TOKEN_PRICE_CONFIG: Record<string, TokenPriceConfig> = {
  'ETH': { usePool: true, pairWith: 'USDC', poolFee: FeeAmount.LOW },
  'USDC': { usePool: false, staticPrice: 1 },
  'ENB': { usePool: false },  // Price integration to be added later
  'PUMP': { usePool: false }  // Price integration to be added later
};

const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// Get token price with improved V3 pool support
export async function getTokenPrice(tokenSymbolOrAddress: string): Promise<number> {
  if (!_provider) {
    throw new Error('Provider not initialized');
  }

  const symbolOrAddress = tokenSymbolOrAddress.toLowerCase();
  console.log(`Getting price for token: ${symbolOrAddress}`);

  // Handle ETH/WETH
  if (symbolOrAddress === 'eth' || 
      symbolOrAddress === '0x0000000000000000000000000000000000000000' ||
      symbolOrAddress === WETH_ADDRESS.toLowerCase()) {
    console.log('Getting ETH price...');
    try {
      return await retryOperation(() => getEthPriceFromPool());
    } catch (error) {
      console.error('Error getting ETH price from pool, using static price:', error);
      return 2000;
    }
  }

  // Get token info
  const tokenInfo = symbolOrAddress.startsWith('0x') ? 
    getTokenInfo(symbolOrAddress) : 
    BASE_TOKENS.find(t => t.symbol.toLowerCase() === symbolOrAddress);

  if (!tokenInfo) {
    throw new Error(`Could not resolve token info for: ${symbolOrAddress}`);
  }

  const config = TOKEN_PRICE_CONFIG[tokenInfo.symbol];
  if (!config) {
    console.warn(`No price configuration for ${tokenInfo.symbol}, using 0`);
    return 0;
  }

  // If static price only, use it
  if (!config.usePool) {
    console.log(`Using static price $${config.staticPrice} for ${tokenInfo.symbol}`);
    return config.staticPrice || 0;
  }
  try {    const poolAddress = config.poolAddress;
    if (!config.usePool || !poolAddress) {
      console.log(`No pool configuration for ${tokenInfo.symbol}, using static price`);
      return config.staticPrice || 0;
    }

    const priceInEth = await retryOperation(() => getPriceFromV3Pool(
      poolAddress,
      tokenInfo,
      config.poolFee || FeeAmount.HIGH
    ));
    
    if (priceInEth === 0) {
      console.warn(`Got zero price from pool for ${tokenInfo.symbol}, using fallback`);
      return config.staticPrice || 0;
    }
    
    if (config.pairWith === 'WETH') {
      const ethPrice = await retryOperation(() => getEthPriceFromPool());
      const usdPrice = priceInEth * ethPrice;
      console.log(`Calculated ${tokenInfo.symbol} price: ${priceInEth} ETH * $${ethPrice} = $${usdPrice}`);
      return usdPrice;
    }
    return priceInEth;
  } catch (error) {
    console.error(`Error getting price for ${tokenInfo.symbol}, using fallback price:`, error);
    return config.staticPrice || 0;
  }

  return config.staticPrice || 0;
}

// Helper function to get price from a V3 pool
async function getPriceFromV3Pool(
  poolAddress: string,
  tokenInfo: TokenInfo,
  fee: FeeAmount
): Promise<number> {
  const provider = await getProvider();
  console.log(`Getting V3 pool price from ${poolAddress}`);

  try {
    const poolContract = new Contract(
      poolAddress,
      [
        'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
        'function liquidity() external view returns (uint128)'
      ],
      provider
    );

    const [token0, token1, slot0, liquidity] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.slot0(),
      poolContract.liquidity()
    ]);

    console.log(`Pool tokens: ${token0} / ${token1}`);
    console.log(`Pool liquidity: ${liquidity.toString()}`);

    if (liquidity.toString() === '0') {
      console.warn(`Pool ${poolAddress} has no liquidity`);
      return 0;
    }

    const isToken0 = tokenInfo.address.toLowerCase() === token0.toLowerCase();
    console.log(`Our token is token${isToken0 ? '0' : '1'}`);

    // Create token instances for Uniswap SDK
    const token0Instance = new Token(
      Number(process.env.BASE_CHAIN_ID),
      token0,
      isToken0 ? tokenInfo.decimals : 18, // WETH has 18 decimals
      isToken0 ? tokenInfo.symbol : 'WETH'
    );

    const token1Instance = new Token(
      Number(process.env.BASE_CHAIN_ID),
      token1,
      isToken0 ? 18 : tokenInfo.decimals, // WETH has 18 decimals
      isToken0 ? 'WETH' : tokenInfo.symbol
    );

    // Create pool instance
    const pool = new Pool(
      token0Instance,
      token1Instance,
      fee,
      slot0.sqrtPriceX96.toString(),
      liquidity.toString(),
      slot0.tick
    );

    // Get price (need to use token0Price or token1Price depending on token position)
    const price = isToken0 ? 
      parseFloat(pool.token0Price.toSignificant(6)) :
      parseFloat(pool.token1Price.toSignificant(6));

    if (price <= 0 || isNaN(price)) {
      console.warn(`Invalid pool price ${price} for ${tokenInfo.symbol}`);
      return 0;
    }

    console.log(`Raw pool price for ${tokenInfo.symbol}: ${price}`);
    return price;
  } catch (error) {
    console.error(`Error getting V3 pool price from ${poolAddress}:`, error);
    throw error;
  }
}

// Compute Uniswap V3 pool address for given tokens and fee
function computePoolAddress(arg0: { factoryAddress: string; tokenA: Token; tokenB: Token; fee: FeeAmount; }): string {
    // Uniswap V3 pool address is computed as per: 
    // https://docs.uniswap.org/contracts/v3/reference/core/libraries/PoolAddress
    const POOL_INIT_CODE_HASH = '0x0839c5a1e6e7e2c58e4458b4a5bc9aef12640add3521dc1a42937e2b1f7c4c15';

    // Sort tokens
    const [token0, token1] = arg0.tokenA.sortsBefore(arg0.tokenB)
        ? [arg0.tokenA, arg0.tokenB]
        : [arg0.tokenB, arg0.tokenA];

    // Encode pool key
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abi.encode(
        ['address', 'address', 'uint24'],
        [token0.address, token1.address, arg0.fee]
    );
    const salt = ethers.keccak256(encoded);

    // Compute and return address
    return ethers.getCreate2Address(
        arg0.factoryAddress,
        salt,
        POOL_INIT_CODE_HASH
    );
}

// Utility function for retrying failed RPC calls
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const isRateLimit = error && 
        typeof error === 'object' && 
        'info' in error &&
        error.info && 
        typeof error.info === 'object' &&
        'error' in error.info &&
        error.info.error &&
        typeof error.info.error === 'object' &&
        'code' in error.info.error &&
        error.info.error.code === -32016;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait longer if it's a rate limit error
      const delay = isRateLimit ? delayMs * attempt * 2 : delayMs;
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export async function getProvider(): Promise<ethers.Provider> {
  try {
    // Test the connection
    await _provider.getNetwork();
    return _provider;
  } catch (error) {
    console.error('Provider error:', error);
    // Reinitialize provider
    _provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    try {
      await _provider.getNetwork();
      return _provider;
    } catch (retryError) {
      throw new Error('Failed to connect to Base network. Please check your API key and network status.');
    }
  }
}

// Get token balance with retries and fallback providers
export async function getTokenBalance(
  address: string,
  tokenAddress?: string
): Promise<string> {
  try {
    const provider = await getProvider();
    
    if (!tokenAddress) {
      const balance = await retryOperation(() => provider.getBalance(address));
      return ethers.formatEther(balance);
    }

    const balance = await retryOperation(async () => {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );
      return tokenContract.balanceOf(address);
    });

    const tokenInfo = getTokenInfo(tokenAddress);
    return ethers.formatUnits(balance, tokenInfo?.decimals || 18);
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}
