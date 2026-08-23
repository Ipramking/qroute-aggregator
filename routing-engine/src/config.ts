export interface ZoneRPCConfig {
  [zone: string]: string;
}

export const ORCHARD_TESTNET_RPCS: ZoneRPCConfig = {
  "cyprus-1": "https://orchard.rpc.quai.network/cyprus1",
  "cyprus-2": "https://orchard.rpc.quai.network/cyprus2",
  "cyprus-3": "https://orchard.rpc.quai.network/cyprus3",
  "ethiopia-1": "https://orchard.rpc.quai.network/ethiopia1",
  "ethiopia-2": "https://orchard.rpc.quai.network/ethiopia2",
  "ethiopia-3": "https://orchard.rpc.quai.network/ethiopia3",
  "paxos-1": "https://orchard.rpc.quai.network/paxos1",
  "paxos-2": "https://orchard.rpc.quai.network/paxos2",
  "paxos-3": "https://orchard.rpc.quai.network/paxos3"
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
