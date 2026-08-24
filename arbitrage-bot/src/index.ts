import * as dotenv from "dotenv";
import { LiquidityGraph, LiquiditySyncer } from "qroute-aggregator-routing-engine";
import { ArbitrageCalculator } from "./arbitrage";
import { ArbitrageMonitor } from "./monitor";
import { ArbitrageExecutor } from "./executor";
import { ArbitrageScanner } from "./scanner";

dotenv.config();

export { ArbitrageCalculator, ArbitrageOpportunity } from "./arbitrage";
export { ArbitrageMonitor, SwapEvent } from "./monitor";
export { ArbitrageExecutor, ExecutionPlan } from "./executor";
export { ArbitrageScanner } from "./scanner";

const QI = "0x000000000000000000000000000000000000000A";
const USDC = "0x000000000000000000000000000000000000000B";

// Illustrative multi-shard pools for the dry-run loop (replace with live-synced
// reserves once the pools are deployed).
function demoGraph(): LiquidityGraph {
  const g = new LiquidityGraph();
  g.registerPool({ pairAddress: "0xc1", token0: QI, token1: USDC, reserve0: 100000n * 10n ** 18n, reserve1: 101000n * 10n ** 18n, zone: "cyprus-1" });
  g.registerPool({ pairAddress: "0xp1", token0: QI, token1: USDC, reserve0: 100000n * 10n ** 18n, reserve1: 98000n * 10n ** 18n, zone: "paxos-1" });
  return g;
}

async function main() {
  console.log("Starting qroute AEV Arbitrage Bot (dry-run)...");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("PRIVATE_KEY env variable is missing. Exiting.");
    process.exit(1);
  }

  const graph = demoGraph();
  const scanner = new ArbitrageScanner(graph);
  const executor = new ArbitrageExecutor(privateKey, process.env.ROUTER_ADDRESS, true);

  // When live, a LiquiditySyncer keeps `graph` reserves fresh across shards:
  const syncer = new LiquiditySyncer(graph);
  void syncer; // syncer.startPolling(5000) once RPCs/pools are real

  const scanOnce = async () => {
    const best = scanner.bestOpportunity();
    if (!best) {
      console.log("No profitable cross-shard AEV right now.");
      return;
    }
    const plan = executor.buildPlan(best);
    console.log(`Opportunity: net +${best.netProfitWei} wei across ${best.sourcePool.zone} -> ${best.targetPool.zone}`);
    plan.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    const id = await executor.executeOpportunity(best);
    console.log(`Executed (dry-run): ${id}`);
  };

  await scanOnce();
  setInterval(scanOnce, 15000);
}

if (require.main === module) {
  main().catch((err) => console.error("Error in AEV Bot main loop:", err));
}
