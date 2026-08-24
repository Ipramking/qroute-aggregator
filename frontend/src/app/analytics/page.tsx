"use client";

import Link from "next/link";
import WalletConnect from "../../components/WalletConnect";
import ShardHeatmap from "../../components/ShardHeatmap";
import { Card, SectionLabel, StatusDot } from "../../components/ui/primitives";
import {
  getNetworkStats,
  getShardStats,
  fmtUsd,
  ANALYTICS_LIVE,
} from "../../utils/analyticsData";

const ROUTE_MIX = [
  { label: "Local", pct: 38, color: "bg-primary" },
  { label: "Cross-shard", pct: 45, color: "bg-accent" },
  { label: "Split", pct: 17, color: "bg-foreground/60" },
];

export default function Analytics() {
  const net = getNetworkStats();
  const pools = getShardStats().filter((s) => s.pools > 0);

  const stats = [
    { label: "Total liquidity", value: fmtUsd(net.tvlUsd) },
    { label: "24h volume", value: fmtUsd(net.volume24hUsd) },
    { label: "Active shards", value: `${net.activeShards} / 9` },
    { label: "Cross-shard routes", value: `${Math.round(net.crossShardShare * 100)}%` },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-glow">
              <span className="text-lg font-bold">⌁</span>
            </div>
            <div className="leading-none">
              <span className="font-display text-lg font-bold tracking-tight text-foreground">qroute</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                /analytics
              </span>
            </div>
          </Link>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-24 pt-10 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>network analytics</SectionLabel>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Quai liquidity, unified
            </h1>
          </div>
          <StatusDot live={ANALYTICS_LIVE} label={ANALYTICS_LIVE ? "Live" : "Preview"} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <div className="mt-2 font-display text-2xl font-bold text-foreground tnum sm:text-3xl">
                {s.value}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Heatmap */}
          <Card className="p-6">
            <div className="mb-4">
              <SectionLabel>shard liquidity heatmap</SectionLabel>
            </div>
            <ShardHeatmap />
          </Card>

          {/* Routing insights */}
          <Card className="p-6">
            <div className="mb-4">
              <SectionLabel>routing mix (24h)</SectionLabel>
            </div>
            <div className="space-y-4">
              {ROUTE_MIX.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between font-mono text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="text-foreground tnum">{r.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-muted-foreground">
              <span className="text-accent">✦</span> 62% of volume routed across shards — depth no
              single shard could offer alone.
            </div>
          </Card>
        </div>

        {/* Pools table */}
        <Card className="p-6">
          <div className="mb-4">
            <SectionLabel>active pools</SectionLabel>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left font-mono text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Shard</th>
                  <th className="pb-2 font-medium">Pair</th>
                  <th className="pb-2 text-right font-medium">Liquidity</th>
                  <th className="pb-2 text-right font-medium">24h vol</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((p) => (
                  <tr key={p.zone} className="border-b border-border/50">
                    <td className="py-2.5 text-primary">{p.zone}</td>
                    <td className="py-2.5 text-foreground">QI / USDC</td>
                    <td className="py-2.5 text-right text-foreground tnum">{fmtUsd(p.tvlUsd)}</td>
                    <td className="py-2.5 text-right text-muted-foreground tnum">{fmtUsd(p.volume24hUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Link
          href="/"
          className="mx-auto font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← back to swap
        </Link>
      </main>
    </>
  );
}
