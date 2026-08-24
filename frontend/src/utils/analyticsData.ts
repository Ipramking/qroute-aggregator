import { IS_LIVE } from "./contracts";

export interface ShardStat {
  zone: string;
  region: string;
  tvlUsd: number;
  volume24hUsd: number;
  pools: number;
}

const REGION_OF: Record<string, string> = {
  cyprus: "Cyprus",
  paxos: "Paxos",
  hydra: "Hydra",
};

// Illustrative FUTURE multi-shard state (Preview). Only Cyprus-1 is live on Quai
// today; the other zones activate via demand-triggered sharding events. When live,
// these would aggregate from on-chain reserves + events.
const DEMO_STATS: ShardStat[] = [
  { zone: "cyprus-1", tvlUsd: 400_000, volume24hUsd: 128_000, pools: 1 },
  { zone: "cyprus-2", tvlUsd: 0, volume24hUsd: 0, pools: 0 },
  { zone: "cyprus-3", tvlUsd: 0, volume24hUsd: 0, pools: 0 },
  { zone: "paxos-1", tvlUsd: 480_000, volume24hUsd: 151_000, pools: 1 },
  { zone: "paxos-2", tvlUsd: 0, volume24hUsd: 0, pools: 0 },
  { zone: "paxos-3", tvlUsd: 0, volume24hUsd: 0, pools: 0 },
  { zone: "hydra-1", tvlUsd: 360_000, volume24hUsd: 74_000, pools: 1 },
  { zone: "hydra-2", tvlUsd: 0, volume24hUsd: 0, pools: 0 },
  { zone: "hydra-3", tvlUsd: 0, volume24hUsd: 0, pools: 0 },
].map((s) => ({ ...s, region: REGION_OF[s.zone.split("-")[0]] }));

export function getShardStats(): ShardStat[] {
  return DEMO_STATS;
}

export interface NetworkStats {
  tvlUsd: number;
  volume24hUsd: number;
  activeShards: number;
  crossShardShare: number; // fraction of routes that went cross-shard
}

export function getNetworkStats(): NetworkStats {
  const stats = getShardStats();
  return {
    tvlUsd: stats.reduce((a, s) => a + s.tvlUsd, 0),
    volume24hUsd: stats.reduce((a, s) => a + s.volume24hUsd, 0),
    activeShards: stats.filter((s) => s.pools > 0).length,
    crossShardShare: 0.62,
  };
}

export const ANALYTICS_LIVE = IS_LIVE;

export function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
