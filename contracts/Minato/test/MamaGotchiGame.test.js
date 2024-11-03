const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGame Contract - Time and Cooldown Functionality", function () {
  let game, hahaToken, owner, addr1;
  const feedCost = ethers.parseUnits("10000", 18);
  const playCost = ethers.parseUnits("10000", 18);

  beforeEach(async function () {
    // Deploy HAHA token
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    const MamaGotchiGame = await ethers.getContractFactory("MamaGotchiGame");
    [owner, addr1] = await ethers.getSigners();

    game = await MamaGotchiGame.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Transfer tokens to addr1 and approve minting cost for minting
    const mintCost = ethers.parseUnits("1000000000", 18); // Adjust this to the actual mint cost if needed
    await hahaToken.transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost); // Ensure approval for minting cost

    // Mint Gotchi to addr1
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
  });

  it("Should correctly update timeAlive after feeding", async function () {
    const tokenId = 0;
    await game.connect(addr1).feed(tokenId);
    const gotchi = await game.gotchiStats(tokenId);

    expect(gotchi.timeAlive).to.be.gt(0); // Check timeAlive increased
    expect(gotchi.health).to.equal(90); // Health should increase by 10
  });

  it("Should correctly update timeAlive after playing", async function () {
    const tokenId = 0;
    await game.connect(addr1).play(tokenId);
    const gotchi = await game.gotchiStats(tokenId);

    expect(gotchi.timeAlive).to.be.gt(0); // Check timeAlive increased
    expect(gotchi.happiness).to.equal(90); // Happiness should increase by 10
  });

  it("Should prevent feeding before cooldown", async function () {
    const tokenId = 0;
    await game.connect(addr1).feed(tokenId);
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm full!"
    );
  });

  it("Should prevent playing before cooldown", async function () {
    const tokenId = 0;
    await game.connect(addr1).play(tokenId);
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );
  });

  it("Should enter sleep mode and pause decay", async function () {
    const tokenId = 0;
    await game.connect(addr1).sleep(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.equal(true);
  });

  it("Should wake up and apply decay with max duration capped", async function () {
    const tokenId = 0;
    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [8 * 60 * 60 + 10]); // Move time forward beyond max sleep
    await game.connect(addr1).wake(tokenId);

    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.be.lte(100 - 5.5 * 8); // Check decay capped at max sleep duration
  });

  it("Should prevent sleep before cooldown", async function () {
    const tokenId = 0;

    // Put the Gotchi to sleep initially
    await game.connect(addr1).sleep(tokenId);

    // Attempt to put Gotchi to sleep again without waking up
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already in dreamland, shhh!"
    );

    // Wake the Gotchi and attempt to sleep again before cooldown
    await game.connect(addr1).wake(tokenId);
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm not sleepy!"
    );
  });

  it("Should correctly track timeAlive after multiple interactions", async function () {
    const tokenId = 0;
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [300]); // Fast forward 5 minutes
    await game.connect(addr1).play(tokenId);

    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.timeAlive).to.be.gt(0); // timeAlive should reflect both actions
  });

  it("Should accurately update timeAlive after feeding close to cooldown expiration", async function () {
    const tokenId = 0;

    // Retrieve feed cooldown and convert to number
    const feedCooldown = Number((await game.cooldowns()).feed);

    // Perform an action to start tracking
    await game.connect(addr1).feed(tokenId);

    // Fast-forward time to just before the cooldown ends
    await ethers.provider.send("evm_increaseTime", [feedCooldown + 5]); // Slightly past cooldown
    await ethers.provider.send("evm_mine", []);

    // Feed again and check timeAlive tracking
    await game.connect(addr1).feed(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.timeAlive).to.be.above(0);
  });

  it("Should revert if attempting to wake when not sleeping", async function () {
    const tokenId = 0;

    // Attempt to wake up when not sleeping
    await expect(game.connect(addr1).wake(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already awake!"
    );
  });

  it("Should not exceed max health and happiness when feeding or playing", async function () {
    const tokenId = 0;

    // Set health and happiness to near maximum for boundary check
    await game.connect(owner).setHealthAndHappinessForTesting(tokenId, 95, 95);

    // Perform feed and play actions to reach max values
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);

    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(100);
    expect(gotchi.happiness).to.equal(100);
  });

  it("Should correctly retrieve play cooldown", async function () {
    const playCooldown = await game.getPlayCooldown();

    // Check if the return is BigInt directly
    expect(typeof playCooldown).to.equal("bigint");

    // Check that playCooldown has a positive value
    expect(playCooldown).to.be.greaterThan(0n);
  });

  //###############################################################
  it("Should confirm cooldown status after playing action", async function () {
    const tokenId = 0;

    // Perform the play action to start the cooldown
    await game.connect(addr1).play(tokenId);

    // Retrieve the play cooldown directly
    const playCooldown = await game.getPlayCooldown();

    // Fast-forward time just shy of the cooldown expiration
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown) - 1]);
    await ethers.provider.send("evm_mine", []);

    // Retrieve the cooldown-ready status from the contract
    const isReady = await game.isActionReady("play", tokenId);

    // We expect isReady to be false since cooldown has not fully elapsed
    expect(isReady).to.be.false;
  });

  it("Should allow action after play cooldown elapses", async function () {
    const tokenId = 0;

    // Perform the play action to initiate cooldown
    await game.connect(addr1).play(tokenId);

    // Retrieve the cooldown time
    const playCooldown = await game.getPlayCooldown();

    // Fast-forward time to pass the cooldown completely
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Now retrieve the cooldown-ready status again
    const isReady = await game.isActionReady("play", tokenId);

    // We expect isReady to be true as cooldown should have elapsed
    expect(isReady).to.be.true;
  });

  it("Should prevent consecutive play actions if cooldown has not elapsed", async function () {
    const tokenId = 0;

    // Perform the play action to initiate cooldown
    await game.connect(addr1).play(tokenId);

    // Attempt to play again immediately, expecting a revert due to active cooldown
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );

    // Fast-forward time to ensure cooldown elapses
    const playCooldown = await game.getPlayCooldown();
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Retry the play action after cooldown; it should succeed
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  it("Should allow play action exactly at cooldown expiry", async function () {
    const tokenId = 0;

    // Initiate cooldown with a play action
    await game.connect(addr1).play(tokenId);

    // Fast-forward time exactly to the play cooldown
    const playCooldown = await game.getPlayCooldown();
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Play again right at the cooldown expiry; it should succeed
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  it("Should allow feeding even if play cooldown is active", async function () {
    const tokenId = 0;

    // Start play cooldown
    await game.connect(addr1).play(tokenId);

    // Feed action should still be allowed
    await expect(game.connect(addr1).feed(tokenId)).to.not.be.reverted;
  });

  it("Should handle multiple actions in sequence with correct cooldowns", async function () {
    const tokenId = 0;

    // Perform feed action and check it works
    await game.connect(addr1).feed(tokenId);

    // Fast-forward to feed cooldown expiry
    const feedCooldown = await game.getFeedCooldown();
    await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Perform play action and check it works
    await game.connect(addr1).play(tokenId);

    // Fast-forward to play cooldown expiry
    const playCooldown = await game.getPlayCooldown();
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Perform sleep action and check it works
    await game.connect(addr1).sleep(tokenId);

    // Fast-forward to sleep cooldown expiry
    const sleepCooldown = await game.getSleepCooldown();
    await ethers.provider.send("evm_increaseTime", [Number(sleepCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Wake the Gotchi and confirm it works
    await expect(game.connect(addr1).wake(tokenId)).to.not.be.reverted;
  });

  it("Should add score to leaderboard upon Gotchi's death if saveOnDeath is true", async function () {
    const tokenId = 0;

    // Deplete health to trigger death
    await game.connect(owner).setHealthAndHappinessForTesting(tokenId, 0, 100);
    await game.setDeath(tokenId, true);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.equal(addr1.address); // Expect player to be on the leaderboard
    expect(leaderboard[0].score).to.be.gt(0); // Expect a non-zero score for timeAlive
  });

  it("Should not add score to leaderboard upon Gotchi's death if saveOnDeath is false", async function () {
    const tokenId = 0;

    // Deplete health to trigger death
    await game.connect(owner).setHealthAndHappinessForTesting(tokenId, 0, 100);
    await game.setDeath(tokenId, false);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.not.equal(addr1.address); // Ensure player did not get added
  });

  it("Should update leaderboard correctly if score qualifies", async function () {
    const tokenId = 0;

    // Mint and feed to accumulate timeAlive
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [1200]); // Fast forward 20 minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.equal(addr1.address); // Expect player on leaderboard
    expect(leaderboard[0].score).to.be.gt(0); // Expect a positive score
  });

  it("Should correctly insert new high score in sorted position on leaderboard", async function () {
    const tokenId = 0;

    // Mint, feed, and save to leaderboard with some timeAlive
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]); // Fast forward 10 minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const firstScore = leaderboard[0].score;

    // Fast forward more time to increase score and manually save again
    await ethers.provider.send("evm_increaseTime", [1800]); // Fast forward 30 more minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const updatedLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(updatedLeaderboard[0].score).to.be.gt(firstScore); // Check score was updated
  });

  it("Should prevent lower scores from displacing higher scores on leaderboard", async function () {
    const tokenId = 0;

    // Mint, feed, and save initial high score
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [3000]); // Fast forward for significant timeAlive
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const initialLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const topScore = initialLeaderboard[0].score;

    // Manually save a lower score after minimal interaction
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [300]); // Fast forward minimal time
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const finalLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(finalLeaderboard[0].score).to.equal(topScore); // Ensure original high score remains
  });

  it("Should allow manual save to leaderboard when MamaGotchi is alive", async function () {
    const tokenId = 0;

    // Perform a few interactions to accumulate timeAlive
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]); // Fast forward 10 minutes
    await game.connect(addr1).play(tokenId);

    // Perform manual save
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.equal(addr1.address); // Player should be on the leaderboard
    expect(leaderboard[0].score).to.be.gt(0); // Score should reflect timeAlive
  });

  it("Should not allow duplicate entries for the same player on the leaderboard", async function () {
    const tokenId = 0;

    // Perform interactions and save to leaderboard
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [900]); // Fast forward 15 minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Verify initial leaderboard entry
    const initialLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const initialScore = initialLeaderboard[0].score;

    // Attempt another manual save with minimal additional timeAlive
    await ethers.provider.send("evm_increaseTime", [300]); // Fast forward minimal time
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Verify leaderboard didn't duplicate entry, only updated score if it's higher
    const updatedLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(updatedLeaderboard[0].player).to.equal(addr1.address);
    expect(updatedLeaderboard[0].score).to.be.equal(initialScore); // Score remains unchanged for insufficient update
  });

  it("Should correctly update leaderboard with multiple players and scores", async function () {
    // Deploy and mint another Gotchi to addr2
    const [_, addr2] = await ethers.getSigners();
    const tokenId1 = 0;
    await hahaToken.transfer(
      addr2.address,
      ethers.parseUnits("1000000000", 18)
    );
    await hahaToken
      .connect(addr2)
      .approve(game.target, ethers.parseUnits("1000000000", 18));
    await game.connect(addr2).mintNewGotchi(addr2.address, 0);
    const tokenId2 = 1;

    // Perform actions and save for addr1
    await game.connect(addr1).feed(tokenId1);
    await ethers.provider.send("evm_increaseTime", [1200]); // Fast forward 20 minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId1);

    // Perform actions and save for addr2 with a lower score
    await game.connect(addr2).feed(tokenId2);
    await ethers.provider.send("evm_increaseTime", [600]); // Fast forward 10 minutes
    await game.connect(addr2).manualSaveToLeaderboard(tokenId2);

    // Verify leaderboard placement with addr1 on top
    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.equal(addr1.address);
    expect(leaderboard[1].player).to.equal(addr2.address);
    expect(leaderboard[0].score).to.be.gt(leaderboard[1].score);
  });

  it("Should not allow a lower score to overwrite a higher score on the leaderboard", async function () {
    const tokenId = 0;

    // Perform actions to create a high score
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [3600]); // Fast forward 1 hour
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const highScore = leaderboard[0].score;

    // Attempt a manual save with a much lower score
    await ethers.provider.send("evm_increaseTime", [300]); // Fast forward minimal time
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Verify leaderboard still holds the high score
    const updatedLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(updatedLeaderboard[0].score).to.equal(highScore); // High score remains
  });

  it("Should cap the leaderboard at 10 entries and replace only the lowest score", async function () {
    const tokenId = 0;

    // Simulate adding 10 players with incrementing scores
    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_increaseTime", [i * 600]); // Increase time for each player
      await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    }

    // Attempt to add a new score that qualifies for the top 10
    await ethers.provider.send("evm_increaseTime", [7200]); // Fast forward to achieve a higher score
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].score).to.be.gt(leaderboard[9].score); // Top score should be greater than the lowest
  });
  // Additional test cases for the leaderboard functionality
  it("Should allow manual save to leaderboard when MamaGotchi is alive", async function () {
    const tokenId = 0;

    // Perform a few interactions to accumulate timeAlive
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]); // Fast forward 10 minutes
    await game.connect(addr1).play(tokenId);

    // Perform manual save
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.equal(addr1.address); // Player should be on the leaderboard
    expect(leaderboard[0].score).to.be.gt(0); // Score should reflect timeAlive
  });

  it("Should not allow duplicate entries for the same player on the leaderboard", async function () {
    const tokenId = 0;

    // Perform interactions and save to leaderboard
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [900]); // Fast forward 15 minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Verify initial leaderboard entry
    const initialLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const initialScore = initialLeaderboard[0].score;

    // Attempt another manual save with minimal additional timeAlive
    await ethers.provider.send("evm_increaseTime", [300]); // Fast forward minimal time
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Verify leaderboard didn't duplicate entry, only updated score if it's higher
    const updatedLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(updatedLeaderboard[0].player).to.equal(addr1.address);
    expect(updatedLeaderboard[0].score).to.be.equal(initialScore); // Score remains unchanged for insufficient update
  });

  it("Should correctly update leaderboard with multiple players and scores", async function () {
    // Deploy and mint another Gotchi to addr2
    const [_, addr2] = await ethers.getSigners();
    const tokenId1 = 0;
    await hahaToken.transfer(
      addr2.address,
      ethers.parseUnits("1000000000", 18)
    );
    await hahaToken
      .connect(addr2)
      .approve(game.target, ethers.parseUnits("1000000000", 18));
    await game.connect(addr2).mintNewGotchi(addr2.address, 0);
    const tokenId2 = 1;

    // Perform actions and save for addr1
    await game.connect(addr1).feed(tokenId1);
    await ethers.provider.send("evm_increaseTime", [1200]); // Fast forward 20 minutes
    await game.connect(addr1).manualSaveToLeaderboard(tokenId1);

    // Perform actions and save for addr2 with a lower score
    await game.connect(addr2).feed(tokenId2);
    await ethers.provider.send("evm_increaseTime", [600]); // Fast forward 10 minutes
    await game.connect(addr2).manualSaveToLeaderboard(tokenId2);

    // Verify leaderboard placement with addr1 on top
    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].player).to.equal(addr1.address);
    expect(leaderboard[1].player).to.equal(addr2.address);
    expect(leaderboard[0].score).to.be.gt(leaderboard[1].score);
  });

  it("Should not allow a lower score to overwrite a higher score on the leaderboard", async function () {
    const tokenId = 0;

    // Perform actions to create a high score
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [3600]); // Fast forward 1 hour
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    const highScore = leaderboard[0].score;

    // Attempt a manual save with a much lower score
    await ethers.provider.send("evm_increaseTime", [300]); // Fast forward minimal time
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Verify leaderboard still holds the high score
    const updatedLeaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(updatedLeaderboard[0].score).to.equal(highScore); // High score remains
  });

  it("Should cap the leaderboard at 10 entries and replace only the lowest score", async function () {
    const tokenId = 0;

    // Simulate adding 10 players with incrementing scores
    for (let i = 0; i < 10; i++) {
      await ethers.provider.send("evm_increaseTime", [i * 600]); // Increase time for each player
      await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    }

    // Attempt to add a new score that qualifies for the top 10
    await ethers.provider.send("evm_increaseTime", [7200]); // Fast forward to achieve a higher score
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const leaderboard = await game.getTopAllTimeHighRoundLeaderboard();
    expect(leaderboard[0].score).to.be.gt(leaderboard[9].score); // Top score should be greater than the lowest
  });
});
