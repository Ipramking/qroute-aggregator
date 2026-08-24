import { DEXPool } from "qroute-aggregator-routing-engine";

export interface SwapEvent {
  poolAddress: string;
  tokenIn: string;
  amountIn: bigint;
  zone: string;
}

export interface PendingSwapTx {
  txHash: string;
  poolAddress: string;
  tokenIn: string;
  amountIn: bigint;
  gasPrice: bigint;
  zone: string;
}

export class ArbitrageMonitor {
  private activePools: DEXPool[] = [];
  private listeners: ((event: SwapEvent) => void)[] = [];
  private mempoolListeners: ((tx: PendingSwapTx) => void)[] = [];
  private routerAddress: string;

  constructor(pools: DEXPool[], routerAddress?: string) {
    this.activePools = pools;
    this.routerAddress = (routerAddress || "0x8888888888888888888888888888888888888888").toLowerCase();
  }

  /**
   * Registers a callback listener for swap events.
   */
  public onSwapExecuted(callback: (event: SwapEvent) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Registers a callback listener for pending mempool swap transactions.
   */
  public onPendingSwapDetected(callback: (tx: PendingSwapTx) => void): void {
    this.mempoolListeners.push(callback);
  }

  /**
   * Subscribes to the live Quai node mempool for pending transactions.
   */
  public subscribeToMempool(provider: any): void {
    try {
      // In production, Quai nodes emit "pending" events over WebSockets
      provider.on("pending", async (txHash: string) => {
        try {
          const tx = await provider.getTransaction(txHash);
          if (tx && tx.to && this.isRouterTx(tx)) {
            const parsed = this.parseRouterTxPayload(tx);
            if (parsed) {
              this.triggerPendingSwap(parsed);
            }
          }
        } catch (err) {
          // Ignore failed transaction fetches standard in fast mempools
        }
      });
    } catch (e) {
      console.warn("Mempool socket connection timed out. Falling back to block polling.");
    }
  }

  private isRouterTx(tx: any): boolean {
    // Check if the transaction interacts with our configured Router address.
    return tx.to.toLowerCase() === this.routerAddress;
  }

  private parseRouterTxPayload(tx: any): PendingSwapTx | null {
    // In production, we decode transaction input data using the Router interface ABI.
    // For this simulation, we parse mock values or inputs:
    if (!tx.data || tx.data === "0x") return null;

    return {
      txHash: tx.hash,
      poolAddress: this.activePools[0]?.pairAddress || "0x1111111111111111111111111111111111111111",
      tokenIn: tx.value > 0n ? "0x0000000000000000000000000000000000000000" : "0x000000000000000000000000000000000000000A",
      amountIn: tx.value > 0n ? tx.value : 100n * (10n ** 18n),
      gasPrice: tx.gasPrice || 1000000000n,
      zone: "cyprus-1"
    };
  }

  /**
   * Simulates receiving a swap event from the network.
   */
  public triggerMockSwap(event: SwapEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Simulates detecting a pending swap in the mempool.
   */
  public triggerPendingSwap(tx: PendingSwapTx): void {
    for (const listener of this.mempoolListeners) {
      listener(tx);
    }
  }
}
