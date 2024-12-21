const { ethers } = require("ethers");

async function main() {
  const rpcUrl = "https://rpc.startale.com/astar-zkevm";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    const chainId = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    console.log("Connected to Astar zkEVM!");
    console.log("Chain ID:", chainId.chainId);
    console.log("Current Block Number:", blockNumber);
  } catch (error) {
    console.error("Error connecting to Astar zkEVM:", error);
  }
}

main().catch((error) => console.error(error));
