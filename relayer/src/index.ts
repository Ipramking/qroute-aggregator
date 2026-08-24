import * as dotenv from "dotenv";
import { CrossShardRelayer, ShardConfig } from "./relayer";

dotenv.config();

export { CrossShardRelayer, deriveMessageId } from "./relayer";
export type { CrossShardIntent, ShardConfig, RelayCall } from "./relayer";

async function main() {
  const source: ShardConfig = {
    zone: process.env.SOURCE_ZONE || "cyprus-1",
    rpcUrl: process.env.SOURCE_RPC || "https://orchard.rpc.quai.network/cyprus1",
    router: process.env.SOURCE_ROUTER || "",
  };
  const dest: ShardConfig = {
    zone: process.env.DEST_ZONE || "paxos-1",
    rpcUrl: process.env.DEST_RPC || "https://orchard.rpc.quai.network/paxos1",
    router: process.env.DEST_ROUTER || "",
  };
  const relayerKey = process.env.RELAYER_KEY;
  const dryRun = !relayerKey || !source.router || !dest.router;

  if (dryRun) {
    console.log("Relayer starting in DRY-RUN (set SOURCE_ROUTER/DEST_ROUTER/RELAYER_KEY for live).");
  }

  const relayer = new CrossShardRelayer(source, dest, relayerKey);
  await relayer.start((id) => console.log("Relayed:", id), dryRun);

  setInterval(() => {}, 1 << 30); // keep alive
}

if (require.main === module) {
  main().catch((err) => console.error("Relayer main error:", err));
}
