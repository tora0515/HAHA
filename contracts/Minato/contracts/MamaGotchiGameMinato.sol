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
        uint256 save;
    }

    GotchiCooldowns public cooldowns = GotchiCooldowns({
        feed: 10 * 60,     // 10-minute cooldown for feeding
        play: 15 * 60,     // 15-minute cooldown for playing
        sleep: 1 * 60 * 60, // 1-hour cooldown for sleep
        save: 10 // 10-second cooldown for saving scores
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
    uint256 public sleepCost;

    // Reference to the $HAHA token contract
    IERC20 public hahaToken;

    mapping(address => uint256) public ownerToTokenId;
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
        uint256 lastSaveTime;
    }

    // Leaderboard Struct
    struct LeaderboardEntry {
        address player;
        uint256 score;
    }

    // Event definitions
    event FreshMintInitiated(address indexed player, uint256 tokenIdToBurn);
    event GotchiBurned(address indexed player, uint256 tokenId);
    event InsufficientHAHA(address indexed player, uint256 requiredAmount, uint256 currentBalance);
    event BurnApprovalRequired(address indexed player, uint256 requiredAmount, uint256 currentAllowance);
    event GotchiMinted(address indexed player, uint256 indexed tokenId, uint256 health, uint256 happiness, uint256 timeAlive);
    event GotchiFed(address indexed player, uint256 tokenId, uint256 newHealth, uint256 newHappiness, uint256 newTimeAlive);
    event GotchiPlayed(address indexed player, uint256 tokenId, uint256 newHealth, uint256 newHappiness, uint256 newTimeAlive);    
    event GotchiSleeping(address indexed player, uint256 tokenId, uint256 sleepStartTime, uint256 health, uint256 happiness, uint256 timeAlive);
    event GotchiAwake(address indexed player, uint256 tokenId, uint256 health, uint256 happiness, uint256 timeAlive, uint256 wakeTimestamp);
    event GotchiDied(address indexed player, uint256 tokenId);
    event LeaderboardUpdated(address indexed player, uint256 newScore, string leaderboardType);
    event GotchiStatus(address indexed player, uint256 tokenId, string status, uint256 timeAlive, uint256 health, uint256 happiness);    
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
        sleepCost = 25_000 * 10 ** 18; // Initial sleep cost: 25,0000 $HAHA
    }

    /**
    * @dev Returns the metadata URI for a specific MamaGotchi token.
    * Ensures the token exists by checking its ownership.
    * @param tokenId The ID of the MamaGotchi for which metadata is requested.
    * @return The URI pointing to the metadata of the token.
    */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "ERC721Metadata: URI query for nonexistent token");
        return "https://gateway.pinata.cloud/ipfs/QmRCaEGi3FB7fWB9KCmtfV8i6RvNRqZXGY7F1KF4jkdTrm";
    }

    /**
    * @dev Internal function to prevent transfers of MamaGotchi tokens, enforcing their soulbound nature.
    * Allows minting and burning only.
    * @param to The address receiving the token (must be address(0) for burning).
    * @param tokenId The ID of the token.
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
    * @dev Mints a new MamaGotchi for a player, optionally burning an existing one.
    * Requires the player to have sufficient $HAHA tokens approved for the mint cost.
    * @param to The address to receive the new MamaGotchi.
    * @param tokenIdToBurn Optional: ID of the MamaGotchi to burn.
    */
    function mintNewGotchi(address to, uint256 tokenIdToBurn) external nonReentrant {
        // Check if the player owns a Gotchi
        if (balanceOf(msg.sender) > 0) {
            require(tokenIdToBurn != 0, "You already own a MamaGotchi! Burn it first to mint a new one.");
            require(ownerOf(tokenIdToBurn) == msg.sender, "Not your MamaGotchi");
            emit FreshMintInitiated(msg.sender, tokenIdToBurn);

            // Update status and ensure Gotchi is dead before burning
            updateTimeAlive(tokenIdToBurn);
            require(!isAlive(tokenIdToBurn), "MamaGotchi still lives! Be a Good Kid and treat her well!");

            // Save to leaderboard before burning
        _saveToLeaderboard(tokenIdToBurn);

            _burn(tokenIdToBurn);

             // Clear the owner-to-token mapping
            delete ownerToTokenId[msg.sender];

            emit GotchiBurned(msg.sender, tokenIdToBurn);
        }

        // Ensure the player has sufficient $HAHA tokens for minting
        require(hahaToken.balanceOf(msg.sender) >= mintCost, "Insufficient $HAHA balance for minting");
        require(hahaToken.allowance(msg.sender, address(this)) >= mintCost, "Approval required for minting");

        // Burn the required $HAHA tokens from the player's balance
        ERC20Burnable(address(hahaToken)).burnFrom(msg.sender, mintCost);

        // Mint a new Gotchi for the player with initial stats
        uint256 newTokenId = _nextTokenId;
        _safeMint(to, newTokenId);
        _nextTokenId++;

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
            0,        // timeAlive
            0         // lastSaveTime
        );

        // Update the ownerToTokenId mapping
        ownerToTokenId[to] = newTokenId;

        emit GotchiMinted(to, newTokenId, gotchiStats[newTokenId].health, gotchiStats[newTokenId].happiness, gotchiStats[newTokenId].timeAlive);
    }

    /**
    * @dev Internal function to check if a MamaGotchi's health or happiness has reached zero.
    * Updates its death timestamp if conditions for death are met.
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
    * @dev Checks if a MamaGotchi is alive by evaluating its health, happiness, and death timestamp.
    * @param tokenId The ID of the MamaGotchi to check.
    * @return True if the MamaGotchi is alive, false otherwise.
    */
    function isAlive(uint256 tokenId) public view returns (bool) {
        Gotchi memory gotchi = gotchiStats[tokenId];
        return (gotchi.deathTimestamp == 0 && gotchi.health > 0 && gotchi.happiness > 0);
    }
    
    /**
    * @dev Marks a MamaGotchi as deceased and optionally saves its timeAlive score to the leaderboard.
    * Only callable by the contract owner.
    * @param tokenId The ID of the MamaGotchi to mark as dead.
    * @param saveOnDeath Boolean flag indicating whether to save the score upon death.
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
    * @dev Updates the timeAlive counter and applies decay for health and happiness.
    * Decay is applied based on time elapsed since the last interaction or sleep start.
    * Marks the MamaGotchi as dead if health or happiness reaches zero.
    * @param tokenId The ID of the MamaGotchi.
    */
    function updateTimeAlive(uint256 tokenId) internal {
        Gotchi storage gotchi = gotchiStats[tokenId];

        // Exit early if Gotchi is already dead
        if (gotchi.deathTimestamp != 0) {
        return;
        }    

        uint256 decayHealth = 0;
        uint256 decayHappiness = 0;

        if (gotchi.isSleeping) {
            // Calculate sleepDuration as capped by MAX_SLEEP_DURATION
            uint256 sleepDuration = block.timestamp > gotchi.sleepStartTime
                ? (block.timestamp - gotchi.sleepStartTime <= MAX_SLEEP_DURATION
                    ? block.timestamp - gotchi.sleepStartTime
                    : MAX_SLEEP_DURATION)
                : 0;

            // Calculate the exact decayDuration exceeding MAX_SLEEP_DURATION
            uint256 decayDuration = block.timestamp > gotchi.sleepStartTime + MAX_SLEEP_DURATION
                ? (block.timestamp - gotchi.sleepStartTime) - MAX_SLEEP_DURATION
                : 0;

            // Apply decay if decayDuration exceeded MAX_SLEEP_DURATION
            if (decayDuration > 0) {
                decayHealth = calculateHealthDecay(decayDuration);
                decayHappiness = calculateHappinessDecay(decayDuration);

                // Determine exact time until death, if applicable
                uint256 decayUntilDeath = (decayHealth >= gotchi.health || decayHappiness >= gotchi.happiness)
                    ? calculateTimeUntilDeath(tokenId)
                    : 0;

                // Adjust health and happiness within capped limits
                gotchi.health = gotchi.health > decayHealth ? gotchi.health - decayHealth : 0;
                gotchi.happiness = gotchi.happiness > decayHappiness ? gotchi.happiness - decayHappiness : 0;

                if (gotchi.health == 0 || gotchi.happiness == 0) {
                    gotchi.timeAlive += sleepDuration + decayUntilDeath;  // Only add precise time until death
                    gotchi.deathTimestamp = block.timestamp - (decayDuration - decayUntilDeath);
                    emit GotchiDied(ownerOf(tokenId), tokenId);           
                    return;
                }

                // Add full decay duration if Gotchi remains alive after decay
                gotchi.timeAlive += sleepDuration + decayDuration;
            
            } else {
                // No decay applied, only sleep time accumulates
                gotchi.timeAlive += sleepDuration;
            }

            gotchi.lastInteraction = block.timestamp;
            emit DecayCalculated(decayHealth, decayHappiness);
        } else {
            // Handle regular decay outside of sleep
            uint256 elapsedTime = block.timestamp - gotchi.lastInteraction;

            decayHealth = calculateHealthDecay(elapsedTime);
            decayHappiness = calculateHappinessDecay(elapsedTime);

              // Determine if Gotchi dies during this decay
        if (decayHealth >= gotchi.health || decayHappiness >= gotchi.happiness) {
            uint256 timeUntilDeath = calculateTimeUntilDeath(tokenId);

            // Update timeAlive and mark death
            gotchi.timeAlive += timeUntilDeath;
            gotchi.deathTimestamp = block.timestamp - (elapsedTime - timeUntilDeath);

            emit GotchiDied(ownerOf(tokenId), tokenId);
            return; // Exit after handling death
        }

        // Apply decay and update stats if Gotchi survives
        gotchi.health = gotchi.health > decayHealth ? gotchi.health - decayHealth : 0;
        gotchi.happiness = gotchi.happiness > decayHappiness ? gotchi.happiness - decayHappiness : 0;
        gotchi.timeAlive += elapsedTime;

        gotchi.lastInteraction = block.timestamp;
    }
}

    /**
    * @dev Internal function to burn $HAHA tokens for a specific gameplay action.
    * Verifies allowance and balance before burning.
    * @param amount The amount of $HAHA tokens to burn.
    * @param action A description of the action requiring token burning (used in revert messages).
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
    * This function also updates `timeAlive` and applies any necessary health and happiness decay.
    * Emits events to inform the UI about the updated health, happiness, and timeAlive stats.
    *
    * Requirements:
    * - The caller must own the specified MamaGotchi (`Not your MamaGotchi`).
    * - The MamaGotchi must be alive (`MamaGotchi is dead!`).
    * - The MamaGotchi must not be asleep (`MamaGotchi is asleep!`).
    * - The cooldown period for feeding must have elapsed (`MamaGotchi says: I'm full!`).
    * - The caller must have sufficient $HAHA tokens approved and available for feeding.
    *
    * Emits:
    * - `GotchiFed` with updated health, happiness, and timeAlive stats.
    * - `InsufficientHAHA` if the caller's $HAHA balance is insufficient.
    * - `BurnApprovalRequired` if the caller has not approved enough $HAHA tokens for the contract.
    *
    * @param tokenId The ID of the MamaGotchi being fed.
    */
    function feed(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];

        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");

        // Pre-existing state validation (no emits here)
        require(isAlive(tokenId), "MamaGotchi is dead!");
        require(!gotchi.isSleeping, "MamaGotchi is asleep!");
        require(block.timestamp >= gotchi.lastFeedTime + cooldowns.feed, "MamaGotchi says: I'm full!");

        // State change: apply decay and update timeAlive
        updateTimeAlive(tokenId);

        // Post-decay validation (emit for state change)
        if (!isAlive(tokenId)) {
            emit GotchiDied(ownerOf(tokenId), tokenId);
            return;
        }

        // Burn tokens only after confirming Gotchi is alive post-decay
        requireAndBurnTokens(feedCost, "feeding");

        // State change: apply health boost and update feed time
        gotchi.health = gotchi.health + feedHealthBoost > MAX_HEALTH ? MAX_HEALTH : gotchi.health + feedHealthBoost;
        gotchi.lastFeedTime = block.timestamp;

        // Emit updated health stats (state change)
        emit GotchiFed(msg.sender, tokenId, gotchi.health, gotchi.happiness, gotchi.timeAlive);

    }

   /**
    * @dev Plays with a MamaGotchi, increasing its happiness if cooldown has elapsed and it is not asleep.
    * Updates `timeAlive` and applies necessary health and happiness decay. Emits events to inform the UI
    * about state changes following gameplay interactions.
    *
    * Requirements:
    * - The caller must own the specified MamaGotchi (`Not your MamaGotchi`).
    * - The MamaGotchi must be alive (`MamaGotchi is dead!`).
    * - The MamaGotchi must not be asleep (`MamaGotchi is asleep!`).
    * - The cooldown period for playing must have elapsed (`MamaGotchi says: I'm tired now!`).
    * - The caller must have sufficient $HAHA tokens approved and available for playing.
    *
    * Emits:
    * - `GotchiPlayed` with updated health, happiness, and timeAlive stats if the action is successful.
    * - `GotchiDied` if the Gotchi dies during post-decay validation.
    *
    * @param tokenId The ID of the MamaGotchi being played with.
    */
    function play(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];

        // Initial validation checks (no state change yet)
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(isAlive(tokenId), "MamaGotchi is dead!"); // No state change, so remain `require`
        require(!gotchi.isSleeping, "MamaGotchi is asleep!"); // No state change, so remain `require`
        require(block.timestamp >= gotchi.lastPlayTime + cooldowns.play, "MamaGotchi says: I'm tired now!");

        // Update timeAlive and apply any decay
        updateTimeAlive(tokenId);

        // Post-decay validation check
        if (!isAlive(tokenId)) {
            emit GotchiDied(ownerOf(tokenId), tokenId); // Emit because this is a state change
            return;
        }

        // Burn tokens only after confirming Gotchi is alive post-decay
        requireAndBurnTokens(playCost, "playing");

        // Apply the play boost to happiness
        gotchi.happiness = gotchi.happiness + playHappinessBoost > MAX_HAPPINESS ? MAX_HAPPINESS : gotchi.happiness + playHappinessBoost;
        gotchi.lastPlayTime = block.timestamp;

        // Emit event with updated stats (health, happiness, and timeAlive)
        emit GotchiPlayed(msg.sender, tokenId, gotchi.health, gotchi.happiness, gotchi.timeAlive);
    }
 
    /**
    * @dev Puts a MamaGotchi to sleep, pausing decay, if cooldown has elapsed and it is not already sleeping.
    * Updates `timeAlive` and applies necessary health and happiness decay.
    *
    * Requirements:
    * - The caller must own the specified MamaGotchi (`Not your MamaGotchi`).
    * - The MamaGotchi must be alive (`MamaGotchi is dead!`).
    * - The MamaGotchi must not be already sleeping (`MamaGotchi says: I'm already in dreamland, shhh!`).
    * - The cooldown period for sleeping must have elapsed (`MamaGotchi says: I'm not sleepy!`).
    * - The caller must have sufficient $HAHA tokens approved and available for sleeping.
    *
    * Emits:
    * - `GotchiSleeping` with updated health, happiness, timeAlive, and sleep start time if the action is successful.
    * - `GotchiDied` if the Gotchi dies during post-decay validation.
    *
    * @param tokenId The ID of the MamaGotchi to put to sleep.
    */
    function sleep(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];

        // Initial validation checks (no state change yet)
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(isAlive(tokenId), "MamaGotchi is dead!"); // No state change, so remain `require`
        require(!gotchi.isSleeping, "MamaGotchi says: I'm already in dreamland, shhh!");
        require(block.timestamp >= gotchi.lastSleepTime + cooldowns.sleep, "MamaGotchi says: I'm not sleepy!");

        // Update timeAlive and apply any decay
        updateTimeAlive(tokenId);

        // Post-decay validation check
        if (!isAlive(tokenId)) {
            emit GotchiDied(ownerOf(tokenId), tokenId); // Emit because this is a state change
            return;
        }

        // Burn tokens only after confirming Gotchi is alive post-decay
        requireAndBurnTokens(sleepCost, "sleeping");

        // Set the sleep state
        gotchi.isSleeping = true;
        gotchi.sleepStartTime = block.timestamp;
        gotchi.lastSleepTime = block.timestamp; // Always update lastSleepTime on initiating sleep

        // Emit event with updated stats (health, happiness, timeAlive, and sleep start time)
        emit GotchiSleeping(msg.sender, tokenId, block.timestamp, gotchi.health, gotchi.happiness, gotchi.timeAlive);
    }

    /**
    * @dev Wakes a MamaGotchi, checking if it survived the sleep period based on health and happiness decay.
    * If death occurs during sleep, sets death timestamp and marks as no longer sleeping. If the Gotchi survives,
    * simply updates its awake state.
    * @param tokenId The ID of the MamaGotchi to wake up.
    */
    function wake(uint256 tokenId) external nonReentrant {
        Gotchi storage gotchi = gotchiStats[tokenId];
        
        // Initial state checks
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        require(gotchi.isSleeping, "MamaGotchi says: I'm already awake!");
        
        // Apply time decay up to this moment and update stats
        updateTimeAlive(tokenId);

        // Check if Gotchi died during sleep after applying decay
        if (!isAlive(tokenId)) {
            gotchi.isSleeping = false; // Reset sleep state
            gotchi.deathTimestamp = block.timestamp; // Mark death timestamp

            emit GotchiDied(ownerOf(tokenId), tokenId); // Notify the UI of death
            return;
        }

        // Reset the sleep state if the Gotchi survived
        gotchi.isSleeping = false;
        gotchi.sleepStartTime = 0;

        // Emit the wake event with updated stats
        emit GotchiAwake(msg.sender, tokenId, gotchi.health, gotchi.happiness, gotchi.timeAlive, block.timestamp);
    }
   
   /**
    * @dev Saves the current timeAlive score to the leaderboard if it is the player's highest score.
    * Can be called during gameplay or when a MamaGotchi dies.
    * @param tokenId The ID of the MamaGotchi.
    */
    function _saveToLeaderboard(uint256 tokenId) internal {
        require(ownerOf(tokenId) == msg.sender, "Not your MamaGotchi");
        Gotchi storage gotchi = gotchiStats[tokenId];
        
        // Check cooldown
        require(
            block.timestamp >= gotchi.lastSaveTime + cooldowns.save,
            "MamaGotchi says: I'm too tired to save again so soon!"
        );

        // Check if Gotchi is alive or dead
        if (!isAlive(tokenId)) {
            // Gotchi is dead, use existing timeAlive value directly
            uint256 currentTimeAlive = gotchi.timeAlive;

            // Update leaderboard if this is the highest timeAlive score for the player
            if (currentTimeAlive > playerHighScores[msg.sender]) {
                playerHighScores[msg.sender] = currentTimeAlive;
                emit LeaderboardUpdated(msg.sender, currentTimeAlive, "AllTimeHighRound");
                
                // Update lastSaveTime
                gotchi.lastSaveTime = block.timestamp;        
            }

            emit GotchiStatus(msg.sender, tokenId, "Dead", currentTimeAlive, 0, 0);
        
        } else {
            // Gotchi is alive, so we need to update timeAlive to ensure it's current
            updateTimeAlive(tokenId);

            // After updating, retrieve the latest timeAlive value
            uint256 currentTimeAlive = gotchi.timeAlive;

            // Update leaderboard if this is the highest timeAlive score for the player
            if (currentTimeAlive > playerHighScores[msg.sender]) {
                playerHighScores[msg.sender] = currentTimeAlive;
                gotchi.lastInteraction = block.timestamp;
                emit LeaderboardUpdated(msg.sender, currentTimeAlive, "AllTimeHighRound");

                // Update lastSaveTime
                gotchi.lastSaveTime = block.timestamp;        
            }

            emit GotchiStatus(msg.sender, tokenId, "Alive", currentTimeAlive, gotchi.health, gotchi.happiness);
        }
        
        // If the Gotchi just died due to the update, emit a death event
        if (!isAlive(tokenId) && gotchi.deathTimestamp == block.timestamp) {
            emit GotchiDied(msg.sender, tokenId);
        }
    }

    /**
    * @dev Allows players to manually save their timeAlive score to the leaderboard.
    * Calls the internal _saveToLeaderboard function.
    * @param tokenId The ID of the MamaGotchi.
    */
    function manualSaveToLeaderboard(uint256 tokenId) external nonReentrant {
        _saveToLeaderboard(tokenId);
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

    function setSleepCost(uint256 newSleepCost) external onlyOwner {
        sleepCost = newSleepCost;
        emit CostUpdated("SleepCost", newSleepCost);
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