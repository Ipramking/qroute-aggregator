require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // We define networks for Quai's hierarchical structure.
    // Each Zone chain requires its own RPC URL.
    cyprus1: {
      url: "http://localhost:8545", // Custom port or official testnet RPC
      accounts: [],
    },
    cyprus2: {
      url: "http://localhost:8546",
      accounts: [],
    },
    paxos1: {
      url: "http://localhost:8554",
      accounts: [],
    },
  },
};
