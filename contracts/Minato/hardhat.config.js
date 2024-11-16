require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();
require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: "0.8.22",
  networks: {
    minato: {
      url: process.env.MINATO_RPC_URL, // Loads from .env
      accounts: [process.env.PRIVATE_KEY], // Loads from .env
    },
  },

  etherscan: {
    apiKey: {
      minato: "abc", // Blockscout doesn’t require a real API key, but a non-empty string is necessary.
    },
    customChains: [
      {
        network: "minato",
        chainId: 1946, // Replace with the Minato chain ID if different
        urls: {
          apiURL: "https://soneium-minato.blockscout.com/api",
          browserURL: "https://soneium-minato.blockscout.com/",
        },
      },
    ],
  },

  paths: {
    artifacts: "./artifacts", // Output path for compiled contracts
    sources: "./contracts", // Path to your Solidity contracts
    cache: "./cache", // Path for cached builds
  },
};
