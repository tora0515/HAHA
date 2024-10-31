// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GotchiPoints is Ownable {
    mapping(address => uint256) public roundPoints; // Player's current round points
    mapping(address => uint256) public cumulativePoints; // Player's cumulative points

    // Struct for leaderboard entries
    struct LeaderboardEntry {
        address player;
        uint256 score;
    }

    LeaderboardEntry[] public bestRoundScores; // Top round scores leaderboard
    LeaderboardEntry[] public allTimeScores;   // All-time cumulative scores leaderboard

    uint256 public leaderboardSize = 10; // Limit for leaderboard entries

    // Constructor to set the initial owner
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Adds points to the current round and cumulative total for a player.
     */
    function addPoints(address player, uint256 points) external onlyOwner {
        roundPoints[player] += points;
        cumulativePoints[player] += points;
        
        // Update all-time leaderboard based on cumulative points
        updateAllTimeLeaderboard(player);
    }

    /**
     * @dev Deducts points from both round and cumulative totals, used for penalties.
     */
    function deductPoints(address player, uint256 points) external onlyOwner {
        roundPoints[player] = roundPoints[player] > points ? roundPoints[player] - points : 0;
        cumulativePoints[player] = cumulativePoints[player] > points ? cumulativePoints[player] - points : 0;

        // Update all-time leaderboard based on cumulative points
        updateAllTimeLeaderboard(player);
    }

    /**
     * @dev Saves the current round score to the leaderboard, resets round points, and updates cumulative score.
     */
    function saveRoundScore(address player) external onlyOwner {
        uint256 playerRoundScore = roundPoints[player];

        // Update best round scores leaderboard
        updateLeaderboard(bestRoundScores, player, playerRoundScore);

        // Reset round points
        roundPoints[player] = 0;
    }

    /**
     * @dev Updates the all-time leaderboard based on cumulative points.
     */
    function updateAllTimeLeaderboard(address player) internal {
        uint256 playerCumulativeScore = cumulativePoints[player];
        updateLeaderboard(allTimeScores, player, playerCumulativeScore);
    }

    /**
     * @dev Updates a leaderboard with the new score if it qualifies for top entries.
     */
    function updateLeaderboard(LeaderboardEntry[] storage leaderboard, address player, uint256 score) internal {
        if (leaderboard.length < leaderboardSize || score > leaderboard[leaderboardSize - 1].score) {
            leaderboard.push(LeaderboardEntry(player, score));
            sortLeaderboard(leaderboard);
            if (leaderboard.length > leaderboardSize) {
                leaderboard.pop(); // Remove lowest score if above limit
            }
        }
    }

    /**
     * @dev Sorts the leaderboard in descending order.
     */
    function sortLeaderboard(LeaderboardEntry[] storage leaderboard) internal {
        for (uint256 i = 0; i < leaderboard.length; i++) {
            for (uint256 j = i + 1; j < leaderboard.length; j++) {
                if (leaderboard[j].score > leaderboard[i].score) {
                    // Store temporary copies of leaderboard entries
                    LeaderboardEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }
    }

    /**
     * @dev Get the current top scores for both round and cumulative leaderboards.
     */
    function getLeaderboards() external view returns (LeaderboardEntry[] memory, LeaderboardEntry[] memory) {
        return (bestRoundScores, allTimeScores);
    }
}
