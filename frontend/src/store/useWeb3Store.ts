import { create } from "zustand";
import { OptimizedRoute, LiquidityGraph, DEXRouter } from "qroute-aggregator-routing-engine";

export interface Token {
  symbol: string;
  address: string;
}

export const TOKENS: Token[] = [
  { symbol: "QUAI", address: "0x0000000000000000000000000000000000000000" },
  { symbol: "QI", address: "0x000000000000000000000000000000000000000A" },
  { symbol: "USDC", address: "0x000000000000000000000000000000000000000B" }
];

interface Web3State {
  // Wallet state
  address: string | null;
  zone: string | null;
  hasPelagus: boolean;
  setWallet: (address: string, zone: string) => void;
  clearWallet: () => void;
  setHasPelagus: (val: boolean) => void;

  // Swap State
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  route: OptimizedRoute | null;
  error: string | null;

  setTokenIn: (token: Token) => void;
  setTokenOut: (token: Token) => void;
  setAmountIn: (amount: string) => void;
  calculateOptimalRoute: () => void;

  // Liquidity Provider (LP) State
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
  fetchLpShares: () => void;
}

// Generate the same mock graph for pathfinding
const getMockGraph = (): LiquidityGraph => {
  const graph = new LiquidityGraph();
  
  // Cyprus-1 Local Pool
  graph.registerPool({
    pairAddress: "0x1111111111111111111111111111111111111111",
    token0: TOKENS[0].address,
    token1: TOKENS[1].address,
    reserve0: 100000n * (10n ** 18n),
    reserve1: 100000n * (10n ** 18n),
    zone: "cyprus-1"
  });

  // Paxos-1 Deep Pool
  graph.registerPool({
    pairAddress: "0x2222222222222222222222222222222222222222",
    token0: TOKENS[0].address,
    token1: TOKENS[1].address,
    reserve0: 1500000n * (10n ** 18n),
    reserve1: 1500000n * (10n ** 18n),
    zone: "paxos-1"
  });

  return graph;
};

export const useWeb3Store = create<Web3State>((set, get) => ({
  // Initial Wallet state
  address: null,
  zone: null,
  hasPelagus: false,
  setWallet: (address, zone) => {
    set({ address, zone });
    get().calculateOptimalRoute();
    get().fetchLpShares(); // Fetch LP balance on connection
  },
  clearWallet: () => set({ address: null, zone: null, lpSharesBalance: "0.0" }),
  setHasPelagus: (hasPelagus) => set({ hasPelagus }),

  // Initial Swap State
  tokenIn: TOKENS[0],
  tokenOut: TOKENS[1],
  amountIn: "",
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

  calculateOptimalRoute: () => {
    const { tokenIn, tokenOut, amountIn, zone } = get();

    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
      set({ route: null, error: null });
      return;
    }

    try {
      const graph = getMockGraph();
      const router = new DEXRouter(graph);
      
      const parsedAmountIn = BigInt(Math.floor(Number(amountIn) * 1e18));
      const userZone = zone || "cyprus-1";
      
      const optimalRoute = router.findOptimalRoute(
        tokenIn.address,
        tokenOut.address,
        parsedAmountIn,
        userZone
      );
      
      set({ route: optimalRoute, error: null });
    } catch (err: any) {
      set({
        route: null,
        error: err.message || "Failed to calculate swap path."
      });
    }
  },

  // Initial Liquidity Provider (LP) State
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
    // Simple Constant Product LP helper: if Token A/B are 1:1, auto-fill Token B
    if (lpAmountA && !isNaN(Number(lpAmountA))) {
      set({ lpAmountB: lpAmountA });
    } else {
      set({ lpAmountB: "" });
    }
  },
  setLpAmountB: (lpAmountB) => {
    set({ lpAmountB });
    if (lpAmountB && !isNaN(Number(lpAmountB))) {
      set({ lpAmountA: lpAmountB });
    } else {
      set({ lpAmountA: "" });
    }
  },

  fetchLpShares: () => {
    const { address } = get();
    if (!address) {
      set({ lpSharesBalance: "0.0" });
      return;
    }
    // Simulate user holding 45.5 LPT shares
    set({ lpSharesBalance: "45.5200" });
  },

  addLiquidity: async () => {
    const { lpAmountA, address } = get();
    if (!address || !lpAmountA || isNaN(Number(lpAmountA))) {
      throw new Error("Invalid deposit parameters");
    }

    // Simulate token approvals and execution
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Add LPT shares to state
    const currentShares = parseFloat(get().lpSharesBalance);
    const newShares = (currentShares + parseFloat(lpAmountA) * 0.95).toFixed(4); // LPT formula simulation
    set({ lpSharesBalance: newShares, lpAmountA: "", lpAmountB: "" });

    return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  },

  removeLiquidity: async () => {
    const { lpSharesBalance, address } = get();
    if (!address || parseFloat(lpSharesBalance) <= 0) {
      throw new Error("No LPT shares to withdraw");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    set({ lpSharesBalance: "0.0" });

    return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}));
