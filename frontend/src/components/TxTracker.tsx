"use client";

import { useEffect, useState } from "react";
import { OptimizedRoute } from "qroute-aggregator-routing-engine";

interface TxTrackerProps {
  txHash: string;
  route: OptimizedRoute;
  onClose: () => void;
}

export default function TxTracker({ txHash, route, onClose }: TxTrackerProps) {
  const [progress, setProgress] = useState(0);

  const isCrossShard = route.path.some((s) => s.type === "CROSS_SHARD_SWAP");

  const log = isCrossShard
    ? [
        "broadcasting tx to origin shard…",
        "deducting protocol fee · locking input",
        "waiting for coincident block…",
        "executing swap on destination shard",
        "routing output back to your wallet ✓",
      ]
    : [
        "broadcasting tx to cyprus-1…",
        "deducting protocol fee · executing swap",
        "settlement confirmed ✓",
      ];

  useEffect(() => {
    const total = isCrossShard ? 15000 : 3000;
    const tick = total / 100;
    let p = 0;
    const timer = setInterval(() => {
      p += 1;
      setProgress(p);
      if (p >= 100) clearInterval(timer);
    }, tick);
    return () => clearInterval(timer);
  }, [isCrossShard]);

  const visibleLines = Math.min(Math.ceil((progress / 100) * log.length), log.length);
  const done = progress >= 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-glow backdrop-blur-xl">
        {/* terminal chrome */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">qroute://tx</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground tnum">
            {txHash.slice(0, 10)}…
          </span>
        </div>

        {/* log */}
        <div className="space-y-2 px-5 py-5 font-mono text-xs">
          {log.slice(0, visibleLines).map((line, i) => {
            const isLast = i === visibleLines - 1 && !done;
            return (
              <div key={i} className="flex gap-2">
                <span className={isLast ? "text-primary" : "text-success"}>
                  {isLast ? "›" : "✓"}
                </span>
                <span className={isLast ? "text-foreground" : "text-muted-foreground"}>
                  {line}
                  {isLast && <span className="ml-1 inline-block h-3 w-1.5 animate-blink bg-primary align-middle" />}
                </span>
              </div>
            );
          })}
        </div>

        {/* progress */}
        <div className="px-5">
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isCrossShard ? "bg-accent" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="p-5">
          {done ? (
            <button
              onClick={onClose}
              className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-glow transition hover:brightness-110"
            >
              Done
            </button>
          ) : (
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              {isCrossShard ? "settling across shards…" : "confirming on cyprus-1…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
