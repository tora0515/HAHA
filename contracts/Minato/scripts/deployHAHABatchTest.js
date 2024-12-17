const { ethers } = require("hardhat");

async function main() {
  const HMBT2 = await ethers.getContractFactory("HAHAMintaoBatchTestTwo");
  console.log("Deploying HAHA Minato Batch Test Token 2...");

  const hmbt2 = await HMBT2.deploy();
  const deploymentReceipt = await hmbt2.deploymentTransaction().wait(1); // Ethers v6 syntax

  console.log("HMBT2 Token deployed to:", hmbt2.target); // In Ethers v6, use `.target` for contract address
  console.log("Deployment receipt:", deploymentReceipt);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
