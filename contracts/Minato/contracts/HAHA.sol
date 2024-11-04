// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Contract for HAHA Minato Testnet Token with a fixed supply and burn mechanism
contract HAHAMinatoTestnetToken is ERC20, ERC20Burnable, Ownable {
    // Maximum supply cap, set to 100 trillion tokens
    uint256 private immutable _cap = 100_000_000_000_000 * 10 ** decimals();

    // Constructor to initialize token with name, symbol, and initial supply cap
    constructor() ERC20("HAHA Minato Testnet Token", "HAHA") Ownable(msg.sender) {
        _mint(msg.sender, _cap);
    }

    /**
     * @dev Returns the maximum supply cap of the token.
     * This cap is set upon deployment and cannot be changed.
     * @return uint256 The total cap of HAHA tokens.
     */
    function cap() public view returns (uint256) {
        return _cap;
    }

     /**
     * @dev Returns the total number of tokens burned so far.
     * Calculated as the difference between the initial cap and the current total supply.
     * @return uint256 The total number of HAHA tokens burned.
     */
    function tokensBurned() public view returns (uint256) {
        return _cap - totalSupply();
    }

     /**
     * @dev Returns the circulating supply of the token.
     * Calculated as the total supply minus tokens held by the deployer.
     * This function provides insight into the number of tokens actively in circulation.
     * @return uint256 The circulating supply of HAHA tokens.
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() - balanceOf(owner());
    }

    /**
     * @dev Returns the current balance of tokens held by the contract's owner (deployer).
     * This function allows transparency of the owner’s token holdings.
     * @return uint256 The number of HAHA tokens held by the owner.
     */
        function ownerBalance() public view returns (uint256) {
        return balanceOf(owner());
    }
}
