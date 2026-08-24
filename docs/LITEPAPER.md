# qroute — Litepaper

*The chain-abstraction layer for Quai Network*

**Version 0.1 · Orchard testnet**

---

## Abstract

Quai Network scales through parallel execution: the chain is partitioned into **9 zone
shards** (cyprus, ethiopia, paxos × 1–3) that produce blocks concurrently. This is what
lets Quai scale — but it fragments liquidity. Capital pooled on one shard is invisible
to traders on another without manual, multi-step bridging.

**qroute** abstracts the shards away. A user signs a single intent to swap; the protocol
computes the optimal execution path across all 9 shards — local, cross-shard, or split —
prices in Quai's native cross-shard (ETx) gas, and settles. The cross-shard arbitrage
this unlocks (AEV) is captured for the protocol and **rebated to the trader** rather than
leaking to MEV searchers.

## The problem: fragmented liquidity

On a single-shard chain, an AMM's depth is global. On Quai, depth is *per shard*. A QI/USDC
pool on `cyprus-1` and another on `paxos-1` are separate markets with separate prices. The
result:

- **Worse prices** — traders hit one shallow pool instead of aggregate depth.
- **Manual bridging** — reaching another shard's liquidity is a multi-transaction chore.
- **Arbitrage leakage** — price gaps between shards are harvested by external bots.

## The solution: shard abstraction + intent settlement

qroute presents Quai as if it were one chain:

1. **Off-chain pathfinder.** Reads reserves across every zone shard and builds a liquidity
   graph. For a given trade it evaluates a direct local swap, a cross-shard swap on a deeper
   shard, and a split across pools — selecting the route with the best *net* output.
2. **Gas-aware routing.** Cross-shard hops cost a native ETx. The engine prices these in, so
   it only crosses shards when the extra depth outweighs the extra gas.
3. **Intent-based settlement (roadmap).** Users sign a guaranteed outcome ("≥ X out"), and a
   competitive solver network fills it across shards — retiring most raw-execution attack
   surface and abstracting the shard mechanics entirely.

## How a swap works

```
origin (cyprus-1)
  ├─ local swap on cyprus-1                     ┐
  └─ bridge → swap on paxos-1 → bridge back     ┘ split, weighted for best net output
        ↓
  optimal path selected · protocol fee taken · settled
```

The routing math is standard constant-product (Uniswap-V2 x·y=k) per pool, composed across
shards with a gas penalty per cross-shard transfer. Splitting a large trade across a local
and a cross-shard pool reduces aggregate slippage — a decision the engine makes dynamically.

## AEV — arbitrage rebated to users

Cross-shard price discrepancies are *Arbitrage Extractable Value*. On most chains this
leaks to MEV bots. qroute internalizes it: back-running keeps pool margins balanced, and a
share of the captured surplus is returned to the trader who created the opportunity.
*Other DEXs leak your value. qroute pays it back.*

## Security model

qroute is built on audited patterns; every hardening item is covered by tests.

- **Pools** issue real LP tokens with a `MINIMUM_LIQUIDITY` lock — no pool-drain, no
  first-depositor inflation.
- **The router never trusts a caller-supplied pair.** Pairs are resolved from a trusted
  on-chain **registry**, eliminating fake/malicious-pair injection.
- `ReentrancyGuard` + `SafeERC20` on all state-changing paths; **deadlines** on every swap;
  **exact-amount approvals** in the client.
- The **cross-shard bridge callback is relayer-gated and nonce/replay-protected**.
- Privileged functions are owner-gated (to be migrated to a **multisig** before mainnet).

A professional audit and public bug bounty precede any mainnet deployment.

## Business model

1. **Protocol fee** — 0.05–0.1% per swap, embedded in the router.
2. **AEV capture** — cross-shard arbitrage surplus, split between treasury and trader rebates.
3. **API / SDK licensing** — "Stripe for Quai liquidity": wallets, remittance apps, and
   dApps route through qroute's aggregation.

## Roadmap

- **Now** — single-shard *real* swaps + LP on Cyprus-1 (Orchard); hardened contracts; live UI.
- **Next** — genuine cross-shard settlement across a second shard (native ETx + signed,
  nonce-gated bridge).
- **Then** — intent + solver network, MM vaults that rebalance liquidity across shards,
  cross-shard limit orders / TWAP, public routing SDK, live shard-liquidity analytics.
- **Trust** — audit, bug bounty, multisig treasury, progressive decentralization.

## Disclaimer

Experimental testnet software; unaudited. QUAI on Orchard testnet has no monetary value.
Nothing here is financial advice or a solicitation.
