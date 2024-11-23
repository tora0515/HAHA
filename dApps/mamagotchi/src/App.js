import React, { useState } from 'react';
import WalletConnect, { defaultGotchiData } from './components/WalletConnect';
import HealthBar from './components/HealthBar';
import FeedButton from './components/FeedButton';
import { calculateDecay } from './utils';

function App() {
  const [gotchiData, setGotchiData] = useState({
    ...defaultGotchiData,
    health: 50, // Mock initial health value
    lastInteraction: Math.floor(Date.now() / 1000) - 3600, // Mock last interaction (1 hour ago)
    lastFeedTime: null, // Mock last feed time for cooldown
  });
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const handleFeed = async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const cooldownTime = 10; // 10 seconds for testing (set to 600 for production)

    // Check for cooldown
    if (
      gotchiData.lastFeedTime &&
      currentTime - gotchiData.lastFeedTime < cooldownTime
    ) {
      alert(
        `Feed cooldown active. Try again in ${
          cooldownTime - (currentTime - gotchiData.lastFeedTime)
        } seconds.`
      );
      return;
    }

    // Calculate health with decay applied
    const decayedHealth = calculateDecay(
      gotchiData.health,
      gotchiData.lastInteraction,
      5.5 // Decay rate
    );

    // Update health by adding 10 points (max 100)
    const newHealth = Math.min(decayedHealth + 10, 100);

    // Update gotchiData state
    const updatedGotchiData = {
      ...gotchiData,
      health: newHealth,
      lastInteraction: currentTime, // Update interaction time
      lastFeedTime: currentTime, // Update feed time
    };

    setGotchiData(updatedGotchiData);
  };

  return (
    <div>
      <h1>MamaGotchi</h1>

      {!isWalletConnected ? (
        <p>Please connect your wallet to start playing MamaGotchi!</p>
      ) : (
        <>
          {/* Render HealthBar with initialHealth and lastInteraction */}
          <HealthBar
            initialHealth={gotchiData.health}
            lastInteraction={gotchiData.lastInteraction}
          />

          {/* Render FeedButton */}
          <FeedButton
            lastFeedTime={gotchiData.lastFeedTime}
            onFeed={handleFeed}
          />
        </>
      )}

      {/* WalletConnect for handling wallet interaction */}
      <WalletConnect
        onGotchiData={setGotchiData}
        onWalletConnect={setIsWalletConnected}
      />
    </div>
  );
}

export default App;
