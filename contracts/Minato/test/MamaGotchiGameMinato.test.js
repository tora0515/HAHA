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
  //
  //
  //
  //
});
