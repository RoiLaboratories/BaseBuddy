import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, FeeAmount } from '@uniswap/v3-sdk';
import { ethers, Interface } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);

interface SwapQuote {
  expectedOutput: string;
  minimumOutput: string;
  priceImpact: string;
  fee: string;
  route: string[];
  swapData: {
    poolAddress: string;
    calldata: string;
    value: string;
    to: string; // Router address
    amountIn?: string;
    amountOutMin?: string;
  };
}

// Export types
export type { SwapQuote };

// Uniswap V3 contract addresses
export const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
export const UNIVERSAL_ROUTER = '0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC';

// Simplified Universal Router ABI for swap functions
const UNIVERSAL_ROUTER_ABI = [
  'function exactInput(tuple(bytes path, address recipient, uint256 amountIn, uint256 amountOutMin)) external payable returns (uint256)',
  'function exactOutput(tuple(bytes path, address recipient, uint256 amountOut, uint256 amountInMax)) external payable returns (uint256)'
];

const routerInterface = new Interface(UNIVERSAL_ROUTER_ABI);

// Generate swap transaction data
export async function generateSwapTransaction(
  quote: SwapQuote,
  recipient: string,
  tokenIn: string,
  tokenOut: string
): Promise<{ to: string; data: string; value: string }> {
  // Get token info
  const [tokenInInfo, tokenOutInfo] = await Promise.all([
    getTokenInfo(tokenIn),
    getTokenInfo(tokenOut)
  ]);

  // Encode the path for the swap
  const path = encodePath(quote.route.map(symbol => {
    switch(symbol.toUpperCase()) {
      case 'ETH': return TOKEN_ADDRESSES.WETH;
      case 'WETH': return TOKEN_ADDRESSES.WETH;
      case 'USDC': return TOKEN_ADDRESSES.USDC;
      case 'USDBC': return TOKEN_ADDRESSES.USDbC;
      case 'PUMP': return TOKEN_ADDRESSES.PUMP;
      case 'ENB': return TOKEN_ADDRESSES.ENB;
      default: throw new Error(`Unsupported token in route: ${symbol}`);
    }
  }), quote.route.length > 2 ? [FeeAmount.MEDIUM, FeeAmount.MEDIUM] : [FeeAmount.MEDIUM]);

  // Create the swap parameters
  const isExactInput = !quote.swapData.amountOutMin;
  const params = isExactInput ? {
    path,
    recipient,
    amountIn: quote.swapData.amountIn || quote.swapData.value,
    amountOutMin: quote.minimumOutput
  } : {
    path,
    recipient,
    amountOut: quote.expectedOutput,
    amountInMax: quote.swapData.value
  };

  // Encode the swap function call
  const data = isExactInput ?
    routerInterface.encodeFunctionData('exactInput', [params]) :
    routerInterface.encodeFunctionData('exactOutput', [params]);

  return {
    to: UNIVERSAL_ROUTER,
    data,
    value: tokenInInfo.symbol === 'ETH' ? quote.swapData.value : '0'
  };
}

// Helper to encode the swap path
function encodePath(path: string[], fees: FeeAmount[]): string {
  if (path.length !== fees.length + 1) {
    throw new Error('path/fee lengths do not match');
  }

  let encoded = '0x';
  for (let i = 0; i < fees.length; i++) {
    // Encode the token address
    encoded += path[i].slice(2);
    // Encode the fee
    encoded += fees[i].toString(16).padStart(6, '0');
  }
  // Encode the final token
  encoded += path[path.length - 1].slice(2);

  return encoded;
}

// Fee tiers from lowest to highest
const FEE_TIERS = [
  FeeAmount.LOW,    // 0.05%
  FeeAmount.MEDIUM, // 0.30%
  FeeAmount.HIGH    // 1.00%
];

// Token addresses
// These addresses must be in checksum format
export const TOKEN_ADDRESSES = {  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  PUMP: '0x32c43d8D7245924f9232D69200fbE139aC05227B',
  ENB: '0xF73978B3A7D1d4974abAE11f696c1b4408c027A0'
};

// Known pool addresses
const KNOWN_POOLS = {
  PUMP_WETH: {
    address: '0x47eDbFC8E489eD5C7eb2b7b8E7a5e32dc2Aec515',
    feeTier: 10000, // 1%
    token0: TOKEN_ADDRESSES.PUMP,
    token1: TOKEN_ADDRESSES.WETH
  },
  ENB_WETH: {
    address: '0xfAB2F613D2b4c43AE304860f759575359EaC0566',
    feeTier: 10000, // 1%
    token0: TOKEN_ADDRESSES.ENB,
    token1: TOKEN_ADDRESSES.WETH
  }
};

// Define routing tokens in order of preference
const ROUTING_TOKENS = [
  TOKEN_ADDRESSES.WETH,  // Primary routing token
  TOKEN_ADDRESSES.USDC,  // Secondary routing token
  TOKEN_ADDRESSES.USDbC  // Tertiary routing token
];

// Token information interface
interface TokenInfo {
  address: string;
  decimals: number;
  symbol: string;
}

// Create a Token instance with proper address formatting
function createToken(chainId: number, address: string, decimals: number, symbol: string): Token {
  const checksummedAddress = ethers.getAddress(address);
  return new Token(chainId, checksummedAddress, decimals, symbol);
}

// Get token info by symbol
async function getTokenInfo(symbol: string): Promise<TokenInfo> {
  const upperSymbol = symbol.toUpperCase();
  
  // Handle ETH/WETH special case
  if (upperSymbol === 'ETH' || upperSymbol === 'WETH') {
    return {
      address: TOKEN_ADDRESSES.WETH,
      decimals: 18,
      symbol: upperSymbol === 'ETH' ? 'ETH' : 'WETH'
    };
  }

  // Handle known tokens
  const knownTokens: Record<string, { address: string; decimals: number }> = {
    'USDC': { address: TOKEN_ADDRESSES.USDC, decimals: 6 },
    'USDBC': { address: TOKEN_ADDRESSES.USDbC, decimals: 6 },
    'PUMP': { address: TOKEN_ADDRESSES.PUMP, decimals: 18 },
    'ENB': { address: TOKEN_ADDRESSES.ENB, decimals: 18 }
  };

  if (upperSymbol in knownTokens) {
    const token = knownTokens[upperSymbol];
    return {
      address: token.address,
      decimals: token.decimals,
      symbol: upperSymbol
    };
  }

  // Handle token addresses
  if (symbol.startsWith('0x') && symbol.length === 42) {
    try {
      const checksummedAddress = ethers.getAddress(symbol);
      const tokenContract = new ethers.Contract(
        checksummedAddress,
        ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
        provider
      );

      const [decimals, fetchedSymbol] = await Promise.all([
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      return {
        address: checksummedAddress,
        decimals,
        symbol: fetchedSymbol
      };
    } catch (error) {
      console.error('Error getting token info from contract:', error);
      throw new Error(`Invalid token address: ${symbol}`);
    }
  }

  // If not recognized, show supported tokens
  const supportedTokens = [...Object.keys(knownTokens), 'ETH'].join(', ');
  throw new Error(
    `Unsupported token: ${symbol}\nSupported tokens: ${supportedTokens}`
  );
}

// Helper to sort two tokens by address
function sortTokens(tokenA: Token, tokenB: Token): [Token, Token] {
  return tokenA.address.toLowerCase() < tokenB.address.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];
}

// V3 Pool Interface ABI
const V3_POOL_INTERFACE = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)'
];

// Get the best pool for a token pair
async function getBestPool(
  tokenA: Token, 
  tokenB: Token, 
  amount: CurrencyAmount<Token>
): Promise<{ pool: Pool; feeTier: FeeAmount } | null> {
  // Check for known pools first
  const tokenAPair = [tokenA.address.toLowerCase(), tokenB.address.toLowerCase()];
  const wethAddr = TOKEN_ADDRESSES.WETH.toLowerCase();
  
  console.log('Checking for pool between:', {
    tokenA: tokenA.symbol,
    tokenAAddress: tokenA.address,
    tokenB: tokenB.symbol,
    tokenBAddress: tokenB.address
  });
  
  let knownPool = null;
  
  if (tokenAPair.includes(TOKEN_ADDRESSES.PUMP.toLowerCase()) && tokenAPair.includes(wethAddr)) {
    knownPool = KNOWN_POOLS.PUMP_WETH;
    console.log('Found PUMP/WETH known pool');
  } else if (tokenAPair.includes(TOKEN_ADDRESSES.ENB.toLowerCase()) && tokenAPair.includes(wethAddr)) {
    knownPool = KNOWN_POOLS.ENB_WETH;
    console.log('Found ENB/WETH known pool');
  }

  if (knownPool) {
    try {
      console.log(`Using known pool: ${knownPool.address}`);
      const poolContract = new ethers.Contract(
        knownPool.address,
        V3_POOL_INTERFACE,
        provider
      );

      // Verify pool exists
      const code = await provider.getCode(knownPool.address);
      if (code === '0x') {
        console.log('Known pool address has no code');
        return null;
      }

      // Get all pool data in parallel
      const [liquidity, slot0Data, token0Address, token1Address] = await Promise.all([
        poolContract.liquidity(),
        poolContract.slot0(),
        poolContract.token0(),
        poolContract.token1()
      ]);

      // Check liquidity
      if (BigInt(liquidity.toString()) === BigInt(0)) {
        console.log('Known pool has no liquidity');
        return null;
      }

      // Log all pool data for debugging
      const { sqrtPriceX96, tick } = slot0Data;
      console.log('Pool data:', {
        token0: token0Address,
        token1: token1Address,
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick: tick.toString(),
        liquidity: liquidity.toString()
      });

      // Ensure tick is within valid range [-887272, 887272]
      const validTick = Math.max(-887272, Math.min(887272, Number(tick)));
      console.log('Using tick:', validTick);

      // Get tokens in the correct order as stored in the pool
      const [token0, token1] = token0Address.toLowerCase() === tokenA.address.toLowerCase()
        ? [tokenA, tokenB]
        : [tokenB, tokenA];

      // Create pool instance with validated data
      const pool = new Pool(
        token0,
        token1,
        knownPool.feeTier,
        sqrtPriceX96.toString(),
        liquidity.toString(),
        validTick
      );

      // Verify pool creation
      try {
        // Test quote to verify pool is working
        const testAmount = CurrencyAmount.fromRawAmount(token1, '1000000'); // small test amount
        const [testQuote] = await pool.getInputAmount(testAmount);
        console.log('Test quote successful:', testQuote.quotient.toString());
      } catch (error) {
        console.log('Pool verification failed:', error);
        return null;
      }

      return { pool, feeTier: knownPool.feeTier };
    } catch (error) {
      console.log('Error initializing pool:', error);
      console.log('Pool details:', {
        address: knownPool.address,
        feeTier: knownPool.feeTier,
        token0: knownPool.token0,
        token1: knownPool.token1
      });
      return null;
    }
  }

  // If no known pool, try the regular pool discovery
  const [token0, token1] = sortTokens(tokenA, tokenB);
  
  for (const feeTier of FEE_TIERS) {
    try {
      const poolAddress = ethers.getAddress(
        ethers.getCreate2Address(
          UNISWAP_V3_FACTORY,
          ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'address', 'uint24'],
              [token0.address, token1.address, feeTier]
            )
          ),
          '0x0839c5a1e6e7e2c58e4458b4a5bc9aef12640add3521dc1a42937e2b1f7c4c15'
        )
      );

      // Check if pool exists
      const code = await provider.getCode(poolAddress);
      if (code === '0x') {
        console.log(`No pool exists for fee tier ${feeTier}`);
        continue;
      }

      // Create pool contract with full interface
      const poolContract = new ethers.Contract(
        poolAddress,
        V3_POOL_INTERFACE,
        provider
      );
      
      // Check liquidity
      const liquidity = await poolContract.liquidity();
      if (liquidity.eq(0)) {
        console.log(`Pool exists but has no liquidity for fee tier ${feeTier}`);
        continue;
      }

      // Get slot0 data
      const { sqrtPriceX96, tick } = await poolContract.slot0();
      
      // Create pool instance
      const pool = new Pool(
        token0,
        token1,
        feeTier,
        sqrtPriceX96.toString(),
        liquidity.toString(),
        tick
      );

      return { pool, feeTier };
    } catch (error) {
      console.log(`Error checking pool for fee tier ${feeTier}:`, error);
      continue;
    }
  }
  
  return null;
}

// Format the swap details with human-readable numbers
function formatSwapNumbers(amount: string, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

// Get swap quote with output amount
export async function getSwapQuoteExactOutput(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  amountOut: string,
  maxAmountIn: string = '0',
  slippageTolerance: string = '0.5'
): Promise<SwapQuote> {
  console.log('Getting swap quote for:', {
    chainId,
    tokenIn,
    tokenOut,
    amountOut,
    maxAmountIn,
    slippageTolerance
  });

  const [tokenInInfo, tokenOutInfo] = await Promise.all([
    getTokenInfo(tokenIn),
    getTokenInfo(tokenOut)
  ]);

  // Create token instances
  const baseTokenIn = createToken(
    chainId,
    tokenInInfo.address,
    tokenInInfo.decimals,
    tokenInInfo.symbol
  );

  const baseTokenOut = createToken(
    chainId,
    tokenOutInfo.address,
    tokenOutInfo.decimals,
    tokenOutInfo.symbol
  );
  // For buying tokens, we want exact output amount
  console.log('Parsing PUMP output amount:', amountOut, tokenOutInfo.decimals);
  const parsedAmount = ethers.parseUnits(amountOut, tokenOutInfo.decimals);
  if (parsedAmount <= BigInt(0)) {
    throw new Error('PUMP amount must be greater than 0');
  }
  console.log('Parsed PUMP amount:', parsedAmount.toString());

  // Create exact output amount for PUMP
  const outputAmount = CurrencyAmount.fromRawAmount(
    baseTokenOut,
    parsedAmount.toString()
  );

  // Convert max ETH input to proper units (18 decimals)
  console.log('Parsing max ETH input:', maxAmountIn);
  const maxInput = ethers.parseUnits(maxAmountIn, 18); // ETH always has 18 decimals
  console.log('Max ETH amount in wei:', maxInput.toString());

  // Try direct pool first
  console.log('Trying direct pool...');
  const directPool = await getBestPool(baseTokenIn, baseTokenOut, outputAmount);
  
  if (directPool) {    console.log('Found direct pool, creating route...');
    const route = new Route([directPool.pool], baseTokenIn, baseTokenOut);
    
    console.log('Creating trade to buy', amountOut, 'PUMP with max', maxAmountIn, 'ETH...');    // Calculate the quote directly from the pool
    const [quotedInputAmount] = await directPool.pool.getInputAmount(outputAmount);
    console.log('Pool quote details:', {
      outputAmount: outputAmount.quotient.toString(),
      inputAmount: quotedInputAmount.quotient.toString(),
      inputFormatted: ethers.formatEther(quotedInputAmount.quotient.toString())
    });

    const uncheckedTrade = await Trade.createUncheckedTrade({
      route,
      inputAmount: quotedInputAmount,
      outputAmount,
      tradeType: TradeType.EXACT_OUTPUT
    });

    console.log('Calculating required ETH input...');
    const requiredInput = uncheckedTrade.inputAmount;
    console.log('Required ETH:', {
      raw: requiredInput.quotient.toString(),
      formatted: ethers.formatEther(requiredInput.quotient.toString()),
      maxAllowed: ethers.formatEther(maxInput)
    });
    
    // Validate required input
    if (requiredInput.quotient.toString() === '0') {
      throw new Error('Required ETH amount is zero - something went wrong with the price calculation');
    }

    // Check if within max ETH spend
    if (BigInt(requiredInput.quotient.toString()) > maxInput) {
      throw new Error(
        `Price too high. Required: ${ethers.formatEther(requiredInput.quotient.toString())} ETH, ` +
        `Maximum: ${maxAmountIn} ETH`
      );
    }

    const priceImpact = new Percent(
      uncheckedTrade.priceImpact.numerator,
      uncheckedTrade.priceImpact.denominator
    );

    console.log('Price impact:', priceImpact.toFixed(2));
    
    const slippage = new Percent(
      Math.floor(parseFloat(slippageTolerance) * 100),
      10000
    );    // Calculate pool address
    const [token0, token1] = sortTokens(baseTokenIn, baseTokenOut);
    const poolAddress = ethers.getCreate2Address(
      UNISWAP_V3_FACTORY,
      ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint24'],
          [token0.address, token1.address, directPool.feeTier]
        )
      ),
      '0x0839c5a1e6e7e2c58e4458b4a5bc9aef12640add3521dc1a42937e2b1f7c4c15'
    );

    // Return the quote with validated data
    return {
      expectedOutput: requiredInput.quotient.toString(),
      minimumOutput: outputAmount.quotient.toString(),
      priceImpact: priceImpact.toFixed(2),
      fee: `${(directPool.feeTier / 10000).toFixed(2)}%`,
      route: [tokenInInfo.symbol, tokenOutInfo.symbol],
      swapData: {
        poolAddress,
        calldata: '', // Will be implemented when needed
        value: tokenInInfo.symbol === 'ETH' ? requiredInput.quotient.toString() : '0',
        to: UNIVERSAL_ROUTER
      }
    };
  }

  // If direct pool fails, try routing through WETH if no direct pool is found
  const wethToken = createToken(chainId, TOKEN_ADDRESSES.WETH, 18, 'WETH');
  
  console.log('No direct pool, trying route through WETH...');
  
  const poolFromWeth = await getBestPool(wethToken, baseTokenOut, outputAmount);
  if (!poolFromWeth) {
    throw new Error('No liquidity found for output token');
  }

  const wethNeeded = poolFromWeth.pool.token0Price.quote(outputAmount);
  const poolToWeth = await getBestPool(baseTokenIn, wethToken, wethNeeded);
  if (!poolToWeth) {
    throw new Error('No liquidity found for input token');
  }

  const route = new Route(
    [poolToWeth.pool, poolFromWeth.pool],
    baseTokenIn,
    baseTokenOut
  );

  const trade = await Trade.createUncheckedTrade({
    route,
    inputAmount: CurrencyAmount.fromRawAmount(baseTokenIn, '0'),
    outputAmount,
    tradeType: TradeType.EXACT_OUTPUT
  });

  const requiredInput = trade.inputAmount;

  // Check if within max spend
  if (BigInt(requiredInput.quotient.toString()) > maxInput) {
    const availableOutput = await getMaxOutputForInput(
      tokenIn,
      tokenOut,
      maxAmountIn
    );
    throw new Error(
      `Insufficient funds. With ${maxAmountIn} ${tokenInInfo.symbol} you can get approximately ` +
      `${availableOutput} ${tokenOutInfo.symbol}`
    );
  }

  const priceImpact = new Percent(
    trade.priceImpact.numerator,
    trade.priceImpact.denominator
  );

  const [token0, token1] = sortTokens(baseTokenIn, wethToken);
  const poolAddress = ethers.getCreate2Address(
    UNISWAP_V3_FACTORY,
    ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint24'],
        [token0.address, token1.address, poolToWeth.feeTier]
      )
    ),
    '0x0839c5a1e6e7e2c58e4458b4a5bc9aef12640add3521dc1a42937e2b1f7c4c15'
  );

  const totalFee = (
    (poolToWeth.feeTier + poolFromWeth.feeTier) / 10000
  ).toFixed(2);

  return {
    expectedOutput: amountOut,
    minimumOutput: outputAmount.toSignificant(6),
    priceImpact: priceImpact.toSignificant(2),
    fee: `${totalFee}%`,
    route: [tokenInInfo.symbol, 'WETH', tokenOutInfo.symbol],      swapData: {
      poolAddress,
      calldata: '', // Implement later if needed
      value: tokenInInfo.symbol === 'ETH' ? requiredInput.toSignificant(18) : '0',
      to: UNIVERSAL_ROUTER
    }
  };
}

// Helper function to get maximum output amount for a given input
async function getMaxOutputForInput(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<string> {
  try {
    const quote = await getSwapQuote(tokenIn, tokenOut, amountIn);
    return quote.expectedOutput;
  } catch (error) {
    console.error('Error getting max output:', error);
    return '0';
  }
}

// Get swap quote
export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  slippageTolerance = '0.5'
): Promise<SwapQuote>{
  if (!process.env.BASE_CHAIN_ID) {
    throw new Error('BASE_CHAIN_ID not configured');
  }
  const chainId = Number(process.env.BASE_CHAIN_ID);

  try {
    // Get token information
    const [tokenInInfo, tokenOutInfo] = await Promise.all([
      getTokenInfo(tokenIn),
      getTokenInfo(tokenOut)
    ]);

    // Create token instances
    const baseTokenIn = createToken(
      chainId,
      tokenInInfo.address,
      tokenInInfo.decimals,
      tokenInInfo.symbol
    );

    const baseTokenOut = createToken(
      chainId,
      tokenOutInfo.address,
      tokenOutInfo.decimals,
      tokenOutInfo.symbol
    );

    // Create input amount
    const inputAmount = CurrencyAmount.fromRawAmount(
      baseTokenIn,
      ethers.parseUnits(amountIn, tokenInInfo.decimals).toString()
    );

    // Try direct pool first
    const directPool = await getBestPool(baseTokenIn, baseTokenOut, inputAmount);
    
    if (directPool) {
      const route = new Route([directPool.pool], baseTokenIn, baseTokenOut);
      
      const trade = await Trade.createUncheckedTrade({
        route,
        inputAmount,
        outputAmount: CurrencyAmount.fromRawAmount(baseTokenOut, '0'),
        tradeType: TradeType.EXACT_INPUT
      });

      const expectedOutput = trade.outputAmount;
      const priceImpact = new Percent(
        trade.priceImpact.numerator,
        trade.priceImpact.denominator
      );
      
      const slippage = new Percent(
        Math.floor(parseFloat(slippageTolerance) * 100),
        10000
      );

      const minimumOutput = trade.minimumAmountOut(slippage);

      const [token0, token1] = sortTokens(baseTokenIn, baseTokenOut);
      const poolAddress = ethers.getCreate2Address(
        UNISWAP_V3_FACTORY,
        ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'address', 'uint24'],
            [token0.address, token1.address, directPool.feeTier]
          )
        ),
        '0x0839c5a1e6e7e2c58e4458b4a5bc9aef12640add3521dc1a42937e2b1f7c4c15'
      );      return {
        expectedOutput: expectedOutput.toSignificant(6),
        minimumOutput: minimumOutput.toSignificant(6),
        priceImpact: priceImpact.toSignificant(2),
        fee: `${(directPool.feeTier / 10000).toFixed(2)}%`,
        route: [tokenInInfo.symbol, tokenOutInfo.symbol],
        swapData: {
          poolAddress,
          calldata: '', // Implement later if needed
          value: tokenInInfo.symbol === 'ETH' ? amountIn : '0',
          to: UNIVERSAL_ROUTER
        }
      };
    }

    // If direct pool fails, try routing through WETH
    const wethToken = createToken(chainId, TOKEN_ADDRESSES.WETH, 18, 'WETH');
    
    console.log('No direct pool, trying route through WETH...');
    
    const poolToWeth = await getBestPool(baseTokenIn, wethToken, inputAmount);
    if (!poolToWeth) {
      throw new Error('No liquidity found for first hop of trade');
    }

    const wethAmount = poolToWeth.pool.token0Price.quote(inputAmount);
    const poolFromWeth = await getBestPool(wethToken, baseTokenOut, wethAmount);
    if (!poolFromWeth) {
      throw new Error('No liquidity found for second hop of trade');
    }

    const route = new Route(
      [poolToWeth.pool, poolFromWeth.pool],
      baseTokenIn,
      baseTokenOut
    );

    const trade = await Trade.createUncheckedTrade({
      route,
      inputAmount,
      outputAmount: CurrencyAmount.fromRawAmount(baseTokenOut, '0'),
      tradeType: TradeType.EXACT_INPUT
    });

    const expectedOutput = trade.outputAmount;
    const priceImpact = new Percent(
      trade.priceImpact.numerator,
      trade.priceImpact.denominator
    );

    const slippage = new Percent(
      Math.floor(parseFloat(slippageTolerance) * 100),
      10000
    );
    const minimumOutput = trade.minimumAmountOut(slippage);

    // For multi-hop routes, use the first pool's address
    const [token0, token1] = sortTokens(baseTokenIn, wethToken);
    const poolAddress = ethers.getCreate2Address(
      UNISWAP_V3_FACTORY,
      ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint24'],
          [token0.address, token1.address, poolToWeth.feeTier]
        )
      ),
      '0x0839c5a1e6e7e2c58e4458b4a5bc9aef12640add3521dc1a42937e2b1f7c4c15'
    );

    const totalFee = (
      (poolToWeth.feeTier + poolFromWeth.feeTier) / 10000
    ).toFixed(2);

    return {
      expectedOutput: expectedOutput.toSignificant(6),
      minimumOutput: minimumOutput.toSignificant(6),
      priceImpact: priceImpact.toSignificant(2),
      fee: `${totalFee}%`,
      route: [tokenInInfo.symbol, 'WETH', tokenOutInfo.symbol],      swapData: {
        poolAddress,
        calldata: '', // Implement later if needed
        value: tokenInInfo.symbol === 'ETH' ? amountIn : '0',
        to: UNIVERSAL_ROUTER
      }
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    throw error;
  }
}

// Validate token addresses on startup
function validateTokenAddresses() {
  try {
    // Verify each address is properly checksummed
    for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
      const checksummedAddress = ethers.getAddress(address);
      if (checksummedAddress !== address) {
        throw new Error(`Invalid checksum for ${symbol}: ${address}\nShould be: ${checksummedAddress}`);
      }
    }
    console.log('All token addresses validated successfully');
  } catch (error) {
    console.error('Token address validation failed:', error);
    process.exit(1);
  }
}

validateTokenAddresses();
