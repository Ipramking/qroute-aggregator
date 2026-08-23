import { expect } from "chai";
import { DEXPool } from "qroute-aggregator-routing-engine";
import { ArbitrageCalculator } from "../src/arbitrage";
import { ArbitrageExecutor } from "../src/executor";

describe("qroute-aggregator AEV Arbitrage Bot", () => {
  let calculator: ArbitrageCalculator;
  let executor: ArbitrageExecutor;

  const TOKEN_A = "0x000000000000000000000000000000000000000A";
  const TOKEN_B = "0x000000000000000000000000000000000000000B";

  beforeEach(() => {
    calculator = new ArbitrageCalculator();
    executor = new ArbitrageExecutor("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
  });

  it("should calculate optimal input size and expected profit correctly", () => {
    // Setup a classic arbitrage opportunity:
    // Pool A (Cheap): 10,000 TOKEN_A and 15,000 TOKEN_B (Ratio 1 A = 1.5 B)
    const cheapPool: DEXPool = {
      pairAddress: "0x1111111111111111111111111111111111111111",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 10000n * (10n ** 18n),
      reserve1: 15000n * (10n ** 18n),
      zone: "cyprus-1"
    };

    // Pool B (Expensive): 10,000 TOKEN_A and 8,000 TOKEN_B (Ratio 1 A = 0.8 B)
    // If we swap A -> B on Cheap Pool, and B -> A on Expensive Pool, we extract profit!
    const expensivePool: DEXPool = {
      pairAddress: "0x2222222222222222222222222222222222222222",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 10000n * (10n ** 18n),
      reserve1: 8000n * (10n ** 18n),
      zone: "paxos-1"
    };

    const opportunity = calculator.findOptimalOpportunity(cheapPool, expensivePool, TOKEN_A);

    expect(opportunity).to.not.be.null;
    expect(opportunity!.optimalAmountIn > 0n).to.be.true;
    expect(opportunity!.expectedProfit > 0n).to.be.true;
    
    // Profit must be substantial enough to cover the cross-shard gas costs
    expect(opportunity!.netProfitWei > 0n).to.be.true;
  });

  it("should skip unprofitable arbitrage opportunities", () => {
    // Both pools are identical, so no price spread exists
    const poolA: DEXPool = {
      pairAddress: "0x1111111111111111111111111111111111111111",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 10000n * (10n ** 18n),
      reserve1: 10000n * (10n ** 18n),
      zone: "cyprus-1"
    };

    const poolB: DEXPool = {
      pairAddress: "0x2222222222222222222222222222222222222222",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 10000n * (10n ** 18n),
      reserve1: 10000n * (10n ** 18n),
      zone: "paxos-1"
    };

    const opportunity = calculator.findOptimalOpportunity(poolA, poolB, TOKEN_A);
    expect(opportunity).to.be.null;
  });

  it("should enforce gas thresholds during execution", async () => {
    // Setup a 2% arbitrage opportunity (which covers pool fees)
    const cheapPool: DEXPool = {
      pairAddress: "0x1111111111111111111111111111111111111111",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 10000n * (10n ** 18n),
      reserve1: 10200n * (10n ** 18n), // 2% price difference
      zone: "cyprus-1"
    };

    const expensivePool: DEXPool = {
      pairAddress: "0x2222222222222222222222222222222222222222",
      token0: TOKEN_A,
      token1: TOKEN_B,
      reserve0: 10000n * (10n ** 18n),
      reserve1: 10000n * (10n ** 18n),
      zone: "paxos-1"
    };

    // Pass a very high gas price of 2000 gwei to ensure gas cost exceeds profit
    const opportunity = calculator.findOptimalOpportunity(cheapPool, expensivePool, TOKEN_A, 2000000000000n);
    
    // Opportunity is identified mathematically, but netProfitWei is negative
    expect(opportunity).to.not.be.null;
    expect(opportunity!.netProfitWei < 0n).to.be.true;

    // Executor must throw an error when attempting to run this opportunity
    try {
      await executor.executeOpportunity(opportunity!);
      expect.fail("Executor did not block unprofitable trade");
    } catch (err: any) {
      expect(err.message).to.equal("Cannot execute unprofitable opportunity");
    }
  });

  describe("Mempool Arbitrage Forecasting", () => {
    it("should forecast pool reserve changes post-swap correctly", () => {
      const initialPool: DEXPool = {
        pairAddress: "0x1111111111111111111111111111111111111111",
        token0: TOKEN_A,
        token1: TOKEN_B,
        reserve0: 10000n * (10n ** 18n),
        reserve1: 10000n * (10n ** 18n),
        zone: "cyprus-1"
      };

      // Swap 100 TOKEN_A into pool
      const forecastPool = calculator.forecastPoolReserves(initialPool, TOKEN_A, 100n * (10n ** 18n));

      expect(forecastPool.reserve0).to.equal(initialPool.reserve0 + 100n * (10n ** 18n));
      expect(forecastPool.reserve1 < initialPool.reserve1).to.be.true;
    });

    it("should register mempool listeners and simulate receipt of pending transactions", (done) => {
      const initialPool: DEXPool = {
        pairAddress: "0x1111111111111111111111111111111111111111",
        token0: TOKEN_A,
        token1: TOKEN_B,
        reserve0: 10000n * (10n ** 18n),
        reserve1: 10000n * (10n ** 18n),
        zone: "cyprus-1"
      };

      const monitor = new (require("../src/monitor").ArbitrageMonitor)([initialPool]);
      
      monitor.onPendingSwapDetected((pendingTx: any) => {
        expect(pendingTx.txHash).to.equal("0x12345");
        expect(pendingTx.amountIn > 0n).to.be.true;
        done();
      });

      monitor.triggerPendingSwap({
        txHash: "0x12345",
        poolAddress: initialPool.pairAddress,
        tokenIn: TOKEN_A,
        amountIn: 100n * (10n ** 18n),
        gasPrice: 1000000000n,
        zone: "cyprus-1"
      });
    });
  });
});
