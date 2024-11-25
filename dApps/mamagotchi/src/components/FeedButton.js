import React, { useState, useEffect } from 'react';
import { calculateCooldown } from '../utils';
import { FEED_COOLDOWN } from '../constants';

const FeedButton = ({ lastFeedTime, onFeed, initialHealth }) => {
  const [cooldown, setCooldown] = useState(0); // Remaining cooldown time in seconds

  useEffect(() => {
    const interval = setInterval(() => {
      const remainingCooldown = calculateCooldown(lastFeedTime, FEED_COOLDOWN); // 600 seconds = 10 minutes
      setCooldown(remainingCooldown);
    }, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on component unmount
  }, [lastFeedTime]);

  const handleFeed = async () => {
    if (cooldown === 0) {
      if (initialHealth <= 0) {
        alert('Your MamaGotchi has expired and cannot be fed.');
        return;
      }
      try {
        await onFeed(); // Trigger the feed contract interaction
      } catch (error) {
        console.error('Error feeding MamaGotchi:', error);
      }
    }
  };

  return (
    <button
      onClick={handleFeed}
      disabled={cooldown > 0} // Disable button if cooldown is active
      className="feed-button"
    >
      {cooldown > 0 ? `${cooldown}s` : 'Feed'} {/* Show cooldown or "Feed" */}
    </button>
  );
};

export default FeedButton;
