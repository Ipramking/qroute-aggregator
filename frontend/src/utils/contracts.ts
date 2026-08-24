import { quais } from "quais";
import deployed from "../deployed_addresses.json";
import { getInjectedProvider } from "./wallet";

// Addresses are populated by contracts/scripts/deploy.js on a real deployment.
export const ADDRESSES = {
  router: (deployed as any).router as string,
  registry: (deployed as any).registry as string | undefined,
  pair: (deployed as any).dexPair as string,
  qi: (deployed as any).qiToken as string,
  usdc: (deployed as any).usdcToken as string,
};

export const RPC_URL =
  (deployed as any).rpcUrl || "https://orchard.rpc.quai.network/cyprus1";
export const ZONE = (deployed as any).zone || "cyprus-1";

// A real (non-simulated) deployment writes an `rpcUrl` + `registry`. Until then,
// the UI runs in a labeled preview mode instead of hitting fake addresses.
export const IS_LIVE = Boolean((deployed as any).rpcUrl && ADDRESSES.registry);

// Zones with liquidity: just the real pool when live; the demo spread in preview.
export const LIQUIDITY_ZONES = IS_LIVE
  ? ["cyprus-1"]
  : ["cyprus-1", "paxos-1", "hydra-1"];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

export const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112,uint112)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];

export const ROUTER_ABI = [
  "function localSwap(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address to,uint256 deadline) returns (uint256)",
  "function swapAndFlagCrossShard(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address to,uint256 destinationShard,uint256 deadline) returns (uint256)",
  "function addLiquidity(address tokenA,address tokenB,uint256 amountA,uint256 amountB,address to,uint256 deadline) returns (uint256)",
  "function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,address to,uint256 deadline) returns (uint256,uint256)",
  "function getAmountOut(uint256,uint256,uint256) view returns (uint256)",
];

export function getReadProvider() {
  return new quais.JsonRpcProvider(RPC_URL, undefined, { usePathing: true });
}

export function getSigner() {
  const injected = getInjectedProvider();
  if (!injected) throw new Error("No Quai wallet found. Install Pelagus.");
  const provider = new quais.BrowserProvider(injected);
  return provider.getSigner();
}

export interface PairState {
  token0: string; // lower-sorted address
  reserve0: bigint;
  reserve1: bigint;
}

/** Read live reserves for the QI/USDC pair from chain. */
export async function fetchPairState(): Promise<PairState> {
  const provider = getReadProvider();
  const pair = new quais.Contract(ADDRESSES.pair, PAIR_ABI, provider);
  const [token0, reserves] = await Promise.all([pair.token0(), pair.getReserves()]);
  return {
    token0: String(token0).toLowerCase(),
    reserve0: BigInt(reserves[0].toString()),
    reserve1: BigInt(reserves[1].toString()),
  };
}

const now = () => Math.floor(Date.now() / 1000);
export const deadlineIn = (minutes: number) => now() + minutes * 60;
