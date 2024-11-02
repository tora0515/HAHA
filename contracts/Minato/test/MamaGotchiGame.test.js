const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGame Contract - Leaderboard Complex Insertion", function () {
  let game, hahaToken, owner, addr1, addr2, addr3;
  const mintCost = ethers.parseUnits("1000000000", 18);

  beforeEach(async function () {
    // Step 1: Deploy HAHA token contract
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    // Step 2: Deploy MamaGotchiGame contract with HAHA token address
    const MamaGotchiGame = await ethers.getContractFactory("MamaGotchiGame");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    game = await MamaGotchiGame.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Step 3: Transfer tokens and set approval
    await hahaToken.transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
  });

  it("Should accurately update leaderboard with multiple boundary and mid-range values", async function () {
    // Define scores to insert, covering low, mid, and high boundaries
    const scores = [
      { player: addr1.address, score: 150 },
      { player: addr2.address, score: 200 },
      { player: addr3.address, score: 300 },
      { player: owner.address, score: 90 },
      { player: addr1.address, score: 250 },
      { player: addr2.address, score: 120 },
      { player: addr3.address, score: 180 },
      { player: owner.address, score: 130 },
      { player: addr1.address, score: 170 },
      { player: addr2.address, score: 140 },
      { player: addr3.address, score: 110 },
    ];

    // Insert each score, update leaderboard, and log intermediate results
    for (const { player, score } of scores) {
      await game.testUpdateLeaderboard(player, score, "AllTimeHighRound");

      // Log the current leaderboard after each update
      const currentLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
      console.log(
        "Current Leaderboard:",
        currentLeaderboard.map((entry) => entry.score.toString())
      );
    }

    // Retrieve and verify sorted leaderboard
    const finalLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const expectedScores = [300, 250, 200, 180, 170, 150, 140, 130, 120, 110];
    for (let i = 0; i < expectedScores.length; i++) {
      expect(finalLeaderboard[i].score).to.equal(expectedScores[i].toString());
    }

    console.log(
      "Final Leaderboard Entries:",
      finalLeaderboard.map((entry) => entry.score.toString())
    );
  });

  it("Should accurately update leaderboard with basic values", async function () {
    // Adding scores to test leaderboard update functionality
    const lowScore = 50;
    const midScore = 100;
    const highScore = 200;

    await game.testUpdateLeaderboard(
      addr1.address,
      lowScore,
      "AllTimeHighRound"
    );
    await game.testUpdateLeaderboard(
      addr2.address,
      midScore,
      "AllTimeHighRound"
    );
    await game.testUpdateLeaderboard(
      addr3.address,
      highScore,
      "AllTimeHighRound"
    );

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();

    // Verify leaderboard order for basic values
    expect(leaderboard[0].score).to.equal(highScore);
    expect(leaderboard[1].score).to.equal(midScore);
    expect(leaderboard[2].score).to.equal(lowScore);
  });

  it("Should accurately update leaderboard with multiple boundary and mid-range values", async function () {
    const scores = [
      { address: addr1, score: 90 },
      { address: addr2, score: 150 },
      { address: addr3, score: 300 },
      { address: addr1, score: 250 },
      { address: addr2, score: 200 },
      { address: addr3, score: 100 },
      { address: addr1, score: 50 },
      { address: addr2, score: 75 },
      { address: addr3, score: 125 },
      { address: addr1, score: 175 },
    ];

    // Populate leaderboard with test scores
    for (let entry of scores) {
      await game.testUpdateLeaderboard(
        entry.address.address,
        entry.score,
        "AllTimeHighRound"
      );
      const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
      console.log(
        "Current Leaderboard:",
        leaderboard.map((entry) => entry.score.toString())
      );
    }

    // Insert a new high score and verify its position
    const newHighScore = 350;
    await game.testUpdateLeaderboard(
      addr2.address,
      newHighScore,
      "AllTimeHighRound"
    );

    const finalLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    console.log(
      "Final Leaderboard:",
      finalLeaderboard.map((entry) => entry.score.toString())
    );

    // Validate the leaderboard order for the complex case
    expect(finalLeaderboard[0].score).to.equal(newHighScore);
    expect(finalLeaderboard[1].score).to.equal(300);
    expect(finalLeaderboard[2].score).to.equal(250);
    expect(finalLeaderboard[3].score).to.equal(200);
  });
});
