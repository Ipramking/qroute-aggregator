"use client";

import { useEffect, useState } from "react";
import { useWeb3Store } from "../store/useWeb3Store";
import { shortenAddress, getZoneForAddress } from "../utils/quai";

export default function WalletConnect() {
  const {
    address,
    zone,
    hasPelagus,
    setWallet,
    clearWallet,
    setHasPelagus
  } = useWeb3Store();

  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Check if Pelagus wallet is installed
    if (typeof window !== "undefined" && (window as any).pelagus) {
      setHasPelagus(true);
      
      // Auto-connect if already authorized
      (window as any).pelagus
        .request({ method: "quai_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            handleConnection(accounts[0]);
          }
        })
        .catch(() => {});

      // Set up account change listener
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          handleConnection(accounts[0]);
        } else {
          disconnect();
        }
      };

      (window as any).pelagus.on("accountsChanged", handleAccountsChanged);

      return () => {
        (window as any).pelagus.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, [setHasPelagus]);

  const handleConnection = (addr: string) => {
    const mappedZone = getZoneForAddress(addr);
    setWallet(addr, mappedZone);
  };

  const connect = async () => {
    if (isConnecting || !hasPelagus) return;
    setIsConnecting(true);

    try {
      const accounts = await (window as any).pelagus.request({
        method: "quai_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        handleConnection(accounts[0]);
      }
    } catch (error) {
      console.error("User rejected Pelagus wallet connection", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    clearWallet();
  };

  return (
    <div className="flex items-center gap-3">
      {address ? (
        <div className="flex items-center gap-3 bg-quai-gray px-4 py-2 rounded-xl border border-neutral-800">
          <div className="flex flex-col text-left">
            <span className="text-xs text-neutral-400 font-medium">Zone: {zone}</span>
            <span className="text-sm font-semibold text-white">{shortenAddress(address)}</span>
          </div>
          <button
            onClick={disconnect}
            className="text-xs text-red-500 hover:text-red-400 font-bold transition ml-2"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={!hasPelagus}
          className={`px-5 py-2.5 rounded-xl font-bold transition text-sm ${
            hasPelagus
              ? "bg-quai-orange hover:bg-orange-600 text-white shadow-md shadow-orange-950/20"
              : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
          }`}
        >
          {hasPelagus ? "Connect Pelagus" : "Pelagus Wallet Required"}
        </button>
      )}
    </div>
  );
}
