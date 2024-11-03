/**
* Helper functions - paste at end of MamaGotchiGameMinato.sol prior to running tests.

function getFeedCooldown() external view returns (uint256) {
    return cooldowns.feed;
}

function getPlayCooldown() external view returns (uint256) {
    return cooldowns.play;
}

function getSleepCooldown() external view returns (uint256) {
    return cooldowns.sleep;
}

function getCooldownTime(string memory action) external view returns (uint256) {
    if (keccak256(bytes(action)) == keccak256(bytes("play"))) {
        return cooldowns.play;
    } else if (keccak256(bytes(action)) == keccak256(bytes("feed"))) {
        return cooldowns.feed;
    } else if (keccak256(bytes(action)) == keccak256(bytes("sleep"))) {
        return cooldowns.sleep;
    } else {
        revert("Invalid action");
    }
}

function isActionReady(string memory action, uint256 tokenId) external view returns (bool) {
    Gotchi storage gotchi = gotchiStats[tokenId];
    
    if (keccak256(bytes(action)) == keccak256(bytes("play"))) {
        return block.timestamp >= gotchi.lastPlayTime + cooldowns.play;
    } else if (keccak256(bytes(action)) == keccak256(bytes("feed"))) {
        return block.timestamp >= gotchi.lastFeedTime + cooldowns.feed;
    } else if (keccak256(bytes(action)) == keccak256(bytes("sleep"))) {
        return block.timestamp >= gotchi.lastSleepTime + cooldowns.sleep;
    } else {
        revert("Invalid action");
    }
}

function isTokenOwner(uint256 tokenId, address expectedOwner) external view returns (bool) {
    return ownerOf(tokenId) == expectedOwner;
}

function testCheckAndMarkDeath(uint256 tokenId) external {
    checkAndMarkDeath(tokenId);
}

function setHealthAndHappinessForTesting(uint256 tokenId, uint256 health, uint256 happiness) external onlyOwner {
    gotchiStats[tokenId].health = health;
    gotchiStats[tokenId].happiness = happiness;
}
 */

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

  it("Should wake up and apply decay only for the time beyond the 8-hour cap", async function () {
    const tokenId = 0;
    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [9 * 60 * 60]); // Move time forward by 9 hours
    await game.connect(addr1).wake(tokenId);

    const gotchi = await game.gotchiStats(tokenId);

    // Calculate expected health after only 1 hour of decay (9 - 8 hours capped)
    const initialHealth = 80; // Assuming newly minted Gotchi health starts at 80
    const healthDecay = Math.floor(5.5 * 1); // Calculate decay for 1 hour at 5.5 per hour
    const finalHealth =
      initialHealth > healthDecay ? initialHealth - healthDecay : 0; // Prevent negative health

    expect(gotchi.health).to.equal(finalHealth);
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

  it("Should update high score on death if saveOnDeath is true and score is higher", async function () {
    const tokenId = 0;
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]);
    await game.connect(addr1).play(tokenId);
    await ethers.provider.send("evm_increaseTime", [1200]);
    await game.connect(owner).setHealthAndHappinessForTesting(tokenId, 0, 0); // Set Gotchi to die

    const initialScore = await game.playerHighScores(addr1.address);
    await game.connect(owner).setDeath(tokenId, true);
    const updatedScore = await game.playerHighScores(addr1.address);

    expect(updatedScore).to.be.gt(initialScore);
  });

  it("Should update high score on manual save if score is higher", async function () {
    const tokenId = 0;
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]);
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const initialScore = await game.playerHighScores(addr1.address);

    // Increase timeAlive significantly, then save again
    await ethers.provider.send("evm_increaseTime", [1800]);
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const updatedScore = await game.playerHighScores(addr1.address);

    expect(updatedScore).to.be.gt(initialScore);
  });

  it("Should not update high score if manual save score is not higher", async function () {
    const tokenId = 0;
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]);
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const initialScore = await game.playerHighScores(addr1.address);

    // Fast forward slightly but less than last increase and attempt to save
    await ethers.provider.send("evm_increaseTime", [300]);
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const newScore = await game.playerHighScores(addr1.address);
    expect(newScore).to.equal(initialScore); // Score should remain unchanged
  });

  it("Should emit LeaderboardUpdated event only on high score increase", async function () {
    const tokenId = 0;

    // Step 1: First interaction to establish initial high score
    await game.connect(addr1).feed(tokenId);
    await ethers.provider.send("evm_increaseTime", [600]); // Fast-forward 600 seconds (10 minutes)

    // Capture the transaction and initial high score
    let tx = await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const initialHighScore = await game.playerHighScores(addr1.address);

    // Assert the initial high score update event
    await expect(tx)
      .to.emit(game, "LeaderboardUpdated")
      .withArgs(addr1.address, initialHighScore, "AllTimeHighRound");

    // Step 2: Advance time slightly, below threshold for new high score
    await ethers.provider.send("evm_increaseTime", [300]); // Fast-forward 300 seconds (5 minutes)

    // Save again and ensure no event is emitted since score didn’t exceed initial
    tx = await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    await expect(tx).to.not.emit(game, "LeaderboardUpdated");

    // Step 3: Advance time further to exceed the initial high score
    await ethers.provider.send("evm_increaseTime", [600]); // Another 600 seconds (10 minutes)

    // Save again; this time we expect an event as score should now exceed initial high score
    tx = await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const newHighScore = await game.playerHighScores(addr1.address);

    await expect(tx)
      .to.emit(game, "LeaderboardUpdated")
      .withArgs(addr1.address, newHighScore, "AllTimeHighRound");

    // Confirm new high score is greater than initial
    expect(newHighScore).to.be.gt(initialHighScore);
  });

  it("Should enforce cooldowns accurately and independently when actions are mixed", async function () {
    const tokenId = 0;

    // Step 1: Perform feed action and ensure play can be called independently
    await game.connect(addr1).feed(tokenId);
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted; // Play should be independent of feed cooldown

    // Step 2: Execute sleep and block consecutive sleep until wake clears it
    await game.connect(addr1).sleep(tokenId); // First sleep action
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already in dreamland, shhh!"
    );

    // Step 3: Wake up the Gotchi to reset sleep state
    await ethers.provider.send("evm_increaseTime", [8 * 60 * 60 + 10]); // Move time forward beyond max sleep to apply decay
    await game.connect(addr1).wake(tokenId); // Wake the Gotchi

    // Step 4: Advance time for play and feed cooldowns without affecting sleep
    const playCooldown = await game.getPlayCooldown();
    const feedCooldown = await game.getFeedCooldown();
    await ethers.provider.send("evm_increaseTime", [
      Number(playCooldown) + Number(feedCooldown),
    ]);
    await ethers.provider.send("evm_mine", []);

    // Feed and play should now be available again
    await expect(game.connect(addr1).feed(tokenId)).to.not.be.reverted;
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;

    // Step 5: Verify that sleep can be re-entered after cooldown, since wake was called
    const sleepCooldown = await game.getSleepCooldown();
    await ethers.provider.send("evm_increaseTime", [Number(sleepCooldown)]);
    await ethers.provider.send("evm_mine", []);

    // Re-enter sleep, confirming independent cooldown reset
    await expect(game.connect(addr1).sleep(tokenId)).to.not.be.reverted;
  });

  it("Should consistently update timeAlive using updateTimeAlive helper across actions", async function () {
    const tokenId = 0;

    // Perform initial action (feed) and capture timeAlive
    await game.connect(addr1).feed(tokenId);
    const initialTimeAlive = (await game.gotchiStats(tokenId)).timeAlive;

    // Fast-forward time
    await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
    await ethers.provider.send("evm_mine", []);

    // Perform another action (play) to trigger timeAlive update
    await game.connect(addr1).play(tokenId);
    const updatedTimeAlive = (await game.gotchiStats(tokenId)).timeAlive;

    // Assert that timeAlive increased
    expect(updatedTimeAlive).to.be.gt(initialTimeAlive);
  });

  it("Should enforce token transfer requirements with requireAndTransferTokens helper", async function () {
    const tokenId = 0;

    // Revoke allowance for HAHA tokens
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Expect action to fail due to lack of token allowance
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "Approval required for feeding"
    );

    // Re-approve tokens and ensure the action succeeds
    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await expect(game.connect(addr1).feed(tokenId)).to.not.be.reverted;
  });

  it("Should enforce independent cooldowns for different actions", async function () {
    const tokenId = 0;

    // Initiate feed action to start its cooldown
    await game.connect(addr1).feed(tokenId);

    // Play action should still be allowed since it has a separate cooldown
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;

    // Sleep action should also be allowed
    await expect(game.connect(addr1).sleep(tokenId)).to.not.be.reverted;
  });

  it("Should mark Gotchi as dead when health or happiness reaches zero", async function () {
    const tokenId = 0;

    // Reduce health to zero and invoke the death check directly
    await game.connect(owner).setHealthAndHappinessForTesting(tokenId, 0, 50);
    await game.connect(owner).testCheckAndMarkDeath(tokenId); // Directly check and mark death

    // Fetch Gotchi stats to verify death
    let gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.deathTimestamp).to.be.gt(0); // Verify that death timestamp is set

    // Reset Gotchi and test with happiness at zero
    await game.connect(owner).setHealthAndHappinessForTesting(tokenId, 50, 0);
    await game.connect(owner).testCheckAndMarkDeath(tokenId);

    // Fetch Gotchi stats again to verify death marking
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.deathTimestamp).to.be.gt(0); // Confirm death timestamp is set
  });

  it("Should correctly apply health and happiness decay upon waking after sleep", async function () {
    const tokenId = 0;

    // Step 1: Put Gotchi to sleep right after minting (starts at 80 health and 80 happiness)
    await game.connect(addr1).sleep(tokenId);

    // Step 2: Fast-forward exactly to the 8-hour cap and wake Gotchi
    const sleepDurationWithinCap = 8 * 60 * 60; // 8 hours
    await ethers.provider.send("evm_increaseTime", [sleepDurationWithinCap]);
    await game.connect(addr1).wake(tokenId);

    const gotchi = await game.gotchiStats(tokenId);

    // Expect health and happiness to remain at the initial mint values of 80 each
    expect(gotchi.health).to.equal(80); // No decay expected
    expect(gotchi.happiness).to.equal(80); // No decay expected
  });

  it("Should enforce unique cooldowns for each action", async function () {
    const tokenId = 0;

    // Perform feed action
    await game.connect(addr1).feed(tokenId);
    // Attempt to feed again immediately, should revert due to cooldown
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm full!"
    );

    // Play action should still be allowed as it has its own cooldown
    await game.connect(addr1).play(tokenId);

    // Attempt to play again immediately, should revert due to cooldown
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );

    // Sleep action should still be allowed as it has its own cooldown
    await game.connect(addr1).sleep(tokenId);

    // Attempt to sleep again immediately, should revert due to cooldown
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already in dreamland, shhh!"
    );
  });

  it("Should retrieve the correct cooldown times for feed, play, and sleep actions", async function () {
    const feedCooldown = await game.getFeedCooldown();
    const playCooldown = await game.getPlayCooldown();
    const sleepCooldown = await game.getSleepCooldown();

    // Expected cooldown values in seconds
    const expectedFeedCooldown = 10 * 60; // 10 minutes
    const expectedPlayCooldown = 15 * 60; // 15 minutes
    const expectedSleepCooldown = 1 * 60 * 60; // 1 hour

    // Check if the cooldown values are as expected
    expect(feedCooldown).to.equal(expectedFeedCooldown);
    expect(playCooldown).to.equal(expectedPlayCooldown);
    expect(sleepCooldown).to.equal(expectedSleepCooldown);
  });

  it("Should correctly report cooldown ready status for feed, play, and sleep actions", async function () {
    const tokenId = 0;

    // Start each action to initiate their cooldowns
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);
    await game.connect(addr1).sleep(tokenId);

    // Retrieve cooldowns
    const feedCooldown = await game.getFeedCooldown();
    const playCooldown = await game.getPlayCooldown();
    const sleepCooldown = await game.getSleepCooldown();

    // Check action readiness immediately after initiating; all should be false
    expect(await game.isActionReady("feed", tokenId)).to.be.false;
    expect(await game.isActionReady("play", tokenId)).to.be.false;
    expect(await game.isActionReady("sleep", tokenId)).to.be.false;

    // Fast-forward time for each cooldown and check readiness status
    await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
    await ethers.provider.send("evm_mine", []);
    expect(await game.isActionReady("feed", tokenId)).to.be.true;

    await ethers.provider.send("evm_increaseTime", [
      Number(playCooldown) - Number(feedCooldown),
    ]);
    await ethers.provider.send("evm_mine", []);
    expect(await game.isActionReady("play", tokenId)).to.be.true;

    await ethers.provider.send("evm_increaseTime", [
      Number(sleepCooldown) - Number(playCooldown),
    ]);
    await ethers.provider.send("evm_mine", []);
    expect(await game.isActionReady("sleep", tokenId)).to.be.true;
  });

  it("Should revert with an invalid action name in getCooldownTime and isActionReady", async function () {
    const tokenId = 0;

    // Attempt to get the cooldown time for an invalid action name
    await expect(game.getCooldownTime("invalidAction")).to.be.revertedWith(
      "Invalid action"
    );

    // Attempt to check readiness for an invalid action name
    await expect(
      game.isActionReady("invalidAction", tokenId)
    ).to.be.revertedWith("Invalid action");
  });
});
