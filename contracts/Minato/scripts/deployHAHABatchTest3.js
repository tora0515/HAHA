const { ethers } = require("hardhat");

async function main() {
  const HMBT3 = await ethers.getContractFactory("HAHAMintaoBatchTestThree");
  console.log("Deploying HAHA Minato Batch Test Token 3...");

  const hmbt3 = await HMBT3.deploy();
  const deploymentReceipt = await hmbt3.deploymentTransaction().wait(1); // Ethers v6 syntax

  console.log("HMBT3 Token deployed to:", hmbt3.target); // In Ethers v6, use `.target` for contract address
  console.log("Deployment receipt:", deploymentReceipt);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
