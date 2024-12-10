import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import '../css/WalletConnect.css';
import MamaGotchiABI from '../MamaGotchiGameMinato_ABI.json';

// Contract address for MamaGotchiGameMinato
const contractAddress = '0x9F2609A76E9AF431FCa6bbbdd28BE92d2A283F2E';

const EXPECTED_CHAIN_ID = '0x79a'; // Minato Testnet Chain ID in hexadecimal
const NETWORK_PARAMS = {
  chainId: '0x79a',
  chainName: 'Minato Testnet',
  nativeCurrency: {
    name: 'Minato',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.minato.soneium.org'],
  blockExplorerUrls: ['https://soneium-minato.blockscout.com/'],
};

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
const WalletConnect = ({
  onGotchiData,
  onWalletConnect,
  onTokenId,
  onContract,
  onError, // New prop for error handling
}) => {
  const [walletAddress, setWalletAddress] = useState(null);

  /**
   * Fetch Gotchi data and tokenId from the contract
   */
  const fetchGotchiData = useCallback(
    async (gameContract, address) => {
      try {
        const tokenId = await gameContract.ownerToTokenId(address);
        onTokenId(tokenId); // Pass tokenId to App.js

        if (tokenId === 0) {
          console.warn('No Gotchi found for the connected wallet.');
          return defaultGotchiData;
        }

        const isAlive = await gameContract.isAlive(tokenId);
        const gotchiStats = await gameContract.gotchiStats(tokenId);

        console.log('Fetched Gotchi Stats in WalletConnect:', gotchiStats);

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
    },
    [onTokenId]
  );

  const switchNetwork = async () => {
    if (window.ethereum) {
      try {
        // Attempt to switch to the Minato Testnet
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK_PARAMS.chainId }],
        });
        return { success: true, message: 'Switched to Minato Testnet.' };
      } catch (switchError) {
        if (switchError.code === 4902) {
          // If the network is not added, prompt the user to add it
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [NETWORK_PARAMS],
            });
            return {
              success: true,
              message: 'Minato Testnet added and switched.',
            };
          } catch (addError) {
            console.error('Failed to add network:', addError.message);
            return {
              success: false,
              message:
                'Failed to add the Minato Testnet. Please add it manually.',
            };
          }
        } else {
          console.error('Failed to switch network:', switchError.message);
          return {
            success: false,
            message: 'Failed to switch networks. Please switch manually.',
          };
        }
      }
    } else {
      return {
        success: false,
        message: 'No Ethereum wallet detected. Please install MetaMask.',
      };
    }
  };

  /**
   * Connect Wallet and Initialize Contract Interaction
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

        // Check the current network
        const network = await provider.getNetwork();
        if (network.chainId !== parseInt(EXPECTED_CHAIN_ID, 16)) {
          const switchResult = await switchNetwork();
          if (!switchResult.success) {
            onError(switchResult.message); // Pass error to App.js
            return; // Stop further execution if switching failed
          }
        }

        const gameContract = new ethers.Contract(
          contractAddress,
          MamaGotchiABI,
          signer
        );
        onContract(gameContract); // Pass contract to App.js

        const initialGotchiData = await fetchGotchiData(gameContract, wallet);

        // Notify parent component
        onGotchiData(initialGotchiData);
        onWalletConnect(true);
      } catch (error) {
        console.error('Error connecting to wallet or contract:', error);
        onGotchiData(defaultGotchiData); // Notify App.js of reset state
        onWalletConnect(false);
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
          onContract(gameContract); // Pass contract to App.js

          const initialGotchiData = await fetchGotchiData(
            gameContract,
            savedWallet
          );

          // Notify parent component
          onGotchiData(initialGotchiData);
          onWalletConnect(true);
        } catch (error) {
          console.error('Error reconnecting wallet or contract:', error);
          onGotchiData(defaultGotchiData); // Notify App.js of reset state
          onWalletConnect(false);
        }
      }
    },
    [fetchGotchiData, onGotchiData, onWalletConnect, onContract]
  );

  // Event listener for wallet changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // Wallet disconnected
          setWalletAddress(null);
          onGotchiData(defaultGotchiData); // Notify App.js of reset state
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
  }, [onGotchiData, onWalletConnect]);

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

  // Render
  return (
    <div>
      {!walletAddress ? (
        <button className="wallet-button" onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <p className="wallet-address">{truncateAddress(walletAddress)}</p>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
