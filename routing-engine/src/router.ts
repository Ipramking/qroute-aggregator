import { LiquidityGraph, DEXPool } from "./graph";

export interface SwapRouteStep {
  type: "LOCAL_SWAP" | "CROSS_SHARD_TRANSFER" | "CROSS_SHARD_SWAP";
  fromZone: string;
  toZone: string;
  tokenIn: string;
  tokenOut: string;
  pairAddress?: string;
  amountIn: bigint;
  expectedAmountOut: bigint;
  estimatedGas: bigint;
}

export interface OptimizedRoute {
  path: SwapRouteStep[];
  amountIn: bigint;
  expectedAmountOut: bigint;
  totalGasCost: bigint;
  netOutput: bigint; // expectedAmountOut minus gas cost (denominated in target token or native QUAI equivalent)
}

export class DEXRouter {
  private graph: LiquidityGraph;
  
  // Custom fee configuration
  public protocolFeeBips: bigint = 10n; // 0.1% protocol fee
  public crossShardGasPenalty: bigint = 50000n; // gas penalty for a cross-shard transfer
  public localSwapGas: bigint = 150000n; // gas cost for a local swap

  constructor(graph: LiquidityGraph) {
    this.graph = graph;
  }

  /**
   * Helper: Calculates standard constant product output (Uniswap V2)
   */
  public getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
    if (amountIn <= 0n) return 0n;
    if (reserveIn <= 0n || reserveOut <= 0n) return 0n;

    // Deduct 0.3% pool fee (Uniswap V2 model)
    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    return numerator / denominator;
  }

  /**
   * Calculates the output of swapping a token in a specific pool
   */
  public calculatePoolSwap(pool: DEXPool, tokenIn: string, amountIn: bigint): bigint {
    // Normalize tokenIn
    const normalizedIn = tokenIn.toLowerCase();
    const isToken0 = pool.token0.toLowerCase() === normalizedIn;
    
    const [reserveIn, reserveOut] = isToken0 
      ? [pool.reserve0, pool.reserve1] 
      : [pool.reserve1, pool.reserve0];

    return this.getAmountOut(amountIn, reserveIn, reserveOut);
  }

  /**
   * Find the optimal swap path across all shards.
   */
  public findOptimalRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    originZone: string,
    gasPriceWei: bigint = 1000000000n // Default 1 gwei
  ): OptimizedRoute {
    const tIn = tokenIn.toLowerCase();
    const tOut = tokenOut.toLowerCase();
    
    // Deduct protocol fee (0.1%)
    const feeAmount = (amountIn * this.protocolFeeBips) / 10000n;
    const swapAmount = amountIn - feeAmount;

    // Retrieve all pools containing both tokenIn and tokenOut
    const candidatePools = this.graph.pools.filter(
      (p) => 
        (p.token0 === tIn && p.token1 === tOut) || 
        (p.token0 === tOut && p.token1 === tIn)
    );

    if (candidatePools.length === 0) {
      throw new Error("No liquidity pools found for the token pair.");
    }

    let bestRoute: OptimizedRoute | null = null;

    // Evaluate each candidate pool (representing swaps on different shards)
    for (const pool of candidatePools) {
      const poolZone = pool.zone.toLowerCase();
      const isLocal = poolZone === originZone.toLowerCase();

      let expectedOut = 0n;
      let totalGas = 0n;
      let pathSteps: SwapRouteStep[] = [];

      if (isLocal) {
        // Option 1: Direct Local Swap on origin shard
        expectedOut = this.calculatePoolSwap(pool, tIn, swapAmount);
        totalGas = this.localSwapGas;
        
        pathSteps.push({
          type: "LOCAL_SWAP",
          fromZone: originZone,
          toZone: originZone,
          tokenIn: tIn,
          tokenOut: tOut,
          pairAddress: pool.pairAddress,
          amountIn: swapAmount,
          expectedAmountOut: expectedOut,
          estimatedGas: totalGas
        });
      } else {
        // Option 2: Cross-Shard Swap on another shard (requires transfer to B, swap, transfer back)
        expectedOut = this.calculatePoolSwap(pool, tIn, swapAmount);
        
        // Total gas = 1 local swap + 2 cross-shard transfers
        totalGas = this.localSwapGas + (this.crossShardGasPenalty * 2n);

        pathSteps.push({
          type: "CROSS_SHARD_TRANSFER",
          fromZone: originZone,
          toZone: poolZone,
          tokenIn: tIn,
          tokenOut: tIn,
          amountIn: swapAmount,
          expectedAmountOut: swapAmount,
          estimatedGas: this.crossShardGasPenalty
        });

        pathSteps.push({
          type: "CROSS_SHARD_SWAP",
          fromZone: poolZone,
          toZone: poolZone,
          tokenIn: tIn,
          tokenOut: tOut,
          pairAddress: pool.pairAddress,
          amountIn: swapAmount,
          expectedAmountOut: expectedOut,
          estimatedGas: this.localSwapGas
        });

        pathSteps.push({
          type: "CROSS_SHARD_TRANSFER",
          fromZone: poolZone,
          toZone: originZone,
          tokenIn: tOut,
          tokenOut: tOut,
          amountIn: expectedOut,
          expectedAmountOut: expectedOut,
          estimatedGas: this.crossShardGasPenalty
        });
      }

      // Convert gas to Wei to compute net output
      const gasCostWei = totalGas * gasPriceWei;
      const netOutput = expectedOut - gasCostWei; // simplified normalization

      const route: OptimizedRoute = {
        path: pathSteps,
        amountIn,
        expectedAmountOut: expectedOut,
        totalGasCost: totalGas,
        netOutput
      };

      if (!bestRoute || route.netOutput > bestRoute.netOutput) {
        bestRoute = route;
      }
    }

    // Evaluate Option 3: Split routing across pools (e.g. 50/50 split)
    // If there is a local pool and a deep cross-shard pool, splitting can yield higher output
    const localPool = candidatePools.find(p => p.zone.toLowerCase() === originZone.toLowerCase());
    const externalPool = candidatePools.find(p => p.zone.toLowerCase() !== originZone.toLowerCase());

    if (localPool && externalPool) {
      // Test a 50/50 split
      const splitAmount = swapAmount / 2n;

      const localOut = this.calculatePoolSwap(localPool, tIn, splitAmount);
      const externalOut = this.calculatePoolSwap(externalPool, tIn, splitAmount);
      const totalSplitOut = localOut + externalOut;

      // Gas: 1 local swap + (1 cross-shard transfer + 1 remote swap + 1 cross-shard transfer)
      const totalSplitGas = (this.localSwapGas * 2n) + (this.crossShardGasPenalty * 2n);
      const gasCostWei = totalSplitGas * gasPriceWei;
      const netOutput = totalSplitOut - gasCostWei;

      if (bestRoute && netOutput > bestRoute.netOutput) {
        const splitSteps: SwapRouteStep[] = [
          // Local Swap leg
          {
            type: "LOCAL_SWAP",
            fromZone: originZone,
            toZone: originZone,
            tokenIn: tIn,
            tokenOut: tOut,
            pairAddress: localPool.pairAddress,
            amountIn: splitAmount,
            expectedAmountOut: localOut,
            estimatedGas: this.localSwapGas
          },
          // Cross-Shard leg
          {
            type: "CROSS_SHARD_TRANSFER",
            fromZone: originZone,
            toZone: externalPool.zone,
            tokenIn: tIn,
            tokenOut: tIn,
            amountIn: splitAmount,
            expectedAmountOut: splitAmount,
            estimatedGas: this.crossShardGasPenalty
          },
          {
            type: "CROSS_SHARD_SWAP",
            fromZone: externalPool.zone,
            toZone: externalPool.zone,
            tokenIn: tIn,
            tokenOut: tOut,
            pairAddress: externalPool.pairAddress,
            amountIn: splitAmount,
            expectedAmountOut: externalOut,
            estimatedGas: this.localSwapGas
          },
          {
            type: "CROSS_SHARD_TRANSFER",
            fromZone: externalPool.zone,
            toZone: originZone,
            tokenIn: tOut,
            tokenOut: tOut,
            amountIn: externalOut,
            expectedAmountOut: externalOut,
            estimatedGas: this.crossShardGasPenalty
          }
        ];

        bestRoute = {
          path: splitSteps,
          amountIn,
          expectedAmountOut: totalSplitOut,
          totalGasCost: totalSplitGas,
          netOutput
        };
      }
    }

    if (!bestRoute) {
      throw new Error("Unable to calculate a valid route.");
    }

    return bestRoute;
  }
}
