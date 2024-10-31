const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = require("@ethersproject/units");

describe("HAHA Token Contract", function () {
  let HAHA, haha, owner, addr1;

  beforeEach(async function () {
    HAHA = await ethers.getContractFactory("HAHAMinatoTestnetToken");
    haha = await HAHA.deploy();
    [owner, addr1] = await ethers.getSigners();
  });

  it("Should deploy with the correct initial supply cap", async function () {
    const totalSupply = (await haha.totalSupply()).toString();
    const cap = (await haha.cap()).toString();
    const expectedCap = parseUnits("100000000000000", 18).toString();

    expect(totalSupply).to.equal(cap);
    expect(totalSupply).to.equal(expectedCap);

    const deployerBalance = (await haha.balanceOf(owner.address)).toString();
    expect(deployerBalance).to.equal(expectedCap);
  });

  it("Should allow the owner to burn tokens", async function () {
    const burnAmount = parseUnits("1000000000000", 18).toString(); // Convert to string
    await haha.connect(owner).burn(burnAmount); // Ensure burnAmount is passed as string

    const newSupply = (await haha.totalSupply()).toString();
    const tokensBurned = (await haha.tokensBurned()).toString();

    expect(tokensBurned).to.equal(burnAmount);
    expect(newSupply).to.equal(parseUnits("99000000000000", 18).toString()); // New supply after burn
  });

  it("Should calculate circulating supply accurately", async function () {
    const initialCirculatingSupply = (
      await haha.circulatingSupply()
    ).toString();
    expect(initialCirculatingSupply).to.equal("0");

    const transferAmount = parseUnits("5000000000000", 18).toString(); // Convert to string
    await haha.connect(owner).transfer(addr1.address, transferAmount);

    const updatedCirculatingSupply = (
      await haha.circulatingSupply()
    ).toString();
    expect(updatedCirculatingSupply).to.equal(transferAmount);
  });

  it("Should prevent any further minting", async function () {
    const totalSupply = (await haha.totalSupply()).toString();
    const cap = (await haha.cap()).toString();
    expect(totalSupply).to.equal(cap);
  });
});
