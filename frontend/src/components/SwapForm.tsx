"use client";

import { useState } from "react";
import { quais } from "quais";
import { useWeb3Store, TOKENS } from "../store/useWeb3Store";
import { OptimizedRoute } from "qroute-aggregator-routing-engine";

interface SwapFormProps {
  onSwapDispatched: (txHash: string, route: OptimizedRoute) => void;
}

export default function SwapForm({ onSwapDispatched }: SwapFormProps) {
  const {
    address: userAddress,
    zone: userZone,
    tokenIn,
    tokenOut,
    amountIn,
    route,
    error,
    setTokenIn,
    setTokenOut,
    setAmountIn
  } = useWeb3Store();

  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const executeSwap = async () => {
    if (!route || !userAddress || !(window as any).pelagus) return;
    setIsLoading(true);
    setLocalError(null);

    try {
      const provider = new quais.BrowserProvider((window as any).pelagus);
      const signer = await provider.getSigner();
      
      // Select router contract address on the appropriate zone.
      const routerAddress = "0x8888888888888888888888888888888888888888"; 
      
      const tx = await signer.sendTransaction({
        from: userAddress,
        to: routerAddress,
        value: route.path[0].type === "LOCAL_SWAP" ? route.amountIn : 0n,
        data: "0x"
      });

      onSwapDispatched(tx.hash, route);
    } catch (err: any) {
      setLocalError(err.message || "Transaction execution failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeError = error || localError;

  return (
    <div className="bg-quai-gray rounded-2xl p-6 border border-neutral-800 w-full max-w-md shadow-xl">
      <h2 className="text-lg font-bold text-white text-left mb-5">Swap Tokens</h2>

      <div className="space-y-4">
        {/* Input Card */}
        <div className="bg-quai-dark p-4 rounded-xl border border-neutral-900">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-neutral-400 font-medium">From</span>
          </div>
          <div className="flex justify-between items-center">
            <input
              type="text"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="bg-transparent text-2xl font-bold text-white outline-none w-2/3"
            />
            <select
              value={tokenIn.symbol}
              onChange={(e) => setTokenIn(TOKENS.find(t => t.symbol === e.target.value)!)}
              className="bg-neutral-800 text-white rounded-lg p-2 font-semibold text-sm outline-none border border-neutral-700"
            >
              {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        {/* Swap Icon */}
        <div className="flex justify-center -my-2">
          <div className="bg-neutral-800 p-2 rounded-lg border border-neutral-700 cursor-pointer hover:bg-neutral-700 transition">
            ⬇️
          </div>
        </div>

        {/* Output Card */}
        <div className="bg-quai-dark p-4 rounded-xl border border-neutral-900">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-neutral-400 font-medium">To (Estimated)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-white">
              {route ? (Number(route.expectedAmountOut) / 1e18).toFixed(4) : "0.0"}
            </span>
            <select
              value={tokenOut.symbol}
              onChange={(e) => setTokenOut(TOKENS.find(t => t.symbol === e.target.value)!)}
              className="bg-neutral-800 text-white rounded-lg p-2 font-semibold text-sm outline-none border border-neutral-700"
            >
              {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        {/* Pathfinder Visualizer */}
        {route && (
          <div className="bg-quai-dark/40 p-4 rounded-xl border border-neutral-900/50 text-left">
            <span className="text-xs text-neutral-400 font-semibold block mb-2">Optimal Path Selection</span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-neutral-800 px-2 py-1 rounded text-white font-medium capitalize">
                {userZone || "cyprus-1"}
              </span>
              {route.path.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-neutral-500">➔</span>
                  <span className="bg-neutral-800/80 px-2 py-1 rounded text-neutral-300 font-mono">
                    {step.type === "LOCAL_SWAP" && `Local Swap (${step.expectedAmountOut.toString().slice(0, 4)}...)`}
                    {step.type === "CROSS_SHARD_TRANSFER" && `Bridge to ${step.toZone}`}
                    {step.type === "CROSS_SHARD_SWAP" && `Swap on ${step.toZone}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-neutral-400 flex justify-between">
              <span>Estimated Gas Cost:</span>
              <span className="font-semibold text-neutral-300">{route.totalGasCost.toString()} gas</span>
            </div>
          </div>
        )}

        {activeError && (
          <div className="bg-red-950/20 text-red-400 border border-red-900/50 px-4 py-2.5 rounded-xl text-xs text-left">
            ⚠️ {activeError}
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={executeSwap}
          disabled={!route || !userAddress || isLoading}
          className={`w-full py-4 rounded-xl font-bold transition ${
            !userAddress
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
              : !route
              ? "bg-quai-orange/20 text-quai-orange/40 cursor-not-allowed border border-quai-orange/10"
              : "bg-quai-orange hover:bg-orange-600 text-white shadow-md shadow-orange-950/25"
          }`}
        >
          {!userAddress
            ? "Connect Wallet to Trade"
            : isLoading
            ? "Executing Transaction..."
            : "Swap Tokens"}
        </button>
      </div>
    </div>
  );
}
