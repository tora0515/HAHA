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
    uint256 private _nextTokenId = 1;

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

    // Constants for gameplay mechanics
    uint256 public constant MAX_SLEEP_DURATION = 8 * 60 * 60; // 8 hours
    uint256 public constant HEALTH_DECAY_RATE = 550;          // 5.5 points/hour
    uint256 public constant HAPPINESS_DECAY_RATE = 416;       // 4.16 points/hour
    uint256 public constant MAX_HEALTH = 100; // 100 points max health
    uint256 public feedHealthBoost = 10; // Adjustable feed boost for health
    uint256 public constant MAX_HAPPINESS = 100; // 100 points max happiness
    uint256 public playHappinessBoost = 10; // Adjustable play boost for happiness
    
    // Adjustable costs in $HAHA tokens
    uint256 public mintCost;
    uint256 public feedCost;
    uint256 public playCost;

    // Reference to the $HAHA token contract
    IERC20 public hahaToken;

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
    * @dev Contract constructor, sets the initial owner and initializes the $HAHA token contract address.
    * Defines initial costs for minting, feeding, and playing actions.
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
    * @dev Retrieves the metadata URI for a specific MamaGotchi token, ensuring the token exists.
    * @param tokenId The ID of the MamaGotchi for which the URI is requested.
    * @return The URI pointing to the metadata of the token.
    */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "ERC721Metadata: URI query for nonexistent token");
        return "https://gateway.pinata.cloud/ipfs/QmRCaEGi3FB7fWB9KCmtfV8i6RvNRqZXGY7F1KF4jkdTrm";
    }

    /**
    * @dev Prevents any transfer of the MamaGotchi token, enforcing it as soulbound.
    * Allows only minting and burning actions.
    * @param to The address receiving the token (must be address(0) for burning).
    * @param tokenId The ID of the MamaGotchi token.
    * @param auth The authorized address for this action.
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
    * Requires approval for minting cost in $HAHA tokens.
    * Initializes the Gotchi with default attributes and emits GotchiMinted event.
    * @param to The address to receive the newly minted MamaGotchi.
    * @param tokenIdToBurn Optional: ID of the MamaGotchi to burn (0 if no token is burned).
    */
    function mintNewGotchi(address to, uint256 tokenIdToBurn) external nonReentrant {
    // Check if the player owns a Gotchi
    if (balanceOf(msg.sender) > 0) {
         require(tokenIdToBurn != 0, "You already own a MamaGotchi! Burn it first to mint a new one.");
        // Verify ownership of the specified Gotchi and update its time alive
        require(ownerOf(tokenIdToBurn) == msg.sender, "Not your MamaGotchi");

        // Update time alive to ensure the Gotchi’s status is current
        updateTimeAlive(tokenIdToBurn);
        // Check if the Gotchi is dead before allowing the burn
        require(!isAlive(tokenIdToBurn), "MamaGotchi still lives! Be a Good Kid and treat her well!");

        // Burn the Gotchi if dead
        _burn(tokenIdToBurn);
    }

    require(tokenIdToBurn != 0, "You already own a MamaGotchi! Burn it first to mint a new one.");

    // Ensure the player has sufficient $HAHA tokens and has approved the mint cost
    require(hahaToken.balanceOf(msg.sender) >= mintCost, "Insufficient $HAHA balance for minting");
    require(hahaToken.allowance(msg.sender, address(this)) >= mintCost, "Approval required for minting");

    // Burn the required $HAHA tokens from the player's balance
    ERC20Burnable(address(hahaToken)).burnFrom(msg.sender, mintCost);

    // Mint a new Gotchi for the player with initial stats
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
        block.timestamp, // lastInteraction
        0         // timeAlive
    );

    emit GotchiMinted(to, newTokenId);
}


     /**
    * @dev Checks if a MamaGotchi's health or happiness has reached zero and sets its `deathTimestamp`.
    * Marks a Gotchi as deceased if conditions are met.
    * @param tokenId The ID of the MamaGotchi to evaluate for death.
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
    * @dev Determines if a MamaGotchi is alive based on its health, happiness, and `deathTimestamp`.
    * @param tokenId The ID of the MamaGotchi to check.
    * @return True if the MamaGotchi is alive, false otherwise.
    */
    function isAlive(uint256 tokenId) public view returns (bool) {
        Gotchi memory gotchi = gotchiStats[tokenId];
        return (gotchi.deathTimestamp == 0 && gotchi.health > 0 && gotchi.happiness > 0);
    }
    
    /**
    * @dev Marks a MamaGotchi as deceased by setting its `deathTimestamp`.
    * Saves the player's time alive to the high score if `saveOnDeath` is true.
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
    * @dev Updates the `timeAlive` counter and applies health and happiness decay for a MamaGotchi.
    * Decay is based on the duration since the last interaction or sleep start. Adjusts health and
    * happiness accordingly, and if either reaches zero, the Gotchi is marked as dead.
    * If the Gotchi is sleeping, this method applies decay after the maximum sleep duration.
    * @param tokenId The ID of the MamaGotchi.
    */
    function updateTimeAlive(uint256 tokenId) internal {
    Gotchi storage gotchi = gotchiStats[tokenId];

    // Exit early if Gotchi is already dead
    if (gotchi.deathTimestamp != 0) {
        return;
    }

    // Pre-check: if health or happiness is already zero, skip further calculations
    if (gotchi.health == 0 || gotchi.happiness == 0) {
        gotchi.deathTimestamp = block.timestamp;
        emit GotchiDied(ownerOf(tokenId), tokenId);
        return;
    }

    uint256 decayHealth = 0;
    uint256 decayHappiness = 0;

    if (gotchi.isSleeping) {
        // Calculate decay based on duration exceeding MAX_SLEEP_DURATION
        uint256 decayDuration = block.timestamp > gotchi.sleepStartTime + MAX_SLEEP_DURATION
            ? (block.timestamp - gotchi.sleepStartTime) - MAX_SLEEP_DURATION
            : 0;

        // Apply decay if duration exceeded
        if (decayDuration > 0) {
            decayHealth = calculateHealthDecay(decayDuration);
            decayHappiness = calculateHappinessDecay(decayDuration);

            // Adjust health and happiness within capped limits
            gotchi.health = gotchi.health > decayHealth ? gotchi.health - decayHealth : 0;
            gotchi.happiness = gotchi.happiness > decayHappiness ? gotchi.happiness - decayHappiness : 0;

            // Mark death if health or happiness reaches zero
            if (gotchi.health == 0 || gotchi.happiness == 0) {
                uint256 timeUntilDeath = calculateTimeUntilDeath(tokenId);
                gotchi.timeAlive += timeUntilDeath;
                gotchi.deathTimestamp = block.timestamp - (decayDuration - timeUntilDeath);
                emit GotchiDied(ownerOf(tokenId), tokenId);
                return;
            }

            gotchi.timeAlive += decayDuration;
        }

        gotchi.lastInteraction = block.timestamp;
        emit DecayCalculated(decayHealth, decayHappiness);
    } else {
        // Handle regular decay outside of sleep
        uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;
        decayHealth = calculateHealthDecay(elapsedTime);
        decayHappiness = calculateHappinessDecay(elapsedTime);

        gotchi.health = gotchi.health > decayHealth ? gotchi.health - decayHealth : 0;
        gotchi.happiness = gotchi.happiness > decayHappiness ? gotchi.happiness - decayHappiness : 0;

        if (gotchi.health == 0 || gotchi.happiness == 0) {
            uint256 timeUntilDeath = calculateTimeUntilDeath(tokenId);
            gotchi.timeAlive += timeUntilDeath;
            gotchi.deathTimestamp = block.timestamp - (elapsedTime - timeUntilDeath);
            emit GotchiDied(ownerOf(tokenId), tokenId);
            return;
        }

        gotchi.timeAlive += elapsedTime;
        gotchi.lastInteraction = block.timestamp;
    }
}


    /**
    * @dev Verifies the token allowance and burns $HAHA tokens for a specified gameplay action.
    * @param amount The amount of $HAHA tokens required.
    * @param action Description of the action for revert messages.
    */
    function requireAndBurnTokens(uint256 amount, string memory action) internal {
        // Check if the sender has given allowance to the contract to burn tokens on their behalf
        require(hahaToken.allowance(msg.sender, address(this)) >= amount, 
            string(abi.encodePacked("Approval required for ", action)));
        
        // Burn tokens directly from the player's balance
        ERC20Burnable(address(hahaToken)).burnFrom(msg.sender, amount);
    }

    /**
    * @dev Feeds a MamaGotchi, increasing its health if cooldown has elapsed and it is not asleep.
    * Deducts $HAHA tokens, updates `timeAlive`, and emits GotchiFed event.
    * @param tokenId The ID of the MamaGotchi being fed.
    */
    function feed(uint256 tokenId) external nonReentrant {
    Gotchi storage gotchi = gotchiStats[tokenId];

    // Initial validation checks
    require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
    require(isAlive(tokenId), "MamaGotchi is dead!"); // Ensure the Gotchi is initially alive
    require(!gotchi.isSleeping, "MamaGotchi is asleep!");

    require(block.timestamp >= gotchi.lastFeedTime + cooldowns.feed, "MamaGotchi says: I'm full!");

    // Update timeAlive and apply any decay
    updateTimeAlive(tokenId);

    // Post-decay validation check
    require(isAlive(tokenId), "MamaGotchi is dead!");

    // Burn tokens only after confirming Gotchi is alive post-decay
    requireAndBurnTokens(feedCost, "feeding");

    // Apply health boost and update feed time
    gotchi.health = gotchi.health + feedHealthBoost > MAX_HEALTH ? MAX_HEALTH : gotchi.health + feedHealthBoost;
    gotchi.lastFeedTime = block.timestamp;
    
    emit GotchiFed(msg.sender, tokenId);
}



    /**
    * @dev Plays with a MamaGotchi, increasing its happiness if cooldown has elapsed and it is not asleep.
    * Deducts $HAHA tokens, updates `timeAlive`, and emits GotchiPlayed event.
    * @param tokenId The ID of the MamaGotchi to play with.
    */
    function play(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];

        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(isAlive(tokenId), "MamaGotchi is dead!"); // Ensure the Gotchi is alive
        require(!gotchi.isSleeping, "MamaGotchi is asleep!");
        require(block.timestamp >= gotchi.lastPlayTime + cooldowns.play, "MamaGotchi says: I'm tired now!");

       
         // Update timeAlive and apply any decay
    updateTimeAlive(tokenId);

    // Post-decay validation check
    require(isAlive(tokenId), "MamaGotchi is dead!");

             // Burn tokens first if all checks pass
        requireAndBurnTokens(playCost, "playing");

            // Apply the play boost to happiness
            gotchi.happiness = gotchi.happiness + playHappinessBoost > MAX_HAPPINESS ? MAX_HAPPINESS : gotchi.happiness + playHappinessBoost;
            gotchi.lastPlayTime = block.timestamp;
    

        emit GotchiPlayed(msg.sender, tokenId);
    }

     /**
    * @dev Puts a MamaGotchi to sleep, pausing decay, if cooldown has elapsed and it is not already sleeping.
    * This method applies a cooldown period after which sleep can be initiated again, and sets the sleep state,
    * starting time, and other necessary flags.
    * @param tokenId The ID of the MamaGotchi to put to sleep.
    */
    function sleep(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];

        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(isAlive(tokenId), "MamaGotchi is dead!");
        require(block.timestamp >= gotchi.lastSleepTime + cooldowns.sleep, "MamaGotchi says: I'm not sleepy!");
        require(!gotchi.isSleeping, "MamaGotchi says: I'm already in dreamland, shhh!");
        

        updateTimeAlive(tokenId); // Update timeAlive and lastInteraction

        require(isAlive(tokenId), "MamaGotchi is dead!");

        // Set the sleep state
        gotchi.isSleeping = true;
        gotchi.sleepStartTime = block.timestamp;
        gotchi.lastSleepTime = block.timestamp; // Always update lastSleepTime on initiating sleep


        emit GotchiSleeping(msg.sender, tokenId, block.timestamp);
    }

    /**
    * @dev Wakes a MamaGotchi, checking if it survived the sleep period based on health and happiness decay.
    * If death occurs during sleep, sets death timestamp and marks as no longer sleeping. If the Gotchi survives,
    * simply updates its awake state. This method does not have a cooldown, allowing users to wake a Gotchi
    * from sleep at any time.
    * @param tokenId The ID of the MamaGotchi to wake up.
    */
    function wake(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(gotchi.isSleeping, "MamaGotchi says: I'm already awake!");

        // Apply time decay up to this moment
        updateTimeAlive(tokenId);

        // Check if Gotchi died during sleep after applying decay
        if (gotchi.health == 0 || gotchi.happiness == 0) {
            gotchi.isSleeping = false; // Reset sleep state
            gotchi.deathTimestamp = block.timestamp; // Mark death timestamp
            emit GotchiDied(ownerOf(tokenId), tokenId);
            return;
        }

        // Reset the sleep state
        gotchi.isSleeping = false;
        gotchi.sleepStartTime = 0;

        emit GotchiAwake(msg.sender, tokenId, 0, 0); // Emit wake event
    }
   
     /**
    * @dev Manually saves the current `timeAlive` to the player's high score if it exceeds the previous score.
    * Updates the leaderboard and resets `lastInteraction` timestamp.
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
    * @dev Sets a new minting cost for creating a MamaGotchi.
    * Only callable by the contract owner.
    * @param newMintCost The new mint cost in $HAHA tokens.
    */
    function setMintCost(uint256 newMintCost) external onlyOwner {
        mintCost = newMintCost;
        emit CostUpdated("MintCost", newMintCost);
    }

    /**
    * @dev Updates the feeding cost for a MamaGotchi.
    * Only callable by the contract owner.
    * @param newFeedCost The new feeding cost in $HAHA tokens.
    */
    function setFeedCost(uint256 newFeedCost) external onlyOwner {
        feedCost = newFeedCost;
        emit CostUpdated("FeedCost", newFeedCost);
    }

    /**
    * @dev Updates the play cost for a MamaGotchi.
    * Only callable by the contract owner.
    * @param newPlayCost The new play cost in $HAHA tokens.
    */
    function setPlayCost(uint256 newPlayCost) external onlyOwner {
        playCost = newPlayCost;
        emit CostUpdated("PlayCost", newPlayCost);
    }

    /**
    * @dev Sets the health boost value for feeding a Gotchi.
    * Can only be called by the contract owner.
    * @param newFeedHealthBoost The new health boost value for feeding.
    */
    function setFeedHealthBoost(uint256 newFeedHealthBoost) external onlyOwner {
        feedHealthBoost = newFeedHealthBoost;
    }

    /**
    * @dev Sets the happiness boost value for playing with a Gotchi.
    * Can only be called by the contract owner.
    * @param newPlayHappinessBoost The new happiness boost value for playing.
    */
    function setPlayHappinessBoost(uint256 newPlayHappinessBoost) external onlyOwner {
        playHappinessBoost = newPlayHappinessBoost;
    }

    /**
    * @dev Checks if the caller has sufficient allowance to mint a MamaGotchi.
    * @return True if allowance is sufficient, false otherwise.
    */
    function checkAllowance() public view returns (bool) {
        return hahaToken.allowance(msg.sender, address(this)) >= mintCost;
    }

    /**
    * @dev Returns the address of the $HAHA token contract.
    * @return The $HAHA token contract address.
    */
    function getHahaTokenAddress() public view returns (address) {
        return address(hahaToken);
    }

    /**
    * @dev Calculates the health decay over a specified duration using the defined `HEALTH_DECAY_RATE`.
    * This function converts the duration into decay points and applies it based on the rate.
    * @param duration The duration in seconds over which decay is calculated.
    * @return The calculated health decay amount.
    */
    function calculateHealthDecay(uint256 duration) internal pure returns (uint256) {
        // Calculate decay based on the duration and health decay rate
        return (duration * HEALTH_DECAY_RATE) / (3600 * 100); // Converts to 5.5 points per hour
    }
    
    /**
    * @dev Calculates the happiness decay over a specified duration using the defined `HAPPINESS_DECAY_RATE`.
    * This function converts the duration into decay points and applies it based on the rate.
    * @param duration The duration in seconds over which decay is calculated.
    * @return The calculated happiness decay amount.
    */
    function calculateHappinessDecay(uint256 duration) internal pure returns (uint256) {
        // Calculate decay based on the duration and happiness decay rate
        return (duration * HAPPINESS_DECAY_RATE) / (3600 * 100); // Converts to 4.16 points per hour
    }

    /**
    * @dev Calculates the time remaining until a MamaGotchi’s health or happiness reaches zero based on decay rates.
    * Returns the shorter of the two times calculated for health and happiness, as death occurs when either reaches zero.
    * @param tokenId The ID of the MamaGotchi to calculate time until death.
    * @return The estimated time in seconds until death occurs.
    */
     function calculateTimeUntilDeath(uint256 tokenId) internal view returns (uint256) {
        Gotchi storage gotchi = gotchiStats[tokenId];
        
        // Calculate time until health or happiness reaches zero based on hourly decay rates
        uint256 healthDecayTime = (gotchi.health * 3600 * 100) / HEALTH_DECAY_RATE;
    // Time in seconds until health reaches zero
        uint256 happinessDecayTime = (gotchi.happiness * 3600 * 100) / HAPPINESS_DECAY_RATE;
    // Time in seconds until happiness reaches zero

        // Return the lesser of the two times to determine when death occurs
        return healthDecayTime < happinessDecayTime ? healthDecayTime : happinessDecayTime;
    }
}