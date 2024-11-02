const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGame Contract - Action Gas Usage", function () {
  let game, hahaToken, owner, addr1;
  const mintCost = ethers.parseUnits("1000000000", 18);

  beforeEach(async function () {
    // Deploy HAHA token and MamaGotchiGame contract
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    const MamaGotchiGame = await ethers.getContractFactory("MamaGotchiGame");
    [owner, addr1] = await ethers.getSigners();

    game = await MamaGotchiGame.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Transfer tokens and mint a Gotchi for addr1
    await hahaToken.transfer(addr1.address, mintCost);
    await hahaToken.connect(addr1).approve(game.target, mintCost);
    await game.connect(addr1).mintNewGotchi(addr1.address, 0);
  });

  it("Should measure gas usage for feeding action", async function () {
    // Assumes the first Gotchi tokenId is 0; adjust if dynamic IDs are used
    const tokenId = 0;

    const feedTx = await game
      .connect(addr1)
      .feed(tokenId, { gasLimit: 100000 });
    const feedReceipt = await feedTx.wait();

    console.log("Gas used for feeding:", feedReceipt.gasUsed.toString());
  });

  it("Should measure gas usage for playing action", async function () {
    // Assumes the first Gotchi tokenId is 0; adjust if dynamic IDs are used
    const tokenId = 0;

    const playTx = await game
      .connect(addr1)
      .play(tokenId, { gasLimit: 130000 });
    const playReceipt = await playTx.wait();

    console.log("Gas used for playing:", playReceipt.gasUsed.toString());
  });
});
