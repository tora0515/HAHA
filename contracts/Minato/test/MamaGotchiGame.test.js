const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGame Contract - Gotchi Points System", function () {
  let MamaGotchiGame, hahaToken, game, owner, addr1;

  beforeEach(async function () {
    // Step 1: Deploy HAHA token contract for testing payments in the game
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken"); // Adjusted contract name
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment(); // Adjusted for version compatibility

    // Step 2: Deploy MamaGotchiGame contract with HAHA token address
    MamaGotchiGame = await ethers.getContractFactory("MamaGotchiGame");
    [owner, addr1] = await ethers.getSigners();
    game = await MamaGotchiGame.deploy(owner.address, hahaToken.target); // 'target' for contract address in ethers v6
    await game.waitForDeployment();

    // Step 3: Allocate HAHA tokens to addr1 to cover minting costs
    await hahaToken.transfer(
      addr1.address,
      ethers.parseUnits("1000000000", 18)
    );
  });

  // Test: Award Gotchi Points to player on minting a new MamaGotchi
  it("Should award Gotchi Points to player on minting a new MamaGotchi", async function () {
    // Step 1: Retrieve minting cost from game contract
    const mintCost = await game.mintCost();

    // Step 2: Approve spending of HAHA tokens for minting
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Step 3: Mint a new MamaGotchi for addr1
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Step 4: Check Gotchi Points balances for addr1
    const roundPoints = await game.roundPoints(addr1.address);
    const cumulativePoints = await game.cumulativePoints(addr1.address);
    const allTimeHighRound = await game.allTimeHighRound(addr1.address);

    // Step 5: Assert Gotchi Points values match expected outcomes
    expect(roundPoints).to.equal(20); // Should be 20 Gotchi Points awarded on mint
    expect(cumulativePoints).to.equal(20); // Should be 20 cumulative Gotchi Points
    expect(allTimeHighRound).to.equal(20); // All-time high round should match roundPoints
  });
});
