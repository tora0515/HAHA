# Deployment Records for HAHA Token and MamaGotchiGameMinato Contract

This document records details of each deployment for HAHA Token and MamaGotchiGameMinato contracts.

---

.

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
- Deployment intended for testing purposes; testnet ASTR will be provided for liquidity at a later date

---

## Minato Testnet Deployment - HAHA Batch Send Test Token Three HMBT3

**Date of Deployment**: December 21, 2024
**Network**: Minato Testnet  
**Token Address**: 0x28E61137a0DeCDeE8C8Ab427D7Fd4F5fA387bBd8  
**Deployer Address**: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
**Explorer Link**: [View on Minato Explorer](https://soneium-minato.blockscout.com/token/0x28E61137a0DeCDeE8C8Ab427D7Fd4F5fA387bBd8?tab=contract)  
**Initial Supply**: 100 trillion HMBT2 tokens
**Gas Used**: Transaction gas used (retrieved from the transaction receipt)

### Deployment Notes:

- Deployed using Hardhat with Ethers.js v6.
- Initial tests: HMBT
- Test Results: Error in batch send script result in small variations in token values being sent. Updated batch send script and use HMBT3 as new test token.
- Deployment intended for testing purposes; No liquidity provided. Token exclusively created to test batch deployment.

### Past Tokens

- HMBT: 0x1E8893B544CD6fC26BbA141Fdd8e808c1570A2D0
- HMBT2: 0x97248d9fDC963381C9b68e27a8c0ba40B066bf17

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
Contract Address: 0xf3124d75d918eC64E6567BB2F699c6D9421CDdC8
Deployer Address: 0x1adAF26F6440ab7D7a237b49e1ceEf58f45F902a  
Explorer Link: [View on Minato Explorer](https://soneium-minato.blockscout.com/address/0xf3124d75d918eC64E6567BB2F699c6D9421CDdC8?tab=contract)

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

## Soneium Mainnet Deployment - Mother of Memes (HAHA) Token

**Date of Deployment**: 15 Jan 2025
**Network**: Soneium  
**Token Address**: 0xA8FeAae65C44B458A16Ea4E709036A2ee85d073A  
**Deployer Address**: 0xeA9c9404422E2e09b5e4872A6FEa1311Fef46c0D  
**Explorer Link**: [View on Soneium Blockscout](https://soneium.blockscout.com/token/0xA8FeAae65C44B458A16Ea4E709036A2ee85d073A)  
**Initial Supply**: 100 trillion HAHA tokens  
**Gas Used**: Transaction gas used (retrieved from the transaction receipt)

### Deployment Notes:

- Deployed using Hardhat with Ethers.js v6.
- Testing carried out on Minato testnet (see above)
- Token will be paired with ASTR on Soneium. ASTR will be withdrawn from Astar zkEVM LP and bridged to Astar EVM then to Soneium for pairing. Liquidity to be provided on QuickSwap.
