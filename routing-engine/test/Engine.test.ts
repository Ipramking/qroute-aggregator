import { expect } from "chai";
import {
  LiquidityGraph,
  DEXRouter,
  getRpcForZone,
  ORCHARD_TESTNET_RPCS,
} from "../src";

const A = "0x000000000000000000000000000000000000000A";
const B = "0x000000000000000000000000000000000000000B";
const C = "0x000000000000000000000000000000000000000C";
const E18 = 10n ** 18n;

describe("LiquidityGraph", () => {
  it("normalizes token/pair addresses to lowercase on register", () => {
    const g = new LiquidityGraph();
    g.registerPool({
      pairAddress: "0xABCDEF1111111111111111111111111111111111",
      token0: A,
      token1: B,
      reserve0: 1n,
      reserve1: 1n,
      zone: "cyprus-1",
    });
    const pool = g.pools[0];
    expect(pool.token0).to.equal(A.toLowerCase());
    expect(pool.token1).to.equal(B.toLowerCase());
    expect(pool.pairAddress).to.equal("0xabcdef1111111111111111111111111111111111");
  });

  it("returns pools containing a given token, and clears", () => {
    const g = new LiquidityGraph();
    g.registerPool({ pairAddress: "0x1", token0: A, token1: B, reserve0: 1n, reserve1: 1n, zone: "cyprus-1" });
    g.registerPool({ pairAddress: "0x2", token0: A, token1: C, reserve0: 1n, reserve1: 1n, zone: "paxos-1" });
    expect(g.getPoolsForToken(A).length).to.equal(2);
    expect(g.getPoolsForToken(B).length).to.equal(1);
    expect(g.getPoolsForToken(C).length).to.equal(1);
    g.clear();
    expect(g.pools.length).to.equal(0);
  });
});

describe("config.getRpcForZone", () => {
  it("has all 9 zones configured", () => {
    expect(Object.keys(ORCHARD_TESTNET_RPCS).length).to.equal(9);
  });

  it("resolves a known zone", () => {
    expect(getRpcForZone("cyprus-1")).to.contain("cyprus1");
  });

  it("prefers a custom RPC override", () => {
    expect(getRpcForZone("cyprus-1", { "cyprus-1": "http://localhost:8545" })).to.equal("http://localhost:8545");
  });

  it("throws for an unknown zone", () => {
    expect(() => getRpcForZone("atlantis-9")).to.throw(/No RPC configured/);
  });
});

describe("DEXRouter math", () => {
  const router = new DEXRouter(new LiquidityGraph());

  it("getAmountOut returns 0 for non-positive input or empty reserves", () => {
    expect(router.getAmountOut(0n, 100n, 100n)).to.equal(0n);
    expect(router.getAmountOut(-5n, 100n, 100n)).to.equal(0n);
    expect(router.getAmountOut(100n, 0n, 100n)).to.equal(0n);
    expect(router.getAmountOut(100n, 100n, 0n)).to.equal(0n);
  });

  it("getAmountOut charges the 0.3% pool fee (output < input on a 1:1 pool)", () => {
    const out = router.getAmountOut(1000n * E18, 100000n * E18, 100000n * E18);
    expect(out > 0n).to.equal(true);
    expect(out < 1000n * E18).to.equal(true);
  });

  it("calculatePoolSwap respects token direction", () => {
    const pool = {
      pairAddress: "0x1",
      token0: A,
      token1: B,
      reserve0: 100000n * E18, // A
      reserve1: 200000n * E18, // B
      zone: "cyprus-1",
    };
    const aIn = router.calculatePoolSwap(pool, A, 1000n * E18); // A->B, deeper out
    const bIn = router.calculatePoolSwap(pool, B, 1000n * E18); // B->A, shallower out
    expect(aIn > bIn).to.equal(true);
  });
});

describe("DEXRouter.findOptimalRoute edge cases", () => {
  let graph: LiquidityGraph;
  let router: DEXRouter;

  beforeEach(() => {
    graph = new LiquidityGraph();
    router = new DEXRouter(graph);
    graph.registerPool({
      pairAddress: "0x1",
      token0: A,
      token1: B,
      reserve0: 100000n * E18,
      reserve1: 100000n * E18,
      zone: "cyprus-1",
    });
  });

  it("throws when no pool exists for the pair", () => {
    expect(() => router.findOptimalRoute(A, C, 100n * E18, "cyprus-1")).to.throw(/No liquidity pools/);
  });

  it("routes the reverse direction (B -> A)", () => {
    const route = router.findOptimalRoute(B, A, 100n * E18, "cyprus-1");
    expect(route.expectedAmountOut > 0n).to.equal(true);
    expect(route.path[0].type).to.equal("LOCAL_SWAP");
  });

  it("deducts the protocol fee (net output below a fee-free quote)", () => {
    const amountIn = 1000n * E18;
    const route = router.findOptimalRoute(A, B, amountIn, "cyprus-1");
    const feeFree = router.getAmountOut(amountIn, 100000n * E18, 100000n * E18);
    // route applies protocol fee on top of the pool fee, so it must be strictly less
    expect(route.expectedAmountOut < feeFree).to.equal(true);
  });

  it("uses a single local pool when no external pool exists (no split)", () => {
    const route = router.findOptimalRoute(A, B, 5000n * E18, "cyprus-1");
    expect(route.path.length).to.equal(1);
    expect(route.path[0].type).to.equal("LOCAL_SWAP");
  });
});
