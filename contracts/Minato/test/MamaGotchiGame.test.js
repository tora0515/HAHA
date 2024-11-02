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

  it("Should update leaderboards with player's scores on MamaGotchi's death", async function () {
    const mintCost = await game.mintCost();
    const feedCost = await game.feedCost();
    const feedCooldown = await game.FEED_COOLDOWN(); // Retrieve the cooldown duration for feeding

    // Approve HAHA token spending for minting and mint a MamaGotchi for addr1
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Feed MamaGotchi multiple times, simulating time passing for cooldown
    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await game.connect(addr1).feed(0); // First feed

    // Increase time to bypass the cooldown
    await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
    await ethers.provider.send("evm_mine"); // Mine a new block

    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await game.connect(addr1).feed(0); // Second feed

    // Increase time to bypass the cooldown again
    await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
    await ethers.provider.send("evm_mine"); // Mine a new block

    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await game.connect(addr1).feed(0); // Third feed

    // Set health to zero to simulate death (using test helper or setHealthAndHappinessForTesting if available)
    await game.connect(owner).setHealthAndHappinessForTesting(0, 0, 0); // Test helper function

    // Trigger the setDeath function
    await game.connect(owner).setDeath(0);

    // Fetch the leaderboards after death
    const topAllTimeHighRound = await game.topAllTimeHighRound(0);
    const topCumulativePoints = await game.topCumulativePoints(0);

    // Verify that addr1's score is on both leaderboards
    expect(topAllTimeHighRound.player).to.equal(addr1.address);
    expect(topCumulativePoints.player).to.equal(addr1.address);

    // Check if the scores match addr1's current allTimeHighRound and cumulativePoints
    const playerAllTimeHighRound = await game.allTimeHighRound(addr1.address);
    const playerCumulativePoints = await game.cumulativePoints(addr1.address);

    expect(topAllTimeHighRound.score).to.equal(playerAllTimeHighRound);
    expect(topCumulativePoints.score).to.equal(playerCumulativePoints);
  });

  it("Should skip leaderboard update when the score is zero", async function () {
    // Fetch the initial leaderboard entry
    const initialLeaderboardEntry = await game.topAllTimeHighRound(0);

    // Call the test helper with a score of zero and specify the leaderboard type
    await game
      .connect(owner)
      .testUpdateLeaderboard(addr1.address, 0, "AllTimeHighRound");

    // Fetch the leaderboard entry again to check if it has remained unchanged
    const updatedLeaderboardEntry = await game.topAllTimeHighRound(0);

    // Verify leaderboard has not been updated with zero score
    expect(updatedLeaderboardEntry.score).to.equal(
      initialLeaderboardEntry.score
    ); // Should remain unchanged
    expect(updatedLeaderboardEntry.player).to.equal(
      initialLeaderboardEntry.player
    ); // Should remain unchanged
  });

  it("Should emit GotchiMinted event on minting a new MamaGotchi", async function () {
    const mintCost = await game.mintCost();

    // Approve HAHA token spending for minting
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Listen for the GotchiMinted event
    await expect(game.connect(addr1).mintNewGotchi(addr1.address, 0))
      .to.emit(game, "GotchiMinted")
      .withArgs(addr1.address, 0, await game.mintingPoints()); // Replace `0` with the actual tokenId if needed
  });

  it("Should emit GotchiFed event on feeding a MamaGotchi", async function () {
    const mintCost = await game.mintCost();
    const feedCost = await game.feedCost();

    // Mint a new MamaGotchi first
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Approve HAHA token spending for feeding
    await hahaToken.connect(addr1).approve(game.target, feedCost);

    // Listen for the GotchiFed event
    await expect(game.connect(addr1).feed(0))
      .to.emit(game, "GotchiFed")
      .withArgs(addr1.address, 0, await game.feedingPoints());
  });

  it("Should emit GotchiPlayed event on playing with a MamaGotchi", async function () {
    const mintCost = await game.mintCost();
    const playCost = await game.playCost();

    // Mint a new MamaGotchi first
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Approve HAHA token spending for playing
    await hahaToken.connect(addr1).approve(game.target, playCost);

    // Listen for the GotchiPlayed event
    await expect(game.connect(addr1).play(0))
      .to.emit(game, "GotchiPlayed")
      .withArgs(addr1.address, 0, await game.playingPoints());
  });

  it("Should emit GotchiSleeping event on putting a MamaGotchi to sleep", async function () {
    const mintCost = await game.mintCost();

    // Mint a new MamaGotchi first
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Put MamaGotchi to sleep and capture the timestamp
    const sleepTx = await game.connect(addr1).sleep(0);
    const block = await ethers.provider.getBlock(sleepTx.blockNumber);
    const sleepTimestamp = BigInt(block.timestamp);

    // Listen for the GotchiSleeping event
    await expect(sleepTx)
      .to.emit(game, "GotchiSleeping")
      .withArgs(addr1.address, 0, sleepTimestamp);
  });

  it("Should emit GotchiAwake event on waking a MamaGotchi", async function () {
    const mintCost = await game.mintCost();

    // Mint and put MamaGotchi to sleep first
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
    await game.connect(addr1).sleep(0);

    // Simulate time passing to create decay
    await ethers.provider.send("evm_increaseTime", [3600]); // Increase by 1 hour
    await ethers.provider.send("evm_mine");

    // Calculate expected decay using explicit BigInt conversions
    const healthDecayRate = await game.HEALTH_DECAY_RATE();
    const happinessDecayRate = await game.HAPPINESS_DECAY_RATE();
    const decayDuration = BigInt(3600); // Simulate 1-hour decay duration

    const healthDecay =
      (decayDuration * healthDecayRate) / (BigInt(3600) * BigInt(100));
    const happinessDecay =
      (decayDuration * happinessDecayRate) / (BigInt(3600) * BigInt(100));

    // Wake the MamaGotchi and check for event
    await expect(game.connect(addr1).wake(0))
      .to.emit(game, "GotchiAwake")
      .withArgs(addr1.address, 0, healthDecay, happinessDecay);
  });

  it("Should emit LeaderboardUpdated event for AllTimeHighRound when leaderboard is updated", async function () {
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a MamaGotchi and set up a score for AllTimeHighRound leaderboard
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
    await game.setHealthAndHappinessForTesting(0, 0, 0); // "Kill" the MamaGotchi

    // Set points so that AllTimeHighRound leaderboard is updated
    await game.setPointsForTesting(addr1.address, 100, 100);

    // Trigger leaderboard update for AllTimeHighRound
    await expect(game.setDeath(0))
      .to.emit(game, "LeaderboardUpdated")
      .withArgs(addr1.address, 100, "AllTimeHighRound");
  });

  it("Should emit LeaderboardUpdated event for CumulativePoints when leaderboard is updated", async function () {
    // Ensure CumulativePoints leaderboard is updated and emits the correct event
    await expect(
      game.testUpdateLeaderboard(addr1.address, 100, "CumulativePoints")
    )
      .to.emit(game, "LeaderboardUpdated")
      .withArgs(addr1.address, 100, "CumulativePoints");
  });

  it("Should emit GotchiDied event on MamaGotchi's death", async function () {
    const mintCost = await game.mintCost();

    // Mint and set health/happiness to zero to simulate death
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
    await game.connect(owner).setHealthAndHappinessForTesting(0, 0, 0);

    // Set death and check for GotchiDied event
    await expect(game.setDeath(0))
      .to.emit(game, "GotchiDied")
      .withArgs(addr1.address, 0, await game.deathPenaltyPoints());
  });

  it("Should emit LeaderboardUpdated event when player scores qualify for leaderboard", async function () {
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Set points to qualify for leaderboard update
    await game.connect(owner).setPointsForTesting(addr1.address, 150, 150);

    // Set health and happiness to zero to allow for MamaGotchi "death"
    await game.setHealthAndHappinessForTesting(0, 0, 0);

    // Trigger leaderboard update by simulating death
    await expect(game.setDeath(0))
      .to.emit(game, "LeaderboardUpdated")
      .withArgs(addr1.address, 150, "AllTimeHighRound");

    // Similarly, update cumulative points leaderboard
    await expect(
      game.testUpdateLeaderboard(addr1.address, 150, "CumulativePoints")
    )
      .to.emit(game, "LeaderboardUpdated")
      .withArgs(addr1.address, 150, "CumulativePoints");
  });

  describe("CostUpdated Event Emission", function () {
    it("Should emit CostUpdated event on mint cost update", async function () {
      const newMintCost = ethers.parseEther("100"); // New mint cost
      await expect(game.setMintCost(newMintCost))
        .to.emit(game, "CostUpdated")
        .withArgs("MintCost", newMintCost);
    });

    it("Should emit CostUpdated event on feed cost update", async function () {
      const newFeedCost = ethers.parseEther("50"); // New feed cost
      await expect(game.setFeedCost(newFeedCost))
        .to.emit(game, "CostUpdated")
        .withArgs("FeedCost", newFeedCost);
    });

    it("Should emit CostUpdated event on play cost update", async function () {
      const newPlayCost = ethers.parseEther("30"); // New play cost
      await expect(game.setPlayCost(newPlayCost))
        .to.emit(game, "CostUpdated")
        .withArgs("PlayCost", newPlayCost);
    });
  });

  it("Should emit PointsUpdated event on minting points update", async function () {
    await expect(game.setMintingPoints(25))
      .to.emit(game, "PointsUpdated")
      .withArgs("MintingPoints", 25);
  });

  it("Should emit PointsUpdated event on feeding points update", async function () {
    await expect(game.setFeedingPoints(15))
      .to.emit(game, "PointsUpdated")
      .withArgs("FeedingPoints", 15);
  });

  it("Should emit PointsUpdated event on playing points update", async function () {
    await expect(game.setPlayingPoints(20))
      .to.emit(game, "PointsUpdated")
      .withArgs("PlayingPoints", 20);
  });

  it("Should emit DecayCalculated event on waking a MamaGotchi", async function () {
    const mintCost = await game.mintCost();

    // Mint and put MamaGotchi to sleep first
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
    await game.connect(addr1).sleep(0);

    // Simulate time passing to create decay
    await ethers.provider.send("evm_increaseTime", [3600]); // Increase by 1 hour
    await ethers.provider.send("evm_mine");

    // Calculate expected decay
    const healthDecayRate = await game.HEALTH_DECAY_RATE();
    const happinessDecayRate = await game.HAPPINESS_DECAY_RATE();
    const decayDuration = BigInt(3600);

    const healthDecay =
      (decayDuration * healthDecayRate) / (BigInt(3600) * BigInt(100));
    const happinessDecay =
      (decayDuration * happinessDecayRate) / (BigInt(3600) * BigInt(100));

    // Check for the DecayCalculated event emission
    await expect(game.connect(addr1).wake(0))
      .to.emit(game, "DecayCalculated")
      .withArgs(healthDecay, happinessDecay);
  });
});
