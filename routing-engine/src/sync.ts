import { quais } from "quais";
import { LiquidityGraph, DEXPool } from "./graph";
import { getRpcForZone, ZoneRPCConfig } from "./config";

const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

export class LiquiditySyncer {
  private graph: LiquidityGraph;
  private providers: Map<string, quais.JsonRpcProvider> = new Map();
  private customRpcs?: ZoneRPCConfig;
  private intervalId: NodeJS.Timeout | null = null;
  public isSyncing: boolean = false;

  constructor(graph: LiquidityGraph, customRpcs?: ZoneRPCConfig) {
    this.graph = graph;
    this.customRpcs = customRpcs;
  }

  /**
   * Get or create a Provider for the specified zone.
   */
  public getProvider(zone: string): quais.JsonRpcProvider {
    const normZone = zone.toLowerCase();
    if (!this.providers.has(normZone)) {
      const url = getRpcForZone(normZone, this.customRpcs);
      // Construct JSON-RPC provider for Quai
      const provider = new quais.JsonRpcProvider(url, undefined, { usePathing: true });
      this.providers.set(normZone, provider);
    }
    return this.providers.get(normZone)!;
  }

  /**
   * Sync a single pool's reserves from the blockchain.
   */
  public async syncPool(pool: DEXPool): Promise<void> {
    try {
      const provider = this.getProvider(pool.zone);
      const contract = new quais.Contract(pool.pairAddress, PAIR_ABI, provider);

      // Call getReserves on Quai Contract
      const [reserve0, reserve1] = await contract.getReserves();
      
      // Update reserves in graph pool
      pool.reserve0 = BigInt(reserve0.toString());
      pool.reserve1 = BigInt(reserve1.toString());
    } catch (error) {
      console.error(`Error syncing reserves for pool ${pool.pairAddress} on zone ${pool.zone}:`, error);
    }
  }

  /**
   * Sync all pools in the graph.
   */
  public async syncAll(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const syncPromises = this.graph.pools.map((pool) => this.syncPool(pool));
      await Promise.all(syncPromises);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start polling in the background to keep reserves updated.
   */
  public startPolling(intervalMs: number = 5000): void {
    if (this.intervalId) return;

    // Trigger initial sync
    this.syncAll().catch(err => console.error("Initial sync error:", err));

    this.intervalId = setInterval(() => {
      this.syncAll().catch(err => console.error("Interval sync error:", err));
    }, intervalMs);
  }

  /**
   * Stop the background polling.
   */
  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
