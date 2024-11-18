require("dotenv").config(); // Load environment variables
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Use HAHA_MINATO_TOKEN_ADDRESS from the .env file
  const hahaTokenAddress = process.env.HAHA_MINATO_TOKEN_ADDRESS;

  // Deploy the MamaGotchi contract
  const MamaGotchiFactory = await hre.ethers.getContractFactory(
    "MamaGotchiGameMinato"
  );
  const mamaGotchiGame = await MamaGotchiFactory.deploy(
    deployer.address,
    hahaTokenAddress
  );

  // Wait for deployment to complete
  await mamaGotchiGame.waitForDeployment();

  console.log("MamaGotchiGameMinato deployed to:", mamaGotchiGame.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
