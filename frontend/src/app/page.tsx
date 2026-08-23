"use client";

import { useState } from "react";
import WalletConnect from "../components/WalletConnect";
import SwapForm from "../components/SwapForm";
import TxTracker from "../components/TxTracker";
import { useWeb3Store } from "../store/useWeb3Store";
import { OptimizedRoute } from "qroute-aggregator-routing-engine";

export default function Home() {
  const { address: userAddress } = useWeb3Store();
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<OptimizedRoute | null>(null);

  const handleSwapDispatched = (txHash: string, route: OptimizedRoute) => {
    setActiveTxHash(txHash);
    setActiveRoute(route);
  };

  return (
    <>
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-4 flex justify-between items-center bg-quai-dark/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">⚡</span>
          <h1 className="text-lg font-bold tracking-tight text-white font-mono">qroute</h1>
        </div>
        <WalletConnect />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center py-12 px-4 max-w-5xl mx-auto w-full gap-12">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl">
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Unifying Quai Network <span className="text-quai-orange">Cross-Shard</span> Liquidity
          </h2>
          <p className="text-base text-neutral-400 max-w-lg mx-auto">
            Trade permissionlessly across 9 sharded zones with optimal path routing, split liquidity, and minimal slippage.
          </p>
        </div>

        {/* Swap & Info Panel Grid */}
        <div className="grid md:grid-cols-2 gap-8 items-start w-full">
          {/* Swap Panel */}
          <div className="flex justify-center">
            <SwapForm onSwapDispatched={handleSwapDispatched} />
          </div>

          {/* Info Panel */}
          <div className="bg-quai-gray/50 border border-neutral-900 rounded-2xl p-6 text-left space-y-6">
            <h3 className="text-md font-bold text-white uppercase tracking-wider text-xs">How it Works</h3>
            
            <div className="space-y-4 text-sm leading-relaxed">
              <div className="flex gap-3">
                <span className="text-quai-orange font-bold">1.</span>
                <p className="text-neutral-300">
                  <strong className="text-white block mb-0.5">Off-Chain Pathfinder</strong>
                  Computes reserves across all 9 Zone shards to find the optimal trade routing, dynamically evaluating split-paths.
                </p>
              </div>

              <div className="flex gap-3">
                <span className="text-quai-orange font-bold">2.</span>
                <p className="text-neutral-300">
                  <strong className="text-white block mb-0.5">Gas-Aware Routing</strong>
                  Factors in Quai's native Type 1 External Transaction (ETx) fees so you only route cross-shard when it makes financial sense.
                </p>
              </div>

              <div className="flex gap-3">
                <span className="text-quai-orange font-bold">3.</span>
                <p className="text-neutral-300">
                  <strong className="text-white block mb-0.5">AEV Internalization</strong>
                  Our protocol captures cross-shard arbitrage discrepancies directly for the treasury instead of external miners.
                </p>
              </div>
            </div>

            <div className="border-t border-neutral-900 pt-4 flex justify-between items-center text-xs text-neutral-400">
              <span>Ecosystem Hub:</span>
              <span className="font-semibold text-neutral-300">Orchard Testnet</span>
            </div>
          </div>
        </div>

        {/* Active Transaction Tracking Modal */}
        {activeTxHash && activeRoute && (
          <TxTracker
            txHash={activeTxHash}
            route={activeRoute}
            onClose={() => {
              setActiveTxHash(null);
              setActiveRoute(null);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 px-6 text-center text-xs text-neutral-500 flex flex-col sm:flex-row justify-between items-center gap-4 bg-quai-dark/20">
        <p>© 2026 qroute. Built on Quai Network.</p>
        <div className="flex gap-4">
          <a
            href="https://github.com/Ipramking/qroute-aggregator"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition font-semibold"
          >
            GitHub Repository
          </a>
        </div>
      </footer>
    </>
  );
}
