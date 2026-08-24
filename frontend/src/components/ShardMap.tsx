"use client";

const REGIONS: { name: string; zones: string[] }[] = [
  { name: "Cyprus", zones: ["cyprus-1", "cyprus-2", "cyprus-3"] },
  { name: "Paxos", zones: ["paxos-1", "paxos-2", "paxos-3"] },
  { name: "Hydra", zones: ["hydra-1", "hydra-2", "hydra-3"] },
];

const short = (z: string) => z.split("-")[1];

/**
 * Map of Quai's execution zones (up to 9; Cyprus-1 live today, others forward-looking).
 * Zones holding liquidity pulse orange; the user's connected zone rings cyan.
 */
export default function ShardMap({
  userZone,
  liquidityZones = ["cyprus-1"],
}: {
  userZone?: string | null;
  liquidityZones?: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        {REGIONS.map((region) => (
          <div key={region.name} className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {region.name}
            </div>
            <div className="space-y-1.5">
              {region.zones.map((zone) => {
                const isLiquidity = liquidityZones.includes(zone);
                const isUser = zone === userZone;
                return (
                  <div
                    key={zone}
                    className={`relative flex items-center justify-between rounded-lg border px-2.5 py-2 transition-colors ${
                      isLiquidity
                        ? "border-primary/50 bg-primary/10"
                        : isUser
                        ? "border-accent/50 bg-accent/10"
                        : "border-border bg-surface-2/40"
                    }`}
                  >
                    <span
                      className={`font-mono text-xs font-semibold ${
                        isLiquidity ? "text-primary" : isUser ? "text-accent" : "text-muted-foreground"
                      }`}
                    >
                      {short(zone)}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isLiquidity
                          ? "bg-primary animate-pulse-glow"
                          : isUser
                          ? "bg-accent"
                          : "bg-border"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 pt-1 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> liquidity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> your zone
        </span>
      </div>
    </div>
  );
}
