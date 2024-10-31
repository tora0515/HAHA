# Deployment Records for HAHA Token and GotchiPoints Contracts

This document records details of each deployment of the HAHA Token and GotchiPoints contracts.

---

## Minato Testnet Deployment - HAHA Token

**Date of Deployment**: October 27, 2023  
**Network**: Minato Testnet  
**Token Address**: 0xDD735ad642e188d595E17236628e5d4aFA2DBab7
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a
**Explorer Link**: [View on Minato Explorer](https://explorer-testnet.soneium.org/address/0xDD735ad642e188d595E17236628e5d4aFA2DBab7)  
**Initial Supply**: 100 trillion HAHA tokens  
**Gas Used**: Transaction gas used (retrieved from the transaction receipt)

### Deployment Notes:

- Deployed using Hardhat with Ethers.js v6.
- Initial tests confirmed successful burn and supply cap functionalities.
- Deployment intended for testing purposes; testnet ASTR will be provided for liquidity at a later date.

---

## Minato Testnet Deployment - GotchiPoints Contract

**Date of Deployment**: October 29, 2024  
**Network**: Minato Testnet  
**Contract Address**: 0xAF09097545960E163c73d746157011f4Ff0A3843  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a
**Explorer Link**: [View on Minato Explorer](https://explorer-testnet.soneium.org/address/0xAF09097545960E163c73d746157011f4Ff0A3843?tab=contract)

### Deployment Notes:

- Manages player scores with round and cumulative leaderboards.
- Points update based on interactions in the MamaGotchi game.
- Round points reset after each MamaGotchi death; cumulative points accumulate over time.
- Deployment intended for testing purposes.

---

## MamaGotchi Contract Deployment on Minato Testnet

**Date of Deployment**: October 31, 2024  
**Network**: Minato Testnet  
**Contract Address**: 0x36e4475cCC39Da792D54d7f2edA6522F9136Edb9  
**HAHA Token Address**: 0xDD735ad642e188d595E17236628e5d4aFA2DBab7  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://explorer-testnet.soneium.org/address/0x36e4475cCC39Da792D54d7f2edA6522F9136Edb9?tab=contract)

**Initial Configuration**:

- **Mint Cost**: 10,000,000 HAHA
- **Feed Cost**: 10,000 HAHA
- **Play Cost**: 10,000 HAHA
- **Cooldowns**:
  - Feeding: 10 minutes
  - Playing: 15 minutes
  - Sleeping: 1 hour
  - Max Sleep Duration: 8 hours

### Notes:

- This contract was fully tested for functionality, error handling, and edge cases before deployment.
- Adjustments were made to error messages to enhance clarity for the community.

## Soneium Deployments

_(Keep this section empty until you deploy on mainnet. Copy the relevant sections and update accordingly.)_
