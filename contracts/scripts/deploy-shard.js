// Deploy the qroute stack to a SINGLE shard, parameterized by env — used to bring
// up a second shard (e.g. paxos-1) for real cross-shard settlement.
//
// Env:
//   PRIVATE_KEY       funded deployer whose address is in the target shard's scope
//   SHARD_ZONE        e.g. "paxos-1"
//   RPC_URL           that shard's RPC (e.g. https://orchard.rpc.quai.network/paxos1)
//   RELAYER_ADDRESS   (optional) whitelisted on the router for onTokenBridgeReceived
//
// Writes contracts/deployments/<zone>.json. Run once per shard.

const { quais } = require("quais");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ARTIFACTS = path.join(__dirname, "..", "artifacts", "contracts");

function loadArtifact(name) {
  const p = path.join(ARTIFACTS, `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`Artifact ${name} not found. Run 'npx hardhat compile'.`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function deploy(name, wallet, ...args) {
  const a = loadArtifact(name);
  const f = new quais.ContractFactory(a.abi, a.bytecode, wallet);
  console.log(`Deploying ${name} ...`);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  ${name} -> ${addr}`);
  return c;
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const zone = process.env.SHARD_ZONE || "paxos-1";
  const rpcUrl = process.env.RPC_URL;
  const relayerAddress = process.env.RELAYER_ADDRESS;

  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("Missing/invalid PRIVATE_KEY.");
  if (!rpcUrl) throw new Error("Missing RPC_URL for the target shard.");

  const provider = new quais.JsonRpcProvider(rpcUrl, undefined, { usePathing: true });
  const wallet = new quais.Wallet(privateKey, provider);
  const deployer = await wallet.getAddress();
  console.log(`Shard: ${zone}\nDeployer: ${deployer}\nRPC: ${rpcUrl}`);

  const balance = await provider.getBalance(deployer);
  console.log("Balance:", quais.formatQuai(balance), "QUAI");
  if (balance === 0n) throw new Error(`Deployer has 0 QUAI on ${zone}. Fund it first.`);

  const qi = await deploy("TestToken", wallet, "Quai Test QI", "QI");
  const usdc = await deploy("TestToken", wallet, "Quai Test USDC", "USDC");
  const qiAddr = await qi.getAddress();
  const usdcAddr = await usdc.getAddress();
  const [token0, token1] = BigInt(qiAddr) < BigInt(usdcAddr) ? [qiAddr, usdcAddr] : [usdcAddr, qiAddr];

  const pair = await deploy("QRoutePair", wallet, token0, token1);
  const pairAddr = await pair.getAddress();

  const registry = await deploy("QRouteRegistry", wallet);
  await (await registry.registerPair(qiAddr, usdcAddr, pairAddr)).wait();

  const router = await deploy("QRouteRouter", wallet, await registry.getAddress(), deployer);
  const routerAddr = await router.getAddress();

  // Whitelist the relayer so it can call onTokenBridgeReceived on this shard.
  if (relayerAddress) {
    await (await router.setRelayer(relayerAddress, true)).wait();
    console.log("Whitelisted relayer:", relayerAddress);
  }

  // Seed liquidity.
  const seed = 100_000n * 10n ** 18n;
  await (await qi.mint(deployer, seed)).wait();
  await (await usdc.mint(deployer, seed)).wait();
  await (await qi.transfer(pairAddr, seed)).wait();
  await (await usdc.transfer(pairAddr, seed)).wait();
  await (await pair.mint(deployer)).wait();

  const out = {
    zone,
    deployer,
    rpcUrl,
    router: routerAddr,
    registry: await registry.getAddress(),
    dexPair: pairAddr,
    qiToken: qiAddr,
    usdcToken: usdcAddr,
    relayer: relayerAddress || null,
    timestamp: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${zone}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Wrote", file);
  console.log("Done. Configure the relayer with this shard's router as SOURCE/DEST.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Shard deploy failed:", err);
    process.exit(1);
  });
