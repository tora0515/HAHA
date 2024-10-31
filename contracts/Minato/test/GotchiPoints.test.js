const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GotchiPoints Contract", function () {
  let GotchiPoints, gotchiPoints, owner, addr1, addr2;

  beforeEach(async function () {
    GotchiPoints = await ethers.getContractFactory("GotchiPoints");
    [owner, addr1, addr2] = await ethers.getSigners();
    gotchiPoints = await GotchiPoints.deploy(owner.address);
  });

  it("Should add points to both round and cumulative totals", async function () {
    await gotchiPoints.addPoints(addr1.address, 100);
    expect(await gotchiPoints.roundPoints(addr1.address)).to.equal(100);
    expect(await gotchiPoints.cumulativePoints(addr1.address)).to.equal(100);
  });

  it("Should deduct points and ensure no negative points", async function () {
    await gotchiPoints.addPoints(addr1.address, 100);
    await gotchiPoints.deductPoints(addr1.address, 30);
    expect(await gotchiPoints.roundPoints(addr1.address)).to.equal(70);
    expect(await gotchiPoints.cumulativePoints(addr1.address)).to.equal(70);

    await gotchiPoints.deductPoints(addr1.address, 100);
    expect(await gotchiPoints.roundPoints(addr1.address)).to.equal(0);
    expect(await gotchiPoints.cumulativePoints(addr1.address)).to.equal(0);
  });

  it("Should save round score, update leaderboard, and reset round points", async function () {
    await gotchiPoints.addPoints(addr1.address, 150);
    await gotchiPoints.saveRoundScore(addr1.address);
    expect(await gotchiPoints.roundPoints(addr1.address)).to.equal(0);

    const leaderboardEntry = await gotchiPoints.bestRoundScores(0);
    expect(leaderboardEntry.player).to.equal(addr1.address);
    expect(leaderboardEntry.score).to.equal(150);
  });

  it("Should update best round scores leaderboard with top entries", async function () {
    await gotchiPoints.addPoints(addr1.address, 200);
    await gotchiPoints.saveRoundScore(addr1.address);

    await gotchiPoints.addPoints(addr2.address, 300);
    await gotchiPoints.saveRoundScore(addr2.address);

    const topScore1 = await gotchiPoints.bestRoundScores(0);
    const topScore2 = await gotchiPoints.bestRoundScores(1);

    expect(topScore1.player).to.equal(addr2.address);
    expect(topScore1.score).to.equal(300);
    expect(topScore2.player).to.equal(addr1.address);
    expect(topScore2.score).to.equal(200);
  });

  it("Should update all-time leaderboard with cumulative scores", async function () {
    await gotchiPoints.addPoints(addr1.address, 500);
    await gotchiPoints.addPoints(addr1.address, 300);
    await gotchiPoints.saveRoundScore(addr1.address);

    await gotchiPoints.addPoints(addr1.address, 200);
    await gotchiPoints.saveRoundScore(addr1.address);

    const cumulativeScore = await gotchiPoints.cumulativePoints(addr1.address);
    expect(cumulativeScore).to.equal(1000);

    const allTimeEntry = await gotchiPoints.allTimeScores(0);
    expect(allTimeEntry.player).to.equal(addr1.address);
    expect(allTimeEntry.score).to.equal(1000);
  });
});
