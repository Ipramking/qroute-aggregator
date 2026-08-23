import { DEXPool } from "qroute-aggregator-routing-engine";

export interface ArbitrageOpportunity {
  tokenIn: string;
  tokenOut: string;
  sourcePool: DEXPool; // Pool we buy from (cheaper)
  targetPool: DEXPool; // Pool we sell to (more expensive)
  optimalAmountIn: bigint;
  expectedProfit: bigint;
  gasCostWei: bigint;
  netProfitWei: bigint;
}

export class ArbitrageCalculator {
  public protocolFeeBips: bigint = 10n; // 0.1% protocol fee
  public localSwapGas: bigint = 150000n;
  public crossShardGasPenalty: bigint = 50000n;

  /**
   * Helper: Uniswap V2 constant product output formula
   */
  public getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
    if (amountIn <= 0n) return 0n;
    if (reserveIn <= 0n || reserveOut <= 0n) return 0n;
    
    // Deduct 0.3% pool fee
    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    return numerator / denominator;
  }

  /**
   * Simulates the entire arbitrage loop for a given input size:
   * 1. Swap tokenIn -> tokenOut on source pool.
   * 2. Deduct protocol fees (0.1%).
   * 3. Swap tokenOut -> tokenIn on target pool.
   */
  public simulateArbitrage(
    amountIn: bigint,
    source: DEXPool,
    target: DEXPool,
    tokenIn: string
  ): bigint {
    const isToken0Source = source.token0.toLowerCase() === tokenIn.toLowerCase();
    
    // Step 1: Swap tokenIn -> tokenOut on source pool
    const [srcReserveIn, srcReserveOut] = isToken0Source
      ? [source.reserve0, source.reserve1]
      : [source.reserve1, source.reserve0];

    const intermediateAmount = this.getAmountOut(amountIn, srcReserveIn, srcReserveOut);
    if (intermediateAmount <= 0n) return 0n;

    // Deduct protocol routing fee (0.1%)
    const fee = (intermediateAmount * this.protocolFeeBips) / 10000n;
    const intermediateAfterFee = intermediateAmount - fee;

    // Step 2: Swap tokenOut -> tokenIn on target pool
    const isToken0Target = target.token0.toLowerCase() === tokenIn.toLowerCase();
    // For target pool, the input is tokenOut, and the output is tokenIn
    const [tgtReserveIn, tgtReserveOut] = isToken0Target
      ? [target.reserve1, target.reserve0] // tokenOut is token1, tokenIn is token0
      : [target.reserve0, target.reserve1]; // tokenOut is token0, tokenIn is token1

    return this.getAmountOut(intermediateAfterFee, tgtReserveIn, tgtReserveOut);
  }

  /**
   * Finds the optimal input amount using binary search.
   */
  public findOptimalOpportunity(
    source: DEXPool,
    target: DEXPool,
    tokenIn: string,
    gasPriceWei: bigint = 1000000000n // 1 gwei
  ): ArbitrageOpportunity | null {
    const isToken0 = source.token0.toLowerCase() === tokenIn.toLowerCase();
    const tokenOut = isToken0 ? source.token1 : source.token0;
    
    // Bounds for binary search: maximum swap size is a fraction of the reserves
    const srcReserveIn = isToken0 ? source.reserve0 : source.reserve1;
    let low = 0n;
    let high = srcReserveIn / 3n; // swap at most 33% of pool depth to prevent extreme price impact
    let optimalAmountIn = 0n;
    let maxProfit = 0n;

    // Binary search over 30 iterations for high precision
    for (let i = 0; i < 30; i++) {
      const mid1 = low + (high - low) / 3n;
      const mid2 = high - (high - low) / 3n;

      if (mid1 >= mid2) break;

      const out1 = this.simulateArbitrage(mid1, source, target, tokenIn);
      const out2 = this.simulateArbitrage(mid2, source, target, tokenIn);

      const profit1 = out1 - mid1;
      const profit2 = out2 - mid2;

      if (profit1 > profit2) {
        if (profit1 > maxProfit) {
          maxProfit = profit1;
          optimalAmountIn = mid1;
        }
        high = mid2;
      } else {
        if (profit2 > maxProfit) {
          maxProfit = profit2;
          optimalAmountIn = mid2;
        }
        low = mid1;
      }
    }

    if (maxProfit <= 0n) return null;

    // Gas cost: 2 swaps + 2 cross-shard transfers
    const totalGas = (this.localSwapGas * 2n) + (this.crossShardGasPenalty * 2n);
    const gasCostWei = totalGas * gasPriceWei;
    const netProfitWei = maxProfit - gasCostWei;

    return {
      tokenIn,
      tokenOut,
      sourcePool: source,
      targetPool: target,
      optimalAmountIn,
      expectedProfit: maxProfit,
      gasCostWei,
      netProfitWei
    };
  }
}
