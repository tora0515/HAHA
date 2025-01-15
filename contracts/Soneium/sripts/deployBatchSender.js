const { ethers } = require("hardhat");

async function main() {
  // Retrieve the signer deploying the contract
  const [deployer] = await ethers.getSigners();

  console.log("Deploying BatchSender contract with account:", deployer.address);

  // Deploy the BatchSender contract
  const BatchSender = await ethers.getContractFactory("BatchSender");
  const batchSender = await BatchSender.deploy();

  // Wait for the deployment to be completed
  await batchSender.waitForDeployment();

  // Retrieve the deployed contract address
  const contractAddress = await batchSender.getAddress();

  console.log("BatchSender deployed successfully to:", contractAddress);
  console.log("Transaction sent by:", deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });
