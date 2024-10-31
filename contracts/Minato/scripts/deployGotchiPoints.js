const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying GotchiPoints contract with the account:",
    deployer.address
  );

  // Fetch and deploy the contract
  const GotchiPoints = await ethers.getContractFactory("GotchiPoints");

  // Replace `YOUR_INITIAL_OWNER_ADDRESS` with the address that should own the contract
  const gotchiPoints = await GotchiPoints.deploy(deployer.address);
  await gotchiPoints.deploymentTransaction().wait(1);

  console.log("GotchiPoints contract deployed to:", gotchiPoints.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
