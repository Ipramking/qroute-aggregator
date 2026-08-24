"use client";

import { useEffect, useState } from "react";
import { useWeb3Store, TOKENS } from "../store/useWeb3Store";
import { IS_LIVE } from "../utils/contracts";
import { track, captureError } from "../utils/analytics";
import { Card, StatusDot } from "./ui/primitives";

export default function LPForm() {
  const {
    address,
    reservesLive,
    lpTokenA,
    lpTokenB,
    lpAmountA,
    lpAmountB,
    lpSharesBalance,
    setLpAmountA,
    setLpAmountB,
    addLiquidity,
    removeLiquidity,
    fetchLpShares,
  } = useWeb3Store();

  const [busy, setBusy] = useState<"IDLE" | "DEPOSIT" | "WITHDRAW">("IDLE");
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLpShares();
  }, [fetchLpShares, address]);

  const run = async (kind: "DEPOSIT" | "WITHDRAW", fn: () => Promise<string>) => {
    setError(null);
    setSuccessTx(null);
    setBusy(kind);
    try {
      setSuccessTx(await fn());
      track(kind === "DEPOSIT" ? "liquidity_added" : "liquidity_removed");
    } catch (err: any) {
      setError(err?.message || "Transaction failed.");
      captureError(err, { scope: kind });
    } finally {
      setBusy("IDLE");
    }
  };

  const hasShares = parseFloat(lpSharesBalance) > 0;
  const live = IS_LIVE && reservesLive;

  return (
    <Card className="w-full max-w-md p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Provide Liquidity</h2>
        <StatusDot live={live} label={live ? "Live · Cyprus-1" : "Preview"} />
      </div>

      {/* Position */}
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-surface-2/50 p-4">
        <div className="text-left">
          <span className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Your position
          </span>
          <span className="font-mono text-xl font-bold text-foreground tnum">
            {lpSharesBalance} <span className="text-sm text-muted-foreground">QR-LP</span>
          </span>
        </div>
        {hasShares && (
          <button
            onClick={() => run("WITHDRAW", removeLiquidity)}
            disabled={busy !== "IDLE"}
            className="h-11 rounded-xl border border-danger/40 bg-danger/10 px-4 text-xs font-bold text-danger transition hover:bg-danger/20 disabled:opacity-50"
          >
            {busy === "WITHDRAW" ? "Withdrawing…" : "Withdraw all"}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <LpInput label={`Deposit ${lpTokenA.symbol}`} value={lpAmountA} onChange={setLpAmountA} symbol={lpTokenA.symbol} />
        <div className="flex justify-center">
          <div className="-my-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-lg text-muted-foreground">
            +
          </div>
        </div>
        <LpInput label={`Deposit ${lpTokenB.symbol}`} value={lpAmountB} onChange={setLpAmountB} symbol={lpTokenB.symbol} />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
        <span>Pool fee tier</span>
        <span className="text-foreground">0.30%</span>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-left text-xs text-danger">
          {error}
        </div>
      )}
      {successTx && (
        <div className="mt-4 truncate rounded-xl border border-success/40 bg-success/10 px-4 py-2.5 text-left font-mono text-xs text-success">
          ✓ {successTx}
        </div>
      )}

      <button
        onClick={() => run("DEPOSIT", addLiquidity)}
        disabled={!lpAmountA || !address || busy !== "IDLE"}
        className={`mt-4 h-14 w-full rounded-2xl font-bold transition-all active:scale-[0.99] ${
          !address
            ? "cursor-not-allowed border border-border bg-surface-2 text-muted-foreground"
            : !lpAmountA
            ? "cursor-not-allowed border border-primary/20 bg-primary/10 text-primary/40"
            : "bg-primary text-primary-foreground shadow-glow hover:brightness-110"
        }`}
      >
        {!address ? "Connect wallet" : busy === "DEPOSIT" ? "Adding liquidity…" : "Add liquidity"}
      </button>
    </Card>
  );
}

function LpInput({
  label,
  value,
  onChange,
  symbol,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  symbol: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-center justify-between gap-3">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent font-display text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40 tnum"
        />
        <span className="shrink-0 rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-sm font-bold text-foreground">
          {symbol}
        </span>
      </div>
    </div>
  );
}
