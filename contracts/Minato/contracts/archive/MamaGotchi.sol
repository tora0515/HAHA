// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MamaGotchi is ERC721, ERC721Burnable, Ownable {
    uint256 private _nextTokenId;
    uint256 public constant FEED_COOLDOWN = 10 * 60; // 10-minute cooldown for feeding
    uint256 public constant PLAY_COOLDOWN = 15 * 60; // 15-minute cooldown for playing
    uint256 public constant MAX_SLEEP_DURATION = 8 * 60 * 60; // 8 hours in seconds
    uint256 public constant SLEEP_COOLDOWN = 1 * 60 * 60; // 1 hour cooldown in seconds

    uint256 public constant HEALTH_DECAY_RATE = 550; // 5.5 points per hour, scaled to avoid decimals
    uint256 public constant HAPPINESS_DECAY_RATE = 416; // 4.16 points per hour, scaled to avoid decimals

    // Adjustable costs in $HAHA tokens
    uint256 public mintCost;
    uint256 public feedCost;
    uint256 public playCost;

    IERC20 public hahaToken; // Reference to the $HAHA token contract

    // Represents a single MamaGotchi's core attributes and state.
    // Tracks health, happiness, sleep state, and activity timestamps.
    struct Gotchi {
    uint256 health;
    uint256 happiness;
    uint256 deathTimestamp;
    bool isSleeping;
    uint256 sleepStartTime;
    uint256 lastFeedTime;
    uint256 lastPlayTime;
    uint256 lastSleepTime;
}

    mapping(uint256 => Gotchi) public gotchiStats; // Mapping from tokenId to Gotchi stats    

    constructor(address initialOwner, address hahaTokenAddress) 
        ERC721("MamaGotchiMinato", "MGM") 
        Ownable(initialOwner) 
    {
        hahaToken = IERC20(hahaTokenAddress); // Set the $HAHA token contract address
        mintCost = 10_000_000 * 10 ** 18; // Initial mint cost: 100 million $HAHA
        feedCost = 10_000 * 10 ** 18; // Initial feed cost: 10,000 $HAHA
        playCost = 10_000 * 10 ** 18; // Initial play cost: 5,000 $HAHA
    }

    /**
     * @dev Retrieves the metadata URI for a specific MamaGotchi token.
     * Ensures the token exists before returning the URI.
     * @param tokenId The ID of the MamaGotchi for which the URI is being requested.
     * @return The URI pointing to the metadata of the token.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "ERC721Metadata: URI query for nonexistent token");
        return "https://gateway.pinata.cloud/ipfs/QmVVYXaEJrkpCb9KnzAkeAqXBSL6tECjabv5qG4jKdN7Ga";
    }

    /**
     * @dev Overrides the default `_update` function to enforce the soulbound nature of MamaGotchi NFTs.
     * Allows only minting (when `from` is address zero) and burning (when `to` is address zero).
     * Any other transfer attempt is prevented, ensuring MamaGotchi NFTs are permanently bound to their original owner.
     *
     * @param to The address receiving the token (must be address(0) for burning).
     * @param tokenId The ID of the MamaGotchi token.
     * @param auth The address with authorization to execute this function.
     * @return The result of the `super._update` call, preserving compatibility with the overridden behavior.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Prevent any transfer to a non-zero address (only mint and burn are allowed)
        if (from != address(0) && to != address(0)) {
            revert("MamaGotchi's soul is bound to you forever! She cannot be transferred.");
        }

        return super._update(to, tokenId, auth);
    }


    /**
     * @dev Allows the minting of a new MamaGotchi NFT, optionally burning an old one if specified.
     * Requires approval and transfer of $HAHA tokens from the caller to cover the minting cost.
     * Initializes health and happiness of the new MamaGotchi.
     * @param to The address to receive the newly minted MamaGotchi.
     * @param tokenIdToBurn The ID of the MamaGotchi to be burned (set to 0 if not applicable).
     */
    function mintNewGotchi(address to, uint256 tokenIdToBurn) external {
        if (tokenIdToBurn != 0) {
            require(ownerOf(tokenIdToBurn) == msg.sender, "Not your MamaGotchi");
            Gotchi storage gotchi = gotchiStats[tokenIdToBurn];
            require(gotchi.health == 0 && gotchi.happiness == 0, "MamaGotchi still lives! Be a Good Kid and treat her well!");
            _burn(tokenIdToBurn);
        }

        require(hahaToken.allowance(msg.sender, address(this)) >= mintCost, "Approval required for minting");
        require(hahaToken.transferFrom(msg.sender, address(this), mintCost), "Minting requires $HAHA tokens");

        uint256 newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);
        gotchiStats[newTokenId] = Gotchi(80, 80, 0, false, 0, 0, 0,0); // Initialize health, happiness, deathTimestamp, isSleeping, sleepStartTime, lastFeedTime, and lastPlayTime
    }

    
     /**
     * @dev Sets the death timestamp for a MamaGotchi when its health or happiness reaches zero.
     * Can only be called by the contract owner.
     * @param tokenId The ID of the MamaGotchi to set as dead.
     */
    function setDeath(uint256 tokenId) external onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        Gotchi storage gotchi = gotchiStats[tokenId];
        require(gotchi.health == 0 || gotchi.happiness == 0, "MamaGotchi isn't dead! Be a Good Kid and treat her well!");
        gotchi.deathTimestamp = block.timestamp; 
    }

    /**
     * @dev Checks if a MamaGotchi is currently alive, based on health and happiness levels.
     * @param tokenId The ID of the MamaGotchi to check.
     * @return True if the MamaGotchi is alive (health and happiness > 0), otherwise false.
     */
    function isAlive(uint256 tokenId) public view returns (bool) {
        Gotchi memory gotchi = gotchiStats[tokenId];
        return gotchi.health > 0 && gotchi.happiness > 0;
    }

    /**
     * @dev Feeds the MamaGotchi, increasing health by a fixed amount, with a cooldown period.
     * Requires the caller to be the owner of the token and to approve the spending of $HAHA tokens.
     * @param tokenId The ID of the MamaGotchi to feed.
     */
    function feed(uint256 tokenId) external {
        Gotchi storage gotchi = gotchiStats[tokenId];
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(hahaToken.allowance(msg.sender, address(this)) >= feedCost, "Approval required for feeding");
        require(hahaToken.transferFrom(msg.sender, address(this), feedCost), "Feeding requires $HAHA tokens");
        require(block.timestamp >= gotchi.lastFeedTime + FEED_COOLDOWN, "MamaGotchi isn't hungry!");

        gotchiStats[tokenId].health = gotchiStats[tokenId].health + 10 > 100 ? 100 : gotchiStats[tokenId].health + 10;
        gotchi.lastFeedTime = block.timestamp; // Update last feed time
    }

    /**
     * @dev Allows the player to play with their MamaGotchi, increasing happiness with a cooldown period.
     * Requires the caller to be the owner of the token and to approve the spending of $HAHA tokens.
     * @param tokenId The ID of the MamaGotchi to play with.
     */
    function play(uint256 tokenId) external {
        Gotchi storage gotchi = gotchiStats[tokenId];
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(hahaToken.allowance(msg.sender, address(this)) >= playCost, "Approval required for playing");
        require(hahaToken.transferFrom(msg.sender, address(this), playCost), "Playing requires $HAHA tokens");
        require(block.timestamp >= gotchi.lastPlayTime + PLAY_COOLDOWN, "MamaGotchi doesn't want to play now!");
        
        gotchiStats[tokenId].happiness = gotchiStats[tokenId].happiness + 10 > 100 ? 100 : gotchiStats[tokenId].happiness + 10;
        gotchi.lastPlayTime = block.timestamp; // Update last play time
    }

   /**
     * @dev Puts the MamaGotchi to sleep, pausing health and happiness decay.
     * Can only be called by the token owner and if the MamaGotchi is not already sleeping.
     * Enforces a cooldown period of 1 hour between sleep actions, requiring the elapsed time
     * since the last sleep to meet the cooldown duration.
     * Records the time when sleep started and updates the last sleep action timestamp.
     * @param tokenId The ID of the MamaGotchi to put to sleep.
     */

    function sleep(uint256 tokenId) external {
    require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
    require(!gotchiStats[tokenId].isSleeping, "MamaGotchi is already sleeping!");

    // Check if the cooldown period has elapsed
    require(
        block.timestamp >= gotchiStats[tokenId].lastSleepTime + SLEEP_COOLDOWN,
        "MamaGotchi isn't tired now!"
    );

    // Set the sleep state and timestamp
    gotchiStats[tokenId].isSleeping = true;
    gotchiStats[tokenId].sleepStartTime = block.timestamp;
    gotchiStats[tokenId].lastSleepTime = block.timestamp; // Update the lastSleepTime with the current time
}

    /**
     * @dev Wakes the MamaGotchi from sleep, calculating and applying the decay rates for health and happiness.
     * Sleep duration is capped at 8 hours and decay applies only after that period or when the player wakes the pet.
     * @param tokenId The ID of the MamaGotchi to wake.
     */
    function wake(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(gotchiStats[tokenId].isSleeping, "MamaGotchi is already wide awake!");
        uint256 sleepDuration = block.timestamp - gotchiStats[tokenId].sleepStartTime;


        if (sleepDuration > MAX_SLEEP_DURATION) {
            sleepDuration = MAX_SLEEP_DURATION;
        }

        // Call decay functions, passing sleepDuration as duration
        uint256 healthDecay = calculateHealthDecay(sleepDuration);
        uint256 happinessDecay = calculateHappinessDecay(sleepDuration);

        // Apply decay values to health and happiness
        gotchiStats[tokenId].health = gotchiStats[tokenId].health > healthDecay ? 
            gotchiStats[tokenId].health - healthDecay : 0;
        gotchiStats[tokenId].happiness = gotchiStats[tokenId].happiness > happinessDecay ? 
            gotchiStats[tokenId].happiness - happinessDecay : 0;

        // Reset sleep state
        gotchiStats[tokenId].isSleeping = false;
        gotchiStats[tokenId].sleepStartTime = 0;
    }

    /**
     * @dev Updates the mint cost in $HAHA tokens for minting a new MamaGotchi.
     * Can only be called by the contract owner.
     * @param newMintCost The new mint cost in $HAHA tokens.
     */
    function setMintCost(uint256 newMintCost) external onlyOwner {
        mintCost = newMintCost;
    }

    
    /**
     * @dev Updates the feeding cost in $HAHA tokens required to feed a MamaGotchi.
     * Can only be called by the contract owner.
     * @param newFeedCost The new feed cost in $HAHA tokens.
     */
    function setFeedCost(uint256 newFeedCost) external onlyOwner {
        feedCost = newFeedCost;
    }

    /**
     * @dev Updates the play cost in $HAHA tokens required to play with a MamaGotchi.
     * Can only be called by the contract owner.
     * @param newPlayCost The new play cost in $HAHA tokens.
     */
    function setPlayCost(uint256 newPlayCost) external onlyOwner {
        playCost = newPlayCost;
    }

    /**
     * @dev Calculates the health decay based on the time elapsed since last sleep.
     * Takes into account a scaled decay rate for precision.
     * @param duration The duration in seconds for which the decay applies.
     * @return The calculated health decay amount.
     */
    function calculateHealthDecay(uint256 duration) internal pure returns (uint256) {
        // Calculate decay based on the duration and health decay rate
        return (duration * HEALTH_DECAY_RATE) / (3600 * 100); // Converts to 5.5 points per hour
    }

    /**
     * @dev Calculates the happiness decay based on the time elapsed since last sleep.
     * Takes into account a scaled decay rate for precision.
     * @param duration The duration in seconds for which the decay applies.
     * @return The calculated happiness decay amount.
     */
    function calculateHappinessDecay(uint256 duration) internal pure returns (uint256) {
        // Calculate decay based on the duration and happiness decay rate
        return (duration * HAPPINESS_DECAY_RATE) / (3600 * 100); // Converts to 4.16 points per hour
    }

    // Helper function for testing purposes only. Remove before deployment.

    //Test helper function to set health and happiness to zero for a specific Gotchi
    function setHealthAndHappinessForTesting(uint256 tokenId, uint256 health, uint256 happiness) external onlyOwner {
        gotchiStats[tokenId].health = health;
        gotchiStats[tokenId].happiness = happiness;
    }

}