"use client";

import { useEffect, useRef, useState } from "react";
import { useWeb3Store } from "../store/useWeb3Store";
import { shortenAddress, getZoneForAddress } from "../utils/quai";
import { initWalletDiscovery, getInjectedProvider, requestAccounts } from "../utils/wallet";

const PELAGUS_URL = "https://pelaguswallet.io/";

export default function WalletConnect() {
  const { address, zone, hasPelagus, setWallet, clearWallet, setHasPelagus } = useWeb3Store();
  const [isConnecting, setIsConnecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const providerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    initWalletDiscovery();

    let stopped = false;
    const onAccountsChanged = (accounts: string[]) => {
      if (accounts?.length) setWallet(accounts[0], getZoneForAddress(accounts[0]));
      else clearWallet();
    };

    const bind = () => {
      const p = getInjectedProvider();
      if (!p) return false;
      setHasPelagus(true);
      if (!providerRef.current) {
        providerRef.current = p;
        requestAccounts(p, false)
          .then((accts) => {
            if (!stopped && accts?.length) onAccountsChanged(accts);
          })
          .catch(() => {});
        p.on?.("accountsChanged", onAccountsChanged);
      }
      return true;
    };

    // Providers can announce a little after load — poll for ~5s.
    if (!bind()) {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if (bind() || tries > 25) clearInterval(timer);
      }, 200);
      return () => {
        stopped = true;
        clearInterval(timer);
        providerRef.current?.removeListener?.("accountsChanged", onAccountsChanged);
      };
    }
    return () => {
      stopped = true;
      providerRef.current?.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [setHasPelagus, setWallet, clearWallet]);

  const connect = async () => {
    if (isConnecting) return;
    setErr(null);
    const provider = getInjectedProvider();
    if (!provider) {
      window.open(PELAGUS_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = await requestAccounts(provider, true);
      if (accounts?.length) setWallet(accounts[0], getZoneForAddress(accounts[0]));
      else setErr("No account returned — unlock Pelagus and retry.");
    } catch (e: any) {
      setErr(e?.message || "Connection rejected.");
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
    <div className="relative">
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
      {err && (
        <p className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-right text-[11px] text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
