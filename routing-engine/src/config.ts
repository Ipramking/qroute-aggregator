export interface ZoneRPCConfig {
  [zone: string]: string;
}

// Quai's three regions are Cyprus, Paxos, Hydra (3 zones each = 9 zones total).
// Only Cyprus-1 is live on mainnet today; the remaining zones activate via
// demand-triggered sharding events. These endpoints are forward-looking.
export const ORCHARD_TESTNET_RPCS: ZoneRPCConfig = {
  "cyprus-1": "https://orchard.rpc.quai.network/cyprus1",
  "cyprus-2": "https://orchard.rpc.quai.network/cyprus2",
  "cyprus-3": "https://orchard.rpc.quai.network/cyprus3",
  "paxos-1": "https://orchard.rpc.quai.network/paxos1",
  "paxos-2": "https://orchard.rpc.quai.network/paxos2",
  "paxos-3": "https://orchard.rpc.quai.network/paxos3",
  "hydra-1": "https://orchard.rpc.quai.network/hydra1",
  "hydra-2": "https://orchard.rpc.quai.network/hydra2",
  "hydra-3": "https://orchard.rpc.quai.network/hydra3"
};

export const getRpcForZone = (zone: string, customRpcs?: ZoneRPCConfig): string => {
  const normZone = zone.toLowerCase();
  if (customRpcs && customRpcs[normZone]) {
    return customRpcs[normZone];
  }
  if (ORCHARD_TESTNET_RPCS[normZone]) {
    return ORCHARD_TESTNET_RPCS[normZone];
  }
  throw new Error(`No RPC configured for zone: ${zone}`);
};
