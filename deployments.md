# Deployment Records for HAHA Token and MamaGotchiGameMinato Contract

This document records details of each deployment for HAHA Token and MamaGotchiGameMinato contracts.

---

## Minato Testnet Deployment - HAHA Token

**Date of Deployment**: November 5, 2024
**Network**: Minato Testnet  
**Token Address**: 0x38611615d7A357B8C88523bd02d85375fAF1E8D1  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://soneium-minato.blockscout.com/token/0x38611615d7A357B8C88523bd02d85375fAF1E8D1?tab=contract)  
**Initial Supply**: 100 trillion HAHA tokens  
**Gas Used**: Transaction gas used (retrieved from the transaction receipt)

### Deployment Notes:

- Deployed using Hardhat with Ethers.js v6.
- Initial tests confirmed successful burn and supply cap functionalities.
- Deployment intended for testing purposes; testnet ASTR will be provided for liquidity at a later date.

---

## Minato Testnet Deployment - MamaGotchiGameMinato Contract

**Date of Deployment**: November 20, 2024  
**Network**: Minato Testnet  
**Contract Address**: 0x37EA6481ecc5f907948e8a3F77655D3C417d809c  
**HAHA Token Address**: 0x38611615d7A357B8C88523bd02d85375fAF1E8D1  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://soneium-minato.blockscout.com/address/0x37EA6481ecc5f907948e8a3F77655D3C417d809c?tab=contract)

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

## Minato Testnet Deployment - HAHAFaucetMinato Contract

Date of Deployment: November 18, 2024  
Network: Minato Testnet  
Contract Address: 0x70b771d4834A266220e49dfC06FE9a6333734fdE  
HAHA Token Address: 0x38611615d7A357B8C88523bd02d85375fAF1E8D1  
Deployer Address: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
Explorer Link: [View on Minato Explorer](https://soneium-minato.blockscout.com/address/0x70b771d4834A266220e49dfC06FE9a6333734fdE?tab=contract)

Initial Configuration:

- Withdrawal Amount: 100,000,000 HAHA
- Initial Lock Time: 60 seconds
- Owner Address: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a

Notes:

- The faucet allows users to request HAHA tokens to test the ecosystem.
- Owner can adjust the withdrawal amount and lock time to throttle access if necessary.
- Deployed and tested for seamless integration with the HAHA token contract.
- Designed as a temporary faucet for testnet use, intended to operate for two weeks.
- Initial Lock Time set to 60 seconds for testing. Updated to 24 hrs after deployed.

---

## Soneium Deployments

_(Keep this section empty until you deploy on mainnet. Copy the relevant sections and update accordingly.)_
