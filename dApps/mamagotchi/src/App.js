import React, { useState } from 'react';
import WalletConnect, { defaultGotchiData } from './components/WalletConnect';
import HealthBar from './components/HealthBar';

function App() {
  const [gotchiData, setGotchiData] = useState(defaultGotchiData);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  return (
    <div>
      <h1>MamaGotchi</h1>

      {!isWalletConnected ? (
        <p>Please connect your wallet to start playing MamaGotchi!</p>
      ) : (
        <>
          <HealthBar initialHealth={gotchiData.health ?? 0} />
        </>
      )}

      <WalletConnect
        onGotchiData={setGotchiData}
        onWalletConnect={setIsWalletConnected}
      />
    </div>
  );
}

export default App;
