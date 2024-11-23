// Helper function to format seconds into DD:HH:MM:SS
export const formatTime = (seconds) => {
  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

/**
 * Calculate health or happiness decay based on time elapsed
 * @param {number} initialStat - Initial stat (e.g., health or happiness)
 * @param {number} lastInteraction - Timestamp of the last contract interaction
 * @param {number} decayRatePerHour - Decay rate per hour
 * @returns {number} - Current stat value after decay
 */
export const calculateDecay = (
  initialStat,
  lastInteraction,
  decayRatePerHour
) => {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const elapsedTime = currentTime - lastInteraction; // Time elapsed in seconds
  const decayAmount = (elapsedTime / 3600) * decayRatePerHour; // Decay over elapsed hours
  const currentStat = Math.max(0, initialStat - decayAmount); // Ensure stat doesn't go below 0
  return currentStat;
};

/**
 * Checks if a cooldown period has passed
 * @param {number} lastInteraction - Timestamp of the last interaction in seconds
 * @param {number} cooldownDuration - Cooldown duration in seconds
 * @returns {number} - Remaining cooldown time in seconds (0 if cooldown is over)
 */
export const calculateCooldown = (lastInteraction, cooldownDuration) => {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const timeElapsed = currentTime - lastInteraction;
  const remainingCooldown = cooldownDuration - timeElapsed;
  return Math.max(remainingCooldown, 0); // Return 0 if cooldown has passed
};
