// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";            // Standard ERC20 token functionality
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol"; // Adds burn functionality to ERC20
import "@openzeppelin/contracts/access/Ownable.sol";               // Provides ownership control to restrict access to certain functions

// Contract for HAHA Minato Testnet Token with a fixed supply and burn mechanism
contract HAHAMinatoTestnetToken is ERC20, ERC20Burnable, Ownable {
    // Maximum supply cap, set to 100 trillion tokens
    uint256 private immutable _cap = 100_000_000_000_000 * 10 ** decimals();

    // Constructor to initialize token with name, symbol, and initial supply cap
    constructor() ERC20("HAHA Minato Testnet Token", "HAHA") Ownable(msg.sender) {
        _mint(msg.sender, _cap); // Mint entire supply (100 trillion tokens) to the deployer upon contract creation
    }

    /**
     * @dev Returns the maximum supply cap of the token.
     * This cap is set upon deployment and cannot be changed.
     */
    function cap() public view returns (uint256) {
        return _cap;
    }

    /**
     * @dev Returns the total number of tokens burned so far.
     * Calculated as the difference between the initial cap and the current total supply.
     */
    function tokensBurned() public view returns (uint256) {
        return _cap - totalSupply();
    }

    /**
     * @dev Returns the circulating supply of the token.
     * Calculated as the total supply minus tokens held by the deployer.
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() - balanceOf(owner());
    }
}
