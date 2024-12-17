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

## Minato Testnet Deployment - HAHA Batch Send Test Token HMBT

**Date of Deployment**: December 16, 2024
**Network**: Minato Testnet  
**Token Address**: 0x1E8893B544CD6fC26BbA141Fdd8e808c1570A2D0  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://soneium-minato.blockscout.com/token/0x1E8893B544CD6fC26BbA141Fdd8e808c1570A2D0?tab=contract)  
**Initial Supply**: 100 trillion HMBT tokens
**Gas Used**: Transaction gas used (retrieved from the transaction receipt)

### Deployment Notes:

- Deployed using Hardhat with Ethers.js v6.
- Initial tests: TBD
- Deployment intended for testing purposes; No liquidity provided. Token exclusively created to test batch deployment.

---

## Minato Testnet Deployment - MamaGotchiGameMinato Contract

**Date of Deployment**: November 23, 2024  
**Network**: Minato Testnet  
**Contract Address**: 0x9F2609A76E9AF431FCa6bbbdd28BE92d2A283F2E  
**HAHA Token Address**: 0x38611615d7A357B8C88523bd02d85375fAF1E8D1  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://soneium-minato.blockscout.com/address/0x9F2609A76E9AF431FCa6bbbdd28BE92d2A283F2E?tab=contract)

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

## Minato Testnet Deployment - Batch Sender Contract

Date of Deployment: December 17, 2024  
Network: Minato Testnet  
Contract Address: 0x3CD92f8BC8fD2ADE1ae6E6655e58e55C2D35f7d7
Deployer Address: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
Explorer Link: [View on Minato Explorer](https://soneium-minato.blockscout.com/address/0x3CD92f8BC8fD2ADE1ae6E6655e58e55C2D35f7d7?tab=contract)

Initial Configuration:

- Batch transfer tokens to multiple recipients.
- tokenAddress The ERC20 token contract address.
- recipients Array of recipient addresses.
- amounts Array of token amounts corresponding to recipients.
- Owner Address: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a

Notes:

- Batch transfer contract to send test tokens to prepare for move to Soneium.
- Pause/enable function to disable/re-enable batch send functionality
- Send to dead address to remove owner from batch sending after initial function is fulfilled.

---

## Soneium Deployments

_(Keep this section empty until you deploy on mainnet. Copy the relevant sections and update accordingly.)_
