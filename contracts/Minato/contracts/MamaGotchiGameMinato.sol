// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";



contract MamaGotchiGameMinato is ERC721, ERC721Burnable, Ownable, ReentrancyGuard {
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

    mapping(address => uint256) public playerHighScores;

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
   
    /**
    * @dev Sets the initial owner, initializes the $HAHA token contract address, and defines the initial costs for minting, feeding, and playing.
    * @param initialOwner The initial owner of the contract.
    * @param hahaTokenAddress Address of the $HAHA token contract.
    */
    constructor(address initialOwner, address hahaTokenAddress) 
        ERC721("MamaGotchiGameMinato", "MGGM") 
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
        return "https://gateway.pinata.cloud/ipfs/QmbevZWuFi1CyzocTh5H7ouEwfYGTEe7FVAmcVX95mzmvA";
    }

    /**
    * @dev Prevents any transfer of the MamaGotchi token, ensuring it is soulbound.
    * Allows only minting (when `from` is address zero) and burning (when `to` is address zero).
    * @param to The address receiving the token (must be address(0) for burning).
    * @param tokenId The ID of the MamaGotchi token.
    * @param auth The address with authorization to execute this function.
    * @return The address of the new owner (compatible with ERC721).
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
    * @dev Mints a new MamaGotchi NFT for a specified address, burning an existing token if provided.
    * Requires approval for `mintCost` in $HAHA tokens and initializes the Gotchi with default attributes.
    * Emits a GotchiMinted event with the player and token ID details.
    * @param to The address to receive the newly minted MamaGotchi.
    * @param tokenIdToBurn Optional: ID of the MamaGotchi to burn (0 if no token is burned).
    */
    function mintNewGotchi(address to, uint256 tokenIdToBurn) external nonReentrant {
        if (tokenIdToBurn != 0) {
            require(ownerOf(tokenIdToBurn) == msg.sender, "Not your MamaGotchi");
            Gotchi storage gotchi = gotchiStats[tokenIdToBurn];
            require(gotchi.health == 0 && gotchi.happiness == 0, "MamaGotchi still lives! Be a Good Kid and treat her well!");
            _burn(tokenIdToBurn);
        } else {
            require(balanceOf(msg.sender) == 0, "You already own a MamaGotchi! Burn it first to mint a new one.");
        }

        // Separate the allowance check
        require(hahaToken.allowance(msg.sender, address(this)) >= mintCost, "Approval required for minting");
        
        // Burn the tokens directly from the user’s balance
    ERC20Burnable(address(hahaToken)).burnFrom(msg.sender, mintCost);

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
    * @dev Checks if a MamaGotchi's health or happiness has reached zero and updates the Gotchi's `deathTimestamp`.
    * Called within gameplay interactions to mark a Gotchi as deceased if conditions are met.
    * @param tokenId The ID of the MamaGotchi to evaluate.
    */
   function checkAndMarkDeath(uint256 tokenId) internal {
    Gotchi storage gotchi = gotchiStats[tokenId];

    // Skip if already marked as dead
    if (gotchi.deathTimestamp != 0) {
        return;
    }

    // If health or happiness is zero, calculate time up to this death moment
    if (gotchi.health == 0 || gotchi.happiness == 0) {
        uint256 timeUntilDeath = block.timestamp - gotchi.lastInteraction;
        gotchi.timeAlive += timeUntilDeath;  // Accumulate time only up to death moment
        gotchi.deathTimestamp = block.timestamp;  // Mark exact time of death

        emit GotchiDied(ownerOf(tokenId), tokenId);
    }
}


    /**
    * @dev Checks if a MamaGotchi is alive by verifying its health, happiness, and `deathTimestamp`.
    * @param tokenId The ID of the MamaGotchi to check.
    * @return True if the MamaGotchi is alive, false otherwise.
    */
    function isAlive(uint256 tokenId) public view returns (bool) {
        Gotchi memory gotchi = gotchiStats[tokenId];
        return (gotchi.deathTimestamp == 0 && gotchi.health > 0 && gotchi.happiness > 0);
    }
    
    /**
    * @dev Marks a MamaGotchi as deceased by setting its `deathTimestamp`.
    * If `saveOnDeath` is true, saves the player's time alive to the high score.
    * Emits GotchiDied and LeaderboardUpdated events as appropriate.
    * @param tokenId The ID of the MamaGotchi to set as dead.
    * @param saveOnDeath Boolean indicating if the time alive should be saved to the leaderboard.
    */
    function setDeath(uint256 tokenId, bool saveOnDeath) external onlyOwner nonReentrant {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        Gotchi storage gotchi = gotchiStats[tokenId];
        require(gotchi.health == 0 || gotchi.happiness == 0, "MamaGotchi isn't dead! Be a Good Kid and treat her well!");

        gotchi.deathTimestamp = block.timestamp;

        address player = ownerOf(tokenId);
        uint256 timeAliveAtDeath = gotchi.timeAlive + (block.timestamp - gotchi.lastInteraction);

        // Update high score if saveOnDeath is true
        if (saveOnDeath && timeAliveAtDeath > playerHighScores[player]) {
            playerHighScores[player] = timeAliveAtDeath;
            emit LeaderboardUpdated(player, timeAliveAtDeath, "AllTimeHighRound");
        }

        emit GotchiDied(player, tokenId);
    }

    /**
    * @dev Updates the timeAlive counter and resets lastInteraction for a MamaGotchi.
    * Used to track survival time for scoring.
    * @param tokenId The ID of the MamaGotchi.
    */
    function updateTimeAlive(uint256 tokenId) internal {
    Gotchi storage gotchi = gotchiStats[tokenId];

    uint256 decayHealth = 0;
    uint256 decayHappiness = 0;

    // Check if Gotchi is currently asleep
    if (gotchi.isSleeping) {
        uint256 sleepDuration = block.timestamp - gotchi.sleepStartTime;
        
        // If sleepDuration exceeds MAX_SLEEP_DURATION, calculate oversleep decay
        if (sleepDuration > MAX_SLEEP_DURATION) {
            uint256 decayDuration = sleepDuration - MAX_SLEEP_DURATION;
            decayHealth = calculateHealthDecay(decayDuration);
            decayHappiness = calculateHappinessDecay(decayDuration);

            gotchi.health = gotchi.health > decayHealth ? gotchi.health - decayHealth : 0;
            gotchi.happiness = gotchi.happiness > decayHappiness ? gotchi.happiness - decayHappiness : 0;

            // Cap timeAlive at MAX_SLEEP_DURATION + oversleep time
            gotchi.timeAlive += MAX_SLEEP_DURATION + decayDuration;
        } else {
            // Add the full sleep duration to timeAlive if it’s within cap
            gotchi.timeAlive += sleepDuration;
        }

        // Emit decay event for oversleep decay
        emit DecayCalculated(decayHealth, decayHappiness);

        // Reset lastInteraction to block.timestamp, preventing additional decay during sleep
        gotchi.lastInteraction = block.timestamp;
        return;
    }

    // If not sleeping, apply regular decay based on elapsedTime
    uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;
    decayHealth = calculateHealthDecay(elapsedTime);
    decayHappiness = calculateHappinessDecay(elapsedTime);

    gotchi.health = gotchi.health > decayHealth ? gotchi.health - decayHealth : 0;
    gotchi.happiness = gotchi.happiness > decayHappiness ? gotchi.happiness - decayHappiness : 0;

    // Update timeAlive with the elapsed time
    gotchi.timeAlive += elapsedTime;
    gotchi.lastInteraction = block.timestamp;

    // Emit decay event for regular decay
    emit DecayCalculated(decayHealth, decayHappiness);

    // Check for death due to decay
    checkAndMarkDeath(tokenId);
}   
 /**
* @dev Verifies token allowance and burns $HAHA tokens from the player's balance for a specified gameplay action.
* @param amount The amount of $HAHA tokens required.
* @param action Description of the action, used in revert messages.
*/
function requireAndBurnTokens(uint256 amount, string memory action) internal {
    // Check if the sender has given allowance to the contract to burn tokens on their behalf
    require(hahaToken.allowance(msg.sender, address(this)) >= amount, 
        string(abi.encodePacked("Approval required for ", action)));
    
    // Burn tokens directly from the player's balance
    ERC20Burnable(address(hahaToken)).burnFrom(msg.sender, amount);
}



    /**
    * @dev Feeds MamaGotchi, increasing health if cooldown has elapsed.
    * Transfers $HAHA tokens, updates timeAlive, and emits GotchiFed event.
    * @param tokenId The ID of the MamaGotchi being fed.
    */
   function feed(uint256 tokenId) external nonReentrant {
    Gotchi storage gotchi = gotchiStats[tokenId];
    require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
    require(!gotchi.isSleeping, "MamaGotchi is asleep!"); // New check
    require(block.timestamp >= gotchi.lastFeedTime + cooldowns.feed, "MamaGotchi says: I'm full!");

    // Apply idle decay by updating timeAlive first
    updateTimeAlive(tokenId);

    // Check again if the Gotchi is alive after decay
    if (!isAlive(tokenId)) {
        // Mark Gotchi as dead without reverting, so function exits gracefully
        gotchi.deathTimestamp = block.timestamp;
        emit GotchiDied(msg.sender, tokenId); // Emit an event for death
        return; // Exit function early without attempting any further actions
    }

    // Use helper for token transfer
    requireAndBurnTokens(feedCost, "feeding");
    // Apply the feed boost to health
    gotchi.health = gotchi.health + 10 > 100 ? 100 : gotchi.health + 10;
    gotchi.lastFeedTime = block.timestamp;

    emit GotchiFed(msg.sender, tokenId);
}

    /**
    * @dev Allows the player to play with MamaGotchi, increasing happiness if cooldown has elapsed.
    * Transfers $HAHA tokens, updates timeAlive, and emits GotchiPlayed event.
    * @param tokenId The ID of the MamaGotchi to play with.
    */
    function play(uint256 tokenId) external nonReentrant {
    Gotchi storage gotchi = gotchiStats[tokenId];
    require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
    require(!gotchi.isSleeping, "MamaGotchi is asleep!"); // New check
    require(block.timestamp >= gotchi.lastPlayTime + cooldowns.play, "MamaGotchi says: I'm tired now!");

    // Apply idle decay by updating timeAlive first
    updateTimeAlive(tokenId);

    // Check again if the Gotchi is alive after decay
    if (!isAlive(tokenId)) {
        // Mark Gotchi as dead without reverting, allowing graceful exit
        gotchi.deathTimestamp = block.timestamp;
        emit GotchiDied(msg.sender, tokenId); // Emit death event
        return; // Exit function early
    }

    // Use helper for token transfer
    requireAndBurnTokens(playCost, "playing");

    // Apply the play boost to happiness
    gotchi.happiness = gotchi.happiness + 10 > 100 ? 100 : gotchi.happiness + 10;
    gotchi.lastPlayTime = block.timestamp;

    emit GotchiPlayed(msg.sender, tokenId);
}


    /**
    * @dev Puts MamaGotchi to sleep, pausing decay, and setting the sleep state if cooldown has elapsed.
    * Updates timeAlive, sets sleep time, and emits GotchiSleeping event.
    * @param tokenId The ID of the MamaGotchi to put to sleep.
    */
    function sleep(uint256 tokenId) external nonReentrant {
    Gotchi storage gotchi = gotchiStats[tokenId];
    require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
    require(!gotchi.isSleeping, "MamaGotchi says: I'm already in dreamland, shhh!");
    require(block.timestamp >= gotchi.lastSleepTime + cooldowns.sleep, "MamaGotchi says: I'm not sleepy!");

    updateTimeAlive(tokenId); // Update timeAlive and lastInteraction

    // Set the sleep state
    gotchi.isSleeping = true;
    gotchi.sleepStartTime = block.timestamp;
    gotchi.lastSleepTime = block.timestamp; // Always update lastSleepTime on initiating sleep

    emit GotchiSleeping(msg.sender, tokenId, block.timestamp);
}


    /**
    * @dev Wakes MamaGotchi, applying decay to health and happiness based on sleep duration.
    * Caps decay at MAX_SLEEP_DURATION, updates timeAlive, and resets the sleep state.
    * Emits GotchiAwake and DecayCalculated events.
    * @param tokenId The ID of the MamaGotchi to wake up.
    */
    function wake(uint256 tokenId) external nonReentrant {
    require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
    Gotchi storage gotchi = gotchiStats[tokenId];
    require(gotchi.isSleeping, "MamaGotchi says: I'm already awake!");

    // Calculate actual sleep duration
    uint256 sleepDuration = block.timestamp - gotchi.sleepStartTime;

    // Update time and apply oversleep decay if sleep exceeds MAX_SLEEP_DURATION
    updateTimeAlive(tokenId);

    // Reset sleep state
    gotchi.isSleeping = false;
    gotchi.sleepStartTime = 0;

    // Apply cooldown only if the sleep duration was less than the max allowed (8 hours)
    if (sleepDuration < MAX_SLEEP_DURATION) {
        gotchi.lastSleepTime = block.timestamp;
    }

    // Check for death conditions after updating stats
    checkAndMarkDeath(tokenId);

    emit GotchiAwake(msg.sender, tokenId, 0, 0); // Emit wake event
}


   
    /**
    * @dev Manually saves the current timeAlive to the player's high score if it exceeds the previous.
    * Used to update the leaderboard, resetting the lastInteraction timestamp.
    * Emits LeaderboardUpdated event if the score is updated.
    * @param tokenId The ID of the MamaGotchi.
    */
    function manualSaveToLeaderboard(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(isAlive(tokenId), "MamaGotchi isn't alive!");

        // Calculate the current timeAlive but don't update lastInteraction yet
        uint256 currentTimeAlive = gotchiStats[tokenId].timeAlive + (block.timestamp - gotchiStats[tokenId].lastInteraction);

        // Update high score if current timeAlive exceeds the previous high score
        if (currentTimeAlive > playerHighScores[msg.sender]) {
            playerHighScores[msg.sender] = currentTimeAlive;
            gotchiStats[tokenId].lastInteraction = block.timestamp;
            emit LeaderboardUpdated(msg.sender, currentTimeAlive, "AllTimeHighRound");
        }
    }

   /**
    * @dev Updates the minting cost for creating a new MamaGotchi.
    * Can only be called by the contract owner.
    * @param newMintCost The new mint cost in $HAHA tokens.
    */
    function setMintCost(uint256 newMintCost) external onlyOwner {
        mintCost = newMintCost;
        emit CostUpdated("MintCost", newMintCost);
    }

     /**
    * @dev Updates the feeding cost for MamaGotchi.
    * Can only be called by the contract owner.
    * @param newFeedCost The new feed cost in $HAHA tokens.
    */
    function setFeedCost(uint256 newFeedCost) external onlyOwner {
        feedCost = newFeedCost;
        emit CostUpdated("FeedCost", newFeedCost);
    }

    /**
    * @dev Updates the play cost for MamaGotchi.
    * Can only be called by the contract owner.
    * @param newPlayCost The new play cost in $HAHA tokens.
    */
    function setPlayCost(uint256 newPlayCost) external onlyOwner {
        playCost = newPlayCost;
        emit CostUpdated("PlayCost", newPlayCost);
    }

    function checkAllowance() public view returns (bool) {
        return hahaToken.allowance(msg.sender, address(this)) >= mintCost;
    }

    function getHahaTokenAddress() public view returns (address) {
        return address(hahaToken);
    }

    /**
    * @dev Calculates health decay based on time elapsed since last sleep, using HEALTH_DECAY_RATE.
    * @param duration The duration in seconds for which decay applies.
    * @return The calculated health decay amount.
    */
    function calculateHealthDecay(uint256 duration) internal pure returns (uint256) {
        // Calculate decay based on the duration and health decay rate
        return (duration * HEALTH_DECAY_RATE) / (3600 * 100); // Converts to 5.5 points per hour
    }
    
   /**
    * @dev Calculates happiness decay based on time elapsed since last sleep, using HAPPINESS_DECAY_RATE.
    * @param duration The duration in seconds for which decay applies.
    * @return The calculated happiness decay amount.
    */
    function calculateHappinessDecay(uint256 duration) internal pure returns (uint256) {
        // Calculate decay based on the duration and happiness decay rate
        return (duration * HAPPINESS_DECAY_RATE) / (3600 * 100); // Converts to 4.16 points per hour
    }



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

function isTokenOwner(uint256 tokenId, address expectedOwner) external view returns (bool) {
    return ownerOf(tokenId) == expectedOwner;
}

function testCheckAndMarkDeath(uint256 tokenId) external {
    checkAndMarkDeath(tokenId);
}

function setHealthAndHappinessForTesting(uint256 tokenId, uint256 health, uint256 happiness) external onlyOwner {
    gotchiStats[tokenId].health = health;
    gotchiStats[tokenId].happiness = happiness;
}

function testUpdateTimeAlive(uint256 tokenId) external {
    updateTimeAlive(tokenId);
}

}