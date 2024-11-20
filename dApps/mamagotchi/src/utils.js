// Utility function to calculate decay
export function calculateDecay(lastInteraction, decayRate, maxValue) {
  const now = Date.now() / 1000; // Current time in seconds
  const elapsedTime = now - lastInteraction; // Time elapsed since last interaction
  const decay = (elapsedTime * decayRate) / 3600; // Decay amount per hour

  // Return the updated value, ensuring it doesn't drop below 0
  return Math.max(maxValue - decay, 0);
}

export function formatTime(seconds) {
  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}
