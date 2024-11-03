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
});
