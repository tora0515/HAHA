// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BatchSender is Ownable {
    using SafeERC20 for IERC20;

    event TransferSuccess(address indexed sender, address indexed recipient, uint256 amount);
    event TransferFailed(address indexed sender, address indexed recipient, uint256 amount);
    event ContractDisabled(address indexed owner);

    bool public paused = false;
    uint256 public maxBatchSize = 100;

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
        require(!paused, "Batch transfers are paused by the owner");
        require(recipients.length == amounts.length, "Mismatched recipient and amount arrays");
        require(recipients.length <= maxBatchSize, "Exceeds max batch size");

        IERC20 token = IERC20(tokenAddress);
        uint256 totalTransferred = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Transfer amount must be greater than zero");

            totalTransferred += amounts[i];
            require(totalTransferred <= token.balanceOf(msg.sender), "Insufficient token balance");
            require(totalTransferred <= token.allowance(msg.sender, address(this)), "Insufficient allowance");

            bool success = _safeTransferFrom(token, msg.sender, recipients[i], amounts[i]);
            if (success) {
                emit TransferSuccess(msg.sender, recipients[i], amounts[i]);
            } else {
                emit TransferFailed(msg.sender, recipients[i], amounts[i]);
            }
        }
    }

    /**
    * @dev Internal function to safely transfer tokens using transferFrom.
    * @param token The ERC20 token instance.
    * @param sender The address from which tokens are transferred.
    * @param recipient The recipient address.
    * @param amount The amount of tokens to transfer.
    * @return success Whether the transfer succeeded.
    */
    function _safeTransferFrom(IERC20 token, address sender, address recipient, uint256 amount) internal returns (bool success) {
        try token.transferFrom(sender, recipient, amount) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Pause or unpause the contract. Only the owner can call this.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev Set the maximum batch size for transfers. Only the owner can call this.
     * @param _maxBatchSize The new maximum batch size.
     */
    function setMaxBatchSize(uint256 _maxBatchSize) external onlyOwner {
        require(_maxBatchSize > 0, "Invalid batch size");
        maxBatchSize = _maxBatchSize;
    }

    /**
     * @dev Permanently disable the contract by transferring ownership to the burn address.
     * Once called, the contract cannot be used again.
     */
    function disableForever() external onlyOwner {
        emit ContractDisabled(msg.sender);
        transferOwnership(address(0));
    }
}
