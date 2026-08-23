# qroute-aggregator

`qroute-aggregator` is a decentralized cross-shard liquidity aggregator and router designed for the **Quai Network**'s multi-chain architecture.

## Mission
To solve liquidity fragmentation across Quai's 9 execution shards, providing traders with optimal routing paths, lower slippage, and a single-transaction swap experience.

## Monetization Model
1. **Protocol Fee (0.05% – 0.1% per swap):** Embedded directly inside our routing smart contracts.
2. **AEV (Arbitrage Extractable Value) Capture:** Internal back-running bots that rebalance pool margins and return profits to the protocol treasury.
3. **API/SDK Licensing:** Providing external wallets, remittance protocols, and dApps with easy-to-use routing APIs.

## Architecture

- `/contracts`: Hardhat project compiling the cross-shard router and Uniswap V2-style pairs on Quai's EVM layer.
- `/routing-engine`: TypeScript project querying pool reserves and computing optimal routing graphs across shards.
