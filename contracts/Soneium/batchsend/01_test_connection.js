const { ethers } = require("ethers");

async function main() {
  // Adjust rpcURL depending on network
  // "https://rpc.soneium.org/"
  // "https://rpc.startale.com/astar-zkevm"
  const rpcUrl = "https://rpc.soneium.org/";

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    const chainId = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    console.log("Connected!");
    console.log("Chain ID:", chainId.chainId);
    console.log("Current Block Number:", blockNumber);
  } catch (error) {
    console.error("Error connecting:", error);
  }
}

main().catch((error) => console.error(error));
