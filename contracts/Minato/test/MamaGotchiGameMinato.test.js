const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGameMinato Contract - Time and Cooldown Functionality", function () {
  let game, hahaToken, owner, addr1;
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

    const MamaGotchiGameMinato = await ethers.getContractFactory(
      "MamaGotchiGameMinato"
    );
    [owner, addr1] = await ethers.getSigners();

    game = await MamaGotchiGameMinato.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Transfer tokens to addr1 and approve minting cost for minting
    const mintCost = ethers.parseUnits("1000000000", 18); // Adjust this to the actual mint cost if needed
    await hahaToken.transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost); // Ensure approval for minting cost

    // Mint Gotchi to addr1
    await game.connect(addr1).mintNewGotchi(addr1.address, 1);
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

    // Approve tokens for feeding and sleeping costs (feedCost reused if sleep cost same)
    await hahaToken.connect(addr1).approve(game.target, feedCost);

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

    // Step 2: Attempt to feed the Gotchi, expecting the contract to recognize it as dead and revert
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi is dead!"
    );
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

    // Approve tokens for playing and sleeping costs (playCost reused if sleep cost same)
    await hahaToken.connect(addr1).approve(game.target, playCost);

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

    // Step 2: Attempt to play with the Gotchi, expecting the contract to recognize it as dead and revert
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi is dead!"
    );
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
  //
  //
  //
  //
});
