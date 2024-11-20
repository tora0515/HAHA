import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import '../css/WalletConnect.css';
import MamaGotchiABI from '../MamaGotchiGameMinato_ABI.json';

// Contract address for MamaGotchiGameMinato
const contractAddress = '0x37EA6481ecc5f907948e8a3F77655D3C417d809c';

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

// Default Gotchi Data
const defaultGotchiData = {
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

// Component: WalletConnect
const WalletConnect = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [gotchiData, setGotchiData] = useState(defaultGotchiData);

  /**
   * Fetch Gotchi data from the contract based on the user's wallet address
   * @param {ethers.Contract} gameContract - Instance of the MamaGotchi contract
   * @param {string} address - User's wallet address
   * @returns {object} - Gotchi stats or default values if an error occurs
   */
  const fetchGotchiData = async (gameContract, address) => {
    try {
      const tokenId = await gameContract.ownerToTokenId(address);
      if (tokenId === 0) {
        console.warn('No Gotchi found for the connected wallet.');
        return defaultGotchiData;
      }

      const isAlive = await gameContract.isAlive(tokenId);
      const gotchiStats = await gameContract.gotchiStats(tokenId);

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
      return defaultGotchiData;
    }
  };

  /**
   * Connect the user's wallet and initialize the contract connection
   */
  const reconnectWallet = useCallback(async (savedWallet) => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        setWalletAddress(savedWallet);
        const gameContract = new ethers.Contract(
          contractAddress,
          MamaGotchiABI,
          signer
        );
        setContract(gameContract);
        const initialGotchiData = await fetchGotchiData(
          gameContract,
          savedWallet
        );
        setGotchiData(initialGotchiData);
      } catch (error) {
        console.error('Error reconnecting wallet or contract:', error);
        setGotchiData(defaultGotchiData); // Reset Gotchi data on error
      }
    }
  }, []);

  /**
   * Reconnect the user's wallet if previously connected
   */
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const accounts = await provider.send('eth_requestAccounts', []);

        const wallet = accounts[0];
        setWalletAddress(wallet);
        localStorage.setItem('walletAddress', wallet);

        const gameContract = new ethers.Contract(
          contractAddress,
          MamaGotchiABI,
          signer
        );
        setContract(gameContract);
        const initialGotchiData = await fetchGotchiData(gameContract, wallet);
        setGotchiData(initialGotchiData);
      } catch (error) {
        console.error('Error connecting to wallet or contract:', error);
        setGotchiData(defaultGotchiData); // Reset Gotchi data on error
      }
    } else {
      alert(
        'No Ethereum wallet detected. Please install MetaMask or use another EVM wallet.'
      );
    }
  };

  // Auto-reconnect on page load if wallet address is saved
  useEffect(() => {
    const savedWallet = localStorage.getItem('walletAddress');
    if (savedWallet) {
      reconnectWallet(savedWallet);
    }
  }, [reconnectWallet]);

  /**
   * Helper function to truncate a long wallet address
   * @param {string} address - Wallet address to truncate
   * @returns {string} - Truncated address
   */
  const truncateAddress = (address) => {
    return address
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : 'Connect Wallet';
  };

  // Render component
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
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
