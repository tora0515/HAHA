const { expect } = require("chai");
const { ethers } = require("hardhat");

let owner, addr1, addr2, mamaGotchi, hahaToken;

describe("MamaGotchi Contract", function () {
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners(); // Assign signers directly

    // Deploy HAHA token
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    // Deploy MamaGotchi with HAHA token address
    const MamaGotchi = await ethers.getContractFactory("MamaGotchi");
    mamaGotchi = await MamaGotchi.deploy(owner.address, hahaToken.target);
    await mamaGotchi.waitForDeployment();

    // Fund addr1 with HAHA tokens for testing
    await hahaToken.transfer(
      addr1.address,
      ethers.parseUnits("1000000000", 18)
    );
  });

  // Test 1: Minting a new MamaGotchi with correct mint cost and balance deduction
  it("Should mint a new MamaGotchi for the user with the correct mint cost", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);

    await expect(mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0))
      .to.emit(mamaGotchi, "Transfer")
      .withArgs(ethers.ZeroAddress, addr1.address, 0);

    const finalBalance = await hahaToken.balanceOf(addr1.address);
    const expectedBalance = ethers.parseUnits("1000000000", 18) - mintCost;
    expect(finalBalance).to.equal(expectedBalance);
  });

  // Test 2: Burning a MamaGotchi as the owner
  it("Should allow the owner to burn a MamaGotchi", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    await expect(mamaGotchi.connect(addr1).burn(0))
      .to.emit(mamaGotchi, "Transfer")
      .withArgs(addr1.address, ethers.ZeroAddress, 0);

    await expect(mamaGotchi.ownerOf(0)).to.be.reverted;
  });

  // Test 3: Setting death timestamp when health reaches zero
  it("Should correctly set the death timestamp when health reaches zero", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;
    await mamaGotchi
      .connect(owner)
      .setHealthAndHappinessForTesting(tokenId, 0, 0);

    await mamaGotchi.connect(owner).setDeath(tokenId);

    const gotchiStats = await mamaGotchi.gotchiStats(tokenId);
    expect(gotchiStats.deathTimestamp).to.be.gt(0);
  });

  // Test 4: Putting a MamaGotchi to sleep and verifying the sleep state
  it("Should correctly put the MamaGotchi to sleep", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;
    await mamaGotchi.connect(addr1).sleep(tokenId);

    const gotchiStats = await mamaGotchi.gotchiStats(tokenId);
    expect(gotchiStats.isSleeping).to.equal(true);
    expect(gotchiStats.sleepStartTime).to.be.gt(0);

    await expect(mamaGotchi.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi is already sleeping"
    );
  });

  // Test 5: Waking up a MamaGotchi after sleep
  it("Should correctly wake up the MamaGotchi after sleep", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;
    await mamaGotchi.connect(addr1).sleep(tokenId);

    await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await mamaGotchi.connect(addr1).wake(tokenId);

    const gotchiStats = await mamaGotchi.gotchiStats(tokenId);
    expect(gotchiStats.isSleeping).to.equal(false);
    expect(gotchiStats.sleepStartTime).to.equal(0);
  });

  // Test 6: Feeding a MamaGotchi, increasing health, and respecting cooldown
  it("Should allow feeding to increase health and respect cooldown", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;

    const feedCost = await mamaGotchi.feedCost();
    const approvalAmount = feedCost * 10n;
    await hahaToken.connect(addr1).approve(mamaGotchi.target, approvalAmount);

    await mamaGotchi.connect(addr1).feed(tokenId);
    const gotchiStatsAfterFeed = await mamaGotchi.gotchiStats(tokenId);
    expect(gotchiStatsAfterFeed.health).to.be.gte(10);

    await expect(mamaGotchi.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "Feed is on cooldown"
    );
  });

  // Test 7: Playing with a MamaGotchi, increasing happiness, and respecting cooldown
  // Test 7 Play
  it("Should allow playing to increase happiness and respect cooldown", async function () {
    const playCost = await mamaGotchi.playCost();
    const tokenId = 0;

    // Mint a MamaGotchi for addr1 to prepare for testing
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    // Approve a larger amount to cover multiple plays without re-approving
    await hahaToken
      .connect(addr1)
      .approve(mamaGotchi.target, BigInt(playCost) * 10n);

    // Play for the first time
    await mamaGotchi.connect(addr1).play(tokenId);

    // Check initial happiness after first play
    const initialHappiness = (await mamaGotchi.gotchiStats(tokenId)).happiness;
    expect(initialHappiness).to.be.at.least(10); // Ensure happiness increased

    // Attempt to play again within the cooldown period
    await expect(mamaGotchi.connect(addr1).play(tokenId)).to.be.revertedWith(
      "Play is on cooldown"
    );

    // Fast-forward time by the cooldown period
    await ethers.provider.send("evm_increaseTime", [
      Number(await mamaGotchi.PLAY_COOLDOWN()),
    ]);
    await ethers.provider.send("evm_mine", []);

    // Play after cooldown
    await mamaGotchi.connect(addr1).play(tokenId);

    // Verify that happiness increased further
    const finalHappiness = (await mamaGotchi.gotchiStats(tokenId)).happiness;
    expect(finalHappiness).to.be.above(initialHappiness);
  });

  // Test 8: Enforcing a cooldown between consecutive sleep actions
  it("Should enforce a 1-hour cooldown between consecutive sleep actions", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;

    // Initial sleep action
    await mamaGotchi.connect(addr1).sleep(tokenId);

    // Wake up the MamaGotchi to end the sleep state
    await mamaGotchi.connect(addr1).wake(tokenId);

    // Attempt another sleep action immediately, which should fail due to cooldown
    await expect(mamaGotchi.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "Cooldown in effect for sleep action"
    );

    // Advance time by 1 hour to allow for another sleep
    await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
    await ethers.provider.send("evm_mine");

    // Try sleeping again, which should now succeed after the cooldown period
    await expect(mamaGotchi.connect(addr1).sleep(tokenId)).to.not.be.reverted;
  });

  // Test 9: Ensuring health and happiness values do not exceed maximum limits
  it("Should not exceed maximum health and happiness values of 100", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;

    // Set health and happiness close to the max (e.g., 95) to test the cap
    await mamaGotchi
      .connect(owner)
      .setHealthAndHappinessForTesting(tokenId, 95, 95);

    const feedCost = await mamaGotchi.feedCost();
    const playCost = await mamaGotchi.playCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, feedCost * 3n);
    await hahaToken.connect(addr1).approve(mamaGotchi.target, playCost * 3n);

    // Feed and play to increase health and happiness, checking that values cap at 100
    await mamaGotchi.connect(addr1).feed(tokenId);
    const gotchiAfterFeed = await mamaGotchi.gotchiStats(tokenId);
    expect(gotchiAfterFeed.health).to.equal(100);

    await mamaGotchi.connect(addr1).play(tokenId);
    const gotchiAfterPlay = await mamaGotchi.gotchiStats(tokenId);
    expect(gotchiAfterPlay.happiness).to.equal(100);
  });

  // Test 10: Only owner should be able to set death and update costs
  it("Should only allow the owner to set death and update costs", async function () {
    const mintCost = await mamaGotchi.mintCost();
    const feedCost = await mamaGotchi.feedCost();
    const playCost = await mamaGotchi.playCost();

    // Non-owner attempts to set death or change costs
    await expect(mamaGotchi.connect(addr1).setDeath(0)).to.be.reverted;
    await expect(mamaGotchi.connect(addr1).setMintCost(mintCost * 2n)).to.be
      .reverted;
    await expect(mamaGotchi.connect(addr1).setFeedCost(feedCost * 2n)).to.be
      .reverted;
    await expect(mamaGotchi.connect(addr1).setPlayCost(playCost * 2n)).to.be
      .reverted;
  });

  // Test 11: Revert when trying to access a non-existent token
  it("Should revert when trying to access a non-existent token", async function () {
    const nonExistentTokenId = 999;

    await expect(mamaGotchi.feed(nonExistentTokenId)).to.be.reverted;
    await expect(mamaGotchi.play(nonExistentTokenId)).to.be.reverted;
    await expect(mamaGotchi.sleep(nonExistentTokenId)).to.be.reverted;
    await expect(mamaGotchi.wake(nonExistentTokenId)).to.be.reverted;
  });

  // Test 12: Ensure MamaGotchi NFTs are non-transferable (soulbound nature)
  it("Should prevent any transfer attempts due to soulbound nature", async function () {
    const mintCost = await mamaGotchi.mintCost();
    await hahaToken.connect(addr1).approve(mamaGotchi.target, mintCost);
    await mamaGotchi.connect(addr1).mintNewGotchi(addr1.address, 0);

    const tokenId = 0;

    await expect(
      mamaGotchi
        .connect(addr1)
        .transferFrom(addr1.address, addr2.address, tokenId)
    ).to.be.revertedWith(
      "MamaGotchi NFTs are soulbound and cannot be transferred"
    );

    await expect(
      mamaGotchi
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](
          addr1.address,
          addr2.address,
          tokenId
        )
    ).to.be.revertedWith(
      "MamaGotchi NFTs are soulbound and cannot be transferred"
    );
  });
});
