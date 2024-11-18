require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  // Retrieve the token address from the environment variables
  const HAHA_MINATO_TOKEN_ADDRESS = process.env.HAHA_MINATO_TOKEN_ADDRESS;

  if (!HAHA_MINATO_TOKEN_ADDRESS) {
    throw new Error("HAHA_MINATO_TOKEN_ADDRESS is not defined in .env");
  }

  const HAHAFaucetMinato = await ethers.getContractFactory("HAHAFaucetMinato");
  console.log("Deploying HAHAFaucetMinato...");

  const hahafaucetminato = await HAHAFaucetMinato.deploy(
    HAHA_MINATO_TOKEN_ADDRESS
  );
  await hahafaucetminato.waitForDeployment();

  const deploymentReceipt = await hahafaucetminato
    .deploymentTransaction()
    .wait(1); // Ethers v6 syntax

  console.log("HAHAFaucetMinato deployed to:", hahafaucetminato.target); // In Ethers v6, use `.target` for contract address
  console.log("Deployment receipt:", deploymentReceipt);
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
