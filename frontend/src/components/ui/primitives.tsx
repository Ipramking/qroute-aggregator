import { ReactNode } from "react";

/** Elevated glass surface used across the app. */
export function Card({
  children,
  className = "",
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: "primary" | "accent";
}) {
  const glowClass =
    glow === "primary" ? "shadow-glow" : glow === "accent" ? "shadow-glow-accent" : "shadow-card";
  return (
    <div
      className={`rounded-2xl border border-border bg-surface/70 backdrop-blur-xl ${glowClass} ${className}`}
    >
      {children}
    </div>
  );
}

/** Uppercase section label with a terminal-style prefix. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
      <span className="text-primary/70">// </span>
      {children}
    </span>
  );
}

/** Live / preview status pill. */
export function StatusDot({ live, label }: { live: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
        live
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success animate-pulse-glow" : "bg-warning"}`} />
      {label}
    </span>
  );
}

/** Numbered step marker for the "how it works" rail. */
export function StepNumber({ n }: { n: string }) {
  return (
    <span className="font-mono text-xs font-bold text-primary">{n}</span>
  );
}
