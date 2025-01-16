const { ethers } = require("hardhat");

async function main() {
  const HAHA = await ethers.getContractFactory("HAHA");
  console.log("Deploying HAHA Token...");

  const haha = await HAHA.deploy();
  const deploymentReceipt = await haha.deploymentTransaction().wait(1); // Ethers v6 syntax

  console.log("HAHA Token deployed to:", haha.target); // In Ethers v6, use `.target` for contract address
  console.log("Deployment receipt:", deploymentReceipt);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
