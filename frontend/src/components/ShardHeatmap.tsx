"use client";

import { getShardStats, fmtUsd, ShardStat } from "../utils/analyticsData";

const REGIONS = ["Cyprus", "Paxos", "Hydra"];

export default function ShardHeatmap() {
  const stats = getShardStats();
  const max = Math.max(...stats.map((s) => s.tvlUsd), 1);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {REGIONS.map((region) => (
        <div key={region} className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {region}
          </div>
          {stats
            .filter((s) => s.region === region)
            .map((s) => (
              <ZoneCell key={s.zone} s={s} max={max} />
            ))}
        </div>
      ))}
    </div>
  );
}

function ZoneCell({ s, max }: { s: ShardStat; max: number }) {
  const active = s.pools > 0;
  const pct = Math.round((s.tvlUsd / max) * 100);
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        active ? "border-primary/40 bg-primary/5" : "border-border bg-surface-2/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-mono text-xs font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
          {s.zone}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tnum">
          {active ? fmtUsd(s.tvlUsd) : "—"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${active ? "bg-primary" : "bg-border"}`}
          style={{ width: `${Math.max(pct, active ? 8 : 2)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{s.pools} pool{s.pools === 1 ? "" : "s"}</span>
        <span>{active ? `${fmtUsd(s.volume24hUsd)} 24h` : "idle"}</span>
      </div>
    </div>
  );
}
