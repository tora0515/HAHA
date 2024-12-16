// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BatchSender is Ownable {
    event TransferSuccess(address indexed recipient, uint256 amount);
    event TransferFailed(address indexed recipient, uint256 amount);

    bool public paused = false;

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Batch transfer tokens to multiple recipients.
     * @param tokenAddress The ERC20 token contract address.
     * @param recipients Array of recipient addresses.
     * @param amounts Array of token amounts corresponding to recipients.
     */
    function batchTransfer(
        address tokenAddress,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(!paused, "Batch transfers are paused");
        require(recipients.length == amounts.length, "Mismatch in arrays length");

        IERC20 token = IERC20(tokenAddress);

        for (uint256 i = 0; i < recipients.length; i++) {
            bool success = token.transfer(recipients[i], amounts[i]);
            if (success) {
                emit TransferSuccess(recipients[i], amounts[i]);
            } else {
                emit TransferFailed(recipients[i], amounts[i]);
            }
        }
    }

    /**
     * @dev Pause or unpause the contract. Only the owner can call this.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev Permanently disable the contract by transferring ownership to the burn address.
     * Once called, the contract cannot be used again.
     */
    function disableForever() external onlyOwner {
    transferOwnership(address(0x0000000000000000000000000000000000000000));
  }
}
