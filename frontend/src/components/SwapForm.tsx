"use client";

import { useEffect, useState } from "react";
import { quais } from "quais";
import { useWeb3Store, TOKENS } from "../store/useWeb3Store";
import { IS_LIVE } from "../utils/contracts";
import { Card, StatusDot } from "./ui/primitives";
import RouteGraph from "./RouteGraph";
import { OptimizedRoute } from "qroute-aggregator-routing-engine";

interface SwapFormProps {
  onSwapDispatched: (txHash: string, route: OptimizedRoute) => void;
}

const SLIPPAGE_OPTIONS = [10, 50, 100]; // bips

export default function SwapForm({ onSwapDispatched }: SwapFormProps) {
  const {
    address,
    zone,
    tokenIn,
    tokenOut,
    amountIn,
    route,
    error,
    reservesLive,
    slippageBips,
    setSlippageBips,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    refreshReserves,
    executeSwap,
  } = useWeb3Store();

  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    refreshReserves();
  }, [refreshReserves]);

  const flip = () => {
    const nextIn = tokenOut;
    const nextOut = tokenIn;
    setTokenIn(nextIn);
    setTokenOut(nextOut);
  };

  const handleSwap = async () => {
    if (!route || !address) return;
    setIsLoading(true);
    setLocalError(null);
    try {
      const txHash = await executeSwap();
      onSwapDispatched(txHash, route);
    } catch (err: any) {
      setLocalError(err?.message || "Transaction failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeError = error || localError;
  const expectedOut = route ? Number(quais.formatUnits(route.expectedAmountOut, 18)) : 0;
  const live = IS_LIVE && reservesLive;

  return (
    <Card className="w-full max-w-md p-6" glow="primary">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Swap</h2>
        <StatusDot live={live} label={live ? "Live · Cyprus-1" : "Preview"} />
      </div>

      <div className="space-y-1.5">
        {/* From */}
        <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            From
          </span>
          <div className="mt-1 flex items-center justify-between gap-3">
            <input
              inputMode="decimal"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="w-full min-w-0 bg-transparent font-display text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40 tnum"
            />
            <TokenSelect
              value={tokenIn.symbol}
              onChange={(sym) => setTokenIn(TOKENS.find((t) => t.symbol === sym)!)}
            />
          </div>
        </div>

        {/* Flip */}
        <div className="relative z-10 flex justify-center">
          <button
            onClick={flip}
            aria-label="Switch tokens"
            className="-my-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground transition-all hover:text-primary active:rotate-180"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 4v16m0 0l-4-4m4 4l4-4M17 20V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* To */}
        <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            To — estimated
          </span>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="w-full min-w-0 truncate font-display text-3xl font-bold text-foreground tnum">
              {expectedOut ? expectedOut.toFixed(4) : "0.0"}
            </span>
            <TokenSelect
              value={tokenOut.symbol}
              onChange={(sym) => setTokenOut(TOKENS.find((t) => t.symbol === sym)!)}
            />
          </div>
        </div>
      </div>

      {/* Route visualizer */}
      {route && (
        <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="text-primary/70">// </span>optimal path
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tnum">
              gas ≈ {route.totalGasCost.toString()}
            </span>
          </div>
          <RouteGraph route={route} originZone={zone || "cyprus-1"} />
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
            <span className="text-accent">✦</span>
            <span className="text-[11px] text-muted-foreground">
              Cross-shard AEV captured is rebated to you, not MEV bots.
            </span>
          </div>
        </div>
      )}

      {/* Slippage */}
      <div className="mt-4 flex items-center justify-between px-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Slippage
        </span>
        <div className="flex gap-1.5">
          {SLIPPAGE_OPTIONS.map((bips) => (
            <button
              key={bips}
              onClick={() => setSlippageBips(bips)}
              className={`rounded-lg border px-3 py-2 font-mono text-xs font-semibold transition ${
                slippageBips === bips
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {bips / 100}%
            </button>
          ))}
        </div>
      </div>

      {activeError && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-left text-xs text-danger">
          {activeError}
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={!route || !address || isLoading}
        className={`mt-4 h-14 w-full rounded-2xl font-bold transition-all active:scale-[0.99] ${
          !address
            ? "cursor-not-allowed border border-border bg-surface-2 text-muted-foreground"
            : !route
            ? "cursor-not-allowed border border-primary/20 bg-primary/10 text-primary/40"
            : "bg-primary text-primary-foreground shadow-glow hover:brightness-110"
        }`}
      >
        {!address
          ? "Connect wallet to trade"
          : isLoading
          ? "Executing…"
          : !route
          ? "Enter an amount"
          : "Swap"}
      </button>
    </Card>
  );
}

function TokenSelect({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-xl border border-border bg-surface pl-4 pr-9 font-mono text-sm font-bold text-foreground outline-none transition hover:border-primary/40"
      >
        {TOKENS.map((t) => (
          <option key={t.symbol} value={t.symbol}>
            {t.symbol}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
