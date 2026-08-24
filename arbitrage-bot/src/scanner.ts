import { LiquidityGraph, DEXPool } from "qroute-aggregator-routing-engine";
import { ArbitrageCalculator, ArbitrageOpportunity } from "./arbitrage";

function samePair(a: DEXPool, b: DEXPool): boolean {
  const ka = [a.token0.toLowerCase(), a.token1.toLowerCase()].sort().join("/");
  const kb = [b.token0.toLowerCase(), b.token1.toLowerCase()].sort().join("/");
  return ka === kb;
}

/**
 * Drives the ArbitrageCalculator over a live liquidity graph (kept fresh by the
 * routing-engine's LiquiditySyncer) to surface cross-shard AEV opportunities.
 */
export class ArbitrageScanner {
  private calculator = new ArbitrageCalculator();

  constructor(private graph: LiquidityGraph) {}

  /** All profitable opportunities across shard pool-pairs, best net profit first. */
  public scan(gasPriceWei: bigint = 1_000_000_000n): ArbitrageOpportunity[] {
    const pools = this.graph.pools;
    const found: ArbitrageOpportunity[] = [];

    for (let i = 0; i < pools.length; i++) {
      for (let j = 0; j < pools.length; j++) {
        if (i === j) continue;
        const source = pools[i];
        const target = pools[j];
        // Only across different shards, same token pair.
        if (source.zone.toLowerCase() === target.zone.toLowerCase()) continue;
        if (!samePair(source, target)) continue;

        const opp = this.calculator.findOptimalOpportunity(source, target, source.token0, gasPriceWei);
        if (opp && opp.netProfitWei > 0n) found.push(opp);
      }
    }

    return found.sort((a, b) => (b.netProfitWei > a.netProfitWei ? 1 : b.netProfitWei < a.netProfitWei ? -1 : 0));
  }

  /** Highest net-profit opportunity, or null if none are profitable. */
  public bestOpportunity(gasPriceWei?: bigint): ArbitrageOpportunity | null {
    const opps = this.scan(gasPriceWei);
    return opps.length > 0 ? opps[0] : null;
  }
}
