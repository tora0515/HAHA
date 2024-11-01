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

  it("Should award Gotchi Points to player on feeding their MamaGotchi", async function () {
    const feedCost = await game.feedCost();
    const mintCost = await game.mintCost();

    // Approve HAHA token spending for minting
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a MamaGotchi to enable feeding
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Approve HAHA token spending for feeding after minting
    await hahaToken.connect(addr1).approve(game.target, feedCost);

    // Record initial Gotchi Points balances (convert to BigInt)
    const initialRoundPoints = BigInt(await game.roundPoints(addr1.address));
    const initialCumulativePoints = BigInt(
      await game.cumulativePoints(addr1.address)
    );

    // Feed the MamaGotchi (tokenId is 0, as it’s the first one minted)
    await game.connect(addr1).feed(0);

    // Check Gotchi Points awarded to addr1 after feeding (convert to BigInt)
    const updatedRoundPoints = BigInt(await game.roundPoints(addr1.address));
    const updatedCumulativePoints = BigInt(
      await game.cumulativePoints(addr1.address)
    );
    const allTimeHighRound = BigInt(await game.allTimeHighRound(addr1.address));

    // Verify that feeding added the expected amount of Gotchi Points
    expect(updatedRoundPoints).to.equal(initialRoundPoints + BigInt(10)); // 10 Gotchi Points added for feeding
    expect(updatedCumulativePoints).to.equal(
      initialCumulativePoints + BigInt(10)
    ); // 10 cumulative Gotchi Points added
    expect(allTimeHighRound).to.be.at.least(updatedRoundPoints); // allTimeHighRound should be updated if roundPoints exceed it
  });

  it("Should award Gotchi Points to player on playing with their MamaGotchi", async function () {
    const playCost = await game.playCost();
    const mintCost = await game.mintCost();

    // Approve HAHA token spending for minting
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a MamaGotchi to enable playing
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Approve HAHA token spending for playing
    await hahaToken.connect(addr1).approve(game.target, playCost);

    // Record initial Gotchi Points balances
    const initialRoundPoints = BigInt(await game.roundPoints(addr1.address));
    const initialCumulativePoints = BigInt(
      await game.cumulativePoints(addr1.address)
    );

    // Play with the MamaGotchi (tokenId is 0, as it’s the first one minted)
    await game.connect(addr1).play(0);

    // Check Gotchi Points awarded to addr1 after playing
    const updatedRoundPoints = BigInt(await game.roundPoints(addr1.address));
    const updatedCumulativePoints = BigInt(
      await game.cumulativePoints(addr1.address)
    );
    const allTimeHighRound = BigInt(await game.allTimeHighRound(addr1.address));

    // Verify that playing added the expected amount of Gotchi Points
    expect(updatedRoundPoints).to.equal(initialRoundPoints + BigInt(10)); // 10 Gotchi Points added for playing
    expect(updatedCumulativePoints).to.equal(
      initialCumulativePoints + BigInt(10)
    ); // 10 cumulative Gotchi Points added
    expect(allTimeHighRound).to.be.at.least(updatedRoundPoints); // allTimeHighRound should be updated if roundPoints exceed it
  });

  it("Should apply Gotchi Points penalty on MamaGotchi's death", async function () {
    const mintCost = await game.mintCost();
    const feedCost = await game.feedCost();

    // Approve HAHA token spending for minting
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a MamaGotchi for addr1
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Award some initial points by feeding
    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await game.connect(addr1).feed(0);

    // Record initial points before death
    const initialCumulativePoints = BigInt(
      await game.cumulativePoints(addr1.address)
    );
    const initialRoundPoints = BigInt(await game.roundPoints(addr1.address));
    const deathPenalty = BigInt(await game.deathPenaltyPoints());

    // Set health to zero to simulate death (using test helper or setHealthAndHappinessForTesting if available)
    await game.connect(owner).setHealthAndHappinessForTesting(0, 0, 0); // Test helper function

    // Trigger the setDeath function
    await game.connect(owner).setDeath(0);

    // Check points after death
    const finalCumulativePoints = BigInt(
      await game.cumulativePoints(addr1.address)
    );
    const finalRoundPoints = BigInt(await game.roundPoints(addr1.address));
    const allTimeHighRound = BigInt(await game.allTimeHighRound(addr1.address));

    // Assertions
    expect(finalCumulativePoints).to.equal(
      initialCumulativePoints > deathPenalty
        ? initialCumulativePoints - deathPenalty
        : BigInt(0)
    ); // Ensure cumulative points decrease by penalty, or 0 if insufficient
    expect(finalRoundPoints).to.equal(BigInt(0)); // roundPoints should reset to zero
    expect(allTimeHighRound).to.equal(
      initialRoundPoints > allTimeHighRound
        ? initialRoundPoints
        : allTimeHighRound
    ); // allTimeHighRound should update if initialRoundPoints exceed it
  });
});
