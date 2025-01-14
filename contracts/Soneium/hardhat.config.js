require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config({ path: __dirname + "/.env" });
require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: "0.8.22",
  networks: {
    soneium: {
      url: process.env.SONEIUM_RPC_URL, // Loads from .env
      accounts: [process.env.PRIVATE_KEY], // Loads from .env
    },
  },

  etherscan: {
    apiKey: {
      soneium: "abc", // Blockscout doesn’t require a real API key, but a non-empty string is necessary.
    },
    customChains: [
      {
        network: "soneium",
        chainId: process.env.SONEIUM_CHAIN_ID,
        urls: {
          apiURL: "https://soneium.blockscout.com/api",
          browserURL: "https://soneium.blockscout.com/",
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
