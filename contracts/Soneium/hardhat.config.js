require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config({ path: __dirname + "/.env" });
require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: "0.8.22", // Update Solidity version if necessary
  networks: {
    "soneium-network": {
      url: process.env.SONEIUM_RPC_URL, // Replace with your Soneium RPC URL in .env
      accounts: [process.env.PRIVATE_KEY], // Replace with your private key in .env
    },
  },
  etherscan: {
    apiKey: {
      "soneium-network": "empty", // Use an empty API key as per Soneium's BlockScout settings
    },
    customChains: [
      {
        network: "soneium-network",
        chainId: 1868, // Soneium chain ID
        urls: {
          apiURL: "https://soneium.blockscout.com/api", // Soneium BlockScout API URL
          browserURL: "https://soneium.blockscout.com", // Soneium BlockScout browser URL
        },
      },
    ],
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
  },
};
