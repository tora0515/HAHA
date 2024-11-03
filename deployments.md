# Deployment Records for HAHA Token and MamaGotchiGameMinato Contract

This document records details of each deployment for HAHA Token and MamaGotchiGameMinato contracts.

---

## Minato Testnet Deployment - HAHA Token

**Date of Deployment**: October 27, 2023  
**Network**: Minato Testnet  
**Token Address**: 0xDD735ad642e188d595E17236628e5d4aFA2DBab7  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://soneium-minato.blockscout.com/token/0xDD735ad642e188d595E17236628e5d4aFA2DBab7)  
**Initial Supply**: 100 trillion HAHA tokens  
**Gas Used**: Transaction gas used (retrieved from the transaction receipt)

### Deployment Notes:

- Deployed using Hardhat with Ethers.js v6.
- Initial tests confirmed successful burn and supply cap functionalities.
- Deployment intended for testing purposes; testnet ASTR will be provided for liquidity at a later date.

---

## Minato Testnet Deployment - MamaGotchiGameMinato Contract

**Date of Deployment**: November 4, 2024  
**Network**: Minato Testnet  
**Contract Address**: 0x422dE3D472217F37aa7AA7e26534e44E498E5bF8  
**HAHA Token Address**: 0xDD735ad642e188d595E17236628e5d4aFA2DBab7  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://explorer-testnet.soneium.org/address/0x422dE3D472217F37aa7AA7e26534e44E498E5bF8?tab=contract)

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

- Fully tested for functionality, error handling, and edge cases before deployment.
- Adjustments were made to error messages to enhance clarity for the community.
- Supports time-based health and happiness decay mechanisms with capped sleep decay, cooldowns, and enhanced error handling for HAHA token transactions.

---

## Soneium Deployments

_(Keep this section empty until you deploy on mainnet. Copy the relevant sections and update accordingly.)_
