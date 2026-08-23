"use client";

import { useEffect, useState } from "react";
import { OptimizedRoute } from "qroute-aggregator-routing-engine";

interface TxTrackerProps {
  txHash: string;
  route: OptimizedRoute;
  onClose: () => void;
}

export default function TxTracker({ txHash, route, onClose }: TxTrackerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { title: "Broadcasting Transaction", description: "Submitting transaction payload to your origin Zone shard..." },
    { title: "Executing Local Swap / Bridge Lockup", description: "Deducting protocol fees and locking tokens inside origin router..." },
    { title: "Waiting for Coincident Block", description: "Mined block matching region/prime difficulty to synchronize states asynchronously..." },
    { title: "Executing Remote Swap / Callback", description: "DEX pool executes the swap on the destination zone shard..." },
    { title: "Completing Transfer", description: "Swapped tokens are routed back to your origin wallet address. Complete!" }
  ];

  // If the path is LOCAL_SWAP, we only need a subset of steps (simulating instant finish)
  const isCrossShard = route.path.some((step) => step.type === "CROSS_SHARD_SWAP");
  const activeSteps = isCrossShard ? steps : [steps[0], steps[1], steps[4]];

  useEffect(() => {
    // Simulate block finality progress
    const totalDuration = isCrossShard ? 15000 : 3000; // 15s for cross-shard, 3s for local swap simulation
    const intervalTime = totalDuration / 100;
    
    let currentProgress = 0;
    const timer = setInterval(() => {
      currentProgress += 1;
      setProgress(currentProgress);

      // Map progress to steps
      const currentStep = Math.min(
        Math.floor((currentProgress / 100) * activeSteps.length),
        activeSteps.length - 1
      );
      setStepIndex(currentStep);

      if (currentProgress >= 100) {
        clearInterval(timer);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isCrossShard, activeSteps.length]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-quai-gray border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-md font-bold text-white">Transaction Status</h3>
          <span className="text-xs text-neutral-500 font-mono">Hash: {txHash.slice(0, 10)}...</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-quai-dark h-2 rounded-full mb-6 overflow-hidden border border-neutral-900">
          <div
            className="bg-quai-orange h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps List */}
        <div className="space-y-6 text-left">
          {activeSteps.map((step, idx) => {
            const isCompleted = idx < stepIndex || progress >= 100;
            const isActive = idx === stepIndex && progress < 100;

            return (
              <div key={idx} className="flex gap-4">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border transition ${
                      isCompleted
                        ? "bg-green-950/20 border-green-500 text-green-400"
                        : isActive
                        ? "bg-quai-orange/20 border-quai-orange text-quai-orange animate-pulse"
                        : "bg-neutral-900 border-neutral-800 text-neutral-500"
                    }`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  {idx < activeSteps.length - 1 && (
                    <div
                      className={`w-0.5 h-10 border-l border-dashed transition ${
                        isCompleted ? "border-green-800" : "border-neutral-800"
                      }`}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pb-2">
                  <h4
                    className={`text-sm font-semibold transition ${
                      isCompleted ? "text-neutral-300" : isActive ? "text-white" : "text-neutral-500"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {progress >= 100 && (
          <button
            onClick={onClose}
            className="mt-6 w-full py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold rounded-xl transition text-sm"
          >
            Close Tracker
          </button>
        )}
      </div>
    </div>
  );
}
