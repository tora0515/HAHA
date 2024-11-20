import React, { useState } from 'react';
import WalletConnect from './components/WalletConnect';
import HealthBar from './components/HealthBar';
import HappinessBar from './components/HappinessBar';

function App() {
  const [gotchiData, setGotchiData] = useState(null); // Centralized state for Gotchi data

  return (
    <div>
      <h1>MamaGotchi</h1>
      {/* Wallet Connection */}
      <WalletConnect onGotchiData={setGotchiData} />

      {/* Conditional rendering of Gotchi-related components */}
      {gotchiData ? (
        <>
          <HealthBar
            initialHealth={gotchiData.health}
            lastInteraction={gotchiData.lastInteraction}
            decayRate={550} // Example decay rate
            maxValue={100} // Maximum health
          />
          <HappinessBar
            initialHappiness={gotchiData.happiness}
            lastInteraction={gotchiData.lastInteraction}
            decayRate={416} // Example decay rate
            maxValue={100} // Maximum happiness
          />
        </>
      ) : (
        <p>Please connect your wallet and mint your Gotchi to start playing.</p>
      )}
    </div>
  );
}

export default App;
