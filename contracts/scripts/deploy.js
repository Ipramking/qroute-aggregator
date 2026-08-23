// Real deployment to Quai Orchard (Cyprus-1) using the quais SDK.
//
// Prereqs:
//   1. `npx hardhat compile`  (produces artifacts/)
//   2. contracts/.env with PRIVATE_KEY (a funded Cyprus-1 wallet) + RPC_URL
//      -> generate one with: node scripts/generate-wallet.js
//      -> fund it at https://orchard.faucet.quai.network
//
// Run: node scripts/deploy.js
//
// NOTE (Quai): contract addresses must land in the deployer's shard scope.
// We deploy each contract directly from a Cyprus-1 EOA (no in-contract CREATE2),
// which quais handles. If a deploy reverts with an out-of-scope address error,
// that is the known Quai grinding constraint — retry or use a salted deploy.

const { quais } = require("quais");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ARTIFACTS = path.join(__dirname, "..", "artifacts", "contracts");

function loadArtifact(contractName) {
  const p = path.join(ARTIFACTS, `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact for ${contractName} not found. Run 'npx hardhat compile' first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function deploy(name, wallet, ...args) {
  const artifact = loadArtifact(name);
  const factory = new quais.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log(`Deploying ${name} ...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ${name} -> ${address}`);
  return contract;
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || "https://orchard.rpc.quai.network/cyprus1";

  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Missing/invalid PRIVATE_KEY in contracts/.env. Run scripts/generate-wallet.js.");
  }

  const provider = new quais.JsonRpcProvider(rpcUrl, undefined, { usePathing: true });
  const wallet = new quais.Wallet(privateKey, provider);
  const deployer = await wallet.getAddress();
  console.log("Deployer:", deployer);
  console.log("RPC     :", rpcUrl);

  const balance = await provider.getBalance(deployer);
  console.log("Balance :", quais.formatQuai(balance), "QUAI");
  if (balance === 0n) {
    throw new Error("Deployer has 0 QUAI. Fund it at https://orchard.faucet.quai.network before deploying.");
  }

  // --- Tokens --------------------------------------------------------------
  const qi = await deploy("TestToken", wallet, "Quai Test QI", "QI");
  const usdc = await deploy("TestToken", wallet, "Quai Test USDC", "USDC");
  const qiAddr = await qi.getAddress();
  const usdcAddr = await usdc.getAddress();

  // Sort so token0 < token1 (pair reserve semantics).
  const [token0, token1] =
    BigInt(qiAddr) < BigInt(usdcAddr) ? [qiAddr, usdcAddr] : [usdcAddr, qiAddr];

  // --- Pair ----------------------------------------------------------------
  const pair = await deploy("QRoutePair", wallet, token0, token1);
  const pairAddr = await pair.getAddress();

  // --- Registry ------------------------------------------------------------
  const registry = await deploy("QRouteRegistry", wallet);
  console.log("Registering pair ...");
  await (await registry.registerPair(qiAddr, usdcAddr, pairAddr)).wait();

  // --- Router --------------------------------------------------------------
  // feeTo is the deployer for now; swap to a multisig before mainnet (audit M5).
  const router = await deploy("QRouteRouter", wallet, await registry.getAddress(), deployer);
  const routerAddr = await router.getAddress();

  // --- Seed liquidity (100k / 100k) ---------------------------------------
  const seed = 100_000n * 10n ** 18n;
  console.log("Minting + seeding liquidity ...");
  await (await qi.mint(deployer, seed)).wait();
  await (await usdc.mint(deployer, seed)).wait();
  await (await qi.transfer(pairAddr, seed)).wait();
  await (await usdc.transfer(pairAddr, seed)).wait();
  await (await pair.mint(deployer)).wait();
  console.log("  Liquidity seeded.");

  // --- Export addresses to the frontend -----------------------------------
  const deployedConfig = {
    zone: "cyprus-1",
    deployer,
    router: routerAddr,
    registry: await registry.getAddress(),
    dexPair: pairAddr,
    qiToken: qiAddr,
    usdcToken: usdcAddr,
    rpcUrl,
    timestamp: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "..", "..", "frontend", "src", "deployed_addresses.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deployedConfig, null, 2));
  console.log("Wrote addresses ->", outputPath);
  console.log("Deployment complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });
