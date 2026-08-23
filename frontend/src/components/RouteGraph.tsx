"use client";

import { OptimizedRoute } from "qroute-aggregator-routing-engine";

interface Node {
  label: string;
  sub: string;
  kind: "origin" | "local" | "cross";
}

function buildNodes(route: OptimizedRoute, originZone: string): Node[] {
  const nodes: Node[] = [
    { label: originZone || "origin", kind: "origin", sub: "you" },
  ];
  for (const step of route.path) {
    if (step.type === "LOCAL_SWAP") {
      nodes.push({ label: "Local Swap", kind: "local", sub: step.toZone });
    } else if (step.type === "CROSS_SHARD_TRANSFER") {
      nodes.push({ label: "Bridge", kind: "cross", sub: `→ ${step.toZone}` });
    } else {
      nodes.push({ label: "Swap", kind: "cross", sub: `@ ${step.toZone}` });
    }
  }
  return nodes;
}

function Connector({ cross }: { cross: boolean }) {
  const color = cross ? "rgb(var(--accent))" : "rgb(var(--primary))";
  return (
    <svg
      className="h-6 w-10 shrink-0 sm:flex-1"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line x1="0" y1="12" x2="100" y2="12" stroke="rgb(var(--border))" strokeWidth="2" />
      <line
        x1="0"
        y1="12"
        x2="100"
        y2="12"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="7 9"
        style={{ strokeDashoffset: 16, animation: "route-draw 0.9s linear infinite" }}
      />
    </svg>
  );
}

export default function RouteGraph({
  route,
  originZone,
}: {
  route: OptimizedRoute;
  originZone: string;
}) {
  const nodes = buildNodes(route, originZone);

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1 sm:gap-0">
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`flex min-w-[74px] flex-col items-center rounded-xl border px-3 py-2 text-center ${
              node.kind === "origin"
                ? "border-accent/50 bg-accent/10"
                : node.kind === "cross"
                ? "border-accent/40 bg-surface-2/60"
                : "border-primary/40 bg-surface-2/60"
            }`}
          >
            <span
              className={`font-mono text-[11px] font-bold ${
                node.kind === "origin"
                  ? "text-accent"
                  : node.kind === "cross"
                  ? "text-accent"
                  : "text-primary"
              }`}
            >
              {node.label}
            </span>
            <span className="mt-0.5 font-mono text-[10px] capitalize text-muted-foreground">
              {node.sub}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <Connector cross={nodes[i + 1].kind === "cross"} />
          )}
        </div>
      ))}
    </div>
  );
}
