const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGameMinato Contract - Time and Cooldown Functionality", function () {
  let game, hahaToken, owner, addr1, addr2, addr3;
  const feedCost = ethers.parseUnits("10000", 18);
  const playCost = ethers.parseUnits("10000", 18);

  let snapshotId;

  beforeEach(async function () {
    // Take a snapshot before each test
    snapshotId = await ethers.provider.send("evm_snapshot", []);

    // Deploy HAHA token
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    // Deploy the game contract
    const MamaGotchiGameMinato = await ethers.getContractFactory(
      "MamaGotchiGameMinato"
    );
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    game = await MamaGotchiGameMinato.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Define mint cost
    const mintCost = ethers.parseUnits("1000000000", 18);

    // Transfer tokens and approve only for addr1 initially, following the test's needs
    await hahaToken.transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint Gotchi for addr1, specifically assigning token ID 1
    await game.connect(addr1).mintNewGotchi(addr1.address, 1);

    // Prepare balances for addr2 and addr3 to mint as needed during individual tests
    await hahaToken.transfer(addr2.address, mintCost);
    await hahaToken.connect(addr2).approve(game.target, mintCost);

    await hahaToken.transfer(addr3.address, mintCost);
    await hahaToken.connect(addr3).approve(game.target, mintCost);
  });

  afterEach(async function () {
    // Revert to the snapshot after each test
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  /**
   * 1. Minting a MamaGotchi
   */
  it("Should mint a new MamaGotchi when the user has no prior Gotchi", async function () {
    const MamaGotchiGameMinato = await ethers.getContractFactory(
      "MamaGotchiGameMinato"
    );
    const gameWithoutMint = await MamaGotchiGameMinato.deploy(
      owner.address,
      hahaToken.target
    );
    await gameWithoutMint.waitForDeployment();

    // Check initial balance of addr1, which should be zero
    const initialBalance = await gameWithoutMint.balanceOf(addr1);
    expect(initialBalance).to.equal(0);

    // Mint a new Gotchi for addr1
    await hahaToken
      .connect(addr1)
      .approve(gameWithoutMint.target, ethers.parseUnits("1000000000", 18));
    const mintTx = await gameWithoutMint
      .connect(addr1)
      .mintNewGotchi(addr1.address, 1);
    await mintTx.wait();

    // Verify that addr1 now owns one Gotchi
    const newBalance = await gameWithoutMint.balanceOf(addr1);
    expect(newBalance).to.equal(1);

    // Verify that the new Gotchi has correct initial stats
    const gotchi = await gameWithoutMint.gotchiStats(1);
    expect(gotchi.health).to.equal(80);
    expect(gotchi.happiness).to.equal(80);
  });

  it("Should prevent minting a new Gotchi if the user already owns one and it is alive", async function () {
    const initialBalance = await game.balanceOf(addr1);
    expect(initialBalance).to.equal(1);

    // Attempt to mint a second Gotchi while the first one is still alive, expecting a revert
    await hahaToken
      .connect(addr1)
      .approve(game.target, ethers.parseUnits("1000000000", 18));
    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, 1)
    ).to.be.revertedWith(
      "MamaGotchi still lives! Be a Good Kid and treat her well!"
    );

    // Verify that balance remains unchanged
    const finalBalance = await game.balanceOf(addr1);
    expect(finalBalance).to.equal(1);
  });

  it("Should prevent minting a Gotchi if the user has insufficient $HAHA token allowance", async function () {
    await game.connect(addr1).burn(1);

    // Set initial balance to be sufficient for minting cost
    const mintCost = ethers.parseUnits("1000000000", 18);
    await hahaToken.connect(owner).transfer(addr1.address, mintCost);

    // Set allowance to zero, simulating insufficient allowance
    await hahaToken.connect(addr1).approve(game.target, 0);

    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, 1)
    ).to.be.revertedWith("Approval required for minting");
  });

  it("Should prevent minting a Gotchi if the user has insufficient $HAHA token balance", async function () {
    const tokenIdToBurn = 1;

    // Step 1: Burn the existing Gotchi to allow minting a new one
    await game.connect(addr1).burn(tokenIdToBurn);

    const mintCost = await game.mintCost();

    await hahaToken.connect(addr1).approve(game.target, mintCost);

    const initialBalance = await hahaToken.balanceOf(addr1.address);

    const reducedBalance = mintCost - 1n;

    await hahaToken
      .connect(addr1)
      .transfer(owner.address, initialBalance - reducedBalance);

    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, tokenIdToBurn)
    ).to.be.revertedWith("Insufficient $HAHA balance for minting");
  });

  it("Should allow minting a new Gotchi after burning the previous one", async function () {
    const tokenIdToBurn = 1;

    await game.connect(addr1).burn(tokenIdToBurn);

    await expect(game.connect(addr1).mintNewGotchi(addr1.address, 1)).to.not.be
      .reverted;

    expect(await game.balanceOf(addr1.address)).to.equal(1);
  });

  it("Should only burn the exact mint cost even if allowance is greater", async function () {
    const tokenIdToBurn = 1;

    await game.connect(addr1).burn(tokenIdToBurn);

    const mintCost = await game.mintCost();
    const excessAllowance = mintCost + ethers.parseUnits("1000", 18);
    await hahaToken.connect(addr1).approve(game.target, excessAllowance);

    const initialBalance = await hahaToken.balanceOf(addr1.address);
    await game.connect(addr1).mintNewGotchi(addr1.address, 1);

    const finalBalance = await hahaToken.balanceOf(addr1.address);
    expect(finalBalance).to.equal(initialBalance - mintCost);
  });

  it("Should mint successfully if the user's balance and allowance are exactly equal to mint cost", async function () {
    await game.connect(addr1).burn(1);

    const currentBalance = await hahaToken.balanceOf(addr1.address);
    if (currentBalance > 0) {
      await hahaToken.connect(addr1).transfer(owner.address, currentBalance);
    }

    const mintCost = await game.mintCost();

    await hahaToken.connect(owner).transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    await game.connect(addr1).mintNewGotchi(addr1.address, 1);

    const finalBalance = await hahaToken.balanceOf(addr1.address);
    expect(finalBalance).to.equal(0);
  });

  it("Should attempt minting a new Gotchi after Gotchi death without feeding", async function () {
    const tokenIdToBurn = 1;

    const twoDays = 48 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [twoDays]);
    await ethers.provider.send("evm_mine");

    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, tokenIdToBurn)
    ).to.not.be.reverted;

    const newBalance = await game.balanceOf(addr1.address);
    expect(newBalance).to.equal(1);

    const newGotchi = await game.gotchiStats(2);
    expect(newGotchi.health).to.equal(80);
    expect(newGotchi.happiness).to.equal(80);
  });

  it("Should prevent minting if the Gotchi to burn is still alive", async function () {
    const tokenIdToBurn = 1;

    const gotchi = await game.gotchiStats(tokenIdToBurn);
    expect(gotchi.health).to.be.greaterThan(0);

    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, tokenIdToBurn)
    ).to.be.revertedWith(
      "MamaGotchi still lives! Be a Good Kid and treat her well!"
    );
  });

  it("Should prevent minting if the player has a live Gotchi", async function () {
    // Confirm the player already owns a live Gotchi
    const initialBalance = await game.balanceOf(addr1);
    expect(initialBalance).to.equal(1);

    // Approve the mint cost
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Attempt to mint a new Gotchi without burning the live one; expect revert
    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, 1)
    ).to.be.revertedWith(
      "MamaGotchi still lives! Be a Good Kid and treat her well!"
    );

    // Verify the player still has only one Gotchi
    const finalBalance = await game.balanceOf(addr1);
    expect(finalBalance).to.equal(1);
  });

  it("Should require burning a dead Gotchi before minting a new one", async function () {
    const tokenIdToBurn = 1;

    // Step 1: Advance time by one day to let the Gotchi's health and happiness decay
    const oneDay = 24 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [oneDay]);
    await ethers.provider.send("evm_mine");

    // Step 2: Attempt to mint a new Gotchi with the dead Gotchi specified for burning (should succeed)
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a new Gotchi, this should proceed without errors if the Gotchi is dead and burnable
    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, tokenIdToBurn)
    ).to.not.be.reverted;

    // Step 3: Confirm that the user now owns a new Gotchi with updated stats
    const newBalance = await game.balanceOf(addr1.address);
    expect(newBalance).to.equal(1);

    const newGotchi = await game.gotchiStats(2); // Assuming the new Gotchi has ID 2
    expect(newGotchi.health).to.equal(80); // Initial health of the new Gotchi
    expect(newGotchi.happiness).to.equal(80); // Initial happiness of the new Gotchi
  });

  it("Should prevent minting if the specified tokenIdToBurn does not belong to the user", async function () {
    // Define mintCost explicitly for this test
    const mintCost = await game.mintCost();

    // Transfer $HAHA tokens to addr1 and set allowance
    await hahaToken.connect(owner).transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Attempt to mint with a tokenIdToBurn that addr1 does not own
    const fakeTokenId = 9999; // Use a high number to ensure it's not owned by addr1
    await expect(game.connect(addr1).mintNewGotchi(addr1.address, fakeTokenId))
      .to.be.reverted; // Check that it simply reverts without specifying a string message
  });

  //
  // 2. Feeding MamaGotchi test
  //

  it("Should feed a Gotchi when it is awake and cooldown has passed", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Retrieve feed cooldown, feed health boost, and max health directly from the contract
    const feedCooldown = Number((await game.cooldowns()).feed);
    const feedHealthBoost = Number(await game.feedHealthBoost());
    const maxHealth = Number(await game.MAX_HEALTH());

    // Advance time by enough seconds to exceed the feed cooldown
    await ethers.provider.send("evm_increaseTime", [feedCooldown]);
    await ethers.provider.send("evm_mine");

    // Retrieve initial health and token balance for addr1
    const initialHealth = Number((await game.gotchiStats(tokenId)).health);
    const initialTokenBalance = await hahaToken.balanceOf(addr1.address);

    // Feed the Gotchi and confirm no revert occurs
    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await game.connect(addr1).feed(tokenId);

    // Verify health increase, respecting max health cap
    const gotchi = await game.gotchiStats(tokenId);
    const expectedHealth = Math.min(initialHealth + feedHealthBoost, maxHealth);
    expect(Number(gotchi.health)).to.equal(expectedHealth);

    // Verify token burn by checking addr1's token balance
    const tokenBalanceAfterFeed = await hahaToken.balanceOf(addr1.address);
    expect(tokenBalanceAfterFeed).to.equal(initialTokenBalance - feedCost);

    // Verify lastFeedTime is updated to current block timestamp
    const currentTimestamp = Number(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    expect(Number(gotchi.lastFeedTime)).to.equal(currentTimestamp);
  });

  it("Should prevent feeding multiple times within the cooldown period", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Retrieve feed cooldown from the contract
    const feedCooldown = Number((await game.cooldowns()).feed);

    // First feed attempt (should pass)
    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await game.connect(addr1).feed(tokenId);

    // Attempt a second feed immediately, expecting it to revert
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm full!"
    );

    // Advance time by the cooldown duration to allow feeding again
    await ethers.provider.send("evm_increaseTime", [feedCooldown]);
    await ethers.provider.send("evm_mine");

    // Approve tokens again and successfully feed after cooldown
    await hahaToken.connect(addr1).approve(game.target, feedCost);
    await expect(game.connect(addr1).feed(tokenId)).to.not.be.reverted;
  });

  it("Should prevent feeding a Gotchi while it is asleep", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Approve tokens for sleeping cost specifically (now required by the updated contract)
    const sleepCost = await game.sleepCost();
    await hahaToken.connect(addr1).approve(game.target, sleepCost);

    // Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Attempt to feed while the Gotchi is asleep, expecting a revert
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi is asleep!"
    );

    // Wake the Gotchi up to clean up state for future tests
    await game.connect(addr1).wake(tokenId);
  });

  it("Should prevent feeding a Gotchi if $HAHA allowance is zero", async function () {
    const tokenId = 1;

    // Set the $HAHA allowance for feeding to zero
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Attempt to feed the Gotchi, expecting a revert due to zero allowance
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "Approval required for feeding"
    );
  });

  it("Should prevent feeding a Gotchi if $HAHA balance is insufficient", async function () {
    // Transfer away addr1's HAHA tokens to simulate insufficient balance
    const balance = await hahaToken.balanceOf(addr1.address);
    await hahaToken.connect(addr1).transfer(owner.address, balance);

    // Attempt to feed the Gotchi and expect a revert
    await expect(game.connect(addr1).feed(1)).to.be.reverted;
  });

  it("Should prevent feeding a Gotchi if $HAHA balance is insufficient", async function () {
    // Save initial HAHA balance and Gotchi health
    const initialBalance = await hahaToken.balanceOf(addr1.address);
    const initialHealth = (await game.gotchiStats(1)).health;

    // Transfer away addr1's HAHA tokens to simulate insufficient balance
    await hahaToken.connect(addr1).transfer(owner.address, initialBalance);

    // Attempt to feed the Gotchi and expect a revert
    await expect(game.connect(addr1).feed(1)).to.be.reverted;

    // Confirm HAHA balance and health haven't changed
    const finalBalance = await hahaToken.balanceOf(addr1.address);
    const finalHealth = (await game.gotchiStats(1)).health;

    expect(finalBalance).to.equal(0); // No HAHA tokens should remain for addr1
    expect(finalHealth).to.equal(initialHealth); // Health should remain unchanged
  });

  it("Should prevent feeding a Gotchi if $HAHA balance is insufficient", async function () {
    // Save initial HAHA balance and Gotchi health
    const initialBalance = await hahaToken.balanceOf(addr1.address);
    const initialHealth = (await game.gotchiStats(1)).health;

    // Transfer away addr1's HAHA tokens to simulate insufficient balance
    await hahaToken.connect(addr1).transfer(owner.address, initialBalance);

    try {
      // Attempt to feed the Gotchi, expecting a revert
      await game.connect(addr1).feed(1);
      // If no error was thrown, force fail the test
      throw new Error(
        "Expected feed to revert due to insufficient balance, but it succeeded"
      );
    } catch (error) {
      // Check that balance and health haven't changed
      const finalBalance = await hahaToken.balanceOf(addr1.address);
      const finalHealth = (await game.gotchiStats(1)).health;

      expect(finalBalance).to.equal(0); // No HAHA tokens should remain for addr1
      expect(finalHealth).to.equal(initialHealth); // Health should remain unchanged
    }
  });

  it("Should allow feeding a Gotchi exactly when cooldown expires", async function () {
    const tokenId = 1;

    // Initial feed to start the cooldown
    await game.connect(addr1).feed(tokenId);

    // Increase time to exactly match the cooldown period, using BigInt directly
    const feedCooldown = (await game.cooldowns()).feed;
    await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
    await ethers.provider.send("evm_mine");

    // Attempt to feed the Gotchi again exactly at cooldown expiration
    await expect(game.connect(addr1).feed(tokenId)).to.not.be.reverted;
  });

  it("Should prevent feeding a Gotchi if $HAHA allowance is insufficient", async function () {
    const tokenId = 1;

    // Set allowance to a value lower than feedCost to simulate insufficient allowance
    const insufficientAllowance = (await game.feedCost()) - BigInt(1); // Setting it just below feedCost
    await hahaToken.connect(addr1).approve(game.target, insufficientAllowance);

    // Attempt to feed the Gotchi with insufficient allowance, expecting a revert
    await expect(game.connect(addr1).feed(tokenId)).to.be.reverted;
  });

  it("Should prevent feeding a dead Gotchi", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure Gotchi's health or happiness decays to zero
    const twoDays = 48 * 60 * 60; // Adjust duration based on expected decay to zero health/happiness
    await ethers.provider.send("evm_increaseTime", [twoDays]);
    await ethers.provider.send("evm_mine");

    // Step 2: Attempt to feed the Gotchi, expecting an event indicating the Gotchi is dead
    await expect(game.connect(addr1).feed(tokenId))
      .to.emit(game, "GotchiDied")
      .withArgs(addr1.address, tokenId);
  });

  it("Should prevent Gotchi's health from exceeding MAX_HEALTH when feeding", async function () {
    const tokenId = 1;

    // Step 1: Bring health close to MAX_HEALTH by feeding multiple times
    const maxHealth = BigInt(100); // MAX_HEALTH defined as BigInt
    const feedHealthBoost = BigInt(10); // feedHealthBoost also as BigInt

    for (let i = 0; i < 2; i++) {
      // Feed and increment time to simulate cooldown reset
      await game.connect(addr1).feed(tokenId);
      const feedCooldown = (await game.cooldowns()).feed; // Already BigInt in ethers v6
      await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
      await ethers.provider.send("evm_mine");
    }

    // Re-fetch Gotchi stats after preliminary feedings
    let gotchi = await game.gotchiStats(tokenId);

    // Confirm that health is close to, but less than, MAX_HEALTH
    expect(gotchi.health).to.be.at.most(maxHealth);
    expect(gotchi.health).to.be.greaterThan(maxHealth - feedHealthBoost);

    // Step 2: Feed one more time to reach MAX_HEALTH and ensure it does not exceed
    await game.connect(addr1).feed(tokenId);

    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(maxHealth); // Health should cap at MAX_HEALTH
  });

  it("Should enforce feed cooldown correctly", async function () {
    const tokenId = 1n;

    // Step 0: Check that the feed cooldown is set correctly after deployment
    const feedCooldown = await game
      .cooldowns()
      .then((cooldowns) => cooldowns.feed);
    console.log("Feed cooldown (expected 600):", feedCooldown.toString());
    expect(feedCooldown).to.equal(600);

    // Step 1: Perform an initial feed to set the cooldown
    await game.connect(addr1).feed(tokenId);

    // Step 2: Confirm lastFeedTime is set correctly
    const initialFeedTime = await game
      .gotchiStats(tokenId)
      .then((stats) => stats.lastFeedTime);
    console.log("lastFeedTime after initial feed:", initialFeedTime.toString());
    expect(initialFeedTime).to.be.greaterThan(0);

    // Step 3: Try to feed immediately, expecting a revert due to cooldown
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm full!"
    );

    // Step 4: Increment time to complete the cooldown period
    await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]); // Move time forward by cooldown period
    await ethers.provider.send("evm_mine");

    // Feed should now be allowed as the cooldown has expired
    await expect(game.connect(addr1).feed(tokenId)).to.not.be.reverted;
  });

  //
  // 3. Playing with MamaGotchi test
  //

  it("Should play with a Gotchi when it is awake and cooldown has passed", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Retrieve play cooldown, play happiness boost, and max happiness directly from the contract
    const playCooldown = Number((await game.cooldowns()).play);
    const playHappinessBoost = Number(await game.playHappinessBoost());
    const maxHappiness = Number(await game.MAX_HAPPINESS());

    // Advance time by enough seconds to exceed the play cooldown
    await ethers.provider.send("evm_increaseTime", [playCooldown]);
    await ethers.provider.send("evm_mine");

    // Retrieve initial happiness and token balance for addr1
    const initialHappiness = Number(
      (await game.gotchiStats(tokenId)).happiness
    );
    console.log("Initial Happiness before play action:", initialHappiness); // Log initial happiness

    const initialTokenBalance = await hahaToken.balanceOf(addr1.address);

    // Play with the Gotchi and confirm no revert occurs
    await hahaToken.connect(addr1).approve(game.target, playCost);
    await game.connect(addr1).play(tokenId);

    // Fetch Gotchi stats after playing
    const gotchiAfterPlay = await game.gotchiStats(tokenId);
    console.log(
      "Happiness after play and decay:",
      Number(gotchiAfterPlay.happiness)
    ); // Log post-decay happiness

    // Verify happiness increase, considering minor decay
    const expectedHappinessRange = [
      Math.min(initialHappiness + playHappinessBoost, maxHappiness) - 1,
      Math.min(initialHappiness + playHappinessBoost, maxHappiness),
    ];
    expect(expectedHappinessRange).to.include(
      Number(gotchiAfterPlay.happiness)
    );

    // Verify token burn by checking addr1's token balance
    const tokenBalanceAfterPlay = await hahaToken.balanceOf(addr1.address);
    expect(tokenBalanceAfterPlay).to.equal(initialTokenBalance - playCost);

    // Verify lastPlayTime is updated to current block timestamp
    const currentTimestamp = Number(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    expect(Number(gotchiAfterPlay.lastPlayTime)).to.equal(currentTimestamp);
  });

  it("Should prevent playing multiple times within the cooldown period", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Retrieve play cooldown from the contract
    const playCooldown = Number((await game.cooldowns()).play);

    // First play attempt (should pass)
    await hahaToken.connect(addr1).approve(game.target, playCost);
    await game.connect(addr1).play(tokenId);

    // Attempt a second play immediately, expecting it to revert
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );

    // Advance time by the cooldown duration to allow playing again
    await ethers.provider.send("evm_increaseTime", [playCooldown]);
    await ethers.provider.send("evm_mine");

    // Approve tokens again and successfully play after cooldown
    await hahaToken.connect(addr1).approve(game.target, playCost);
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  it("Should prevent playing with a Gotchi while it is asleep", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Approve tokens for sleeping cost specifically (now required by the updated contract)
    const sleepCost = await game.sleepCost();
    await hahaToken.connect(addr1).approve(game.target, sleepCost);

    // Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Attempt to play while the Gotchi is asleep, expecting a revert
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi is asleep!"
    );

    // Wake the Gotchi up to clean up state for future tests
    await game.connect(addr1).wake(tokenId);
  });

  it("Should prevent playing a Gotchi if $HAHA allowance is zero", async function () {
    const tokenId = 1;

    // Set the $HAHA allowance for playing to zero
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Attempt to play with the Gotchi, expecting a revert due to zero allowance
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "Approval required for playing"
    );
  });

  it("Should prevent playing a Gotchi if $HAHA balance is insufficient", async function () {
    // Transfer away addr1's HAHA tokens to simulate insufficient balance
    const balance = await hahaToken.balanceOf(addr1.address);
    await hahaToken.connect(addr1).transfer(owner.address, balance);

    // Attempt to play with the Gotchi and expect a revert
    await expect(game.connect(addr1).play(1)).to.be.reverted;
  });

  it("Should allow playing a Gotchi exactly when cooldown expires", async function () {
    const tokenId = 1;

    // Initial play to start the cooldown
    await game.connect(addr1).play(tokenId);

    // Increase time to exactly match the cooldown period
    const playCooldown = (await game.cooldowns()).play;
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine");

    // Attempt to play with the Gotchi again exactly at cooldown expiration
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  it("Should prevent playing a dead Gotchi", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure Gotchi's health or happiness decays to zero
    const twoDays = 48 * 60 * 60; // Adjust duration based on expected decay to zero health/happiness
    await ethers.provider.send("evm_increaseTime", [twoDays]);
    await ethers.provider.send("evm_mine");

    // Step 2: Attempt to play with the Gotchi, expecting the contract to recognize it as dead and emit GotchiDied
    await expect(game.connect(addr1).play(tokenId))
      .to.emit(game, "GotchiDied")
      .withArgs(addr1.address, tokenId);
  });

  it("Should prevent Gotchi's happiness from exceeding MAX_HAPPINESS when playing", async function () {
    const tokenId = 1;

    // Step 1: Bring happiness close to MAX_HAPPINESS by playing multiple times
    const maxHappiness = BigInt(100); // MAX_HAPPINESS defined as BigInt
    const playHappinessBoost = BigInt(10); // playHappinessBoost also as BigInt

    for (let i = 0; i < 2; i++) {
      // Play and increment time to simulate cooldown reset
      await game.connect(addr1).play(tokenId);
      const playCooldown = (await game.cooldowns()).play; // Already BigInt in ethers v6
      await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
      await ethers.provider.send("evm_mine");
    }

    // Re-fetch Gotchi stats after preliminary play actions
    let gotchi = await game.gotchiStats(tokenId);

    // Confirm that happiness is close to, but less than, MAX_HAPPINESS
    expect(gotchi.happiness).to.be.at.most(maxHappiness);
    expect(gotchi.happiness).to.be.greaterThan(
      maxHappiness - playHappinessBoost
    );

    // Step 2: Play one more time to reach MAX_HAPPINESS and ensure it does not exceed
    await game.connect(addr1).play(tokenId);

    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.happiness).to.equal(maxHappiness); // Happiness should cap at MAX_HAPPINESS
  });

  it("Should enforce play cooldown correctly", async function () {
    const tokenId = 1n;

    // Step 0: Check that the play cooldown is set correctly after deployment
    const playCooldown = await game
      .cooldowns()
      .then((cooldowns) => cooldowns.play);
    expect(playCooldown).to.equal(900); // Adjust this based on contract's play cooldown

    // Step 1: Perform an initial play to set the cooldown
    await game.connect(addr1).play(tokenId);

    // Step 2: Confirm lastPlayTime is set correctly
    const initialPlayTime = await game
      .gotchiStats(tokenId)
      .then((stats) => stats.lastPlayTime);
    expect(initialPlayTime).to.be.greaterThan(0);

    // Step 3: Try to play immediately, expecting a revert due to cooldown
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );

    // Step 4: Increment time to complete the cooldown period
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]); // Move time forward by cooldown period
    await ethers.provider.send("evm_mine");

    // Play should now be allowed as the cooldown has expired
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  //
  // 4. Sleep Tests
  //

  it("Should successfully put the Gotchi to sleep and verify sleep start time and isSleeping state", async function () {
    const tokenId = 1;

    // Advance time if necessary to ensure any sleep cooldown has passed
    const sleepCooldown = Number((await game.cooldowns()).sleep);
    await ethers.provider.send("evm_increaseTime", [sleepCooldown]);
    await ethers.provider.send("evm_mine");

    // Put the Gotchi to sleep
    const tx = await game.connect(addr1).sleep(tokenId);

    // Retrieve the updated Gotchi stats
    const gotchi = await game.gotchiStats(tokenId);

    // Verify the Gotchi is now sleeping
    expect(gotchi.isSleeping).to.be.true;

    // Verify sleepStartTime is set to the current block timestamp
    const currentTimestamp = Number(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    expect(Number(gotchi.sleepStartTime)).to.equal(currentTimestamp);

    // Check that the GotchiSleeping event was emitted with the correct parameters
    await expect(tx)
      .to.emit(game, "GotchiSleeping")
      .withArgs(
        addr1.address,
        tokenId,
        currentTimestamp,
        gotchi.health,
        gotchi.happiness,
        gotchi.timeAlive
      );
  });

  it("Should handle multiple sleep and wake cycles correctly, enforcing cooldown and state transitions", async function () {
    const tokenId = 1;
    const sleepCooldown = Number((await game.cooldowns()).sleep);

    for (let cycle = 0; cycle < 2; cycle++) {
      // Step 1: Ensure sleep cooldown has passed
      await ethers.provider.send("evm_increaseTime", [sleepCooldown]);
      await ethers.provider.send("evm_mine");

      // Step 2: Put the Gotchi to sleep
      const sleepTx = await game.connect(addr1).sleep(tokenId);

      // Retrieve updated Gotchi stats
      let gotchi = await game.gotchiStats(tokenId);

      // Verify the Gotchi is in sleep mode
      expect(gotchi.isSleeping).to.be.true;

      // Verify GotchiSleeping event
      await expect(sleepTx)
        .to.emit(game, "GotchiSleeping")
        .withArgs(
          addr1.address,
          tokenId,
          gotchi.sleepStartTime,
          gotchi.health,
          gotchi.happiness,
          gotchi.timeAlive
        );

      // Step 3: Wake the Gotchi up
      const wakeTx = await game.connect(addr1).wake(tokenId);

      // Retrieve updated Gotchi stats
      gotchi = await game.gotchiStats(tokenId);

      // Verify the Gotchi is awake
      expect(gotchi.isSleeping).to.be.false;

      // Verify GotchiAwake event
      await expect(wakeTx).to.emit(game, "GotchiAwake").withArgs(
        addr1.address,
        tokenId,
        gotchi.health,
        gotchi.happiness,
        gotchi.timeAlive,
        gotchi.lastInteraction // Include wakeTimestamp
      );
    }
  });

  it("Should prevent putting a Gotchi to sleep if the cooldown isn't met", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Step 1: Put the Gotchi to sleep initially to set the lastSleepTime
    await game.connect(addr1).sleep(tokenId);

    // Step 2: Wake the Gotchi up to reset its sleep state
    await game.connect(addr1).wake(tokenId);

    // Step 3: Attempt to put it back to sleep before cooldown expires
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm not sleepy!"
    );

    // Step 4: Advance time to complete the cooldown
    const sleepCooldown = Number((await game.cooldowns()).sleep);
    await ethers.provider.send("evm_increaseTime", [sleepCooldown]);
    await ethers.provider.send("evm_mine");

    // Step 5: Now attempt to put the Gotchi to sleep again after cooldown has passed
    await expect(game.connect(addr1).sleep(tokenId)).to.not.be.reverted;
  });

  it("Should handle multiple sleep and wake cycles, enforcing cooldowns and state transitions", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Step 1: Put the Gotchi to sleep for the first time
    await game.connect(addr1).sleep(tokenId);
    let gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true; // Ensure Gotchi is now sleeping

    // Step 2: Try feeding while sleeping, expecting "MamaGotchi is asleep!" error
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi is asleep!"
    );

    // Step 3: Wake the Gotchi and verify wake state
    await game.connect(addr1).wake(tokenId);
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.false; // Confirm Gotchi is now awake

    // Step 4: Attempt to put Gotchi back to sleep immediately; expect cooldown error
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm not sleepy!"
    );

    // Step 5: Fast-forward time to allow cooldown to reset, then put Gotchi back to sleep
    const sleepCooldown = (await game.cooldowns()).sleep;
    await ethers.provider.send("evm_increaseTime", [Number(sleepCooldown)]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).sleep(tokenId);
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true; // Confirm Gotchi is sleeping again

    // Step 6: Attempt to play while sleeping to confirm "MamaGotchi is asleep!" error
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi is asleep!"
    );

    // Step 7: Wake Gotchi again and confirm wake state
    await game.connect(addr1).wake(tokenId);
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.false; // Confirm awake

    // End of test: multiple cycles passed without issues
  });

  it("Should prevent putting a dead Gotchi to sleep", async function () {
    const tokenId = 1;

    // Step 1: Advance time by 48 hours to ensure health and happiness decay to zero.
    const twoDays = 48 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [twoDays]);
    await ethers.provider.send("evm_mine");

    // Retrieve current Gotchi stats before attempting sleep
    const gotchi = await game.gotchiStats(tokenId);

    // Step 3: Attempt to put the Gotchi to sleep, expecting an event indicating death
    const sleepTx = await game.connect(addr1).sleep(tokenId);

    // Check the GotchiDied event since the Gotchi is dead
    await expect(sleepTx)
      .to.emit(game, "GotchiDied")
      .withArgs(addr1.address, tokenId);

    // Verify Gotchi is still dead
    const updatedGotchi = await game.gotchiStats(tokenId);
    expect(updatedGotchi.deathTimestamp).to.be.gt(0); // Death timestamp should be set
  });

  it("Should apply decay correctly if Gotchi sleeps beyond MAX_SLEEP_DURATION", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Put Gotchi to sleep initially
    await game.connect(addr1).sleep(tokenId);

    // Retrieve max sleep duration and calculate extended sleep time
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    const extendedSleepTime = Number(maxSleepDuration) + 3600; // 1 hour beyond max sleep

    // Fast-forward time by max sleep duration + extra time
    await ethers.provider.send("evm_increaseTime", [extendedSleepTime]);
    await ethers.provider.send("evm_mine");

    // Wake the Gotchi to apply decay
    await game.connect(addr1).wake(tokenId);

    // Verify health and happiness have decayed
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.be.lessThan(80);
    expect(gotchi.happiness).to.be.lessThan(80);
    expect(gotchi.deathTimestamp).to.equal(0); // Ensure Gotchi is still alive if health/happiness are above 0
  });

  it("Should retain health and happiness at 80 when woken up at exact MAX_SLEEP_DURATION", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Put Gotchi to sleep initially
    await game.connect(addr1).sleep(tokenId);

    // Retrieve max sleep duration and advance time by exactly this amount
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    await ethers.provider.send("evm_increaseTime", [Number(maxSleepDuration)]);
    await ethers.provider.send("evm_mine");

    // Wake the Gotchi to apply potential decay
    await game.connect(addr1).wake(tokenId);

    // Verify health and happiness are still at their original values, with no decay applied
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(80); // Health should remain unchanged
    expect(gotchi.happiness).to.equal(80); // Happiness should remain unchanged
  });

  it("Should not decay health or happiness if woken up before MAX_SLEEP_DURATION", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Step 1: Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Step 2: Advance time to just before MAX_SLEEP_DURATION
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    const wakeUpBeforeDecay = Number(maxSleepDuration) - 60; // Waking up 1 minute before MAX_SLEEP_DURATION
    await ethers.provider.send("evm_increaseTime", [wakeUpBeforeDecay]);
    await ethers.provider.send("evm_mine");

    // Step 3: Wake the Gotchi before any decay is applied
    await game.connect(addr1).wake(tokenId);

    // Retrieve Gotchi stats to verify no decay in health or happiness
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(80); // Health should be unchanged
    expect(gotchi.happiness).to.equal(80); // Happiness should be unchanged
  });

  it("Should mark Gotchi as dead if health or happiness decays to zero during sleep before MAX_SLEEP_DURATION", async function () {
    const tokenId = 1;

    // Step 1: Put Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Step 2: Advance time beyond a point where decay will reach zero, beyond MAX_SLEEP_DURATION
    const excessiveTimeJump = 2 * 24 * 60 * 60; // Two days, ample time for decay to zero
    await ethers.provider.send("evm_increaseTime", [excessiveTimeJump]);
    await ethers.provider.send("evm_mine");

    // Step 3: Attempt to wake the Gotchi; this should apply decay and set it as dead if health/happiness are zero
    await expect(game.connect(addr1).wake(tokenId)).to.emit(game, "GotchiDied");

    // Fetch the Gotchi stats to confirm death state
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(0);
    expect(gotchi.happiness).to.equal(0);
    expect(gotchi.deathTimestamp).to.be.greaterThan(0); // Ensure deathTimestamp is set
  });

  it("Should reset sleep cooldown for a newly minted Gotchi after the previous Gotchi's death", async function () {
    const initialTokenId = 1;

    // Retrieve the sleep cost for approval
    const sleepCost = await game.sleepCost();

    // Step 1: Approve and put the initial Gotchi to sleep
    await hahaToken.connect(addr1).approve(game.target, sleepCost);
    await game.connect(addr1).sleep(initialTokenId);

    let gotchi = await game.gotchiStats(initialTokenId);
    expect(gotchi.isSleeping).to.be.true;

    // Step 2: Advance time by 48 hours to ensure it dies from decay during sleep
    const twoDaysInSeconds = 48 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [twoDaysInSeconds]);
    await ethers.provider.send("evm_mine");

    // Step 3: Wake the Gotchi to trigger death due to sleep decay
    await game.connect(addr1).wake(initialTokenId);
    gotchi = await game.gotchiStats(initialTokenId);
    expect(gotchi.health).to.equal(0);
    expect(gotchi.happiness).to.equal(0);
    expect(gotchi.deathTimestamp).to.be.greaterThan(0); // Death timestamp should be set

    // Step 4: Mint a new Gotchi immediately after burning the dead Gotchi
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, initialTokenId);

    // Verify that a new Gotchi is successfully minted with initial stats
    const newTokenId = 2;
    let newGotchi = await game.gotchiStats(newTokenId);
    expect(newGotchi.health).to.equal(80);
    expect(newGotchi.happiness).to.equal(80);
    expect(newGotchi.isSleeping).to.be.false;

    // Step 5: Approve and attempt to put the new Gotchi to sleep immediately (no cooldown should apply)
    await hahaToken.connect(addr1).approve(game.target, sleepCost);
    await expect(game.connect(addr1).sleep(newTokenId)).to.not.be.reverted;

    // Verify the new Gotchi's sleep state
    newGotchi = await game.gotchiStats(newTokenId);
    expect(newGotchi.isSleeping).to.be.true;
    const currentTimestamp = Number(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    expect(Number(newGotchi.sleepStartTime)).to.equal(currentTimestamp);
  });

  it("Should prevent sleeping if $HAHA allowance is zero", async function () {
    const tokenId = 1;

    // Set the $HAHA allowance for sleeping to zero
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Attempt to put the Gotchi to sleep, expecting a revert due to zero allowance
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "Approval required for sleeping"
    );
  });

  it("Should prevent sleeping if $HAHA allowance is insufficient", async function () {
    const tokenId = 1;

    // Set allowance to a value lower than sleepCost to simulate insufficient allowance
    const insufficientAllowance = (await game.sleepCost()) - BigInt(1); // Just below sleepCost
    await hahaToken.connect(addr1).approve(game.target, insufficientAllowance);

    // Attempt to put the Gotchi to sleep with insufficient allowance, expecting a revert
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "Approval required for sleeping"
    );
  });

  it("Should allow sleeping if $HAHA allowance is exactly equal to sleep cost", async function () {
    const tokenId = 1;

    // Set allowance exactly to sleepCost
    const sleepCost = await game.sleepCost();
    await hahaToken.connect(addr1).approve(game.target, sleepCost);

    // Successfully put the Gotchi to sleep
    await expect(game.connect(addr1).sleep(tokenId)).to.not.be.reverted;

    // Verify the Gotchi's sleep state
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true;
  });

  it("Should only burn the exact sleep cost from balance on successful sleep", async function () {
    const tokenId = 1;

    // Set allowance higher than sleepCost
    const sleepCost = await game.sleepCost();
    const excessAllowance = sleepCost + ethers.parseUnits("1000", 18);
    await hahaToken.connect(addr1).approve(game.target, excessAllowance);

    // Get the initial balance for comparison after sleeping
    const initialBalance = await hahaToken.balanceOf(addr1.address);

    // Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Verify that only the sleepCost was deducted
    const finalBalance = await hahaToken.balanceOf(addr1.address);
    expect(finalBalance).to.equal(initialBalance - sleepCost);

    // Verify the Gotchi's sleep state
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true;
  });

  it("Should prevent sleeping if the user has insufficient $HAHA balance", async function () {
    const tokenId = 1;

    // Transfer away addr1's $HAHA tokens to simulate insufficient balance
    const balance = await hahaToken.balanceOf(addr1.address);
    await hahaToken.connect(addr1).transfer(owner.address, balance);

    // Attempt to put the Gotchi to sleep, expecting a generic revert
    await expect(game.connect(addr1).sleep(tokenId)).to.be.reverted;
  });

  it("Should update the leaderboard with timeAlive if Gotchi is alive and timeAlive exceeds previous high score", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Step 1: Mint the Gotchi and confirm initial leaderboard score is zero
    let initialScore = await game.playerHighScores(addr1.address);
    console.log("Initial leaderboard score:", initialScore.toString()); // Log initial score
    expect(initialScore).to.equal(0);

    // Step 2: Advance time and call manualSaveToLeaderboard to simulate accumulation of timeAlive
    const oneHourInSeconds = 60 * 60;
    await ethers.provider.send("evm_increaseTime", [oneHourInSeconds]);
    await ethers.provider.send("evm_mine");

    // Step 3: Manually save to leaderboard and confirm leaderboard updates with timeAlive
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    const updatedScore = await game.playerHighScores(addr1.address);

    // Log the Gotchi's timeAlive and the updated leaderboard score
    console.log("Gotchi's timeAlive:", gotchi.timeAlive.toString());
    console.log("Updated leaderboard score:", updatedScore.toString());

    // Verify that leaderboard's updated score matches the Gotchi's timeAlive
    expect(updatedScore).to.equal(gotchi.timeAlive);
  });

  it("Should update leaderboard with accumulated timeAlive after idle time when manualSaveToLeaderboard is called", async function () {
    const tokenId = 1; // ID of the Gotchi owned by addr1

    // Step 1: Check initial leaderboard score is zero and log it
    let initialScore = await game.playerHighScores(addr1.address);
    console.log("Initial leaderboard score:", initialScore.toString()); // Log initial score
    expect(initialScore).to.equal(0);

    // Step 2: Simulate idle time without interactions
    const twoHoursInSeconds = 2 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [twoHoursInSeconds]);
    await ethers.provider.send("evm_mine");

    // Step 3: Manually save to leaderboard and confirm leaderboard updates with the idle time accumulated
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    const updatedScore = await game.playerHighScores(addr1.address);

    // Log the Gotchi's timeAlive and the updated leaderboard score
    console.log(
      "Gotchi's timeAlive after idle time:",
      gotchi.timeAlive.toString()
    );
    console.log(
      "Updated leaderboard score after idle time:",
      updatedScore.toString()
    );

    // Verify that leaderboard's updated score matches the Gotchi's timeAlive after idle time
    expect(updatedScore).to.equal(gotchi.timeAlive);
  });
  // Vanilla Case 1.1: Check initial timeAlive is zero on mint
  it("Should initialize timeAlive to zero upon minting", async function () {
    const tokenId = 1;
    let gotchi = await game.gotchiStats(tokenId);
    console.log("Initial timeAlive:", gotchi.timeAlive.toString());
    expect(Number(gotchi.timeAlive)).to.equal(0);
  });

  // Vanilla Case 1.2: Advance by 1 hour, interact with play, and check timeAlive
  // Combined Test: Check timeAlive progression with sequential play and feed interactions
  it("Should increase timeAlive cumulatively on sequential play and feed interactions", async function () {
    const tokenId = 1;
    const oneHour = 60 * 60;

    // Step 1: Advance time by 1 hour, then call play and check timeAlive
    await ethers.provider.send("evm_increaseTime", [oneHour]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).play(tokenId);

    let gotchi = await game.gotchiStats(tokenId);
    console.log(
      "timeAlive after 1 hour and play:",
      gotchi.timeAlive.toString()
    );
    expect(Number(gotchi.timeAlive)).to.be.within(oneHour - 10, oneHour + 10);

    // Step 2: Advance another hour, call feed, and check cumulative timeAlive
    await ethers.provider.send("evm_increaseTime", [oneHour]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).feed(tokenId);

    gotchi = await game.gotchiStats(tokenId);
    console.log(
      "timeAlive after 2 hours and feed:",
      gotchi.timeAlive.toString()
    );

    // Expect cumulative timeAlive to be around 2 hours with a 10-second tolerance
    expect(Number(gotchi.timeAlive)).to.be.within(
      2 * oneHour - 10,
      2 * oneHour + 10
    );
  });

  // Vanilla Case 1.5: Call manualSaveToLeaderboard and check leaderboard update
  it("Should update leaderboard score with timeAlive on manual save", async function () {
    const tokenId = 1;

    // Define time increments as BigInt
    const oneHour = BigInt(60 * 60);

    // Step 1: Advance time by 1 hour (in BigInt) before saving
    await ethers.provider.send("evm_increaseTime", [Number(oneHour)]);
    await ethers.provider.send("evm_mine");

    // Step 2: Call manualSaveToLeaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 3: Retrieve gotchi stats and leaderboard score for validation
    const gotchi = await game.gotchiStats(tokenId);
    const updatedScore = await game.playerHighScores(addr1.address);
    console.log(
      "Leaderboard score after manual save:",
      updatedScore.toString()
    );

    // Step 4: Convert expected tolerance bounds to BigInt and verify
    const lowerBound = gotchi.timeAlive - BigInt(10);
    const upperBound = gotchi.timeAlive + BigInt(10);
    expect(updatedScore).to.be.within(lowerBound, upperBound);
  });

  // Vanilla Case 1.4: Sleep interaction for half duration and verify timeAlive
  it("Should accumulate timeAlive during sleep up to half of MAX_SLEEP_DURATION", async function () {
    const tokenId = 1;

    // Calculate half of MAX_SLEEP_DURATION
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    const halfSleepDuration = Number(maxSleepDuration) / 2;

    // Approve tokens for sleep cost and put Gotchi to sleep
    const sleepCost = await game.sleepCost();
    await hahaToken.connect(addr1).approve(game.target, sleepCost);
    await game.connect(addr1).sleep(tokenId);

    // Advance time by half of MAX_SLEEP_DURATION and wake the Gotchi
    await ethers.provider.send("evm_increaseTime", [halfSleepDuration]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).wake(tokenId);

    let gotchi = await game.gotchiStats(tokenId);
    console.log(
      "timeAlive after half sleep duration:",
      gotchi.timeAlive.toString()
    );

    // Expect timeAlive to be within halfSleepDuration with a tolerance
    expect(Number(gotchi.timeAlive)).to.be.within(
      halfSleepDuration - 10,
      halfSleepDuration + 10
    );
  });

  it("Should accumulate timeAlive as MAX_SLEEP_DURATION plus decay time during extended sleep (18 hours)", async function () {
    const tokenId = 1;
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();

    // Step 1: Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Step 2: Advance time by 18 hours (64800 seconds)
    const extendedSleepTime = 18 * 60 * 60; // 18 hours in seconds
    await ethers.provider.send("evm_increaseTime", [extendedSleepTime]);
    await ethers.provider.send("evm_mine");

    // Step 3: Wake the Gotchi
    await game.connect(addr1).wake(tokenId);

    // Step 4: Calculate expected timeAlive:
    //   - MAX_SLEEP_DURATION (8 hours) = 28800 seconds
    //   - Decay time after 8 hours = 10 hours (36000 seconds)
    const expectedTimeAlive = Number(maxSleepDuration) + 36000;

    // Step 5: Retrieve and check the final timeAlive
    const gotchi = await game.gotchiStats(tokenId);
    console.log("Final timeAlive from contract:", gotchi.timeAlive.toString());
    console.log("Expected timeAlive:", expectedTimeAlive.toString());

    // Step 6: Assert with a small tolerance for time differences
    expect(Number(gotchi.timeAlive)).to.be.within(
      expectedTimeAlive - 10,
      expectedTimeAlive + 10
    );
  });

  it("Should accumulate timeAlive correctly through multiple sleep and wake cycles", async function () {
    const tokenId = 1;
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();

    // Cycle 1: Sleep for half of MAX_SLEEP_DURATION, then wake
    const halfSleepDuration = Number(maxSleepDuration) / 2;
    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [halfSleepDuration]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    // Verify timeAlive after first half-sleep cycle
    let gotchi = await game.gotchiStats(tokenId);
    console.log(
      "timeAlive after first half sleep:",
      gotchi.timeAlive.toString()
    );
    expect(Number(gotchi.timeAlive)).to.be.within(
      halfSleepDuration - 10,
      halfSleepDuration + 10
    );

    // Cycle 2: Full sleep duration
    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [Number(maxSleepDuration)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    // Verify cumulative timeAlive after second cycle
    gotchi = await game.gotchiStats(tokenId);
    const expectedTimeAfterCycle2 =
      halfSleepDuration + Number(maxSleepDuration);
    console.log(
      "timeAlive after second sleep cycle:",
      gotchi.timeAlive.toString()
    );
    expect(Number(gotchi.timeAlive)).to.be.within(
      expectedTimeAfterCycle2 - 10,
      expectedTimeAfterCycle2 + 10
    );

    // Cycle 3: Extended sleep beyond MAX_SLEEP_DURATION
    const extendedSleepTime = Number(maxSleepDuration) * 1.5; // 12 hours
    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [extendedSleepTime]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    // Calculate expected timeAlive for extended sleep (MAX_SLEEP_DURATION + decay time)
    const decayTimeAfterMaxSleep = extendedSleepTime - Number(maxSleepDuration);
    const expectedTimeAfterCycle3 =
      expectedTimeAfterCycle2 +
      Number(maxSleepDuration) +
      decayTimeAfterMaxSleep;

    // Verify final cumulative timeAlive
    gotchi = await game.gotchiStats(tokenId);
    console.log(
      "Final timeAlive after third extended sleep cycle:",
      gotchi.timeAlive.toString()
    );
    expect(Number(gotchi.timeAlive)).to.be.within(
      expectedTimeAfterCycle3 - 20,
      expectedTimeAfterCycle3 + 20
    );
  });

  it("Should accumulate minimal increments to timeAlive with rapid sequence of interactions", async function () {
    const tokenId = 1;

    // Step 1: Perform initial sleep to set a baseline for timeAlive
    await game.connect(addr1).sleep(tokenId);
    const initialTimeAdvance = 60; // Advance by 60 seconds (1 minute) for a minor time accumulation
    await ethers.provider.send("evm_increaseTime", [initialTimeAdvance]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    // Capture initial timeAlive after the first brief sleep-wake cycle
    let gotchi = await game.gotchiStats(tokenId);
    const initialTimeAlive = Number(gotchi.timeAlive);
    console.log("Initial timeAlive after first brief sleep:", initialTimeAlive);

    // Step 2: Rapidly perform feed and play
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);

    // Retrieve sleep cooldown to wait it out before the next sleep-wake cycle
    const sleepCooldown = Number((await game.cooldowns()).sleep);

    // Step 3: Advance time by the sleep cooldown to allow another sleep action
    await ethers.provider.send("evm_increaseTime", [sleepCooldown]);
    await ethers.provider.send("evm_mine");

    // Step 4: Perform another short sleep-wake cycle
    await game.connect(addr1).sleep(tokenId);
    const shortTimeAdvance = 60; // Another brief interval of 60 seconds
    await ethers.provider.send("evm_increaseTime", [shortTimeAdvance]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    // Step 5: Retrieve final timeAlive and ensure it matches the calculated expected value
    gotchi = await game.gotchiStats(tokenId);
    const finalTimeAlive = Number(gotchi.timeAlive);
    console.log("Final timeAlive after rapid interactions:", finalTimeAlive);

    // Adjusted expected cumulative timeAlive calculation
    const expectedMinimalIncrease =
      initialTimeAlive + sleepCooldown + shortTimeAdvance;
    expect(finalTimeAlive).to.be.within(
      expectedMinimalIncrease - 10,
      expectedMinimalIncrease + 10
    );
    it("Should not increase timeAlive if Gotchi is woken up immediately after going to sleep", async function () {
      const tokenId = 1;

      // Step 1: Capture initial timeAlive before any sleep
      let gotchi = await game.gotchiStats(tokenId);
      const initialTimeAlive = Number(gotchi.timeAlive);
      console.log("Initial timeAlive before immediate wake:", initialTimeAlive);

      // Step 2: Put the Gotchi to sleep and immediately wake it up
      await game.connect(addr1).sleep(tokenId);
      await game.connect(addr1).wake(tokenId);

      // Step 3: Check timeAlive to ensure it remains unchanged
      gotchi = await game.gotchiStats(tokenId);
      const finalTimeAlive = Number(gotchi.timeAlive);
      console.log("Final timeAlive after immediate wake:", finalTimeAlive);

      // Expect timeAlive to be unchanged since no actual sleep time elapsed
      expect(finalTimeAlive).to.equal(initialTimeAlive);
    });
  });

  it("Should prevent excessive timeAlive accumulation from rapid diverse interactions", async function () {
    const tokenId = 1;

    // Step 1: Advance time to allow initial health and happiness decay
    const initialDecayTime = 2 * 60 * 60; // 2 hours to allow for health/happiness decay
    await ethers.provider.send("evm_increaseTime", [initialDecayTime]);
    await ethers.provider.send("evm_mine");

    // Capture initial timeAlive after initial decay
    let gotchi = await game.gotchiStats(tokenId);
    const initialTimeAlive = Number(gotchi.timeAlive);
    console.log(
      "Initial timeAlive before rapid diverse interactions:",
      initialTimeAlive
    );

    // Step 2: Perform rapid interactions in sequence (feed, play, sleep, wake)
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);

    // Set up a minimal time increment between actions
    const interactionDelay = 1; // 1 second between each action

    await ethers.provider.send("evm_increaseTime", [interactionDelay]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [interactionDelay]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).wake(tokenId);

    // Step 3: Capture final timeAlive and calculate expected minimal increase
    gotchi = await game.gotchiStats(tokenId);
    const finalTimeAlive = Number(gotchi.timeAlive);
    console.log(
      "Final timeAlive after rapid diverse interactions:",
      finalTimeAlive
    );

    // Expected timeAlive should reflect initial decay time plus minimal interaction delays
    const expectedTimeAlive =
      initialTimeAlive + initialDecayTime + 2 * interactionDelay;

    // Verify that timeAlive only reflects minimal increases from rapid, diverse interactions
    expect(finalTimeAlive).to.be.within(
      expectedTimeAlive - 12,
      expectedTimeAlive + 12
    );
  });

  it("Should keep timeAlive unchanged if no interactions occur over time", async function () {
    const tokenId = 1;

    // Step 1: Capture initial timeAlive for comparison
    let gotchi = await game.gotchiStats(tokenId);
    const initialTimeAlive = Number(gotchi.timeAlive);
    console.log("Initial timeAlive with no interactions:", initialTimeAlive);

    // Step 2: Advance time significantly without any interactions
    const idleTimeAdvance = 24 * 60 * 60; // 24 hours (1 day) of idle time
    await ethers.provider.send("evm_increaseTime", [idleTimeAdvance]);
    await ethers.provider.send("evm_mine");

    // Step 3: Retrieve final timeAlive and ensure it remains unchanged
    gotchi = await game.gotchiStats(tokenId);
    const finalTimeAlive = Number(gotchi.timeAlive);
    console.log("Final timeAlive after 24 hours of idle time:", finalTimeAlive);

    // Expect timeAlive to be unchanged since no interactions occurred
    expect(finalTimeAlive).to.equal(initialTimeAlive);
  });

  it("Should reset timeAlive when a Gotchi dies and a new Gotchi is minted", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure the Gotchi's health and happiness decay to zero
    const timeUntilDeath = 48 * 60 * 60; // 48 hours should be enough to reach zero health/happiness
    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    // Attempt to interact to confirm Gotchi is dead, expecting a "GotchiDied" event instead of a revert
    await expect(game.connect(addr1).feed(tokenId))
      .to.emit(game, "GotchiDied")
      .withArgs(addr1.address, tokenId);

    // Step 2: Capture the timeAlive value before minting a new Gotchi
    let gotchi = await game.gotchiStats(tokenId);
    const timeAliveBefore = Number(gotchi.timeAlive);
    console.log("TimeAlive before minting a new Gotchi:", timeAliveBefore);

    // Step 3: Burn the dead Gotchi and mint a new one
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    await expect(game.connect(addr1).mintNewGotchi(addr1.address, tokenId))
      .to.emit(game, "GotchiBurned") // Check the burn event
      .withArgs(addr1.address, tokenId)
      .and.to.emit(game, "GotchiMinted") // Check the mint event
      .withArgs(
        addr1.address, // Player address
        tokenId + 1, // New token ID
        80, // Initial health
        80, // Initial happiness
        0 // Initial timeAlive
      );

    // Step 4: Retrieve the timeAlive for the new Gotchi and verify it starts from zero
    gotchi = await game.gotchiStats(tokenId + 1); // The new tokenId
    const newTimeAlive = Number(gotchi.timeAlive);
    console.log("TimeAlive after minting a new Gotchi:", newTimeAlive);

    // Expect the new Gotchi's timeAlive to be zero
    expect(newTimeAlive).to.equal(0);
  });

  it("Should accurately accumulate timeAlive across mixed interactions with various cooldowns", async function () {
    const tokenId = 1;

    // Step 1: Perform initial interactions and advance time between them
    await game.connect(addr1).feed(tokenId); // Interaction #1 (feed)

    await ethers.provider.send("evm_increaseTime", [60]); // 1-minute delay
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).play(tokenId); // Interaction #2 (play)

    await ethers.provider.send("evm_increaseTime", [600]); // 10-minute delay (within play cooldown)
    await ethers.provider.send("evm_mine");

    // Step 2: Put the Gotchi to sleep, then advance time near MAX_SLEEP_DURATION
    const sleepCost = await game.sleepCost();
    await hahaToken.connect(addr1).approve(game.target, sleepCost);
    await game.connect(addr1).sleep(tokenId); // Interaction #3 (sleep)

    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    await ethers.provider.send("evm_increaseTime", [
      Number(maxSleepDuration) - 60,
    ]); // Sleep near max duration
    await ethers.provider.send("evm_mine");

    // Step 3: Wake Gotchi and advance a short time for decay
    await game.connect(addr1).wake(tokenId); // Interaction #4 (wake)

    const postWakeDecayTime = 300; // 5 minutes post-wake decay time
    await ethers.provider.send("evm_increaseTime", [postWakeDecayTime]);
    await ethers.provider.send("evm_mine");

    // Final step: Save to leaderboard to trigger timeAlive update
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Retrieve final timeAlive and leaderboard score
    const gotchi = await game.gotchiStats(tokenId);
    const finalTimeAlive = Number(gotchi.timeAlive);
    const leaderboardScore = await game.playerHighScores(addr1.address);

    console.log("Final timeAlive after mixed interactions:", finalTimeAlive);
    console.log("Leaderboard score after manual save:", leaderboardScore);

    // Expected timeAlive accumulation across all interactions
    const expectedTimeAlive =
      660 + (Number(maxSleepDuration) - 60) + postWakeDecayTime;

    // Validate timeAlive and leaderboard score
    expect(finalTimeAlive).to.be.within(
      expectedTimeAlive - 10,
      expectedTimeAlive + 10
    );
    expect(leaderboardScore).to.equal(finalTimeAlive);
  });

  it("should correctly calculate timeAlive after 48 hours of oversleep", async function () {
    const tokenId = 1; // Gotchi's token ID

    // Start the sleep
    await game.connect(addr1).sleep(tokenId);

    // Increase time by 48 hours (48 * 60 * 60 seconds)
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Wake up the Gotchi
    await game.connect(addr1).wake(tokenId);

    // Fetch the Gotchi stats to check timeAlive
    const gotchi = await game.gotchiStats(tokenId);

    // Expected timeAlive calculation:
    // - 8 hours of no decay = 28800 seconds
    // - Additional time for health decay until it reaches 0:
    //   Health starts at 80, decays at 5.5 points/hour
    const expectedTimeAlive = BigInt(Math.round(28800 + (80 / 5.5) * 60 * 60));

    // Check if the timeAlive is within an acceptable range of expected value
    expect(gotchi.timeAlive).to.be.closeTo(expectedTimeAlive, BigInt(10)); // 1-second tolerance for rounding
  });

  it("Should update leaderboard after a single interaction", async function () {
    const tokenId = 1;
    const oneHour = 60 * 60;

    await ethers.provider.send("evm_increaseTime", [oneHour]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).play(tokenId);
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    const gotchi = await game.gotchiStats(tokenId);
    const score = await game.playerHighScores(addr1.address);
    expect(score).to.equal(gotchi.timeAlive);
  });

  it("Should update leaderboard on death with timeAlive at death", async function () {
    const tokenId = 1;
    const timeUntilDeath = 48 * 60 * 60; // Advance by 48 hours to ensure death

    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    const score = await game.playerHighScores(addr1.address);
    expect(score).to.equal(gotchi.timeAlive);
  });

  it("Should initialize leaderboard score to zero on new Gotchi mint", async function () {
    const tokenId = 1;

    // Advance time by 10 seconds to account for any initial delay
    await ethers.provider.send("evm_increaseTime", [0]);
    await ethers.provider.send("evm_mine");

    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const score = await game.playerHighScores(addr1.address);
    expect(score).to.be.within(0, 0 + 10); // Expect no timeAlive initially
  });

  it("Should accurately update leaderboard after multiple interactions", async function () {
    const tokenId = 1;
    const oneHour = BigInt(60 * 60);
    const sleepDuration = BigInt(await game.MAX_SLEEP_DURATION()) / BigInt(2);

    await ethers.provider.send("evm_increaseTime", [Number(oneHour)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).play(tokenId);

    await ethers.provider.send("evm_increaseTime", [Number(oneHour)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).feed(tokenId);

    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [Number(sleepDuration)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    const score = await game.playerHighScores(addr1.address);
    expect(score).to.equal(gotchi.timeAlive);
  });

  it("Should not update leaderboard if new timeAlive is lower than existing high score", async function () {
    const initialTokenId = 1;
    const initialHighScore = BigInt(7200); // 2 hours as BigInt for precision

    // Step 1: Set a high score for testing on the initial Gotchi
    await ethers.provider.send("evm_increaseTime", [Number(initialHighScore)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).manualSaveToLeaderboard(initialTokenId);

    let score = await game.playerHighScores(addr1.address);
    expect(score).to.be.within(
      initialHighScore - BigInt(10),
      initialHighScore + BigInt(10)
    ); // Confirm initial high score is set

    // Step 2: Burn the initial Gotchi to simulate death and mint a new Gotchi
    await game.connect(addr1).burn(initialTokenId);
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, initialTokenId);

    // Use the new tokenId of 2 for the newly minted Gotchi
    const newTokenId = 2;

    // Step 3: Accumulate a lower timeAlive on the new Gotchi, then save
    const shorterDuration = BigInt(3600); // 1 hour in seconds as BigInt
    await ethers.provider.send("evm_increaseTime", [Number(shorterDuration)]);
    await ethers.provider.send("evm_mine");

    // Approve the HAHA token for playing cost before playing
    const playCost = await game.playCost();
    await hahaToken.connect(addr1).approve(game.target, playCost);
    await game.connect(addr1).play(newTokenId);
    await game.connect(addr1).manualSaveToLeaderboard(newTokenId);

    // Step 4: Confirm leaderboard score remains the initial high score
    score = await game.playerHighScores(addr1.address);
    expect(score).to.be.within(
      initialHighScore - BigInt(10),
      initialHighScore + BigInt(10)
    ); // Should not change if lower
  });

  it("Should decay health and happiness at the expected rate over time without user interactions", async function () {
    const tokenId = 1;

    // Retrieve initial Gotchi stats
    let gotchi = await game.gotchiStats(tokenId);
    const initialHealth = Number(gotchi.health);
    const initialHappiness = Number(gotchi.happiness);

    // Advance time by 3 hours (10800 seconds)
    const threeHours = 3 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [threeHours]);
    await ethers.provider.send("evm_mine");

    // Update Gotchi stats by calling manualSaveToLeaderboard to apply decay
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Retrieve updated stats after decay
    gotchi = await game.gotchiStats(tokenId);
    const decayedHealth = Number(gotchi.health);
    const decayedHappiness = Number(gotchi.happiness);

    // Expected values after 3 hours of decay
    const expectedHealth = 80 - 3 * 5.5; // Expected health after decay
    const expectedHappiness = 80 - 3 * 4.17; // Expected happiness after decay

    console.log(
      "Expected Health:",
      expectedHealth,
      "Actual Health:",
      decayedHealth
    );
    console.log(
      "Expected Happiness:",
      expectedHappiness,
      "Actual Happiness:",
      decayedHappiness
    );

    // Verify decayed health and happiness match expected values within a small tolerance
    expect(decayedHealth).to.be.closeTo(expectedHealth, 1); // 1 point tolerance
    expect(decayedHappiness).to.be.closeTo(expectedHappiness, 1); // 1 point tolerance
  });

  it("Should prevent health from reaching zero with periodic feeding", async function () {
    const tokenId = 1;
    const feedInterval = 3 * 60 * 60; // 3 hours in seconds, allowing us to counteract decay with feeding

    // Retrieve initial Gotchi stats for baseline comparison
    let gotchi = await game.gotchiStats(tokenId);
    const initialHealth = Number(gotchi.health);

    // Step 1: Advance time by the feed interval and feed to maintain health
    await ethers.provider.send("evm_increaseTime", [feedInterval]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).feed(tokenId);

    // Update stats and verify health remains above a critical level
    gotchi = await game.gotchiStats(tokenId);
    let healthAfterFirstFeed = Number(gotchi.health);
    expect(healthAfterFirstFeed).to.be.above(20); // Ensure health is maintained above a low threshold

    // Step 2: Repeat the process, advancing time and feeding
    await ethers.provider.send("evm_increaseTime", [feedInterval]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).feed(tokenId);

    // Verify health remains well-maintained
    gotchi = await game.gotchiStats(tokenId);
    let healthAfterSecondFeed = Number(gotchi.health);
    expect(healthAfterSecondFeed).to.be.above(20);

    // Final check: health should remain above zero
    expect(healthAfterSecondFeed).to.be.above(0);
  });

  it("Should revert if player attempts feeding without setting allowance", async function () {
    const tokenId = 1; // Assume tokenId 1 for the player's Gotchi

    // Reset approval to zero to simulate no allowance set
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Attempt to feed without allowance and expect revert
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "Approval required for feeding"
    );
  });

  it("Should revert if player attempts feeding without sufficient $HAHA balance", async function () {
    const tokenId = 1;

    // Transfer away all $HAHA balance from addr1 to simulate insufficient balance
    const balance = await hahaToken.balanceOf(addr1.address);
    await hahaToken.connect(addr1).transfer(owner.address, balance);

    // Attempt to feed the Gotchi, expecting a generic revert due to insufficient balance
    await expect(game.connect(addr1).feed(tokenId)).to.be.reverted;
  });

  it("Should revert if player attempts playing without sufficient $HAHA balance", async function () {
    const tokenId = 1;

    // Transfer away all $HAHA balance from addr1 to simulate insufficient balance
    const balance = await hahaToken.balanceOf(addr1.address);
    await hahaToken.connect(addr1).transfer(owner.address, balance);

    // Attempt to play with the Gotchi, expecting a generic revert due to insufficient balance
    await expect(game.connect(addr1).play(tokenId)).to.be.reverted;
  });

  it("Should revert if player attempts playing with insufficient $HAHA allowance", async function () {
    const tokenId = 1;

    // Set allowance just below the play cost to simulate insufficient allowance
    const insufficientAllowance = (await game.playCost()) - BigInt(1);
    await hahaToken.connect(addr1).approve(game.target, insufficientAllowance);

    // Attempt to play with the Gotchi, expecting a revert due to insufficient allowance
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "Approval required for playing"
    );
  });

  it("Should revert if player attempts to put Gotchi to sleep without setting sufficient allowance", async function () {
    const tokenId = 1;

    // Set allowance to zero to simulate insufficient allowance for sleep
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Attempt to put the Gotchi to sleep, expecting a revert due to zero allowance
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "Approval required for sleeping"
    );
  });

  it("Should revert if player attempts to put Gotchi to sleep without setting sufficient allowance", async function () {
    const tokenId = 1;

    // Set allowance to zero to simulate insufficient allowance for sleep
    await hahaToken.connect(addr1).approve(game.target, 0);

    // Attempt to feed the Gotchi, expecting a generic revert due to insufficient balance
    await expect(game.connect(addr1).feed(tokenId)).to.be.reverted;
  });

  it("Should prevent Gotchi's health from exceeding MAX_HEALTH when feeding", async function () {
    const tokenId = 1;

    // Retrieve current MAX_HEALTH and health boost from feed action
    const maxHealth = await game.MAX_HEALTH();
    const feedHealthBoost = await game.feedHealthBoost();

    // Perform multiple feed actions until health nears MAX_HEALTH
    for (let i = 0; i < 3; i++) {
      await hahaToken.connect(addr1).approve(game.target, feedCost);
      await game.connect(addr1).feed(tokenId);

      // Wait out the cooldown period
      const feedCooldown = await game.cooldowns().then((c) => c.feed);
      await ethers.provider.send("evm_increaseTime", [Number(feedCooldown)]);
      await ethers.provider.send("evm_mine");
    }

    // Fetch Gotchi stats to confirm health
    const gotchi = await game.gotchiStats(tokenId);

    // Ensure health does not exceed MAX_HEALTH after additional feed action
    expect(gotchi.health).to.be.at.most(maxHealth);
  });

  it("Should prevent Gotchi's happiness from exceeding MAX_HAPPINESS when playing", async function () {
    const tokenId = 1;

    // Retrieve MAX_HAPPINESS and happiness boost from play action
    const maxHappiness = await game.MAX_HAPPINESS();
    const playHappinessBoost = await game.playHappinessBoost();

    // Perform multiple play actions until happiness nears MAX_HAPPINESS
    for (let i = 0; i < 3; i++) {
      await hahaToken.connect(addr1).approve(game.target, playCost);
      await game.connect(addr1).play(tokenId);

      // Wait out the play cooldown period
      const playCooldown = await game.cooldowns().then((c) => c.play);
      await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
      await ethers.provider.send("evm_mine");
    }

    // Fetch Gotchi stats to confirm happiness
    const gotchi = await game.gotchiStats(tokenId);

    // Ensure happiness does not exceed MAX_HAPPINESS after additional play action
    expect(gotchi.happiness).to.be.at.most(maxHappiness);
  });

  it("Should enforce play cooldown correctly", async function () {
    const tokenId = 1;

    // Initial play to set the cooldown
    await hahaToken.connect(addr1).approve(game.target, playCost);
    await game.connect(addr1).play(tokenId);

    // Immediately attempt another play, expecting a revert due to cooldown
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );

    // Increase time by the cooldown period to reset cooldown
    const playCooldown = await game.cooldowns().then((c) => c.play);
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine");

    // Attempt to play again after cooldown has expired
    await hahaToken.connect(addr1).approve(game.target, playCost);
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  it("Should enforce sleep cooldown correctly", async function () {
    const tokenId = 1;

    // Initial sleep to start the cooldown
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Attempt to sleep again immediately, expecting a revert due to "already in dreamland" condition
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already in dreamland, shhh!"
    );

    // Wake Gotchi to reset sleep state
    await game.connect(addr1).wake(tokenId);

    // Advance time by the wake cooldown period to reset
    const wakeCooldown = 60 * 60; // 1 hour in seconds
    await ethers.provider.send("evm_increaseTime", [wakeCooldown]);
    await ethers.provider.send("evm_mine");

    // Advance time by the sleep cooldown period to allow another sleep action
    const sleepCooldown = await game.cooldowns().then((c) => c.sleep);
    await ethers.provider.send("evm_increaseTime", [Number(sleepCooldown)]);
    await ethers.provider.send("evm_mine");

    // Attempt to put Gotchi to sleep again after all cooldowns have expired
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await expect(game.connect(addr1).sleep(tokenId)).to.not.be.reverted;
  });

  it("Should enforce sleep cooldown correctly with feeding in between cycles", async function () {
    const tokenId = 1;

    // Initial sleep to start the cooldown
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Attempt to sleep again immediately, expecting a revert due to cooldown
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already in dreamland, shhh!"
    );

    // Wake Gotchi to reset sleep state
    await game.connect(addr1).wake(tokenId);

    // Enforce a 1-hour cooldown after waking up before sleeping again
    const wakeCooldown = 60 * 60; // 1 hour in seconds
    await ethers.provider.send("evm_increaseTime", [wakeCooldown]);
    await ethers.provider.send("evm_mine");

    // Feed Gotchi to maintain health before next sleep
    await hahaToken.connect(addr1).approve(game.target, await game.feedCost());
    await game.connect(addr1).feed(tokenId);

    // Advance time by the sleep cooldown period to allow another sleep action
    const sleepCooldown = await game.cooldowns().then((c) => c.sleep);
    await ethers.provider.send("evm_increaseTime", [Number(sleepCooldown)]);
    await ethers.provider.send("evm_mine");

    // Attempt to put Gotchi to sleep again after all cooldowns have expired
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await expect(game.connect(addr1).sleep(tokenId)).to.not.be.reverted;
  });

  it("Should enforce play cooldown correctly with feeding between play cycles", async function () {
    const tokenId = 1;

    // Initial play to start the cooldown
    await hahaToken.connect(addr1).approve(game.target, await game.playCost());
    await game.connect(addr1).play(tokenId);

    // Attempt to play again immediately, expecting a revert due to cooldown
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm tired now!"
    );

    // Wait out the play cooldown period
    const playCooldown = await game.cooldowns().then((c) => c.play);
    await ethers.provider.send("evm_increaseTime", [Number(playCooldown)]);
    await ethers.provider.send("evm_mine");

    // Feed Gotchi to maintain health before playing again
    await hahaToken.connect(addr1).approve(game.target, await game.feedCost());
    await game.connect(addr1).feed(tokenId);

    // Attempt to play again after cooldown expires, expecting success
    await hahaToken.connect(addr1).approve(game.target, await game.playCost());
    await expect(game.connect(addr1).play(tokenId)).to.not.be.reverted;
  });

  it("Should enforce sleep cooldown and transition correctly between sleep and wake cycles", async function () {
    const tokenId = 1;
    const sleepCooldown = await game.cooldowns().then((c) => c.sleep);

    // Initial sleep to start the cycle
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Verify the Gotchi is in sleep state
    let gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true;

    // Attempt to sleep again within cooldown, expecting revert
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi says: I'm already in dreamland, shhh!"
    );

    // Wake the Gotchi
    await game.connect(addr1).wake(tokenId);
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.false;

    // Advance time by cooldown to reset sleep eligibility
    await ethers.provider.send("evm_increaseTime", [Number(sleepCooldown)]);
    await ethers.provider.send("evm_mine");

    // Sleep again after cooldown
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Verify Gotchi is sleeping again
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true;
  });

  it("Should apply health and happiness decay if sleep exceeds MAX_SLEEP_DURATION", async function () {
    const tokenId = 1;
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();

    // Put Gotchi to sleep
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Advance time beyond MAX_SLEEP_DURATION to trigger decay upon waking
    const extendedSleepTime = Number(maxSleepDuration) + 3600; // 1 hour beyond max duration
    await ethers.provider.send("evm_increaseTime", [extendedSleepTime]);
    await ethers.provider.send("evm_mine");

    // Wake Gotchi to apply decay
    await game.connect(addr1).wake(tokenId);

    // Verify that health and happiness have decayed
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.be.lessThan(80); // Initial health should decay
    expect(gotchi.happiness).to.be.lessThan(80); // Initial happiness should decay
    expect(gotchi.deathTimestamp).to.equal(0); // Verify Gotchi is still alive if health/happiness are > 0
  });

  it("Should retain health and happiness at 80 when woken up at exact MAX_SLEEP_DURATION", async function () {
    const tokenId = 1;

    // Put Gotchi to sleep
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Advance time to exactly MAX_SLEEP_DURATION
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    await ethers.provider.send("evm_increaseTime", [Number(maxSleepDuration)]);
    await ethers.provider.send("evm_mine");

    // Wake Gotchi to confirm no decay occurs
    await game.connect(addr1).wake(tokenId);

    // Verify health and happiness remain at initial values
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(80); // Health should be unchanged
    expect(gotchi.happiness).to.equal(80); // Happiness should be unchanged
  });

  it("Should not decay health or happiness if woken up before MAX_SLEEP_DURATION", async function () {
    const tokenId = 1;

    // Step 1: Put Gotchi to sleep
    await hahaToken.connect(addr1).approve(game.target, await game.sleepCost());
    await game.connect(addr1).sleep(tokenId);

    // Step 2: Advance time to just before MAX_SLEEP_DURATION
    const maxSleepDuration = await game.MAX_SLEEP_DURATION();
    const wakeUpBeforeDecay = Number(maxSleepDuration) - 60; // Waking up 1 minute before MAX_SLEEP_DURATION
    await ethers.provider.send("evm_increaseTime", [wakeUpBeforeDecay]);
    await ethers.provider.send("evm_mine");

    // Step 3: Wake the Gotchi before any decay is applied
    await game.connect(addr1).wake(tokenId);

    // Retrieve Gotchi stats to verify no decay in health or happiness
    const gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.health).to.equal(80); // Health should be unchanged
    expect(gotchi.happiness).to.equal(80); // Happiness should be unchanged
  });

  it("Should allow sleep initiation after cooldown expiry", async function () {
    const tokenId = 1;

    // Ensure cooldown has passed
    const sleepCooldown = Number((await game.cooldowns()).sleep);
    await ethers.provider.send("evm_increaseTime", [sleepCooldown]);
    await ethers.provider.send("evm_mine");

    // Put the Gotchi to sleep and confirm no revert occurs
    await game.connect(addr1).sleep(tokenId);
    const gotchi = await game.gotchiStats(tokenId);

    // Confirm sleep state is active
    expect(gotchi.isSleeping).to.be.true;
  });

  it("Should allow wake and re-sleep after cooldown expiry", async function () {
    const tokenId = 1;

    // Step 1: Put Gotchi to sleep initially
    await game.connect(addr1).sleep(tokenId);
    let gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true;

    // Step 2: Wake Gotchi up
    await game.connect(addr1).wake(tokenId);
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.false;

    // Step 3: Advance time to meet the cooldown requirement
    const sleepCooldown = Number((await game.cooldowns()).sleep);
    await ethers.provider.send("evm_increaseTime", [sleepCooldown]);
    await ethers.provider.send("evm_mine");

    // Step 4: Re-sleep the Gotchi after cooldown expiry
    await game.connect(addr1).sleep(tokenId);
    gotchi = await game.gotchiStats(tokenId);
    expect(gotchi.isSleeping).to.be.true; // Confirm the Gotchi is asleep again
  });

  it("Should update leaderboard with timeAlive if Gotchi is alive and timeAlive exceeds previous high score", async function () {
    const tokenId = 1;

    // Step 1: Mint the Gotchi and confirm initial leaderboard score is zero
    let initialScore = await game.playerHighScores(addr1.address);
    expect(initialScore).to.equal(0);

    // Step 2: Advance time and call manualSaveToLeaderboard to simulate timeAlive accumulation
    const oneHourInSeconds = 60 * 60;
    await ethers.provider.send("evm_increaseTime", [oneHourInSeconds]);
    await ethers.provider.send("evm_mine");

    // Step 3: Manually save to leaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 4: Fetch the updated leaderboard score and verify
    const gotchi = await game.gotchiStats(tokenId);
    const updatedScore = await game.playerHighScores(addr1.address);
    expect(updatedScore).to.equal(gotchi.timeAlive);
  });

  it("Should update leaderboard on death with timeAlive at death", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure Gotchi's health or happiness decays to zero, triggering death
    const timeUntilDeath = 48 * 60 * 60; // 48 hours in seconds to simulate full decay to death
    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    // Step 2: Manually save to leaderboard to capture final timeAlive
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 3: Retrieve leaderboard score and verify it reflects timeAlive at the moment of death
    const gotchi = await game.gotchiStats(tokenId);
    const score = await game.playerHighScores(addr1.address);
    expect(score).to.equal(gotchi.timeAlive);
  });

  it("Should initialize leaderboard score to zero on new Gotchi mint", async function () {
    const tokenId = 1;

    // Step 1: Mint the Gotchi and immediately save to leaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 2: Verify leaderboard score is zero, allowing a small tolerance for immediate save delay
    const score = await game.playerHighScores(addr1.address);
    expect(score).to.be.within(0, 0 + 10); // Expect close to zero, accounting for minimal time elapsed
  });

  it("Should accurately update leaderboard after multiple interactions", async function () {
    const tokenId = 1;
    const oneHour = BigInt(60 * 60);
    const sleepDuration = BigInt(await game.MAX_SLEEP_DURATION()) / BigInt(2);

    // Step 1: Advance time by one hour, play, and check leaderboard
    await ethers.provider.send("evm_increaseTime", [Number(oneHour)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).play(tokenId);

    // Step 2: Advance another hour, feed, and check leaderboard
    await ethers.provider.send("evm_increaseTime", [Number(oneHour)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).feed(tokenId);

    // Step 3: Sleep Gotchi for half max duration, wake, and verify leaderboard
    await game.connect(addr1).sleep(tokenId);
    await ethers.provider.send("evm_increaseTime", [Number(sleepDuration)]);
    await ethers.provider.send("evm_mine");
    await game.connect(addr1).wake(tokenId);

    // Final Step: Save to leaderboard to trigger timeAlive update
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);
    const gotchi = await game.gotchiStats(tokenId);
    const score = await game.playerHighScores(addr1.address);

    // Verify leaderboard score matches the updated timeAlive
    expect(score).to.equal(gotchi.timeAlive);
  });

  it("Should emit GotchiMinted event with correct parameters", async function () {
    const tokenId = 1;

    // Advance time to ensure Gotchi's health and happiness decay to zero
    const timeUntilDeath = 48 * 60 * 60; // 48 hours
    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    // Confirm Gotchi is dead with the GotchiDied event
    await expect(game.connect(addr1).feed(tokenId))
      .to.emit(game, "GotchiDied")
      .withArgs(addr1.address, tokenId);

    // Approve tokens for minting
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a new Gotchi and check the GotchiMinted event
    await expect(game.connect(addr1).mintNewGotchi(addr1.address, tokenId))
      .to.emit(game, "GotchiMinted")
      .withArgs(
        addr1.address, // Player
        tokenId + 1, // New token ID
        80, // Initial health
        80, // Initial happiness
        0 // Initial timeAlive
      );
  });

  it("Should prevent manualSaveToLeaderboard if cooldown has not expired", async function () {
    const tokenId = 1;

    // Initial save should succeed and set `lastSaveTime`
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Attempt second save within cooldown period (expect revert)
    await expect(
      game.connect(addr1).manualSaveToLeaderboard(tokenId)
    ).to.be.revertedWith(
      "MamaGotchi says: I'm too tired to save again so soon!"
    );

    // Increase time by cooldown duration (10 seconds) to surpass the cooldown
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine");

    // Final save should succeed after cooldown
    await expect(game.connect(addr1).manualSaveToLeaderboard(tokenId)).to.not.be
      .reverted;
  });

  it("Should allow manualSaveToLeaderboard after cooldown expires and update leaderboard", async function () {
    const tokenId = 1;

    // Step 1: Perform initial save to trigger the cooldown
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 2: Advance time to exceed the cooldown duration
    const cooldownDuration = Number((await game.cooldowns()).save); // Fetch cooldown
    await ethers.provider.send("evm_increaseTime", [cooldownDuration]); // Fast forward
    await ethers.provider.send("evm_mine");

    // Step 3: Perform another save after the cooldown expires
    await expect(game.connect(addr1).manualSaveToLeaderboard(tokenId)).to.not.be
      .reverted;

    // Step 4: Retrieve leaderboard score to confirm update
    const gotchi = await game.gotchiStats(tokenId);
    const updatedScore = await game.playerHighScores(addr1.address);

    console.log("Leaderboard updated score:", updatedScore.toString());

    // Ensure leaderboard reflects the new `timeAlive` value
    expect(updatedScore).to.equal(gotchi.timeAlive);
  });

  it("Should allow manualSaveToLeaderboard after cooldown has expired", async function () {
    const tokenId = 1;

    // Perform initial save to set lastSaveTime and start the cooldown
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Increase time by exactly the cooldown duration
    const saveCooldown = await game.cooldowns().then((c) => c.save);
    await ethers.provider.send("evm_increaseTime", [Number(saveCooldown)]);
    await ethers.provider.send("evm_mine");

    // Attempt manualSaveToLeaderboard again after cooldown expires
    await expect(game.connect(addr1).manualSaveToLeaderboard(tokenId)).to.not.be
      .reverted;
  });

  it("should emit GotchiMinted when a Gotchi is successfully minted", async function () {
    // Mint Gotchi for addr3
    await expect(game.connect(addr3).mintNewGotchi(addr3.address, 0))
      .to.emit(game, "GotchiMinted")
      .withArgs(
        addr3.address,
        2, // Assuming tokenId 2 for addr3
        80, // Initial health
        80, // Initial happiness
        0 // Initial timeAlive
      );
  });

  it("should emit FreshMintInitiated when a token burn is initiated", async function () {
    // Mint a Gotchi for addr2 (assign tokenId = 2)
    await game.connect(addr2).mintNewGotchi(addr2.address, 0);

    // Fast-forward time by 48 hours
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Attempt to mint another Gotchi by burning the dead one
    await expect(game.connect(addr2).mintNewGotchi(addr2.address, 2))
      .to.emit(game, "FreshMintInitiated")
      .withArgs(addr2.address, 2);
  });

  it("should emit GotchiBurned when a Gotchi is burned", async function () {
    // Mint a Gotchi for addr2 (assign tokenId = 2)
    await game.connect(addr2).mintNewGotchi(addr2.address, 0);

    // Fast-forward time by 48 hours
    await ethers.provider.send("evm_increaseTime", [48 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    // Approve tokens for minting
    const mintCost = ethers.parseUnits("1000000000", 18);
    await hahaToken.connect(addr2).approve(game.target, mintCost);

    // Burn the Gotchi and mint another
    await expect(game.connect(addr2).mintNewGotchi(addr2.address, 2))
      .to.emit(game, "GotchiBurned")
      .withArgs(addr2.address, 2);
  });

  it("should revert if allowance is too low for a new Gotchi", async function () {
    const mintCost = ethers.parseUnits("1000", 18); // Mint cost in HAHA
    const insufficientAllowance = ethers.parseUnits("500", 18); // Less than mintCost

    // Step 1: Set insufficient allowance for addr2
    await hahaToken.connect(addr2).approve(game.target, insufficientAllowance);

    // Step 2: Verify allowance and balance
    const currentAllowance = await hahaToken.allowance(
      addr2.address,
      game.target
    );
    const currentBalance = await hahaToken.balanceOf(addr2.address);
    console.log("Allowance:", currentAllowance.toString());
    console.log("Balance:", currentBalance.toString());

    expect(currentAllowance).to.be.lt(mintCost); // Ensure allowance is too low
    expect(currentBalance).to.be.gte(mintCost); // Ensure addr2 has enough balance

    // Step 3: Attempt to mint a Gotchi and expect revert
    await expect(
      game.connect(addr2).mintNewGotchi(addr2.address, 0) // New mint with no prior Gotchi
    ).to.be.revertedWith("Approval required for minting");
  });

  it("should revert if balance is too low", async function () {
    const tokenId = 1; // Assuming addr1 owns tokenId 1

    // Step 1: Advance time by 48 hours to ensure Gotchi's health and happiness decay to zero
    const fortyEightHours = 48 * 60 * 60; // 48 hours in seconds
    await ethers.provider.send("evm_increaseTime", [fortyEightHours]);
    await ethers.provider.send("evm_mine");

    // Step 2: Call manualSaveToLeaderboard to update Gotchi's state and mark it as dead
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 3: Advance time to ensure cooldown period has passed
    const saveCooldownBuffer = 30; // Add a 30-second buffer
    await ethers.provider.send("evm_increaseTime", [saveCooldownBuffer]);
    await ethers.provider.send("evm_mine");

    // Step 4: Transfer all $HAHA tokens from addr1 to simulate insufficient balance
    const addr1Balance = await hahaToken.balanceOf(addr1.address);
    await hahaToken.connect(addr1).transfer(owner.address, addr1Balance);

    // Step 5: Attempt to mint a new Gotchi and expect the transaction to revert
    await expect(
      game.connect(addr1).mintNewGotchi(addr1.address, tokenId)
    ).to.be.revertedWith("Insufficient $HAHA balance for minting");
  });

  it("Should update leaderboard when minting a new Gotchi after a Gotchi's death", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure the Gotchi's health and happiness decay to zero
    const timeUntilDeath = 48 * 60 * 60; // 48 hours in seconds to simulate full decay to death
    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    // Step 2: Save to leaderboard to capture the final timeAlive before death
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 3: Advance time to ensure the save cooldown period has elapsed
    const saveCooldownBuffer = 30; // Add at least 30 seconds buffer
    await ethers.provider.send("evm_increaseTime", [saveCooldownBuffer]);
    await ethers.provider.send("evm_mine");

    // Step 4: Retrieve leaderboard score and verify it reflects timeAlive at the moment of death
    const deadGotchiStats = await game.gotchiStats(tokenId);
    const initialLeaderboardScore = await game.playerHighScores(addr1.address);
    expect(initialLeaderboardScore).to.equal(deadGotchiStats.timeAlive);

    // Step 5: Burn the dead Gotchi and mint a new one
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    const mintTx = await game
      .connect(addr1)
      .mintNewGotchi(addr1.address, tokenId);
    await mintTx.wait();

    // Step 6: Verify the leaderboard score remains unchanged after minting a new Gotchi
    const finalLeaderboardScore = await game.playerHighScores(addr1.address);
    expect(finalLeaderboardScore).to.equal(initialLeaderboardScore);

    // Step 7: Verify the new Gotchi has been successfully minted
    const newGotchiStats = await game.gotchiStats(2); // Assuming the new tokenId is 2
    expect(newGotchiStats.health).to.equal(80);
    expect(newGotchiStats.happiness).to.equal(80);
  });

  it("Should invalidate a burnt Gotchi token after burning", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure Gotchi's health and happiness decay to zero
    const timeUntilDeath = 48 * 60 * 60; // 48 hours in seconds
    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    // Step 2: Burn the dead Gotchi by minting a new one
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, tokenId);

    // Step 3: Attempt to interact with the burnt token
    await expect(game.connect(addr1).feed(tokenId)).to.be.reverted; // Check for any revert, not the message
  });

  it("Should verify all initial stats for a newly minted Gotchi", async function () {
    const mintCost = await game.mintCost();

    // Advance time to ensure the existing Gotchi dies
    const timeUntilDeath = 48 * 60 * 60; // 48 hours in seconds
    await ethers.provider.send("evm_increaseTime", [timeUntilDeath]);
    await ethers.provider.send("evm_mine");

    // Interact with the contract to trigger death
    const tokenIdToKill = 1; // Assuming the existing Gotchi has tokenId 1
    await game.connect(addr1).manualSaveToLeaderboard(tokenIdToKill);

    // Advance time to allow the save cooldown to expire (at least 30 seconds)
    const saveCooldownBuffer = 30;
    await ethers.provider.send("evm_increaseTime", [saveCooldownBuffer]);
    await ethers.provider.send("evm_mine");

    // Approve tokens for minting a new Gotchi
    await hahaToken.connect(addr1).approve(game.target, mintCost);

    // Mint a new Gotchi for addr1
    await game.connect(addr1).mintNewGotchi(addr1.address, tokenIdToKill);

    // Fetch the new Gotchi stats
    const newTokenId = tokenIdToKill + 1; // Assuming new Gotchi gets the next tokenId
    const gotchi = await game.gotchiStats(newTokenId);

    // Verify initial stats
    expect(gotchi.health).to.equal(80); // Default health
    expect(gotchi.happiness).to.equal(80); // Default happiness
    expect(gotchi.timeAlive).to.equal(0); // Time alive starts at 0
    expect(gotchi.isSleeping).to.be.false; // Should not be sleeping initially
    expect(gotchi.sleepStartTime).to.equal(0); // No sleep started
    expect(gotchi.lastFeedTime).to.equal(0); // No feeding has occurred
    expect(gotchi.lastPlayTime).to.equal(0); // No playing has occurred
  });

  it("Should correctly apply regular decay without sleep and increment timeAlive", async function () {
    const tokenId = 1; // Gotchi's token ID

    // Step 1: Fetch initial Gotchi stats
    const initialGotchi = await game.gotchiStats(tokenId);
    const initialTimeAlive = BigInt(initialGotchi.timeAlive); // Ensure BigInt type
    const initialHealth = BigInt(initialGotchi.health);
    const initialHappiness = BigInt(initialGotchi.happiness);

    // Step 2: Advance time by 1 hour (3600 seconds)
    const oneHour = 3600n; // Use BigInt for consistency
    await ethers.provider.send("evm_increaseTime", [Number(oneHour)]);
    await ethers.provider.send("evm_mine");

    // Step 3: Trigger state update to apply decay
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 4: Fetch updated Gotchi stats
    const updatedGotchi = await game.gotchiStats(tokenId);
    const updatedHealth = BigInt(updatedGotchi.health);
    const updatedHappiness = BigInt(updatedGotchi.happiness);
    const updatedTimeAlive = BigInt(updatedGotchi.timeAlive);

    // Step 5: Calculate expected values based on contract-defined decay rates
    const decayRateHealth = 55n; // Health decay rate: 5.5 * 10 (scaled to BigInt)
    const decayRateHappiness = 55n; // Happiness decay rate: 5.5 * 10 (scaled to BigInt)
    const scalingFactor = 10n; // Used to emulate float-like calculations

    const expectedHealth = initialHealth - decayRateHealth / scalingFactor;
    const expectedHappiness =
      initialHappiness - decayRateHappiness / scalingFactor;
    const expectedTimeAlive = initialTimeAlive + oneHour;

    // Step 6: Assertions with buffer
    const buffer = 1n;
    expect(updatedHealth).to.equal(expectedHealth, "Health decay mismatch");
    expect(updatedHappiness).to.be.within(
      expectedHappiness - buffer,
      expectedHappiness + buffer,
      "Happiness decay mismatch"
    );
    expect(updatedTimeAlive).to.be.within(
      expectedTimeAlive - 10n,
      expectedTimeAlive + 10n,
      "TimeAlive mismatch"
    );

    // Verify Gotchi is still alive
    expect(updatedGotchi.deathTimestamp).to.equal(
      0n,
      "Gotchi should still be alive"
    );
  });

  it("Should apply decay to health and happiness over time while awake", async function () {
    const tokenId = 1; // Assume addr1 owns tokenId 1

    // Step 1: Fetch initial Gotchi stats for comparison
    let gotchi = await game.gotchiStats(tokenId);
    const initialHealth = Number(gotchi.health);
    const initialHappiness = Number(gotchi.happiness);
    const initialTimeAlive = Number(gotchi.timeAlive);

    // Step 2: Advance time by 3 hours (10800 seconds)
    const threeHours = 3 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [threeHours]);
    await ethers.provider.send("evm_mine");

    // Step 3: Trigger state update by calling manualSaveToLeaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 4: Fetch updated Gotchi stats after decay
    gotchi = await game.gotchiStats(tokenId);
    const updatedHealth = Number(gotchi.health);
    const updatedHappiness = Number(gotchi.happiness);
    const updatedTimeAlive = Number(gotchi.timeAlive);

    // Step 5: Calculate expected values based on decay rates
    const expectedHealthDecay = 3 * 5.5; // 5.5 points per hour
    const expectedHappinessDecay = 3 * 4.17; // 4.17 points per hour
    const expectedHealth = Math.max(0, initialHealth - expectedHealthDecay);
    const expectedHappiness = Math.max(
      0,
      initialHappiness - expectedHappinessDecay
    );
    const expectedTimeAliveLower = initialTimeAlive + threeHours - 10; // Lower bound with buffer
    const expectedTimeAliveUpper = initialTimeAlive + threeHours + 10; // Upper bound with buffer

    // Step 6: Assert the results
    expect(updatedHealth).to.be.closeTo(expectedHealth, 1); // Allow small tolerance
    expect(updatedHappiness).to.be.closeTo(expectedHappiness, 1); // Allow small tolerance
    expect(updatedTimeAlive).to.be.within(
      expectedTimeAliveLower,
      expectedTimeAliveUpper,
      `timeAlive out of range: got ${updatedTimeAlive}, expected between ${expectedTimeAliveLower} and ${expectedTimeAliveUpper}`
    );

    // Verify Gotchi is still alive
    expect(Number(gotchi.deathTimestamp)).to.equal(0); // Gotchi should not be dead
  });

  it("Should apply decay to health and happiness over time while awake", async function () {
    const tokenId = 1;

    // Step 1: Retrieve initial Gotchi stats
    const initialGotchi = await game.gotchiStats(tokenId);
    const initialHealth = Number(initialGotchi.health);
    const initialHappiness = Number(initialGotchi.happiness);
    const initialTimeAlive = Number(initialGotchi.timeAlive);

    // Decay parameters
    const decayRateHealthPerHour = 5.5; // Health decays at 5.5 points/hour
    const decayRateHappinessPerHour = 4.17; // Happiness decays at 4.17 points/hour
    const timeElapsed = 3 * 60 * 60; // Advance time by 3 hours (in seconds)

    // Step 2: Advance time by 3 hours
    await ethers.provider.send("evm_increaseTime", [timeElapsed]);
    await ethers.provider.send("evm_mine");

    // Step 3: Trigger a state update
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 4: Retrieve updated Gotchi stats
    const updatedGotchi = await game.gotchiStats(tokenId);
    const updatedHealth = Number(updatedGotchi.health);
    const updatedHappiness = Number(updatedGotchi.happiness);
    const updatedTimeAlive = Number(updatedGotchi.timeAlive);

    // Step 5: Calculate expected values
    const expectedHealth = Math.max(
      initialHealth - decayRateHealthPerHour * 3,
      0
    );
    const expectedHappiness = Math.max(
      initialHappiness - decayRateHappinessPerHour * 3,
      0
    );
    const expectedTimeAliveLower = initialTimeAlive + timeElapsed - 10;
    const expectedTimeAliveUpper = initialTimeAlive + timeElapsed + 10;

    // Step 6: Assertions
    expect(updatedHealth).to.be.closeTo(expectedHealth, 1); // 1-point tolerance for health
    expect(updatedHappiness).to.be.closeTo(expectedHappiness, 1); // 1-point tolerance for happiness
    expect(updatedTimeAlive).to.be.within(
      expectedTimeAliveLower,
      expectedTimeAliveUpper,
      `timeAlive out of range: got ${updatedTimeAlive}, expected between ${expectedTimeAliveLower} and ${expectedTimeAliveUpper}`
    );

    // Verify Gotchi is still alive
    expect(Number(updatedGotchi.deathTimestamp)).to.equal(0); // Gotchi should not be dead
  });

  it("Should pause decay for health and happiness while the Gotchi is asleep", async function () {
    const tokenId = 1; // Use token ID 1, as initialized in beforeEach

    // Step 1: Retrieve initial Gotchi stats
    const initialGotchi = await game.gotchiStats(tokenId);
    const initialHealth = Number(initialGotchi.health);
    const initialHappiness = Number(initialGotchi.happiness);

    // Define maximum sleep duration in seconds
    const MAX_SLEEP_DURATION = 8 * 60 * 60; // 8 hours in seconds

    // Step 2: Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Step 3: Advance time by 8 hours (MAX_SLEEP_DURATION)
    await ethers.provider.send("evm_increaseTime", [MAX_SLEEP_DURATION]);
    await ethers.provider.send("evm_mine");

    // Step 4: Trigger update via manualSaveToLeaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 5: Retrieve updated Gotchi stats
    const updatedGotchi = await game.gotchiStats(tokenId);
    const updatedHealth = Number(updatedGotchi.health);
    const updatedHappiness = Number(updatedGotchi.happiness);
    const updatedTimeAlive = Number(updatedGotchi.timeAlive);

    // Step 6: Calculate expected values
    const expectedHealth = 80; // After 8 hours, health should decrease by 20
    const expectedHappiness = 80; // After 8 hours, happiness should decrease by 20
    const expectedTimeAliveLower = MAX_SLEEP_DURATION - 10; // Account for timing variance
    const expectedTimeAliveUpper = MAX_SLEEP_DURATION + 10;

    // Step 7: Assertions
    expect(updatedHealth).to.equal(
      expectedHealth,
      `Health mismatch: expected ${expectedHealth}, got ${updatedHealth}`
    );
    expect(updatedHappiness).to.equal(
      expectedHappiness,
      `Happiness mismatch: expected ${expectedHappiness}, got ${updatedHappiness}`
    );
    expect(updatedTimeAlive).to.be.within(
      expectedTimeAliveLower,
      expectedTimeAliveUpper,
      `timeAlive out of range: got ${updatedTimeAlive}, expected between ${expectedTimeAliveLower} and ${expectedTimeAliveUpper}`
    );
  });

  it("Should apply decay to health and happiness after exceeding MAX_SLEEP_DURATION while the Gotchi is asleep", async function () {
    const tokenId = 1; // Use token ID 1, as initialized in beforeEach

    // Step 1: Retrieve initial Gotchi stats
    const initialGotchi = await game.gotchiStats(tokenId);
    const initialHealth = Number(initialGotchi.health); // Should be 80
    const initialHappiness = Number(initialGotchi.happiness); // Should be 80

    // Define maximum sleep duration and oversleep duration
    const MAX_SLEEP_DURATION = 8 * 60 * 60; // 8 hours in seconds
    const OVERSLEEP_DURATION = 2 * 60 * 60; // 2 hours in seconds
    const TOTAL_DURATION = MAX_SLEEP_DURATION + OVERSLEEP_DURATION; // 10 hours in seconds

    // Step 2: Put the Gotchi to sleep
    await game.connect(addr1).sleep(tokenId);

    // Step 3: Advance time by 10 hours (8 hours sleep + 2 hours oversleep)
    await ethers.provider.send("evm_increaseTime", [TOTAL_DURATION]);
    await ethers.provider.send("evm_mine");

    // Step 4: Trigger update via manualSaveToLeaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 5: Retrieve updated Gotchi stats
    const updatedGotchi = await game.gotchiStats(tokenId);
    const updatedHealth = Number(updatedGotchi.health);
    const updatedHappiness = Number(updatedGotchi.happiness);
    const updatedTimeAlive = Number(updatedGotchi.timeAlive);

    // Step 6: Calculate expected values
    const expectedHealth = 80 - 2 * 5.5; // 69
    const expectedHappiness = Math.round(80 - 2 * 4.16); // ≈ 72
    const expectedTimeAliveLower = TOTAL_DURATION - 10; // Account for timing variance
    const expectedTimeAliveUpper = TOTAL_DURATION + 10;

    // Step 7: Assertions
    expect(updatedHealth).to.equal(
      expectedHealth,
      `Health mismatch: expected ${expectedHealth}, got ${updatedHealth}`
    );
    expect(updatedHappiness).to.equal(
      expectedHappiness,
      `Happiness mismatch: expected ${expectedHappiness}, got ${updatedHappiness}`
    );
    expect(updatedTimeAlive).to.be.within(
      expectedTimeAliveLower,
      expectedTimeAliveUpper,
      `timeAlive out of range: got ${updatedTimeAlive}, expected between ${expectedTimeAliveLower} and ${expectedTimeAliveUpper}`
    );
  });

  it("Should maintain health and happiness through regular feeding and playing", async function () {
    const tokenId = 1; // Use token ID 1
    const ONE_HOUR = 60 * 60; // 1 hour in seconds

    // Step 1: Initial feed and play
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);

    // Step 2: Decay for 4 hours
    await ethers.provider.send("evm_increaseTime", [4 * ONE_HOUR]);
    await ethers.provider.send("evm_mine");

    // Step 3: Second feed and play
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);

    // Step 4: Decay for another 4 hours
    await ethers.provider.send("evm_increaseTime", [4 * ONE_HOUR]);
    await ethers.provider.send("evm_mine");

    // Step 5: Third feed and play
    await game.connect(addr1).feed(tokenId);
    await game.connect(addr1).play(tokenId);

    // Step 6: Trigger update to finalize stats
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Step 7: Retrieve updated Gotchi stats
    const updatedGotchi = await game.gotchiStats(tokenId);
    const updatedHealth = Number(updatedGotchi.health);
    const updatedHappiness = Number(updatedGotchi.happiness);
    const updatedTimeAlive = Number(updatedGotchi.timeAlive);

    // Step 8: Define expected values and ranges
    const expectedHealth = 66;
    const expectedHappiness = 76.72;
    const expectedTimeAliveLower = 8 * ONE_HOUR - 10; // Account for timing variance
    const expectedTimeAliveUpper = 8 * ONE_HOUR + 10;

    /// Step 9: Assertions
    expect(updatedHealth).to.equal(
      expectedHealth,
      `Health mismatch: expected ${expectedHealth}, got ${updatedHealth}`
    );
    expect(updatedHappiness).to.be.closeTo(
      expectedHappiness,
      2, // Adjusted tolerance to ±2
      `Happiness mismatch: expected close to ${expectedHappiness}, got ${updatedHappiness}`
    );
    expect(updatedTimeAlive).to.be.within(
      expectedTimeAliveLower - 10,
      expectedTimeAliveUpper + 10,
      `timeAlive out of range: got ${updatedTimeAlive}, expected between ${expectedTimeAliveLower} and ${expectedTimeAliveUpper}`
    );
  });

  it("Should update ownerToTokenId correctly after minting a new Gotchi post-death", async function () {
    const tokenId = 1;

    // Step 1: Advance time to ensure Gotchi dies
    const twoDays = 48 * 60 * 60; // 48 hours in seconds
    await ethers.provider.send("evm_increaseTime", [twoDays]);
    await ethers.provider.send("evm_mine");

    // Step 3: Mint a new Gotchi, specifying tokenId 1 to burn
    const mintCost = await game.mintCost();
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, tokenId);

    // Step 4: Verify the ownerToTokenId mapping is updated to the new tokenId (2)
    const updatedTokenId = await game.ownerToTokenId(addr1.address);
    expect(updatedTokenId).to.equal(2); // New token ID should be 2
  });

  it("Should update ownerToTokenId mapping after minting a new Gotchi", async function () {
    const tokenIdToBurn = 1;

    // Burn the existing Gotchi
    await game.connect(addr1).burn(tokenIdToBurn);

    // Mint a new Gotchi
    await game.connect(addr1).mintNewGotchi(addr1.address, tokenIdToBurn);

    // Verify the ownerToTokenId mapping is updated to the new token ID
    const newTokenId = await game.ownerToTokenId(addr1.address);
    expect(newTokenId).to.equal(2); // Assuming the new token ID is 2
  });

  it("Should update timeAlive correctly when health and happiness decay to zero due to idle state", async function () {
    const tokenId = 1;

    // Move time forward by 48 hours (48 * 60 * 60 seconds)
    const fortyEightHours = 48 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [fortyEightHours]);
    await ethers.provider.send("evm_mine", []);

    // Trigger stats update via manualSaveToLeaderboard
    await game.connect(addr1).manualSaveToLeaderboard(tokenId);

    // Retrieve updated Gotchi stats
    const stats = await game.gotchiStats(tokenId);
    const timeAlive = BigInt(stats.timeAlive); // Convert to BigInt for comparison

    // Expected timeAlive: 52363 seconds (+/- 10 seconds)
    const expectedTimeAlive = BigInt(Math.floor((80 / 5.5) * 3600)); // 52363 seconds
    expect(timeAlive).to.be.closeTo(expectedTimeAlive, BigInt(10)); // +/- 10 seconds tolerance
  });

  //
  //
  //
  //
  //
});
