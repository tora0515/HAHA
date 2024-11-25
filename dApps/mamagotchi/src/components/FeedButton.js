import React, { useState, useEffect } from 'react';
import { calculateCooldown } from '../utils';
import { FEED_COOLDOWN } from '../constants';

const FeedButton = ({
  lastFeedTime,
  initialHealth,
  tokenId,
  contract,
  onUpdateStats, // Add onUpdateStats as a prop
}) => {
  const [cooldown, setCooldown] = useState(0); // Remaining cooldown time in seconds
  const [loading, setLoading] = useState(false); // For transaction feedback

  useEffect(() => {
    const interval = setInterval(() => {
      const remainingCooldown = calculateCooldown(lastFeedTime, FEED_COOLDOWN); // Calculate remaining cooldown
      setCooldown(remainingCooldown);
    }, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on component unmount
  }, [lastFeedTime]);

  const fetchUpdatedGotchiStats = async () => {
    if (!contract || !tokenId) {
      console.error('Contract or Token ID is missing.');
      return null;
    }

    try {
      console.log('Fetching updated Gotchi stats...');
      const gotchiStats = await contract.gotchiStats(tokenId);

      const updatedStats = {
        isAlive: await contract.isAlive(tokenId),
        health: parseInt(gotchiStats.health.toString()),
        happiness: parseInt(gotchiStats.happiness.toString()),
        timeAlive: parseInt(gotchiStats.timeAlive.toString()),
        isSleeping: gotchiStats.isSleeping,
        sleepStartTime: parseInt(gotchiStats.sleepStartTime.toString()),
        lastFeedTime: parseInt(gotchiStats.lastFeedTime.toString()),
        lastPlayTime: parseInt(gotchiStats.lastPlayTime.toString()),
        lastSleepTime: parseInt(gotchiStats.lastSleepTime.toString()),
        lastInteraction: parseInt(gotchiStats.lastInteraction.toString()),
        deathTimestamp: parseInt(gotchiStats.deathTimestamp.toString()),
      };

      console.log('Updated Gotchi stats:', updatedStats);
      return updatedStats;
    } catch (error) {
      console.error('Error fetching updated Gotchi stats:', error);
      return null;
    }
  };

  const handleFeed = async () => {
    if (cooldown > 0) {
      alert(`Feed cooldown active. Try again in ${cooldown} seconds.`);
      return;
    }

    if (!contract || !tokenId) {
      alert('Contract or Token ID is missing.');
      return;
    }

    if (initialHealth <= 0) {
      alert('Your MamaGotchi has expired and cannot be fed.');
      return;
    }

    try {
      setLoading(true); // Show loading feedback
      console.log('Initiating feed transaction...');
      const transaction = await contract.feed(tokenId);
      console.log('Transaction sent:', transaction);

      await transaction.wait(); // Wait for the transaction to be mined
      console.log('Transaction confirmed.');

      const updatedStats = await fetchUpdatedGotchiStats(); // Fetch the updated stats
      if (updatedStats) {
        onUpdateStats(updatedStats); // Call the App.js function to update Gotchi stats
      }

      setLoading(false); // Stop loading feedback
      alert('MamaGotchi successfully fed!');
    } catch (error) {
      setLoading(false); // Stop loading feedback
      console.error('Error feeding MamaGotchi:', error);
      alert('An error occurred while feeding your MamaGotchi.');
    }
  };

  return (
    <button
      onClick={handleFeed}
      disabled={cooldown > 0 || loading} // Disable button if cooldown or loading
      className="feed-button"
    >
      {loading
        ? 'Feeding...' // Show loading text if a transaction is pending
        : cooldown > 0
        ? `${cooldown}s` // Show cooldown time
        : 'Feed'}{' '}
      {/* Show "Feed" if ready */}
    </button>
  );
};

export default FeedButton;
