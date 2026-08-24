# qroute

**Cross-shard routing infrastructure for Quai Network** — built ahead of Quai's sharding
roadmap. As Quai activates new execution zones, qroute routes optimally across them:
ETX-native cross-shard routing, split liquidity, and AEV rebated to traders. **Cyprus-1
live today**; additional zones are forward-looking.

[![CI](https://github.com/Ipramking/qroute-aggregator/actions/workflows/ci.yml/badge.svg)](https://github.com/Ipramking/qroute-aggregator/actions/workflows/ci.yml)

**Live:** https://qroute-six.vercel.app · **Network:** Quai Orchard testnet (Cyprus-1)

> Nine shards. One swap.

---

## Why — forward-looking infrastructure

Quai scales by **sharding**: it braids many chains (Prime → Region → Zone) and activates
new execution zones as demand grows. **Today only Cyprus-1 is live** — but each future zone
will hold its own liquidity, and no routing layer exists yet to move across them. qroute is
that missing layer, **built and tested now so it's ready before the shards fire**: sign one
intent and the pathfinder returns the optimal path — local, cross-shard, or split — pricing
in Quai's native External Transaction (ETX) gas so it only crosses shards when it pays.

This is infrastructure for Quai's own scaling roadmap, not a claim that liquidity is
fragmented today.

## What makes it different

Not another swap UI, and not a generic multi-chain aggregator (e.g. IceCreamSwap) bolted
onto Quai as one of many chains:

- **ETX-native routing** — models Quai's real cross-shard primitive (External Transactions,
  coincident blocks) and prices it into net-output scoring, instead of treating a shard hop
  as a generic bridge. A chain-agnostic aggregator structurally can't have this.
- **Public infrastructure, not a silo** — a pathfinder wallets/dApps (Pelagus, Quainance)
  can route through via an SDK, rather than each rebuilding their own.
- **Shard-aware split routing** — per-zone depth and ETX gas drive genuine split-path decisions.
- **AEV rebate** — cross-shard arbitrage captured for the protocol and returned to traders.

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
