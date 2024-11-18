// contracts/HAHAMFaucet.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
}

/**
 * @title Faucet
 * @dev A simple faucet contract for distributing Minato testnet HAHA tokens. Allows users to withdraw
 * a pre-defined amount of tokens at specific intervals, while the owner can adjust parameters
 * like lock time and withdrawal amount or replenish the faucet's balance.
 */
contract HAHAFaucetMinato {
    address payable owner;
    IERC20 public token;
    /* 100m withdrawal limit */
    uint256 public withdrawalAmount = 100000000 * (10**18);
    uint256 public lockTime = 60;

    event Withdrawal(address indexed to, uint256 indexed amount);
    event Deposit(address indexed from, uint256 indexed amount);

    mapping(address => uint256) nextAccessTime;

    /**
     * @dev Sets the token address and initializes the owner.
     * @param tokenAddress The address of the ERC20 token this faucet will distribute.
     */
    constructor(address tokenAddress) payable {
        token = IERC20(tokenAddress);
        owner = payable(msg.sender);
    }

    /**
     * @dev Allows a user to request tokens from the faucet.
     * Requirements:
     * - Caller must not be the zero address.
     * - The faucet must have sufficient token balance.
     * - The caller must respect the lock time between withdrawals.
     */
    function requestTokens() public {
        require(
            msg.sender != address(0),
            "Request must not originate from a zero account"
        );
        require(
            token.balanceOf(address(this)) >= withdrawalAmount,
            "Insufficient balance in faucet for withdrawal request"
        );
        require(
            block.timestamp >= nextAccessTime[msg.sender],
            "Insufficient time elapsed since last withdrawal - try again later."
        );

        nextAccessTime[msg.sender] = block.timestamp + lockTime;

        token.transfer(msg.sender, withdrawalAmount);
    }
 
    /**
     * @dev Allows the owner to replenish the faucet balance by sending HAHA.
     * Emits a Deposit event.
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Retrieves the faucet's current token balance.
     * @return The token balance of the faucet.
     */
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Sets the withdrawal amount for the faucet.
     * Only callable by the owner.
     * @param amount The new withdrawal amount in tokens (input in whole numbers).
     */
    function setWithdrawalAmount(uint256 amount) public onlyOwner {
        withdrawalAmount = amount * (10**18);
    }

    /**
     * @dev Sets the lock time between withdrawals.
     * Only callable by the owner.
     * @param amount The new lock time in seconds.
     */
    function setLockTime(uint256 amount) public onlyOwner {
        lockTime = amount;
    }

    /**
     * @dev Allows the owner to withdraw all tokens from the faucet.
     * Emits a Withdrawal event.
     */
    function withdraw() external onlyOwner {
        emit Withdrawal(msg.sender, token.balanceOf(address(this)));
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    // Modifier to restrict access to owner-only functions
    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only the contract owner can call this function"
        );
        _;
    }
}