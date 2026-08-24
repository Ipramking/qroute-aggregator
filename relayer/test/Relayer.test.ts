import { expect } from "chai";
import { CrossShardRelayer, deriveMessageId, CrossShardIntent, ShardConfig } from "../src/relayer";

const E18 = 10n ** 18n;
const source: ShardConfig = { zone: "cyprus-1", rpcUrl: "http://x", router: "0x00000000000000000000000000000000000000a1" };
const dest: ShardConfig = { zone: "paxos-1", rpcUrl: "http://y", router: "0x00000000000000000000000000000000000000b2" };

function intent(overrides: Partial<CrossShardIntent> = {}): CrossShardIntent {
  return {
    originTxHash: "0x" + "11".repeat(32),
    tokenIn: "0x000000000000000000000000000000000000000A",
    tokenOut: "0x000000000000000000000000000000000000000B",
    amountIn: 100n * E18,
    to: "0x000000000000000000000000000000000000dEaD",
    destinationShard: 6,
    nonce: 0n,
    ...overrides,
  };
}

describe("deriveMessageId", () => {
  it("is deterministic for the same intent", () => {
    expect(deriveMessageId(intent())).to.equal(deriveMessageId(intent()));
  });

  it("is unique across differing nonces / amounts", () => {
    expect(deriveMessageId(intent({ nonce: 0n }))).to.not.equal(deriveMessageId(intent({ nonce: 1n })));
    expect(deriveMessageId(intent({ amountIn: 100n * E18 }))).to.not.equal(
      deriveMessageId(intent({ amountIn: 101n * E18 }))
    );
  });

  it("produces a 32-byte hash", () => {
    expect(deriveMessageId(intent())).to.match(/^0x[0-9a-f]{64}$/);
  });
});

describe("CrossShardRelayer.planRelay", () => {
  it("maps an intent to the destination onTokenBridgeReceived args", () => {
    const relayer = new CrossShardRelayer(source, dest);
    const plan = relayer.planRelay(intent(), 5n * E18);
    expect(plan.router).to.equal(dest.router);
    expect(plan.args[0]).to.equal(deriveMessageId(intent())); // messageId
    expect(plan.args[1]).to.equal(intent().tokenIn);
    expect(plan.args[3]).to.equal(100n * E18); // amountIn
    expect(plan.args[4]).to.equal(5n * E18); // minAmountOut
    expect(plan.args[6] > BigInt(Math.floor(Date.now() / 1000))).to.equal(true); // future deadline
  });
});

describe("CrossShardRelayer.relay (dry-run + replay guard)", () => {
  it("returns a dry-run id and blocks replays of the same intent", async () => {
    const relayer = new CrossShardRelayer(source, dest);
    const id = await relayer.relay(intent(), { dryRun: true });
    expect(id.startsWith("dryrun:relay:0x")).to.equal(true);
    expect(relayer.alreadyProcessed(deriveMessageId(intent()))).to.equal(true);

    let threw = false;
    try {
      await relayer.relay(intent(), { dryRun: true });
    } catch (e: any) {
      threw = true;
      expect(e.message).to.contain("replay");
    }
    expect(threw).to.equal(true);
  });

  it("relays distinct intents independently", async () => {
    const relayer = new CrossShardRelayer(source, dest);
    const a = await relayer.relay(intent({ nonce: 0n }), { dryRun: true });
    const b = await relayer.relay(intent({ nonce: 1n }), { dryRun: true });
    expect(a).to.not.equal(b);
  });
});
