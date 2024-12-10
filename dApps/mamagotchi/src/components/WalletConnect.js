import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import '../css/WalletConnect.css';
import MamaGotchiABI from '../MamaGotchiGameMinato_ABI.json';

// Contract address for MamaGotchiGameMinato
const contractAddress = '0x9F2609A76E9AF431FCa6bbbdd28BE92d2A283F2E';

const getEVMProvider = () => {
  if (typeof window.ethereum !== 'undefined') {
    // Check if multiple providers exist
    if (window.ethereum.providers?.length) {
      // Filter for EVM-compatible wallets
      const evmProviders = window.ethereum.providers.filter(
        (provider) => provider.request
      );
      return evmProviders.length > 0 ? evmProviders[0] : null;
    } else {
      // Single provider detected
      return window.ethereum.request ? window.ethereum : null;
    }
  }
  console.log('No EVM-compatible wallet detected.');
  return null;
};

// Expected Network Configuration
const EXPECTED_CHAIN_ID = '0x79a'; // Minato Testnet Chain ID in hexadecimal
const NETWORK_PARAMS = {
  chainId: '0x79a',
  chainName: 'Minato Testnet',
  nativeCurrency: {
    name: 'Minato',
    symbol: 'ETH', // Replace with actual symbol if different
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
    const ethereumProvider = getEVMProvider(); // Use the utility function
    if (!ethereumProvider) {
      console.error('No Ethereum wallet detected.');
      return false;
    }

    try {
      // Attempt to switch to the Minato Testnet
      await ethereumProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK_PARAMS.chainId }],
      });
      return true;
    } catch (switchError) {
      if (switchError.code === 4902) {
        // The chain has not been added to MetaMask, try to add it
        try {
          await ethereumProvider.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK_PARAMS],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add the network:', addError);
          return false;
        }
      } else {
        console.error('Failed to switch the network:', switchError);
        return false;
      }
    }
  };

  /**
   * Connect Wallet and Initialize Contract Interaction
   */
  const connectWallet = async () => {
    const ethereumProvider = getEVMProvider(); // Use the utility function
    if (ethereumProvider) {
      try {
        let provider = new ethers.BrowserProvider(ethereumProvider); // Use selected provider
        let signer = await provider.getSigner();
        const accounts = await provider.send('eth_requestAccounts', []);

        const wallet = accounts[0];
        setWalletAddress(wallet);
        localStorage.setItem('walletAddress', wallet);

        // Check the network
        const network = await provider.getNetwork();
        if (network.chainId !== parseInt(EXPECTED_CHAIN_ID, 16)) {
          // Attempt to switch network
          const switched = await switchNetwork();
          if (!switched) {
            // If network switch was unsuccessful, display an error and stop execution
            alert(
              'Please switch to the Minato Testnet network in your wallet.'
            );
            onGotchiData(defaultGotchiData); // Reset Gotchi data
            onWalletConnect(false);
            return;
          } else {
            // After switching, update the provider and signer
            provider = new ethers.BrowserProvider(ethereumProvider);
            signer = await provider.getSigner();
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
      const ethereumProvider = getEVMProvider(); // Use the utility function
      if (ethereumProvider) {
        try {
          let provider = new ethers.BrowserProvider(ethereumProvider); // Use selected provider
          let signer = await provider.getSigner();

          const accounts = await provider.send('eth_accounts', []);
          if (accounts.length === 0) {
            // No accounts found, wallet might be locked
            return;
          }

          // Check the network
          const network = await provider.getNetwork();
          if (network.chainId !== parseInt(EXPECTED_CHAIN_ID, 16)) {
            // Attempt to switch network
            const switched = await switchNetwork();
            if (!switched) {
              // If network switch was unsuccessful, display an error and stop execution
              alert(
                'Please switch to the Minato Testnet network in your wallet.'
              );
              onGotchiData(defaultGotchiData); // Reset Gotchi data
              onWalletConnect(false);
              return;
            } else {
              // After switching, update the provider and signer
              provider = new ethers.BrowserProvider(ethereumProvider);
              signer = await provider.getSigner();
            }
          }

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
    const ethereumProvider = getEVMProvider(); // Use the utility function
    if (ethereumProvider) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          // Wallet disconnected
          setWalletAddress(null);
          onGotchiData(defaultGotchiData); // Notify App.js of reset state
          onWalletConnect(false);
        }
      };

      // Listen for account changes
      ethereumProvider.on('accountsChanged', handleAccountsChanged);

      return () => {
        // Cleanup listener
        ethereumProvider.removeListener(
          'accountsChanged',
          handleAccountsChanged
        );
      };
    }
  }, [onGotchiData, onWalletConnect]);

  useEffect(() => {
    const ethereumProvider = getEVMProvider();
    if (ethereumProvider) {
      const handleChainChanged = async (chainId) => {
        console.log(`Network changed to ${chainId}`);

        if (chainId !== EXPECTED_CHAIN_ID) {
          alert(
            `You switched to a different network. Please switch back to Minato Testnet.`
          );
          onGotchiData(defaultGotchiData);
          onWalletConnect(false);
        } else {
          try {
            let provider = new ethers.BrowserProvider(ethereumProvider);
            const accounts = await provider.send('eth_accounts', []);
            if (accounts.length > 0) {
              const signer = await provider.getSigner();
              const gameContract = new ethers.Contract(
                contractAddress,
                MamaGotchiABI,
                signer
              );
              onContract(gameContract);
              const initialGotchiData = await fetchGotchiData(
                gameContract,
                accounts[0]
              );
              onGotchiData(initialGotchiData);
              onWalletConnect(true);
            }
          } catch (error) {
            console.error('Error reconnecting after network change:', error);
          }
        }
      };

      ethereumProvider.on('chainChanged', handleChainChanged);

      return () => {
        ethereumProvider.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [onGotchiData, onWalletConnect, onContract, fetchGotchiData]);

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
