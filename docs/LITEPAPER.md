# qroute — Litepaper

*Cross-shard routing infrastructure for Quai Network*

**Version 0.2 · Orchard testnet · built ahead of Quai's sharding roadmap**

---

## Abstract

Quai Network scales by **sharding**: it braids many merge-mined chains
(Prime → Region → Zone) and activates new execution zones as demand grows. **Today only
one zone — Cyprus-1 — is live on mainnet.** As the network shards into additional zones
(regions: Cyprus, Paxos, Hydra), each zone will host its own liquidity, and there is
currently **no routing layer** to move value optimally across them.

**qroute** is that layer, built and tested now so it is ready before it is needed. A trader
(or an integrating wallet/dApp) submits one intent; qroute's off-chain pathfinder returns
the optimal execution path across whatever zones are active — local, cross-shard, or split —
pricing in Quai's native **External Transaction (ETX)** cost so it only crosses shards when
the extra depth outweighs the gas.

This is **forward-looking infrastructure for Quai's own scaling roadmap**, not a claim that
liquidity is fragmented today.

## The problem qroute is built for

On a single-shard chain, an AMM's depth is global. Quai's design deliberately splits
execution across zones — which is how it scales, but it also means that **once more than one
zone is live, liquidity becomes per-zone**. A future trader on Cyprus-1 will not natively see
depth that has accumulated on Paxos-1 without a cross-shard hop. When that happens:

- prices worsen as trades hit one zone's shallow pool instead of aggregate depth;
- cross-shard reach becomes a manual, multi-step chore; and
- inter-zone price gaps get harvested by external arbitrageurs.

None of this bites *yet* — Cyprus-1 is the only live zone. The point is that the routing
infrastructure should exist **before** the sharding events, not scramble after them.

## The solution

qroute presents Quai's (eventual) zones as if they were one chain:

1. **Off-chain pathfinder** — builds a liquidity graph across active zones and, per trade,
   evaluates a direct local swap, a cross-shard swap on a deeper zone, and a split across
   pools, selecting the best *net* output.
2. **ETX-native, gas-aware scoring** — prices Quai's real cross-shard primitive (External
   Transactions, coincident-block settlement) into the net-output comparison.
3. **Intent-based settlement (roadmap)** — users sign a guaranteed outcome; a solver network
   fills it across zones, abstracting the mechanics entirely.

## Why not just use IceCreamSwap?

IceCreamSwap runs a generic, chain-agnostic multi-DEX aggregator that happens to be deployed
on Quai as one of many chains. It has no special awareness of Quai's mechanics. qroute's moat
is the opposite bet — go **deep on what is structurally unique to Quai**:

- **ETX / coincident-block awareness.** Routing that understands Quai's actual cross-shard
  transaction primitive, rather than treating a shard hop as a generic bridge. A
  chain-agnostic aggregator cannot replicate this.
- **Quai gas-model specificity.** Quai's fee mechanics (workshares, PRS, cross-shard
  settlement) differ from EVM-standard chains. A router that prices ETX gas correctly into
  net-output scoring is a real, defensible edge.
- **Public infrastructure, not a competing storefront.** qroute is a pathfinder other Quai
  dApps and wallets (Pelagus, Quainance) can route through via an SDK — shared plumbing that
  grows the ecosystem, not another place to swap.

## Architecture

- `routing-engine` — the differentiated IP: constant-product math per pool, composed across
  zones with an ETX gas penalty per cross-shard hop, gas-aware net-output and split scoring.
- `contracts` — audited-pattern AMM pair, trusted pair registry, hardened router (registry-
  resolved pairs, reentrancy guard, SafeERC20, deadlines, relayer-gated + nonce-protected
  cross-shard callback).
- `relayer` — watches the source-zone router for cross-shard intents and submits a nonce-gated
  `onTokenBridgeReceived` on the destination zone.
- `frontend` — swap/LP UI + live shard map / analytics, Pelagus (EIP-6963) wallet.

## Security model

Built on audited patterns; every hardening item is covered by tests (contracts 14 · engine 18
· bot 9 · relayer 6 = 47 passing, green CI).

- Real LP-token accounting + `MINIMUM_LIQUIDITY` lock (no pool-drain).
- Router resolves pairs from a **trusted registry** — no fake-pair injection.
- `ReentrancyGuard` + `SafeERC20`; deadlines on every swap; exact-amount approvals.
- Cross-shard bridge callback is **relayer-gated and nonce/replay-protected**.
- Owner-gated admin (to become a **multisig** before mainnet value).

## Where value comes from

qroute is positioned as **ecosystem infrastructure first**. At Quai's current DeFi scale a
swap fee is immaterial, so monetization is *not* the pitch:

1. **Ecosystem value (now)** — the shared routing layer Quai needs *before* it can shard
   responsibly; a reference implementation that proves cross-shard routing works the moment a
   zone activates.
2. **Integration / SDK (near)** — wallets and dApps route through qroute instead of building
   their own pathfinder.
3. **Protocol fee + AEV (later, at volume)** — a small routing fee and rebated cross-shard
   arbitrage become meaningful only once real volume exists.

## Roadmap

- **Now** — hardened contracts + routing engine; real single-zone swaps/LP on Cyprus-1;
  multi-zone routing proven in tests/preview; relayer + multi-shard deploy scripts ready.
- **Next** — public routing SDK; second-zone deploy + live ETX cross-shard settlement when a
  zone activates; intent + solver network.
- **Then** — MM vaults rebalancing across zones, limit orders / TWAP, shard-liquidity analytics.
- **Trust** — audit, bug bounty, multisig treasury.

## Disclaimer

Experimental testnet software; unaudited. Only Cyprus-1 is live on Quai today; multi-zone
behaviour shown in the app is a forward-looking simulation. QUAI on Orchard testnet has no
monetary value. Nothing here is financial advice.
