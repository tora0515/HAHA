import React, { useState } from 'react';
import WalletConnect, { defaultGotchiData } from './components/WalletConnect';
import HealthBar from './components/HealthBar';
// Import other components like HappinessBar as needed

function App() {
  // Centralized state for Gotchi data with default values
  const [gotchiData, setGotchiData] = useState(defaultGotchiData);

  return (
    <div>
      <h1>MamaGotchi</h1>

      {/* Wallet Connection */}
      <WalletConnect onGotchiData={setGotchiData} />

      {/* Conditional rendering of Gotchi-related components */}
      {gotchiData.health !== null ? (
        <>
          <HealthBar initialHealth={gotchiData.health} />
          {/* Add HappinessBar and other components here */}
        </>
      ) : (
        <p>Please connect your wallet and mint your Gotchi to start playing.</p>
      )}
    </div>
  );
}

export default App;
