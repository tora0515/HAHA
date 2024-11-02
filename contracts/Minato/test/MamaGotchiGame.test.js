const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGame Contract - Gotchi Points System", function () {
  let MamaGotchiGame, hahaToken, game, owner, addr1, tokenId;

  beforeEach(async function () {
    // Step 1: Deploy HAHA token contract
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    // Step 2: Deploy MamaGotchiGame contract
    MamaGotchiGame = await ethers.getContractFactory("MamaGotchiGame");
    [owner, addr1] = await ethers.getSigners();
    game = await MamaGotchiGame.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Step 3: Allocate HAHA tokens to addr1 and approve game contract to spend
    await hahaToken.transfer(
      addr1.address,
      ethers.parseUnits("1000000000", 18)
    );
    await hahaToken
      .connect(addr1)
      .approve(game.target, ethers.parseUnits("1000000000", 18));

    // Step 4: Mint a MamaGotchi to addr1 to use for testing
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
    tokenId = 0; // Use the first token minted
  });

  it("should enforce feed cooldown", async function () {
    await game.connect(addr1).feed(tokenId); // First feed action
    await expect(game.connect(addr1).feed(tokenId)).to.be.revertedWith(
      "MamaGotchi isn't hungry!"
    ); // Should revert
  });

  it("should enforce play cooldown", async function () {
    await game.connect(addr1).play(tokenId); // First play action
    await expect(game.connect(addr1).play(tokenId)).to.be.revertedWith(
      "MamaGotchi doesn't want to play now!"
    ); // Should revert
  });

  it("should enforce sleep cooldown", async function () {
    await game.connect(addr1).sleep(tokenId); // First sleep action

    // Now we wake the MamaGotchi to exit the sleeping state
    await game.connect(addr1).wake(tokenId);

    // Attempt to sleep again before the cooldown expires
    await expect(game.connect(addr1).sleep(tokenId)).to.be.revertedWith(
      "MamaGotchi isn't tired now!"
    ); // Should revert with cooldown message
  });
});
