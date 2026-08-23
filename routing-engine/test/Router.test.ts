import { expect } from "chai";
import { LiquidityGraph, DEXRouter } from "../src";

describe("qroute-aggregator Routing Engine", () => {
  let graph: LiquidityGraph;
  let router: DEXRouter;

  const TOKEN_A = "0x000000000000000000000000000000000000000A";
  const TOKEN_B = "0x000000000000000000000000000000000000000B";

  beforeEach(() => {
    graph = new LiquidityGraph();
    router = new DEXRouter(graph);

    // Setup: Comparable Pools to demonstrate gas vs slippage trade-offs
    // Local Pool on Cyprus-1: 100,000 TK_A and 100,000 TK_B
    graph.registerPool({
      pairAddress: "0x1111111111111111111111111111111111111111",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 100000n * (10n ** 18n),
      reserve1: 100000n * (10n ** 18n),
      zone: "cyprus-1"
    });

    // External Pool on Paxos-1: 150,000 TK_A and 150,000 TK_B
    graph.registerPool({
      pairAddress: "0x2222222222222222222222222222222222222222",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 150000n * (10n ** 18n),
      reserve1: 150000n * (10n ** 18n),
      zone: "paxos-1"
    });
  });

  it("should select local routing for small trades because of low gas overhead", () => {
    const amountIn = 1n * (10n ** 17n); // 0.1 Token A (small trade)
    const route = router.findOptimalRoute(TOKEN_A, TOKEN_B, amountIn, "cyprus-1");

    expect(route.path.length).to.equal(1);
    expect(route.path[0].type).to.equal("LOCAL_SWAP");
    expect(route.path[0].fromZone).to.equal("cyprus-1");
  });

  it("should select cross-shard routing for large trades where slippage on local pool outweighs gas penalty", () => {
    // A very large trade (e.g. 100,000 TK_A) cannot be filled locally (reserve is 100k),
    // and will route cross-shard to the deeper external pool (reserve 150k).
    const amountIn = 100000n * (10n ** 18n);
    const route = router.findOptimalRoute(TOKEN_A, TOKEN_B, amountIn, "cyprus-1");

    // Must select the cross-shard route containing CROSS_SHARD_TRANSFER and CROSS_SHARD_SWAP
    expect(route.path.some(step => step.type === "CROSS_SHARD_SWAP")).to.be.true;
    expect(route.path.some(step => step.type === "CROSS_SHARD_TRANSFER")).to.be.true;
  });

  it("should evaluate and select a split path (local + external) if optimal", () => {
    // A medium trade of 30,000 TK_A is optimal to split: 15k local (on 100k) and 15k external (on 150k)
    // rather than running 30k entirely through either single pool.
    const amountIn = 30000n * (10n ** 18n);
    const route = router.findOptimalRoute(TOKEN_A, TOKEN_B, amountIn, "cyprus-1");
    
    // We expect a split route to have 4 steps (1 local swap leg + 3 cross-shard leg steps)
    expect(route.path.length).to.equal(4);
    expect(route.path[0].type).to.equal("LOCAL_SWAP");
    expect(route.path[1].type).to.equal("CROSS_SHARD_TRANSFER");
  });
});
