"use client";

import { useState } from "react";
import { useWeb3Store, TOKENS } from "../store/useWeb3Store";

export default function LPForm() {
  const {
    address: userAddress,
    lpTokenA,
    lpTokenB,
    lpAmountA,
    lpAmountB,
    lpSharesBalance,
    setLpTokenA,
    setLpTokenB,
    setLpAmountA,
    setLpAmountB,
    addLiquidity,
    removeLiquidity
  } = useWeb3Store();

  const [txStage, setTxStage] = useState<"IDLE" | "APPROVING_A" | "APPROVING_B" | "DEPOSITING" | "WITHDRAWING">("IDLE");
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddLiquidity = async () => {
    if (!lpAmountA || !userAddress) return;
    setError(null);
    setSuccessTx(null);

    try {
      // Step 1: Simulate Approval for Token A
      setTxStage("APPROVING_A");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 2: Simulate Approval for Token B
      setTxStage("APPROVING_B");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 3: Execute Liquidity Deposit
      setTxStage("DEPOSITING");
      const txHash = await addLiquidity();
      
      setSuccessTx(txHash);
    } catch (err: any) {
      setError(err.message || "Failed to add liquidity.");
    } finally {
      setTxStage("IDLE");
    }
  };

  const handleRemoveLiquidity = async () => {
    if (parseFloat(lpSharesBalance) <= 0 || !userAddress) return;
    setError(null);
    setSuccessTx(null);
    setTxStage("WITHDRAWING");

    try {
      const txHash = await removeLiquidity();
      setSuccessTx(txHash);
    } catch (err: any) {
      setError(err.message || "Failed to withdraw liquidity.");
    } finally {
      setTxStage("IDLE");
    }
  };

  return (
    <div className="bg-quai-gray rounded-2xl p-6 border border-neutral-800 w-full max-w-md shadow-xl">
      <h2 className="text-lg font-bold text-white text-left mb-5">Liquidity Pools</h2>

      {/* User LP Status Card */}
      <div className="bg-quai-dark/40 border border-neutral-900 rounded-xl p-4 mb-5 text-left flex justify-between items-center">
        <div>
          <span className="text-xs text-neutral-400 font-semibold block mb-0.5">Your Pool Shares</span>
          <span className="text-xl font-bold text-white font-mono">{lpSharesBalance} LPT</span>
        </div>
        {parseFloat(lpSharesBalance) > 0 && (
          <button
            onClick={handleRemoveLiquidity}
            disabled={txStage !== "IDLE"}
            className="text-xs bg-red-950/20 text-red-400 hover:bg-red-900/30 border border-red-900/50 font-bold px-3 py-1.5 rounded-lg transition"
          >
            {txStage === "WITHDRAWING" ? "Withdrawing..." : "Withdraw All"}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Token A Input */}
        <div className="bg-quai-dark p-4 rounded-xl border border-neutral-900">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-neutral-400 font-medium">Input Token 1</span>
          </div>
          <div className="flex justify-between items-center">
            <input
              type="text"
              placeholder="0.0"
              value={lpAmountA}
              onChange={(e) => setLpAmountA(e.target.value)}
              className="bg-transparent text-2xl font-bold text-white outline-none w-2/3"
            />
            <select
              value={lpTokenA.symbol}
              onChange={(e) => setLpTokenA(TOKENS.find(t => t.symbol === e.target.value)!)}
              className="bg-neutral-800 text-white rounded-lg p-2 font-semibold text-sm outline-none border border-neutral-700"
            >
              {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        {/* Plus Icon */}
        <div className="flex justify-center -my-2">
          <div className="bg-neutral-800 p-2 rounded-lg border border-neutral-700 font-bold text-sm">
            ➕
          </div>
        </div>

        {/* Token B Input */}
        <div className="bg-quai-dark p-4 rounded-xl border border-neutral-900">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-neutral-400 font-medium">Input Token 2</span>
          </div>
          <div className="flex justify-between items-center">
            <input
              type="text"
              placeholder="0.0"
              value={lpAmountB}
              onChange={(e) => setLpAmountB(e.target.value)}
              className="bg-transparent text-2xl font-bold text-white outline-none w-2/3"
            />
            <select
              value={lpTokenB.symbol}
              onChange={(e) => setLpTokenB(TOKENS.find(t => t.symbol === e.target.value)!)}
              className="bg-neutral-800 text-white rounded-lg p-2 font-semibold text-sm outline-none border border-neutral-700"
            >
              {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        {/* Info panel */}
        {lpAmountA && (
          <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-900 text-xs text-neutral-400 space-y-2 text-left">
            <div className="flex justify-between">
              <span>Expected Pool Share:</span>
              <span className="text-neutral-200 font-semibold">~0.15%</span>
            </div>
            <div className="flex justify-between">
              <span>Pool Fee Tier:</span>
              <span className="text-neutral-200 font-semibold">0.3% pool fee</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/20 text-red-400 border border-red-900/50 px-4 py-2.5 rounded-xl text-xs text-left">
            ⚠️ {error}
          </div>
        )}

        {successTx && (
          <div className="bg-green-950/20 text-green-400 border border-green-900/50 px-4 py-2.5 rounded-xl text-xs text-left font-mono truncate">
            ✓ Success! Tx: {successTx}
          </div>
        )}

        {/* Deposit Button */}
        <button
          onClick={handleAddLiquidity}
          disabled={!lpAmountA || !userAddress || txStage !== "IDLE"}
          className={`w-full py-4 rounded-xl font-bold transition text-sm ${
            !userAddress
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
              : !lpAmountA
              ? "bg-quai-orange/20 text-quai-orange/40 cursor-not-allowed border border-quai-orange/10"
              : "bg-quai-orange hover:bg-orange-600 text-white shadow-md shadow-orange-950/25"
          }`}
        >
          {!userAddress
            ? "Connect Wallet to Provide Liquidity"
            : txStage === "APPROVING_A"
            ? `Approving ${lpTokenA.symbol}...`
            : txStage === "APPROVING_B"
            ? `Approving ${lpTokenB.symbol}...`
            : txStage === "DEPOSITING"
            ? "Adding Liquidity..."
            : "Add Liquidity"}
        </button>
      </div>
    </div>
  );
}
