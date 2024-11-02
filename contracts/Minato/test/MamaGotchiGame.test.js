const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MamaGotchiGame Contract - Token Approval Limits", function () {
  let game, hahaToken, owner, addr1;
  const mintCost = ethers.parseUnits("1000000000", 18); // Direct mint cost in $HAHA tokens
  const feedCost = ethers.parseUnits("10000", 18); // Direct feed cost
  const playCost = ethers.parseUnits("10000", 18); // Direct play cost

  beforeEach(async function () {
    const HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    hahaToken = await HAHA.deploy();
    await hahaToken.waitForDeployment();

    const MamaGotchiGame = await ethers.getContractFactory("MamaGotchiGame");
    [owner, addr1] = await ethers.getSigners();
    game = await MamaGotchiGame.deploy(owner.address, hahaToken.target);
    await game.waitForDeployment();

    // Transfer and approve exact $HAHA amounts for addr1
    await hahaToken.transfer(
      addr1.address,
      ethers.parseUnits("1000100000", 18)
    ); // Sufficient tokens for all actions
    await hahaToken.connect(addr1).approve(game.target, mintCost); // Approve exact mint cost
    await game.connect(addr1).mintNewGotchi(addr1.address, 0); // Mint Gotchi
  });

  it("Should allow feeding with exact token approval amount", async function () {
    // Approve exact feed cost
    await hahaToken.connect(addr1).approve(game.target, feedCost);

    // Try feeding with the exact approved amount
    await expect(game.connect(addr1).feed(0)).to.not.be.reverted;
  });

  it("Should revert feeding if approval is slightly below required amount", async function () {
    // Approve just below feed cost
    await hahaToken.connect(addr1).approve(game.target, feedCost.sub(1));

    // Expect revert due to insufficient approval
    await expect(game.connect(addr1).feed(0)).to.be.revertedWith(
      "Approval required for feeding"
    );
  });
});
