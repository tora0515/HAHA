require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.22",
  networks: {
    minato: {
      url: process.env.SONIEUM_RPC_URL, // Loads from .env
      accounts: [process.env.PRIVATE_KEY], // Loads from .env
    },
  },
};
