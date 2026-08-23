# qroute — Roadmap, Security & Positioning

> **qroute** is the chain-abstraction + intent-settlement layer for **Quai Network**.
> It makes Quai's 9 execution shards feel like one chain: you sign an intent, solvers
> compete to fill it across shards, and the cross-shard arbitrage (AEV) we capture is
> rebated back to you instead of leaking to MEV bots.

- **Live target:** Quai Orchard testnet, Cyprus-1 (single-shard real first)
- **Repo:** https://github.com/Ipramking/qroute-aggregator
- **Canonical Vercel project:** `qroute`
- **Status:** planning complete → building Phase 0

---

## 1. Positioning — our wedge (do NOT build everything at once)

One coherent, fundable identity, reinforced by everything else:

| Pillar | The one thing |
|---|---|
| **Signature** | Full **shard abstraction** — users never know which shard they're on. |
| **Mechanism** | **Intent + solver network** — users sign guarantees, solvers fill across shards. |
| **Hook** | **AEV rebate** — cross-shard arbitrage surplus paid back to the trader. |

Everything below (heatmap, MM vaults, limit orders, SDK) is roadmap that *reinforces*
this story rather than scattering focus.

### Why this also fixes security by design
Intent-based settlement means users sign **outcomes**, not raw routes. That retires most
of the router attack surface (user-supplied pair/token/route). Solvers absorb execution risk.

---

## 2. Differentiation — the moat (only possible on Quai)

An EVM aggregator physically cannot copy these:

1. **Shard abstraction / "chain abstraction for Quai"** — the biggest 2026 DeFi narrative, and Quai is built for it.
2. **Intent-based cross-shard settlement + solver network** — UniswapX/CowSwap/Across, but the cross-shard dimension makes it richer; decentralizes over time.
3. **AEV rebate to users** — *"Other DEXs leak your value to MEV bots. qroute captures cross-shard arbitrage and pays it back."*
4. **Shard-aware smart wallets / shard placement** — Quai addresses encode their shard; recommend/generate the optimal shard for funds.
5. **Active cross-shard liquidity rebalancing (MM vaults)** — move liquidity to the shard where it's needed (JIT across zones); LP + routing flywheel.

**Modern patterns that map perfectly here:** cross-shard limit orders + TWAP (solver-executed),
RFQ / private order flow for large trades, and the **API/SDK as the wedge** ("Stripe for Quai liquidity", B2B distribution).

**Trust & UX delighters:** "Safest swap on Quai" (pre-sign simulation, honeypot/malicious-token
detection, MEV-protected routing), live cross-shard liquidity heatmap (data moat + marketing),
remittance-rails angle (Quai = "rebuilding currency").

---

## 3. Security audit — current state & remediation

**Headline:** the current contracts are demo-grade and would be catastrophic on mainnet as-is.
Because the swap flow lets the user supply `tokenIn`, `tokenOut`, **and** `pairAddress`, almost
every function trusts attacker-controlled input.

### 🔴 CRITICAL
- **C1 — `QuaiDEXPair.burn(to)`**: no LP-share accounting, no access control → anyone drains the entire pool. There are no LP tokens at all.
- **C2 — `CrossShardRouter.onTokenBridgeReceived`**: the bridge endpoint is unauthenticated. No relayer signature, no source-shard proof, **no nonce → replayable**. Biggest bridge risk.
- **C3 — user-supplied `pairAddress`/token addresses never validated** against a factory/registry → router makes external calls into attacker code → reentrancy + arbitrary control.
- **C4 — `MockERC20.mint` is public/unlimited** — fine as a mock, fatal if it ever ships as a real token.

### 🟠 HIGH
- **H1** — no reentrancy guard on the router (it calls into caller-controlled contracts).
- **H2** — no SafeERC20; unchecked `transfer`/`transferFrom` returns; fee-on-transfer tokens break accounting.
- **H3** — hardcoded fallback private key in `deploy.js` (`0xabcdef…`). Remove; no key literals anywhere.
- **H4** — `swapAndTransferCrossShard` uses a plain `transfer` that will NOT cross Quai shards (needs native ETx); cosmetic today, inherits C2 when made real.
- **H5** — no `deadline` param → stale tx + MEV sandwich exposure.

### 🟡 MEDIUM / 🔵 LOW
- **M1** — LP faked end-to-end (frontend `setTimeout` + no on-chain shares).
- **M2** — `uint112` cast in `_update` can truncate (no guard).
- **M3** — frontend should use **exact-amount approvals**, never `type(uint256).max`.
- **M4** — no slippage/deadline settings UX.
- **M5** — `owner`/`feeTo` are single EOAs → move to a **multisig** before real value.
- **Bot** — `executor.ts` stores raw `privateKey` as a public field; never log/serialize.
- **Good hygiene already in place:** `.env` gitignored ✅, `.env.example` zero key ✅, no `NEXT_PUBLIC_` secrets ✅, React auto-escaping ✅.

### Attack-surface map
1. Swap router (user-supplied pair/token → reentrancy, fake pools) — primary
2. Cross-shard bridge callback (unauth + replay) — highest consequence
3. Pool (burn drain, no shares) — total loss
4. Key/secret leakage (deploy fallback key, bot field, `.env` slips)
5. Client→chain (unlimited approvals, no slippage/deadline → MEV)
6. Supply chain (`quais` alpha + deps — pin versions, verify lockfile)

### Remediation (lands in Phase 1)
Don't hand-roll AMM primitives. **Fork audited Uniswap-V2 core** (real LP ERC20,
`MINIMUM_LIQUIDITY` lock, k-invariant) + **OpenZeppelin** (`ReentrancyGuard`, `SafeERC20`,
`AccessControl`). Add a **Factory + pair registry** (router only trusts registered pairs).
Make the bridge callback **relayer-signed + nonce-gated + idempotent**. Add `deadline`,
real slippage UX, exact approvals, and a **multisig** for `owner`/`feeTo`.

---

## 4. Design direction — "Cross-Shard Clarity"

Terminal-grade precision meets refined fintech. Take Quai's DNA (near-black canvas,
terminal/code loader, numbered sections, heavy motion) and make it ours by **making the
invisible — 9 shards, live routing — visible.** Executed via the `frontend-revamp` skill.

- **Color** — base `#0A0A0B`, surfaces `#131316`/`#1A1A1E`, hairlines `#26262B`; **Quai orange** primary; **electric cyan** reserved for cross-shard flows; semantic green/red for P&L + tx state.
- **Type** — geometric grotesk headlines (Geist / Space Grotesk), **mono for all data & addresses** (Geist Mono / JetBrains Mono); tabular-nums as hero.
- **Signature moments (award-winning):**
  1. Animated cross-shard **route graph** that draws itself across a 9-zone map.
  2. Live **shard liquidity heatmap** pulsing with real reserve depth.
  3. Terminal-style **tx tracker** — a live CLI log of the route executing.
- **Layout** — focal swap card + right-rail live route/shard panel; sticky glass header; numbered sections (`01 / 03`).
- **Motion** — route-drawing, number tickers, subtle grain, Quai-style boot loader; respect `prefers-reduced-motion`.
- **System** — migrate to **shadcn/ui + Tailwind tokens**. Benchmarks: Matcha, Jupiter (route viz), Zerion (portfolio clarity).
- **Responsive** — full PC + phone parity, proper touch targets.

---

## 5. Delivery plan

### Phase 0 — Fix the deploy ✅ (in progress)
- `transpilePackages: ["qroute-aggregator-routing-engine"]` in `next.config.mjs`.
- Point routing-engine `main`/`types` at `src` (Next compiles the TS directly; no `dist` build needed).
- Vercel `qroute`: Root Directory = `frontend`, include files outside root. **Delete `qroute-aggregator`.**
- Redeploy → verify `/` returns 200.

### Phase 0.5 — Wallet (manual faucet step is yours)
- `contracts/scripts/generate-wallet.js` grinds a fresh **Cyprus-1** wallet → writes key to `contracts/.env` (gitignored).
- **You:** claim 5 testnet QUAI at `orchard.faucet.quai.network` (X-auth, 1×/24h) to that address.

### Phase 1 — Real contracts (Cyprus-1)
Rewrite `deploy.js` → real `ContractFactory` deploy (fork audited V2 + OZ + Factory/registry +
access-controlled bridge). Seed liquidity, export real addresses.

### Phase 2 — Real swaps + LP
Live reserves via `LiquiditySyncer`; real `approve → localSwap`; real LP `mint`/`burn`;
exact approvals, slippage + deadline. Cross-shard path stays but labeled **"Simulated (beta)."**

### Phase 3 — Cross-shard (deferred, honest simulation until real)
Second-shard deployment + native ETx transfer + signed/nonce-gated bridge callback.

---

## 6. Startup-standard checklist

- **Security/trust:** professional audit before mainnet, bug bounty, high test coverage + fuzzing, **multisig** owner/treasury, pause switch, incident response.
- **Product:** real LP + positions, portfolio & tx history, token list + price oracle, slippage/deadline settings, gas estimation, failed-tx UX.
- **Infra/DevOps:** CI/CD, error tracking (Sentry), RPC redundancy + fallback, indexer/subgraph, product analytics, status page.
- **Legal:** entity, Terms + Privacy, risk disclaimers, non-custodial framing, geoblocking, license decision (MIT/BUSL).
- **Growth/GTM:** docs + litepaper, audit badge, clean GitHub hygiene, landing page, socials, fee/analytics dashboard for traction.
