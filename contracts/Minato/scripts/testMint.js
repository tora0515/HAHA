const { ethers } = require("hardhat");

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners(); // Set up three test accounts

  // Deploy the HAHA token
  const HAHAToken = await ethers.getContractFactory("HAHAMinatoTestnetToken");
  const hahaToken = await HAHAToken.deploy();
  await hahaToken.waitForDeployment(); // Use `waitForDeployment` to ensure it's ready
  console.log("HAHA token deployed to:", hahaToken.target); // Use `.target` instead of `.address` in Ethers v6

  // Deploy the MamaGotchiGameMinato contract, using the deployer as the owner
  const MamaGotchiGame = await ethers.getContractFactory(
    "MamaGotchiGameMinato"
  );
  const mintCost = ethers.parseUnits("10000000", 18); // Use `parseUnits` from Ethers v6
  const mamaGotchiGame = await MamaGotchiGame.deploy(
    deployer.address,
    hahaToken.target
  ); // `.target` for address
  await mamaGotchiGame.waitForDeployment();
  console.log("MamaGotchiGameMinato deployed to:", mamaGotchiGame.target);

  // Mint some HAHA tokens to user1 and user2 for testing purposes
  await hahaToken.transfer(user1.address, mintCost);
  await hahaToken.transfer(user2.address, mintCost);

  // Check balance of user1 to ensure it has enough tokens
  const user1Balance = await hahaToken.balanceOf(user1.address);
  console.log("User1 HAHA Balance:", ethers.formatUnits(user1Balance, 18)); // Use `formatUnits` from Ethers v6

  // Step 1: Approve mintCost tokens for MamaGotchiGameMinato from user1
  const hahaUser1 = hahaToken.connect(user1); // Connect to user1's signer
  await hahaUser1.approve(mamaGotchiGame.target, mintCost);
  console.log("User1 approved HAHA tokens for minting");

  // Step 2: Try to mint a MamaGotchi with user1 (should succeed)
  const gotchiGameUser1 = mamaGotchiGame.connect(user1); // Connect to user1's signer
  const mintTx = await gotchiGameUser1.mintNewGotchi(user1.address, 0); // 0 indicates first-time mint
  await mintTx.wait();
  console.log("User1 successfully minted a MamaGotchi");

  // Step 3: Attempt to mint a MamaGotchi with user2 without approval (should fail)
  try {
    const gotchiGameUser2 = mamaGotchiGame.connect(user2); // Connect to user2's signer
    const mintTx2 = await gotchiGameUser2.mintNewGotchi(user2.address, 0);
    await mintTx2.wait();
    console.log("User2 successfully minted a MamaGotchi (unexpected)");
  } catch (error) {
    console.log(
      "User2 failed to mint a MamaGotchi as expected:",
      error.message
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
