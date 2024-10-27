// src/App.js
// Main component for MamaGotchi, handles wallet connection, game state, and UI rendering.

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import placeholderImage from './images/mamagotchi-placeholder.png';

function App() {
  // State declarations
  const [walletAddress, setWalletAddress] = useState('');
  const [health, setHealth] = useState(80);
  const [happiness, setHappiness] = useState(80);
  const [gotchiPoints, setGotchiPoints] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [gotchiImage] = useState(placeholderImage);
  const [notification, setNotification] = useState('');
  const [errorNotification, setErrorNotification] = useState('');

  // Leaderboard data
  const leaderboardData = [
    { name: 'Player1', points: 150 },
    { name: 'Player2', points: 120 },
    { name: 'Player3', points: 100 },
  ];

  // Function to show a notification for a few seconds
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(''); // Clear gameplay notification after 3 seconds
    }, 3000);
  };

  const showErrorNotification = (message) => {
    setErrorNotification(message);
  };

  // Function to clear error notification manually if needed
  const clearErrorNotification = () => {
    setErrorNotification('');
  };

  // Side effect for health and happiness decay
  useEffect(() => {
    const decayInterval = setInterval(() => {
      setHealth((prevHealth) => Math.max(prevHealth - 0.092, 0));
      setHappiness((prevHappiness) => Math.max(prevHappiness - 0.069, 0));
    }, 60000);

    return () => clearInterval(decayInterval);
  }, []);

  // Function to connect to MetaMask wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        setWalletAddress(await signer.getAddress());
        clearErrorNotification(); // Clear any existing error on successful connection
      } catch (error) {
        showErrorNotification('Error connecting to wallet. Please try again.');
      }
    } else {
      showErrorNotification(
        'MetaMask is not installed. Please install it to use this feature.'
      );
    }
  };

  // Game functions for feeding and playing with the pet
  const feedPet = () => {
    setHealth((prev) => {
      if (prev < 100) {
        showNotification('MamaGotchi has been fed!');
        setGotchiPoints((prevPoints) => prevPoints + 10); // Award points only if feeding occurs
        return Math.min(prev + 10, 100);
      }
      showNotification('MamaGotchi is already full!');
      return prev; // No change if health is 100
    });
  };

  const playWithPet = () => {
    setHappiness((prevHappiness) => {
      if (prevHappiness < 100) {
        showNotification('MamaGotchi enjoyed playtime!');
        setGotchiPoints((prevPoints) => prevPoints + 10); // Award points only if playing occurs
        return Math.min(prevHappiness + 10, 100);
      }
      showNotification('MamaGotchi is already happy!');
      return prevHappiness; // No change if happiness is 100
    });
  };

  // Render
  return (
    <div className="App">
      <h1>Welcome to MamaGotchi!</h1>

      {/* Gameplay Notification (Temporary) */}
      {notification && <div className="notification">{notification}</div>}

      {/* Persistent Error Notification */}
      {errorNotification && (
        <div className="error-notification">
          {errorNotification}
          <button onClick={clearErrorNotification}>Dismiss</button>
        </div>
      )}

      {/* Wallet connection button */}
      <button onClick={connectWallet}>Connect Wallet</button>
      {walletAddress && <p>Connected Wallet: {walletAddress}</p>}

      {/* Gameplay controls */}
      <button onClick={feedPet}>Feed Pet</button>
      <button onClick={playWithPet}>Play with Pet</button>

      {/* Display the placeholder image unconditionally for now */}
      <img
        src={gotchiImage}
        alt="MamaGotchi Placeholder"
        className="gotchi-image"
      />

      {/* Gotchi Points and Leaderboard */}
      <button onClick={() => setShowLeaderboard(true)}>Save Data</button>
      <p>Gotchi Points: {gotchiPoints}</p>

      {showLeaderboard && (
        <div className="modal">
          <div className="modal-content">
            <h2>Leaderboard</h2>
            <ul>
              {leaderboardData.map((player, index) => (
                <li key={index}>
                  {index + 1}. {player.name} - {player.points} points
                </li>
              ))}
            </ul>
            <button onClick={() => setShowLeaderboard(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Health and Happiness Displays */}
      <p>Health: {health.toFixed(0)}</p>
      <div className="status-bar">
        <div className="health-bar" style={{ width: `${health}%` }}></div>
      </div>

      <p>Happiness: {happiness.toFixed(0)}</p>
      <div className="status-bar">
        <div className="happiness-bar" style={{ width: `${happiness}%` }}></div>
      </div>
    </div>
  );
}

export default App;
