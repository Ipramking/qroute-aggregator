import { expect } from "chai";
import { quais } from "quais";
import { LiquidityGraph, LiquiditySyncer } from "../src";

describe("qroute-aggregator Liquidity Syncer", () => {
  let graph: LiquidityGraph;
  let syncer: LiquiditySyncer;
  let originalGetReserves: any;
  
  let mockReserves0 = 500n * (10n ** 18n);
  let mockReserves1 = 1000n * (10n ** 18n);

  before(() => {
    // Stub the getReserves prototype function on quais.Contract
    originalGetReserves = (quais.Contract.prototype as any).getReserves;
    (quais.Contract.prototype as any).getReserves = async function () {
      return [mockReserves0, mockReserves1, 12345n];
    };
  });

  after(() => {
    // Restore original function
    (quais.Contract.prototype as any).getReserves = originalGetReserves;
  });

  beforeEach(() => {
    graph = new LiquidityGraph();
    syncer = new LiquiditySyncer(graph);

    // Register a pool on Cyprus-1 with 0 reserves initially
    graph.registerPool({
      pairAddress: "0x1111111111111111111111111111111111111111",
      token0: "0x000000000000000000000000000000000000000A",
      token1: "0x000000000000000000000000000000000000000B",
      reserve0: 0n,
      reserve1: 0n,
      zone: "cyprus-1"
    });
  });

  afterEach(() => {
    syncer.stopPolling();
  });

  it("should sync reserves correctly from mock contract call", async () => {
    const pool = graph.pools[0];
    expect(pool.reserve0).to.equal(0n);
    expect(pool.reserve1).to.equal(0n);

    // Trigger sync
    await syncer.syncAll();

    expect(pool.reserve0).to.equal(500n * (10n ** 18n));
    expect(pool.reserve1).to.equal(1000n * (10n ** 18n));
  });

  it("should poll periodically in the background", async () => {
    const pool = graph.pools[0];
    expect(pool.reserve0).to.equal(0n);

    // Start polling with short interval (50ms)
    syncer.startPolling(50);

    // Wait a short duration for polling to fire
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(pool.reserve0).to.equal(500n * (10n ** 18n));
    expect(pool.reserve1).to.equal(1000n * (10n ** 18n));

    // Update mock values
    mockReserves0 = 750n * (10n ** 18n);

    // Wait for next polling tick
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pool.reserve0).to.equal(750n * (10n ** 18n));
  });
});
