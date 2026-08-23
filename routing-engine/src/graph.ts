export interface DEXPool {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  zone: string; // e.g. "cyprus-1", "paxos-1"
}

export class LiquidityGraph {
  public pools: DEXPool[] = [];

  /**
   * Register a new liquidity pool inside the graph.
   */
  public registerPool(pool: DEXPool): void {
    // Normalize token addresses to lowercase
    const normalizedPool = {
      ...pool,
      token0: pool.token0.toLowerCase(),
      token1: pool.token1.toLowerCase(),
      pairAddress: pool.pairAddress.toLowerCase()
    };
    this.pools.push(normalizedPool);
  }

  /**
   * Get all pools that contain the given token.
   */
  public getPoolsForToken(token: string): DEXPool[] {
    const searchToken = token.toLowerCase();
    return this.pools.filter(
      (p) => p.token0 === searchToken || p.token1 === searchToken
    );
  }

  /**
   * Clears the graph.
   */
  public clear(): void {
    this.pools = [];
  }
}
