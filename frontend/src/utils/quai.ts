export const getZoneForAddress = (address: string): string => {
  if (!address || !address.startsWith("0x") || address.length < 4) {
    return "unknown";
  }

  const prefixHex = address.slice(2, 4);
  const prefixByte = parseInt(prefixHex, 16);

  if (isNaN(prefixByte)) return "unknown";

  if (prefixByte >= 0x00 && prefixByte <= 0x1d) return "cyprus-1";
  if (prefixByte >= 0x1e && prefixByte <= 0x3b) return "cyprus-2";
  if (prefixByte >= 0x3c && prefixByte <= 0x59) return "cyprus-3";
  if (prefixByte >= 0x5a && prefixByte <= 0x77) return "paxos-1";
  if (prefixByte >= 0x78 && prefixByte <= 0x95) return "paxos-2";
  if (prefixByte >= 0x96 && prefixByte <= 0xb3) return "paxos-3";
  if (prefixByte >= 0xb4 && prefixByte <= 0xd1) return "hydra-1";
  if (prefixByte >= 0xd2 && prefixByte <= 0xef) return "hydra-2";
  if (prefixByte >= 0xf0 && prefixByte <= 0xff) return "hydra-3";

  return "unknown";
};

export const shortenAddress = (address: string): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
