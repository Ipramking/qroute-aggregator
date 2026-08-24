"use client";

import { useState } from "react";
import WalletConnect from "../components/WalletConnect";
import SwapForm from "../components/SwapForm";
import LPForm from "../components/LPForm";
import TxTracker from "../components/TxTracker";
import ShardMap from "../components/ShardMap";
import { Card, SectionLabel, StepNumber } from "../components/ui/primitives";
import { useWeb3Store } from "../store/useWeb3Store";
import { LIQUIDITY_ZONES } from "../utils/contracts";
import { OptimizedRoute } from "qroute-aggregator-routing-engine";

const STEPS = [
  {
    n: "01",
    title: "Off-chain pathfinder",
    body: "Reads reserves across all 9 zone shards and computes the optimal route, evaluating split-paths in real time.",
  },
  {
    n: "02",
    title: "Gas-aware routing",
    body: "Prices Quai's native cross-shard (ETx) fees so you only route across shards when it actually pays off.",
  },
  {
    n: "03",
    title: "AEV rebated to you",
    body: "Cross-shard arbitrage is captured for the protocol and returned to traders — not leaked to MEV bots.",
  },
];

export default function Home() {
  const { address, zone } = useWeb3Store();
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<OptimizedRoute | null>(null);
  const [tab, setTab] = useState<"SWAP" | "POOL">("SWAP");

  const onSwapDispatched = (txHash: string, route: OptimizedRoute) => {
    setActiveTxHash(txHash);
    setActiveRoute(route);
  };

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-glow">
              <span className="text-lg font-bold">⌁</span>
            </div>
            <div className="leading-none">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">qroute</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                /quai
              </span>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 pb-24 pt-14 sm:px-6">
        {/* Hero */}
        <section className="mx-auto max-w-2xl text-center animate-fade-up">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-primary">// </span>chain-abstraction layer for quai
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Nine shards.
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              One swap.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            qroute unifies liquidity across Quai's execution shards — optimal cross-shard routing,
            split liquidity, minimal slippage, and AEV rebated back to you.
          </p>
        </section>

        {/* Grid */}
        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: swap / pool */}
          <div className="flex flex-col items-center gap-5">
            <div className="flex rounded-2xl border border-border bg-surface/70 p-1 backdrop-blur-xl">
              {(["SWAP", "POOL"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`h-11 rounded-xl px-6 text-sm font-bold transition-all ${
                    tab === t
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "SWAP" ? "Swap" : "Pool"}
                </button>
              ))}
            </div>
            {tab === "SWAP" ? <SwapForm onSwapDispatched={onSwapDispatched} /> : <LPForm />}
          </div>

          {/* Right: shard map + how it works */}
          <div className="flex w-full flex-col gap-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel>shard network</SectionLabel>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {address ? zone : "not connected"}
                </span>
              </div>
              <ShardMap userZone={zone} liquidityZones={LIQUIDITY_ZONES} />
            </Card>

            <Card className="p-6">
              <div className="mb-4">
                <SectionLabel>how it works</SectionLabel>
              </div>
              <div className="space-y-5">
                {STEPS.map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <StepNumber n={s.n} />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      </main>

      {activeTxHash && activeRoute && (
        <TxTracker
          txHash={activeTxHash}
          route={activeRoute}
          onClose={() => {
            setActiveTxHash(null);
            setActiveRoute(null);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-background/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p className="font-mono">© 2026 qroute · built on Quai</p>
          <a
            href="https://github.com/Ipramking/qroute-aggregator"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold transition-colors hover:text-foreground"
          >
            GitHub ↗
          </a>
        </div>
      </footer>
    </>
  );
}
