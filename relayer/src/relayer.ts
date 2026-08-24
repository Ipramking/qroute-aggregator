import { quais } from "quais";

/** A cross-shard swap intent emitted by the source-shard router. */
export interface CrossShardIntent {
  originTxHash: string; // bytes32 origin tx hash (uniqueness anchor)
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  to: string;
  destinationShard: number;
  nonce: bigint;
}

export interface ShardConfig {
  zone: string;
  rpcUrl: string;
  router: string;
}

export interface RelayCall {
  messageId: string;
  router: string; // destination-shard router
  // onTokenBridgeReceived(messageId, tokenIn, tokenOut, amountIn, minAmountOut, to, deadline)
  args: [string, string, string, bigint, bigint, string, bigint];
}

const ROUTER_ABI = [
  "event LogExternalSwapPending(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, address to, uint256 destinationShard)",
  "function onTokenBridgeReceived(bytes32 messageId, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to, uint256 deadline) returns (uint256)",
];

/**
 * Deterministic, collision-resistant message id. The destination router uses it
 * as an idempotency key (replay protection), so the same intent always maps to
 * the same id and distinct intents never collide.
 */
export function deriveMessageId(intent: CrossShardIntent): string {
  return quais.solidityPackedKeccak256(
    ["bytes32", "address", "address", "uint256", "address", "uint256"],
    [intent.originTxHash, intent.tokenIn, intent.tokenOut, intent.amountIn, intent.to, intent.nonce]
  );
}

/**
 * Watches the source shard for cross-shard swap intents and submits the matching
 * `onTokenBridgeReceived` call on the destination shard as a whitelisted relayer.
 * Replay is guarded both locally and on-chain (per-message nonce).
 */
export class CrossShardRelayer {
  private processed = new Set<string>();

  constructor(
    private readonly source: ShardConfig,
    private readonly dest: ShardConfig,
    private readonly relayerKey?: string,
    private readonly deadlineSecs: number = 1200
  ) {}

  /** Pure mapping of an intent to the destination call (unit-testable). */
  public planRelay(intent: CrossShardIntent, minAmountOut: bigint = 0n): RelayCall {
    const messageId = deriveMessageId(intent);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + this.deadlineSecs);
    return {
      messageId,
      router: this.dest.router,
      args: [messageId, intent.tokenIn, intent.tokenOut, intent.amountIn, minAmountOut, intent.to, deadline],
    };
  }

  public alreadyProcessed(messageId: string): boolean {
    return this.processed.has(messageId);
  }

  /** Relay one intent. Dry-run (default when no relayer key) returns a plan id. */
  public async relay(
    intent: CrossShardIntent,
    opts: { dryRun?: boolean; minAmountOut?: bigint } = {}
  ): Promise<string> {
    const plan = this.planRelay(intent, opts.minAmountOut ?? 0n);
    if (this.processed.has(plan.messageId)) {
      throw new Error("Already relayed (replay guard)");
    }
    this.processed.add(plan.messageId);

    if (opts.dryRun || !this.relayerKey) {
      return `dryrun:relay:${plan.messageId}`;
    }

    const provider = new quais.JsonRpcProvider(this.dest.rpcUrl, undefined, { usePathing: true });
    const wallet = new quais.Wallet(this.relayerKey, provider);
    const router = new quais.Contract(this.dest.router, ROUTER_ABI, wallet);
    const tx = await router.onTokenBridgeReceived(...plan.args);
    await tx.wait();
    return tx.hash;
  }

  /** Subscribe to source-shard intents and relay them to the destination shard. */
  public async start(onRelay?: (id: string) => void, dryRun = true): Promise<void> {
    const provider = new quais.JsonRpcProvider(this.source.rpcUrl, undefined, { usePathing: true });
    const router = new quais.Contract(this.source.router, ROUTER_ABI, provider);
    let nonce = 0n;

    router.on(
      "LogExternalSwapPending",
      async (tokenIn: string, tokenOut: string, amountIn: any, to: string, destinationShard: any, event: any) => {
        try {
          const intent: CrossShardIntent = {
            originTxHash: event?.log?.transactionHash || quais.id(`${this.source.zone}:${nonce}`),
            tokenIn,
            tokenOut,
            amountIn: BigInt(amountIn.toString()),
            to,
            destinationShard: Number(destinationShard),
            nonce: nonce++,
          };
          const id = await this.relay(intent, { dryRun });
          onRelay?.(id);
        } catch (err) {
          console.error("Relay error:", err);
        }
      }
    );

    console.log(`Relayer watching ${this.source.zone} -> ${this.dest.zone} (dryRun=${dryRun})`);
  }
}
