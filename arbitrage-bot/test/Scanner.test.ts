import { expect } from "chai";
import { LiquidityGraph } from "qroute-aggregator-routing-engine";
import { ArbitrageScanner } from "../src/scanner";
import { ArbitrageExecutor } from "../src/executor";

const A = "0x000000000000000000000000000000000000000A";
const B = "0x000000000000000000000000000000000000000B";
const E18 = 10n ** 18n;

// cheap-A pool on cyprus-1 vs expensive-A pool on paxos-1 => cross-shard arb.
function mispricedGraph(): LiquidityGraph {
  const g = new LiquidityGraph();
  g.registerPool({ pairAddress: "0x1", token0: A, token1: B, reserve0: 10000n * E18, reserve1: 15000n * E18, zone: "cyprus-1" });
  g.registerPool({ pairAddress: "0x2", token0: A, token1: B, reserve0: 10000n * E18, reserve1: 8000n * E18, zone: "paxos-1" });
  return g;
}

describe("ArbitrageScanner", () => {
  it("finds a profitable cross-shard opportunity for mispriced pools", () => {
    const opps = new ArbitrageScanner(mispricedGraph()).scan();
    expect(opps.length > 0).to.equal(true);
    expect(opps[0].netProfitWei > 0n).to.equal(true);
    expect(opps[0].sourcePool.zone).to.not.equal(opps[0].targetPool.zone);
  });

  it("returns null when pools are identically priced", () => {
    const g = new LiquidityGraph();
    g.registerPool({ pairAddress: "0x1", token0: A, token1: B, reserve0: 10000n * E18, reserve1: 10000n * E18, zone: "cyprus-1" });
    g.registerPool({ pairAddress: "0x2", token0: A, token1: B, reserve0: 10000n * E18, reserve1: 10000n * E18, zone: "paxos-1" });
    expect(new ArbitrageScanner(g).bestOpportunity()).to.equal(null);
  });

  it("ignores same-shard pool pairs", () => {
    const g = new LiquidityGraph();
    g.registerPool({ pairAddress: "0x1", token0: A, token1: B, reserve0: 10000n * E18, reserve1: 15000n * E18, zone: "cyprus-1" });
    g.registerPool({ pairAddress: "0x2", token0: A, token1: B, reserve0: 10000n * E18, reserve1: 8000n * E18, zone: "cyprus-1" });
    expect(new ArbitrageScanner(g).scan().length).to.equal(0);
  });
});

describe("ArbitrageExecutor (dry-run)", () => {
  it("builds a 4-step plan and returns a dry-run id for a profitable opp", async () => {
    const best = new ArbitrageScanner(mispricedGraph()).bestOpportunity();
    expect(best).to.not.equal(null);

    const executor = new ArbitrageExecutor("0xkey");
    const plan = executor.buildPlan(best!);
    expect(plan.steps.length).to.equal(4);
    expect(plan.netProfitWei).to.equal(best!.netProfitWei);

    const id = await executor.executeOpportunity(best!);
    expect(id.startsWith("dryrun:")).to.equal(true);
    expect(executor.executionCount).to.equal(1);
  });
});
