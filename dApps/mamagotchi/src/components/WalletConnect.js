import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import '../css/WalletConnect.css';
import MamaGotchiABI from '../MamaGotchiGameMinato_ABI.json';

// Contract address for MamaGotchiGameMinato
const contractAddress = '0x9F2609A76E9AF431FCa6bbbdd28BE92d2A283F2E';

// Default Gotchi Data
export const defaultGotchiData = {
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
const WalletConnect = ({ onGotchiData, onWalletConnect }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [gotchiData, setGotchiData] = useState(defaultGotchiData);

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
        timeAlive: parseInt(gotchiStats.timeAlive.toString()),
        isSleeping: gotchiStats.isSleeping,
        sleepStartTime: parseInt(gotchiStats.sleepStartTime.toString()),
        lastFeedTime: parseInt(gotchiStats.lastFeedTime.toString()),
        lastPlayTime: parseInt(gotchiStats.lastPlayTime.toString()),
        lastSleepTime: parseInt(gotchiStats.lastSleepTime.toString()),
        lastInteraction: parseInt(gotchiStats.lastInteraction.toString()),
        deathTimestamp: parseInt(gotchiStats.deathTimestamp.toString()),
      };
    } catch (error) {
      console.error('Error fetching Gotchi data:', error);
      return defaultGotchiData;
    }
  };

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

        // Notify parent component that the wallet is connected
        onWalletConnect(true);
      } catch (error) {
        console.error('Error connecting to wallet or contract:', error);
        setGotchiData(defaultGotchiData);
      }
    } else {
      alert(
        'No Ethereum wallet detected. Please install MetaMask or use another EVM wallet.'
      );
    }
  };

  const reconnectWallet = useCallback(
    async (savedWallet) => {
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

          // Notify parent component that the wallet is connected
          onWalletConnect(true);
        } catch (error) {
          console.error('Error reconnecting wallet or contract:', error);
          setGotchiData(defaultGotchiData);
        }
      }
    },
    [onWalletConnect]
  );

  // Event listener for wallet changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // Wallet disconnected
          setWalletAddress(null);
          setGotchiData(defaultGotchiData);
          onWalletConnect(false);
        }
      };

      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        // Cleanup listener
        window.ethereum.removeListener(
          'accountsChanged',
          handleAccountsChanged
        );
      };
    }
  }, [onWalletConnect]);

  useEffect(() => {
    const savedWallet = localStorage.getItem('walletAddress');
    if (savedWallet) {
      reconnectWallet(savedWallet);
    }
  }, [reconnectWallet]);

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
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
