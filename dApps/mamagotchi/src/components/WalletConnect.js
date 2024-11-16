import React, { useState } from 'react';
import { ethers } from 'ethers';
import '../css/WalletConnect.css'; // CSS import preserved
import MamaGotchiABI from '../MamaGotchiGameMinato_ABI.json'; // ABI import

const contractAddress = '0x246A74Ad5848640cb6bBe516DEAD50F7ED407030'; // Contract address

// Helper function to format seconds into DD:HH:MM:SS
const formatTime = (seconds) => {
  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [gotchiData, setGotchiData] = useState({
    isAlive: false,
    health: null,
    happiness: null,
    timeAlive: null,
    isSleeping: null,
    sleepStartTime: null,
    lastFeedTime: null,
    lastPlayTime: null,
    lastSleepTime: null,
    lastInteraction: null,
    deathTimestamp: null,
  });

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const accounts = await provider.send('eth_requestAccounts', []);

        setWalletAddress(accounts[0]); // Store the connected wallet address

        // Connect to the contract
        const gameContract = new ethers.Contract(
          contractAddress,
          MamaGotchiABI,
          signer
        );
        setContract(gameContract); // Store the contract instance

        // Query initial game data
        const initialGotchiData = await fetchGotchiData(
          gameContract,
          accounts[0]
        );
        setGotchiData(initialGotchiData);
      } catch (error) {
        console.error('Error connecting to wallet or contract:', error);
      }
    } else {
      alert(
        'No Ethereum wallet detected. Please install MetaMask or use another EVM wallet.'
      );
    }
  };

  const fetchGotchiData = async (gameContract, address) => {
    try {
      const tokenId = 1; // Replace with logic to determine the player's token ID if necessary
      const isAlive = await gameContract.isAlive(tokenId);
      const gotchiStats = await gameContract.gotchiStats(tokenId);

      // Format time-related fields
      return {
        isAlive,
        health: gotchiStats.health.toString(),
        happiness: gotchiStats.happiness.toString(),
        timeAlive: formatTime(parseInt(gotchiStats.timeAlive.toString())),
        isSleeping: gotchiStats.isSleeping,
        sleepStartTime: formatTime(
          parseInt(gotchiStats.sleepStartTime.toString())
        ),
        lastFeedTime: formatTime(parseInt(gotchiStats.lastFeedTime.toString())),
        lastPlayTime: formatTime(parseInt(gotchiStats.lastPlayTime.toString())),
        lastSleepTime: formatTime(
          parseInt(gotchiStats.lastSleepTime.toString())
        ),
        lastInteraction: formatTime(
          parseInt(gotchiStats.lastInteraction.toString())
        ),
        deathTimestamp: formatTime(
          parseInt(gotchiStats.deathTimestamp.toString())
        ),
      };
    } catch (error) {
      console.error('Error fetching Gotchi data:', error);
      return {
        isAlive: false,
        health: null,
        happiness: null,
        timeAlive: null,
        isSleeping: null,
        sleepStartTime: null,
        lastFeedTime: null,
        lastPlayTime: null,
        lastSleepTime: null,
        lastInteraction: null,
        deathTimestamp: null,
      };
    }
  };

  const truncateAddress = (address) => {
    return address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : 'Connect Wallet';
  };

  return (
    <div>
      {!walletAddress ? (
        <button className="wallet-button" onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <p className="wallet-address">{truncateAddress(walletAddress)}</p>
          <p>Is Alive: {gotchiData.isAlive ? 'Yes' : 'No'}</p>
          <p>Health: {gotchiData.health || 'N/A'}</p>
          <p>Happiness: {gotchiData.happiness || 'N/A'}</p>
          <p>Time Alive: {gotchiData.timeAlive || 'N/A'}</p>
          <p>Is Sleeping: {gotchiData.isSleeping ? 'Yes' : 'No'}</p>
          {/* Add other stats here if needed */}
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
