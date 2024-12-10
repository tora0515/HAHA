import React, { useState } from 'react';
import WalletConnect, { defaultGotchiData } from './components/WalletConnect';
import HealthBar from './components/HealthBar';
import FeedButton from './components/FeedButton';

function App() {
  const [error, setError] = useState(null); // State for error messages
  const [gotchiData, setGotchiData] = useState(defaultGotchiData); // Centralized state for Gotchi data
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [contract, setContract] = useState(null); // Blockchain contract instance
  const [tokenId, setTokenId] = useState(null); // Token ID of the MamaGotchi

  // Function to update Gotchi data
  // eslint-disable-next-line no-unused-vars
  const updateGotchiData = (updatedStats) => {
    setGotchiData((prevData) => ({
      ...prevData,
      ...updatedStats, // Merge new stats into existing state
    }));
  };

  return (
    <div>
      <h1>MamaGotchi</h1>

      {/* Display error message if there is one */}
      {error && (
        <p
          className="error-message"
          style={{ color: 'red', fontWeight: 'bold' }}
        >
          {error}
        </p>
      )}

      {!isWalletConnected ? (
        <p>Please connect your wallet to start playing MamaGotchi!</p>
      ) : (
        <>
          {/* Render HealthBar */}
          <HealthBar
            initialHealth={gotchiData.health ?? 0}
            lastInteraction={gotchiData.lastInteraction}
          />

          {/* Render FeedButton */}
          <FeedButton
            lastFeedTime={gotchiData.lastFeedTime}
            initialHealth={gotchiData.health}
            tokenId={tokenId}
            contract={contract}
            onUpdateStats={updateGotchiData}
          />
        </>
      )}

      {/* WalletConnect for handling wallet interaction */}
      <WalletConnect
        onGotchiData={setGotchiData}
        onWalletConnect={setIsWalletConnected}
        onTokenId={setTokenId}
        onContract={setContract}
        onError={setError}
      />
    </div>
  );
}

export default App;
