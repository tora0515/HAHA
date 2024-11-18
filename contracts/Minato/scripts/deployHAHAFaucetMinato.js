require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  // Retrieve the token address from the environment variables
  const HAHA_MINATO_TOKEN_ADDRESS = process.env.HAHA_MINATO_TOKEN_ADDRESS;

  if (!HAHA_MINATO_TOKEN_ADDRESS) {
    throw new Error("HAHA_MINATO_TOKEN_ADDRESS is not defined in .env");
  }

  const Faucet = await ethers.getContractFactory("Faucet");
  console.log("Deploying HAHAFaucetMinato...");

  const faucet = await Faucet.deploy(HAHA_MINATO_TOKEN_ADDRESS);
  await faucet.waitForDeployment();

  const deploymentReceipt = await faucet.deploymentTransaction().wait(1); // Ethers v6 syntax

  console.log("HAHAFaucetMinato deployed to:", faucet.target); // In Ethers v6, use `.target` for contract address
  console.log("Deployment receipt:", deploymentReceipt);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
