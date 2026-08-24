import { create } from "zustand";
import { quais } from "quais";
import { OptimizedRoute, LiquidityGraph, DEXRouter } from "qroute-aggregator-routing-engine";
import {
  ADDRESSES,
  ERC20_ABI,
  ROUTER_ABI,
  PAIR_ABI,
  ZONE,
  IS_LIVE,
  getReadProvider,
  getSigner,
  fetchPairState,
  deadlineIn,
  type PairState,
} from "../utils/contracts";

export interface Token {
  symbol: string;
  address: string;
}

// The live QI/USDC pair deployed on Cyprus-1 (addresses come from deploy.js).
export const TOKENS: Token[] = [
  { symbol: "QI", address: ADDRESSES.qi },
  { symbol: "USDC", address: ADDRESSES.usdc },
];

const DECIMALS = 18;
const qiL = ADDRESSES.qi.toLowerCase();
const usdcL = ADDRESSES.usdc.toLowerCase();

// Illustrative multi-shard liquidity used ONLY in Preview mode so the real
// pathfinder can demonstrate cross-shard + split routing before the on-chain
// pools exist. Depth varies by shard, so large trades genuinely route across
// shards (the engine's split logic decides — nothing is faked).
const DEMO_POOLS = [
  { zone: "cyprus-1", r0: 200_000n, r1: 200_000n, pair: "0x00000000000000000000000000000000000c0001" },
  { zone: "paxos-1", r0: 240_000n, r1: 240_000n, pair: "0x00000000000000000000000000000000000c0002" },
  { zone: "ethiopia-2", r0: 180_000n, r1: 180_000n, pair: "0x00000000000000000000000000000000000c0003" },
];

interface Web3State {
  // Wallet
  address: string | null;
  zone: string | null;
  hasPelagus: boolean;
  setWallet: (address: string, zone: string) => void;
  clearWallet: () => void;
  setHasPelagus: (val: boolean) => void;

  // Market data
  pairState: PairState | null;
  reservesLive: boolean;
  refreshReserves: () => Promise<void>;

  // Swap
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  slippageBips: number;
  route: OptimizedRoute | null;
  error: string | null;
  setTokenIn: (token: Token) => void;
  setTokenOut: (token: Token) => void;
  setAmountIn: (amount: string) => void;
  setSlippageBips: (bips: number) => void;
  calculateOptimalRoute: () => void;
  executeSwap: () => Promise<string>;

  // Liquidity
  lpTokenA: Token;
  lpTokenB: Token;
  lpAmountA: string;
  lpAmountB: string;
  lpSharesBalance: string;
  lpError: string | null;
  setLpTokenA: (token: Token) => void;
  setLpTokenB: (token: Token) => void;
  setLpAmountA: (amount: string) => void;
  setLpAmountB: (amount: string) => void;
  addLiquidity: () => Promise<string>;
  removeLiquidity: () => Promise<string>;
  fetchLpShares: () => Promise<void>;
}

async function ensureAllowance(
  tokenAddress: string,
  owner: string,
  amount: bigint,
  signer: any
) {
  const token = new quais.Contract(tokenAddress, ERC20_ABI, signer);
  const current: bigint = BigInt((await token.allowance(owner, ADDRESSES.router)).toString());
  if (current < amount) {
    // Exact-amount approval (audit M3: never approve the full uint256 max).
    const tx = await token.approve(ADDRESSES.router, amount);
    await tx.wait();
  }
}

export const useWeb3Store = create<Web3State>((set, get) => ({
  // ---- Wallet ----
  address: null,
  zone: null,
  hasPelagus: false,
  setWallet: (address, zone) => {
    set({ address, zone });
    get().refreshReserves();
    get().fetchLpShares();
  },
  clearWallet: () => set({ address: null, zone: null, lpSharesBalance: "0.0" }),
  setHasPelagus: (hasPelagus) => set({ hasPelagus }),

  // ---- Market data ----
  pairState: null,
  reservesLive: false,
  refreshReserves: async () => {
    if (!IS_LIVE) {
      set({ reservesLive: false });
      get().calculateOptimalRoute();
      return;
    }
    try {
      const st = await fetchPairState();
      set({ pairState: st, reservesLive: true });
    } catch {
      set({ reservesLive: false });
    }
    get().calculateOptimalRoute();
  },

  // ---- Swap ----
  tokenIn: TOKENS[0],
  tokenOut: TOKENS[1],
  amountIn: "",
  slippageBips: 50, // 0.5%
  route: null,
  error: null,

  setTokenIn: (tokenIn) => {
    set({ tokenIn });
    get().calculateOptimalRoute();
  },
  setTokenOut: (tokenOut) => {
    set({ tokenOut });
    get().calculateOptimalRoute();
  },
  setAmountIn: (amountIn) => {
    set({ amountIn });
    get().calculateOptimalRoute();
  },
  setSlippageBips: (slippageBips) => set({ slippageBips }),

  calculateOptimalRoute: () => {
    const { tokenIn, tokenOut, amountIn, zone, pairState } = get();

    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
      set({ route: null, error: null });
      return;
    }
    if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
      set({ route: null, error: "Select two different tokens." });
      return;
    }

    try {
      const graph = new LiquidityGraph();
      const t0 = qiL < usdcL ? qiL : usdcL;
      const t1 = t0 === qiL ? usdcL : qiL;

      if (IS_LIVE && pairState) {
        // Single real Cyprus-1 pool from live on-chain reserves.
        graph.registerPool({
          pairAddress: ADDRESSES.pair,
          token0: pairState.token0,
          token1: pairState.token0 === qiL ? usdcL : qiL,
          reserve0: pairState.reserve0,
          reserve1: pairState.reserve1,
          zone: ZONE,
        });
      } else {
        // Preview: multi-shard demo liquidity for cross-shard/split routing.
        for (const p of DEMO_POOLS) {
          graph.registerPool({
            pairAddress: p.pair,
            token0: t0,
            token1: t1,
            reserve0: p.r0 * 10n ** 18n,
            reserve1: p.r1 * 10n ** 18n,
            zone: p.zone,
          });
        }
      }

      const router = new DEXRouter(graph);
      const parsedAmountIn = quais.parseUnits(amountIn, DECIMALS);
      const optimalRoute = router.findOptimalRoute(
        tokenIn.address,
        tokenOut.address,
        parsedAmountIn,
        zone || ZONE
      );
      set({ route: optimalRoute, error: null });
    } catch (err: any) {
      set({ route: null, error: err.message || "Failed to calculate swap path." });
    }
  },

  executeSwap: async () => {
    const { tokenIn, tokenOut, amountIn, address, route, slippageBips } = get();
    if (!IS_LIVE) throw new Error("Contracts are not deployed yet (preview mode).");
    if (!address) throw new Error("Connect your wallet first.");
    if (!route) throw new Error("No route available.");

    const signer = await getSigner();
    const amtIn = quais.parseUnits(amountIn, DECIMALS);
    await ensureAllowance(tokenIn.address, address, amtIn, signer);

    const minOut = (route.expectedAmountOut * BigInt(10000 - slippageBips)) / 10000n;
    const router = new quais.Contract(ADDRESSES.router, ROUTER_ABI, signer);
    const tx = await router.localSwap(
      tokenIn.address,
      tokenOut.address,
      amtIn,
      minOut,
      address,
      deadlineIn(20)
    );
    return tx.hash;
  },

  // ---- Liquidity ----
  lpTokenA: TOKENS[0],
  lpTokenB: TOKENS[1],
  lpAmountA: "",
  lpAmountB: "",
  lpSharesBalance: "0.0",
  lpError: null,

  setLpTokenA: (lpTokenA) => set({ lpTokenA }),
  setLpTokenB: (lpTokenB) => set({ lpTokenB }),
  setLpAmountA: (lpAmountA) => {
    set({ lpAmountA });
    // Reflect the current pool ratio (or 1:1 preview) for the paired token.
    const { pairState } = get();
    if (lpAmountA && !isNaN(Number(lpAmountA)) && pairState) {
      const a = Number(quais.formatUnits(pairState.reserve0, DECIMALS));
      const b = Number(quais.formatUnits(pairState.reserve1, DECIMALS));
      const ratio = a > 0 ? b / a : 1;
      set({ lpAmountB: (Number(lpAmountA) * ratio).toString() });
    } else if (lpAmountA && !isNaN(Number(lpAmountA))) {
      set({ lpAmountB: lpAmountA });
    } else {
      set({ lpAmountB: "" });
    }
  },
  setLpAmountB: (lpAmountB) => set({ lpAmountB }),

  fetchLpShares: async () => {
    const { address } = get();
    if (!address || !IS_LIVE) {
      set({ lpSharesBalance: "0.0" });
      return;
    }
    try {
      const provider = getReadProvider();
      const pair = new quais.Contract(ADDRESSES.pair, PAIR_ABI, provider);
      const bal = await pair.balanceOf(address);
      set({ lpSharesBalance: Number(quais.formatUnits(bal, DECIMALS)).toFixed(4) });
    } catch {
      set({ lpSharesBalance: "0.0" });
    }
  },

  addLiquidity: async () => {
    const { lpTokenA, lpTokenB, lpAmountA, lpAmountB, address } = get();
    if (!IS_LIVE) throw new Error("Contracts are not deployed yet (preview mode).");
    if (!address || !lpAmountA || isNaN(Number(lpAmountA))) {
      throw new Error("Invalid deposit parameters.");
    }

    const signer = await getSigner();
    const amtA = quais.parseUnits(lpAmountA, DECIMALS);
    const amtB = quais.parseUnits(lpAmountB || lpAmountA, DECIMALS);

    await ensureAllowance(lpTokenA.address, address, amtA, signer);
    await ensureAllowance(lpTokenB.address, address, amtB, signer);

    const router = new quais.Contract(ADDRESSES.router, ROUTER_ABI, signer);
    const tx = await router.addLiquidity(
      lpTokenA.address,
      lpTokenB.address,
      amtA,
      amtB,
      address,
      deadlineIn(20)
    );
    await tx.wait();
    set({ lpAmountA: "", lpAmountB: "" });
    await get().fetchLpShares();
    return tx.hash;
  },

  removeLiquidity: async () => {
    const { lpTokenA, lpTokenB, address } = get();
    if (!IS_LIVE) throw new Error("Contracts are not deployed yet (preview mode).");
    if (!address) throw new Error("Connect your wallet first.");

    const signer = await getSigner();
    const pair = new quais.Contract(ADDRESSES.pair, PAIR_ABI, signer);
    const lp: bigint = BigInt((await pair.balanceOf(address)).toString());
    if (lp <= 0n) throw new Error("No LP shares to withdraw.");

    // Approve the router to pull the LP tokens (exact amount).
    await (await pair.approve(ADDRESSES.router, lp)).wait();

    const router = new quais.Contract(ADDRESSES.router, ROUTER_ABI, signer);
    const tx = await router.removeLiquidity(
      lpTokenA.address,
      lpTokenB.address,
      lp,
      address,
      deadlineIn(20)
    );
    await tx.wait();
    await get().fetchLpShares();
    return tx.hash;
  },
}));
