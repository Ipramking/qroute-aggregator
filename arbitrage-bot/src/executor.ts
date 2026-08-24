import { ArbitrageOpportunity } from "./arbitrage";

export interface ExecutionPlan {
  steps: string[];
  optimalAmountIn: bigint;
  expectedProfitWei: bigint;
  netProfitWei: bigint;
}

/**
 * Executes the cross-shard arbitrage sequence. Defaults to dry-run: it builds and
 * returns the concrete execution plan without broadcasting. Live execution (an
 * actual on-chain sequence via the router) is wired in Phase 3 once contracts are
 * deployed and the bot has a funded signer.
 */
export class ArbitrageExecutor {
  public executionCount = 0;

  constructor(
    private readonly privateKey: string,
    private readonly routerAddress?: string,
    private readonly dryRun: boolean = true
  ) {}

  /** Human-readable, ordered plan for an opportunity. */
  public buildPlan(op: ArbitrageOpportunity): ExecutionPlan {
    return {
      steps: [
        `swap ${op.optimalAmountIn} ${op.tokenIn} -> ${op.tokenOut} on ${op.sourcePool.zone}`,
        `bridge ${op.tokenOut}: ${op.sourcePool.zone} -> ${op.targetPool.zone}`,
        `swap ${op.tokenOut} -> ${op.tokenIn} on ${op.targetPool.zone}`,
        `bridge proceeds back to ${op.sourcePool.zone}`,
      ],
      optimalAmountIn: op.optimalAmountIn,
      expectedProfitWei: op.expectedProfit,
      netProfitWei: op.netProfitWei,
    };
  }

  /**
   * Execute an opportunity. Returns a tx-hash-like identifier.
   * @param signer optional live signer (quais.Wallet). Required for non-dry-run.
   */
  public async executeOpportunity(op: ArbitrageOpportunity, signer?: any): Promise<string> {
    if (op.netProfitWei <= 0n) {
      throw new Error("Cannot execute unprofitable opportunity");
    }

    const plan = this.buildPlan(op);
    this.executionCount++;

    if (this.dryRun || !signer || !this.routerAddress) {
      // Deterministic dry-run identifier (no broadcast).
      return `dryrun:${plan.steps.length}:${op.netProfitWei.toString()}`;
    }

    // Live path is intentionally gated until Phase 3 (needs funded signer +
    // deployed router + native cross-shard settlement).
    throw new Error("Live AEV execution requires a funded signer and deployed router (Phase 3).");
  }
}
