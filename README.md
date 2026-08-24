# qroute

**The chain-abstraction layer for Quai Network.** One-signature swaps across Quai's
9 execution shards — optimal cross-shard routing, split liquidity, minimal slippage,
and AEV rebated back to you instead of leaking to MEV bots.

**Live:** https://qroute-six.vercel.app · **Network:** Quai Orchard testnet (Cyprus-1)

> Nine shards. One swap.

---

## Why

Quai's parallel execution splits the network into 9 zone shards — which fragments
liquidity. A trader on `cyprus-1` can't natively tap depth sitting on `paxos-1`
without manual bridging. qroute unifies that liquidity: you sign one intent, and the
protocol finds the optimal path — local, cross-shard, or split across both — pricing
in Quai's native cross-shard (ETx) gas so it only routes across shards when it pays.

## What makes it different (only possible on Quai)

- **Shard abstraction** — you never think about which shard you're on.
- **Intent + solver settlement** — sign an outcome, not a raw route (roadmap).
- **AEV rebate** — cross-shard arbitrage is captured for the protocol and returned to traders.
- **Shard-aware routing** — depth and gas per zone drive genuine split-path decisions.

## Architecture (npm-workspaces monorepo)

| Package | Stack | Role |
|---|---|---|
| `contracts` | Hardhat · Solidity 0.8.20 · OpenZeppelin | AMM pair, pair registry, hardened router, test token |
| `routing-engine` | TypeScript · quais | Off-chain pathfinder — reserves graph, gas-aware optimal/split routing |
| `frontend` | Next.js 14 · Tailwind · Zustand · quais | Swap/LP UI, Pelagus (EIP-6963) wallet, live shard map + route graph |
| `arbitrage-bot` | TypeScript | AEV back-running bot (scanner/monitor/executor) |
| `relayer` | TypeScript · quais | Cross-shard bridge worker: watches `LogExternalSwapPending`, relays a nonce-gated `onTokenBridgeReceived` to the destination shard |

## Security

The contracts follow audited patterns and every hardening item is covered by tests
(`14 passing`). See [`ROADMAP.md`](./ROADMAP.md) for the full audit.

- Real LP-token accounting + `MINIMUM_LIQUIDITY` lock (no pool-drain)
- Router resolves pairs from a **trusted registry** — no fake-pair injection
- `ReentrancyGuard` + `SafeERC20` throughout; deadlines on every swap
- Cross-shard bridge callback is **relayer-gated + nonce/replay-protected**
- Owner-gated admin (point at a multisig before mainnet); exact-amount approvals

## Develop

```bash
npm install

# contracts
npm test -w contracts                 # hardhat tests (local EVM)
cd contracts && npx hardhat compile

# generate + fund a Cyprus-1 deployer, then deploy
node contracts/scripts/generate-wallet.js
# fund the printed address at https://orchard.faucet.quai.network
node contracts/scripts/deploy.js      # deploys + seeds liquidity + writes addresses

# frontend
npm run dev -w frontend
```

The frontend runs in a labeled **Preview** mode (illustrative multi-shard liquidity)
until real addresses land in `frontend/src/deployed_addresses.json`, then flips to
**● Live · Cyprus-1** with on-chain swaps.

## Docs

- [Litepaper](./docs/LITEPAPER.md) — vision, mechanism, business model
- [Roadmap & security audit](./ROADMAP.md)

## Disclaimer

Testnet software, unaudited. QUAI on Orchard has no real value. Not financial advice.
