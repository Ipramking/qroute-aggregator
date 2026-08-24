// Generates a fresh wallet whose address lands in the Cyprus-1 shard scope
// (prefix byte 0x00–0x1d), then writes it to contracts/.env (gitignored).
//
// Cyprus-1 is required because the Orchard faucet only funds Cyprus-1 addresses.
//
// Usage: node scripts/generate-wallet.js
const { quais } = require("quais");
const fs = require("fs");
const path = require("path");

function zoneOf(address) {
  const b = parseInt(address.slice(2, 4), 16);
  if (Number.isNaN(b)) return "unknown";
  if (b >= 0x00 && b <= 0x1d) return "cyprus-1";
  if (b >= 0x1e && b <= 0x3b) return "cyprus-2";
  if (b >= 0x3c && b <= 0x59) return "cyprus-3";
  if (b >= 0x5a && b <= 0x77) return "paxos-1";
  if (b >= 0x78 && b <= 0x95) return "paxos-2";
  if (b >= 0x96 && b <= 0xb3) return "paxos-3";
  if (b >= 0xb4 && b <= 0xd1) return "hydra-1";
  if (b >= 0xd2 && b <= 0xef) return "hydra-2";
  if (b >= 0xf0 && b <= 0xff) return "hydra-3";
  return "unknown";
}

function main() {
  const TARGET = "cyprus-1";
  const MAX_TRIES = 2_000_000;

  let wallet;
  let tries = 0;
  const started = Date.now();

  do {
    // quais alpha has no Wallet.createRandom(); grind from raw 32-byte keys.
    const pk = quais.hexlify(quais.randomBytes(32));
    wallet = new quais.Wallet(pk);
    tries++;
  } while (zoneOf(wallet.address) !== TARGET && tries < MAX_TRIES);

  if (zoneOf(wallet.address) !== TARGET) {
    console.error(`Failed to grind a ${TARGET} address after ${tries} tries.`);
    process.exit(1);
  }

  const envPath = path.join(__dirname, "..", ".env");
  const rpcUrl = "https://orchard.rpc.quai.network/cyprus1";
  const envBody =
    `# Auto-generated Cyprus-1 deployer wallet. DO NOT COMMIT (this file is gitignored).\n` +
    `PRIVATE_KEY=${wallet.privateKey}\n` +
    `RPC_URL=${rpcUrl}\n`;

  fs.writeFileSync(envPath, envBody, { encoding: "utf8" });

  // Intentionally print ONLY the public address — never the private key to stdout.
  console.log("Generated Cyprus-1 deployer wallet.");
  console.log(`  Address : ${wallet.address}`);
  console.log(`  Zone    : ${zoneOf(wallet.address)}`);
  console.log(`  Tries   : ${tries} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  console.log(`  Saved   : ${envPath} (PRIVATE_KEY + RPC_URL)`);
  console.log("");
  console.log("Next: fund this address with 5 testnet QUAI at");
  console.log("  https://orchard.faucet.quai.network  (X-auth, 1 claim / 24h)");
}

main();
