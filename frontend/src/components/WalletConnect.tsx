"use client";

import { useEffect, useState } from "react";
import { useWeb3Store } from "../store/useWeb3Store";
import { shortenAddress, getZoneForAddress } from "../utils/quai";

const PELAGUS_URL = "https://pelaguswallet.io/";

export default function WalletConnect() {
  const { address, zone, hasPelagus, setWallet, clearWallet, setHasPelagus } = useWeb3Store();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleConnection = (addr: string) => setWallet(addr, getZoneForAddress(addr));
    const onAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) handleConnection(accounts[0]);
      else clearWallet();
    };

    // Pelagus injects asynchronously — poll briefly instead of checking once.
    let tries = 0;
    const detect = () => {
      const pelagus = (window as any).pelagus;
      if (pelagus) {
        setHasPelagus(true);
        pelagus
          .request({ method: "quai_accounts" })
          .then((accounts: string[]) => {
            if (accounts && accounts.length > 0) handleConnection(accounts[0]);
          })
          .catch(() => {});
        pelagus.on?.("accountsChanged", onAccountsChanged);
        return true;
      }
      return false;
    };

    if (!detect()) {
      const timer = setInterval(() => {
        tries += 1;
        if (detect() || tries > 20) clearInterval(timer); // ~3s
      }, 150);
      return () => clearInterval(timer);
    }

    return () => {
      (window as any).pelagus?.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [setHasPelagus, setWallet, clearWallet]);

  const connect = async () => {
    if (isConnecting) return;
    const pelagus = (window as any).pelagus;
    if (!pelagus) {
      window.open(PELAGUS_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = await pelagus.request({ method: "quai_requestAccounts" });
      if (accounts && accounts.length > 0) setWallet(accounts[0], getZoneForAddress(accounts[0]));
    } catch (err) {
      console.error("Pelagus connection rejected", err);
    } finally {
      setIsConnecting(false);
    }
  };

  if (address) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 px-3 py-2 backdrop-blur-xl">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
        <div className="flex flex-col text-left leading-tight">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {zone}
          </span>
          <span className="font-mono text-sm font-semibold text-foreground tnum">
            {shortenAddress(address)}
          </span>
        </div>
        <button
          onClick={clearWallet}
          className="ml-1 flex h-9 min-w-[44px] items-center justify-center rounded-lg px-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          Exit
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
    >
      {isConnecting ? (
        <>
          <span className="h-2 w-2 animate-ping rounded-full bg-primary-foreground" />
          Connecting…
        </>
      ) : hasPelagus ? (
        "Connect Pelagus"
      ) : (
        "Install Pelagus ↗"
      )}
    </button>
  );
}
