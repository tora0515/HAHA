// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract MamaGotchiGame is ERC721, ERC721Burnable, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;

    // Cooldown durations in seconds
    struct GotchiCooldowns {
        uint256 feed;
        uint256 play;
        uint256 sleep;
    }

    GotchiCooldowns public cooldowns = GotchiCooldowns({
        feed: 10 * 60,     // 10-minute cooldown for feeding
        play: 15 * 60,     // 15-minute cooldown for playing
        sleep: 1 * 60 * 60 // 1-hour cooldown for sleep
    });

    // Constants for gameplay mechanics (remain fixed)
    uint256 public constant MAX_SLEEP_DURATION = 8 * 60 * 60; // 8 hours
    uint256 public constant HEALTH_DECAY_RATE = 550;          // 5.5 points/hour
    uint256 public constant HAPPINESS_DECAY_RATE = 416;       // 4.16 points/hour

    // Adjustable costs in $HAHA tokens
    uint256 public mintCost;
    uint256 public feedCost;
    uint256 public playCost;

    IERC20 public hahaToken; // Reference to the $HAHA token contract

    LeaderboardEntry[10] public topAllTimeHighRound; // Top 10 for all-time high round scores

    mapping(uint256 => Gotchi) public gotchiStats;

    // Represents a single MamaGotchi's core attributes and state
    struct Gotchi {
        uint256 health;
        uint256 happiness;
        uint256 deathTimestamp;
        bool isSleeping;
        uint256 sleepStartTime;
        uint256 lastFeedTime;
        uint256 lastPlayTime;
        uint256 lastSleepTime;
        uint256 lastInteraction;
        uint256 timeAlive; 
    }

    // Leaderboard Struct
    struct LeaderboardEntry {
        address player;
        uint256 score;
    }

    // Event definitions
    event GotchiMinted(address indexed player, uint256 tokenId);
    event GotchiFed(address indexed player, uint256 tokenId);
    event GotchiPlayed(address indexed player, uint256 tokenId);
    event GotchiSleeping(address indexed player, uint256 tokenId, uint256 sleepStartTime);
    event GotchiAwake(address indexed player, uint256 tokenId, uint256 healthDecay, uint256 happinessDecay);
    event GotchiDied(address indexed player, uint256 tokenId);
    event LeaderboardUpdated(address indexed player, uint256 newScore, string leaderboardType);
    event CostUpdated(string costType, uint256 newValue);
    event DecayCalculated(uint256 healthDecay, uint256 happinessDecay);


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
    * @dev Mints a new MamaGotchi NFT for the specified address. Optionally burns an old token if provided.
    * Requires the caller to have approved the contract to transfer the `mintCost` in $HAHA tokens.
    * Initializes new Gotchi with default health and happiness.
    * Awards points for minting and updates the player's high score if applicable.
    * Emits a GotchiMinted event with details of the new token and awarded points.
    *
    * Requirements:
    * - `tokenIdToBurn` must be owned by the caller (if provided) and must be deceased (health and happiness at zero).
    * - The caller must approve the transfer of `mintCost` in $HAHA tokens.
    * - The recipient address `to` must not be the zero address.
    *
    * @param to The address to receive the newly minted MamaGotchi.
    * @param tokenIdToBurn (Optional) The ID of the MamaGotchi to burn (0 if no token is burned).
    */
    function mintNewGotchi(address to, uint256 tokenIdToBurn) external nonReentrant {
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
        gotchiStats[newTokenId] = Gotchi(
            80,       // health
            80,       // happiness
            0,        // deathTimestamp
            false,    // isSleeping
            0,        // sleepStartTime
            0,        // lastFeedTime
            0,        // lastPlayTime
            0,        // lastSleepTime
            block.timestamp, // lastInteraction, start tracking time alive
            0         // timeAlive starts at 0
        );

        emit GotchiMinted(to, newTokenId);
    }

    /**
    * @dev Checks if a given MamaGotchi's health or happiness has reached zero.
    * If either is zero, the function updates the Gotchi's `deathTimestamp`.
    * This function is called internally within gameplay interactions (e.g., `feed`, `play`, `wake`) to
    * automatically mark a Gotchi as deceased when necessary.
    *
    * @param tokenId The ID of the MamaGotchi to evaluate.
    */
    function checkAndMarkDeath(uint256 tokenId) internal {
        Gotchi storage gotchi = gotchiStats[tokenId];
        if (gotchi.health == 0 || gotchi.happiness == 0) {
            gotchi.deathTimestamp = block.timestamp;
        }
    }

    /**
    * @dev Checks if a MamaGotchi is alive based on health, happiness, and `deathTimestamp`.
    * Returns `true` if both health and happiness are greater than zero, and `deathTimestamp` is unset.
    * Used in gameplay functions to ensure interactions are only possible with living Gotchis.
    *
    * @param tokenId The ID of the MamaGotchi to check.
    * @return True if the MamaGotchi is alive, false otherwise.
    */
    function isAlive(uint256 tokenId) public view returns (bool) {
        Gotchi memory gotchi = gotchiStats[tokenId];
        return (gotchi.deathTimestamp == 0 && gotchi.health > 0 && gotchi.happiness > 0);
    }
    
    /**
    * @dev Marks a MamaGotchi as deceased by setting its `deathTimestamp`.
    * Applies point penalties, updates the player’s leaderboard standings, and resets the round points.
    * Only callable by the contract owner, typically during administrative checks or game resets.
    * Emits a GotchiDied event if the Gotchi is marked as dead.
    *
    * Requirements:
    * - Gotchi’s health or happiness must be zero.
    * - Caller must be the contract owner.
    *
    * @param tokenId The ID of the MamaGotchi to set as dead.
    */
    function setDeath(uint256 tokenId) external onlyOwner nonReentrant {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        Gotchi storage gotchi = gotchiStats[tokenId];
        require(gotchi.health == 0 || gotchi.happiness == 0, "MamaGotchi isn't dead! Be a Good Kid and treat her well!");

        gotchi.deathTimestamp = block.timestamp;

        address player = ownerOf(tokenId);

         // Calculate timeAlive and update the leaderboard based on time alive instead of points
        uint256 timeAlive = block.timestamp - gotchi.lastInteraction;
        updateLeaderboard(topAllTimeHighRound, player, timeAlive, "AllTimeHighRound");

        emit GotchiDied(player, tokenId);
}


    /**
    * @dev Feeds MamaGotchi, increasing its health by a fixed amount. Requires cooldown period
    * to have elapsed since the last feeding. Only the token owner can initiate feeding.
    * Emits a GotchiFed event with feeding points.
    *
    * Requirements:
    * - Caller must be the owner of the token.
    * - Token must be approved for feeding cost in $HAHA.
    * - Cooldown must have elapsed since the last feed.
    *
    * @param tokenId The ID of the MamaGotchi being fed.
    */
    function feed(uint256 tokenId) external nonReentrant {
        require(isAlive(tokenId), "MamaGotchi isn't alive!");
        checkAndMarkDeath(tokenId);

        Gotchi storage gotchi = gotchiStats[tokenId];
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(hahaToken.allowance(msg.sender, address(this)) >= feedCost, "Approval required for feeding");
        require(hahaToken.transferFrom(msg.sender, address(this), feedCost), "Feeding requires $HAHA tokens");
        require(block.timestamp >= gotchi.lastFeedTime + cooldowns.feed, "MamaGotchi says: I'm full!");

        // Update timeAlive by calculating time since the last interaction
        uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;
        gotchi.timeAlive += elapsedTime;

        // Update lastInteraction to the current time
        gotchi.lastInteraction = block.timestamp;

        // Health boost for feeding
        gotchi.health = gotchi.health + 10 > 100 ? 100 : gotchi.health + 10;
        gotchi.lastFeedTime = block.timestamp;

        emit GotchiFed(msg.sender, tokenId);
    }

    /**
    * @dev Allows the player to play with their MamaGotchi, increasing happiness.
    * Requires approval for spending $HAHA tokens and enforces a cooldown period.
    * Awards Gotchi points and updates the player’s high score if the round score exceeds it.
    * Emits GotchiPlayed event with playing points.
    *
    * Requirements:
    * - Caller must be the owner of the token.
    * - Gotchi must be alive.
    * - Cooldown must have elapsed since the last play.
    * - Caller must approve the transfer of `playCost` in $HAHA tokens.
    *
    * @param tokenId The ID of the MamaGotchi to play with.
    */
    function play(uint256 tokenId) external nonReentrant {
        require(isAlive(tokenId), "MamaGotchi isn't alive!");
        checkAndMarkDeath(tokenId);

        Gotchi storage gotchi = gotchiStats[tokenId];
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(hahaToken.allowance(msg.sender, address(this)) >= playCost, "Approval required for playing");
        require(hahaToken.transferFrom(msg.sender, address(this), playCost), "Playing requires $HAHA tokens");
        require(block.timestamp >= gotchi.lastPlayTime + cooldowns.play, "MamaGotchi says: I'm tired now!");

        // Update timeAlive
        uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;
        gotchi.timeAlive += elapsedTime;
        gotchi.lastInteraction = block.timestamp;

        // Increase happiness and update play timestamp
        gotchi.happiness = gotchi.happiness + 10 > 100 ? 100 : gotchi.happiness + 10;
        gotchi.lastPlayTime = block.timestamp;

        emit GotchiPlayed(msg.sender, tokenId);
    }

    /**
    * @dev Puts the MamaGotchi to sleep, pausing health and happiness decay.
    * Requires the token owner to initiate and enforces a cooldown between sleep actions.
    * Records the start time and resets the cooldown timer.
    * Emits GotchiSleeping event with the start time.
    *
    * Requirements:
    * - Caller must be the token owner.
    * - Gotchi must not already be sleeping.
    * - Cooldown must have elapsed since the last sleep.
    *
    * @param tokenId The ID of the MamaGotchi to put to sleep.
    */
    function sleep(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(!gotchiStats[tokenId].isSleeping, "MamaGotchi says: I'm already in dreamland, shhh!");
        require(block.timestamp >= gotchiStats[tokenId].lastSleepTime + cooldowns.sleep, "MamaGotchi says: I'm not sleepy!");

        Gotchi storage gotchi = gotchiStats[tokenId];

        // Update timeAlive
        uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;
        gotchi.timeAlive += elapsedTime;
        gotchi.lastInteraction = block.timestamp;

        // Set the sleep state
        gotchi.isSleeping = true;
        gotchi.sleepStartTime = block.timestamp;
        gotchi.lastSleepTime = block.timestamp;

        emit GotchiSleeping(msg.sender, tokenId, block.timestamp);
    }

    /**
    * @dev Wakes the MamaGotchi, applying accumulated decay to health and happiness.
    * Caps decay at `MAX_SLEEP_DURATION` and resets the sleep state.
    * Uses `checkAndMarkDeath` to update Gotchi's status if health or happiness falls to zero.
    * Emits GotchiAwake and DecayCalculated events.
    *
    * Requirements:
    * - Caller must be the token owner.
    * - Gotchi must be in a sleeping state.
    *
    * @param tokenId The ID of the MamaGotchi to wake up.
    */
    function wake(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(gotchiStats[tokenId].isSleeping, "MamaGotchi says: I'm already awake!");

        Gotchi storage gotchi = gotchiStats[tokenId];

        uint256 sleepDuration = block.timestamp - gotchi.sleepStartTime;
        if (sleepDuration > MAX_SLEEP_DURATION) {
            sleepDuration = MAX_SLEEP_DURATION;
        }

        // Calculate decay due to sleeping
        uint256 healthDecay = calculateHealthDecay(sleepDuration);
        uint256 happinessDecay = calculateHappinessDecay(sleepDuration);
        gotchi.health = gotchi.health > healthDecay ? gotchi.health - healthDecay : 0;
        gotchi.happiness = gotchi.happiness > happinessDecay ? gotchi.happiness - happinessDecay : 0;

        // Update timeAlive
        uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;
        gotchi.timeAlive += elapsedTime;
        gotchi.lastInteraction = block.timestamp;

        // Reset sleep state and check if Gotchi is dead
        gotchi.isSleeping = false;
        gotchi.sleepStartTime = 0;
        checkAndMarkDeath(tokenId);

        emit DecayCalculated(healthDecay, happinessDecay);
        emit GotchiAwake(msg.sender, tokenId, healthDecay, happinessDecay);
    }

    /**
    * @dev Updates a leaderboard with a player's score if it qualifies for the top 10.
    * Compares the score against the current lowest score on the leaderboard.
    * Replaces the lowest score if the new score qualifies, then re-sorts the leaderboard.
    * Emits LeaderboardUpdated event with the player's updated score and leaderboard type.
    *
    * Requirements:
    * - `score` must be non-zero.
    *
    * @param leaderboard The leaderboard array (either topAllTimeHighRound or topCumulativePoints).
    * @param player The address of the player whose score is being considered.
    * @param score The player's score for the given leaderboard.
    * @param leaderboardType A string identifier for the leaderboard type.
    */
    function updateLeaderboard(
        LeaderboardEntry[10] storage leaderboard,
        address player,
        uint256 score,
        string memory leaderboardType
    ) internal {
        // Ensure that only scores greater than the lowest score (leaderboard[9]) are added
        if (score <= leaderboard[9].score) {
            return;
        }

        // Insert the new score in place of the lowest one
        leaderboard[9] = LeaderboardEntry(player, score);

        // Sort leaderboard to maintain descending order by score
        sortLeaderboard(leaderboard);

        // Emit the LeaderboardUpdated event with leaderboard type
        emit LeaderboardUpdated(player, score, leaderboardType);
    }

    /**
    * @dev Sorts a given leaderboard array in descending order by score.
    * Implements bubble sort for simplicity, which is efficient given the fixed length of 10 entries.
    * Swaps entries in place, ensuring the highest scores appear at the top.
    *
    * @param leaderboard The leaderboard array to sort.
    */
    function sortLeaderboard(LeaderboardEntry[10] storage leaderboard) internal {
        for (uint256 i = 0; i < leaderboard.length - 1; i++) {
            for (uint256 j = 0; j < leaderboard.length - 1 - i; j++) {
                // Compare scores for descending order
                if (leaderboard[j].score < leaderboard[j + 1].score) {
                    // Swap using intermediate memory variables to avoid direct storage-to-storage assignment
                    LeaderboardEntry memory tempEntry = leaderboard[j];
                    leaderboard[j] = leaderboard[j + 1];
                    leaderboard[j + 1] = tempEntry;
                }
            }
        }
    }

    /**
     * @dev Updates the mint cost in $HAHA tokens for minting a new MamaGotchi.
     * Can only be called by the contract owner.
     * @param newMintCost The new mint cost in $HAHA tokens.
     */
    function setMintCost(uint256 newMintCost) external onlyOwner {
        mintCost = newMintCost;
        emit CostUpdated("MintCost", newMintCost);
    }

     /** @dev Updates the feeding cost in $HAHA tokens required to feed a MamaGotchi.
     * Can only be called by the contract owner.
     * @param newFeedCost The new feed cost in $HAHA tokens.
     */
    function setFeedCost(uint256 newFeedCost) external onlyOwner {
        feedCost = newFeedCost;
        emit CostUpdated("FeedCost", newFeedCost);
    }

    /**
     * @dev Updates the play cost in $HAHA tokens required to play with a MamaGotchi.
     * Can only be called by the contract owner.
     * @param newPlayCost The new play cost in $HAHA tokens.
     */
    function setPlayCost(uint256 newPlayCost) external onlyOwner {
        playCost = newPlayCost;
        emit CostUpdated("PlayCost", newPlayCost);
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

    /**
    * @dev Returns the top entries in the All-Time High Round leaderboard.
    * @return LeaderboardEntry[] The array of top 10 leaderboard entries.
    */
    function getTopAllTimeHighRoundLeaderboard() external view returns (LeaderboardEntry[10] memory) {
        return topAllTimeHighRound;
    }

//###########################################################################
//###########################################################################

// Helper functions to retrieve each cooldown duration as a uint256
function getFeedCooldown() external view returns (uint256) {
    return cooldowns.feed;
}

function getPlayCooldown() external view returns (uint256) {
    return cooldowns.play;
}

function getSleepCooldown() external view returns (uint256) {
    return cooldowns.sleep;
}

function getCooldownTime(string memory action) external view returns (uint256) {
    if (keccak256(bytes(action)) == keccak256(bytes("play"))) {
        return cooldowns.play;
    } else if (keccak256(bytes(action)) == keccak256(bytes("feed"))) {
        return cooldowns.feed;
    } else if (keccak256(bytes(action)) == keccak256(bytes("sleep"))) {
        return cooldowns.sleep;
    } else {
        revert("Invalid action");
    }
}

function isActionReady(string memory action, uint256 tokenId) external view returns (bool) {
    Gotchi storage gotchi = gotchiStats[tokenId];
    
    if (keccak256(bytes(action)) == keccak256(bytes("play"))) {
        return block.timestamp >= gotchi.lastPlayTime + cooldowns.play;
    } else if (keccak256(bytes(action)) == keccak256(bytes("feed"))) {
        return block.timestamp >= gotchi.lastFeedTime + cooldowns.feed;
    } else if (keccak256(bytes(action)) == keccak256(bytes("sleep"))) {
        return block.timestamp >= gotchi.lastSleepTime + cooldowns.sleep;
    } else {
        revert("Invalid action");
    }
}














////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////


   // Helper function to set health and happiness for testing purposes
function setHealthAndHappinessForTesting(uint256 tokenId, uint256 health, uint256 happiness) external onlyOwner {
    gotchiStats[tokenId].health = health;
    gotchiStats[tokenId].happiness = happiness;
}

// Helper function to directly update the leaderboard for testing
function testUpdateLeaderboard(address player, uint256 score) external onlyOwner {
    updateLeaderboard(topAllTimeHighRound, player, score, "AllTimeHighRound");
}


}