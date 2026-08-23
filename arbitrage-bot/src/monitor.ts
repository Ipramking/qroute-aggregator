import { DEXPool } from "qroute-aggregator-routing-engine";

export interface SwapEvent {
  poolAddress: string;
  tokenIn: string;
  amountIn: bigint;
  zone: string;
}

export class ArbitrageMonitor {
  private activePools: DEXPool[] = [];
  private listeners: ((event: SwapEvent) => void)[] = [];

  constructor(pools: DEXPool[]) {
    this.activePools = pools;
  }

  /**
   * Registers a callback listener for swap events.
   */
  public onSwapExecuted(callback: (event: SwapEvent) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Simulates receiving a swap event from the network.
   */
  public triggerMockSwap(event: SwapEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
