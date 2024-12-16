const { ethers } = require("hardhat");

async function main() {
  const HMBT = await ethers.getContractFactory("HAHAMintaoBatchTest");
  console.log("Deploying HAHA Minato Batch Test Token...");

  const hmbt = await HMBT.deploy();
  const deploymentReceipt = await hmbt.deploymentTransaction().wait(1); // Ethers v6 syntax

  console.log("HMBT Token deployed to:", hmbt.target); // In Ethers v6, use `.target` for contract address
  console.log("Deployment receipt:", deploymentReceipt);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
