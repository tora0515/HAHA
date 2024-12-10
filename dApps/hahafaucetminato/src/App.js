import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { ethers } from "ethers";
import faucetContract from "./ethereum/faucet";
import logo from "./images/mamaround.png";

const EXPECTED_CHAIN_ID = "0x79a"; // Replace with your network's chain ID in hexadecimal
const NETWORK_PARAMS = {
  chainId: "0x79a", // Minato Testnet's chain ID
  chainName: "Minato Testnet",
  nativeCurrency: {
    name: "Minato",
    symbol: "ETH", // Replace with the actual native token symbol
    decimals: 18,
  },
  rpcUrls: ["https://rpc.minato.soneium.org"], // Replace with your RPC URL
  blockExplorerUrls: ["https://soneium-minato.blockscout.com/"], // Replace with your block explorer URL
};

// Utility function to detect and prioritize EVM-compatible wallets
const getEVMProvider = () => {
  if (typeof window.ethereum !== "undefined") {
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
  console.log("No EVM-compatible wallet detected.");
  return null;
};

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [signer, setSigner] = useState();
  const [fcContract, setFcContract] = useState();
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [transactionData, setTransactionData] = useState("");

  const linkab = "https://soneium-minato.blockscout.com/tx/";

  const switchNetwork = async () => {
    const provider = getEVMProvider();
    if (!provider) {
      console.error("No EVM-compatible wallet detected.");
      return;
    }

    try {
      // Attempt to switch to the Minato Testnet
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NETWORK_PARAMS.chainId }],
      });
      setWithdrawError(""); // Clear errors if the switch succeeds
    } catch (switchError) {
      if (switchError.code === 4902) {
        // If the network is not added, prompt the user to add it
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [NETWORK_PARAMS],
          });
          setWithdrawError(""); // Clear errors if the network is successfully added
        } catch (addError) {
          console.error("Failed to add network:", addError.message);
          setWithdrawError(
            `Failed to add the Minato Testnet. Please add it manually.`
          );
        }
      } else {
        console.error("Failed to switch network:", switchError.message);
        setWithdrawError(
          `Failed to switch to the Minato Testnet. Please switch manually.`
        );
      }
    }
  };

  const getCurrentWalletConnected = useCallback(async () => {
    const provider = getEVMProvider();
    if (provider) {
      try {
        const web3Provider = new ethers.providers.Web3Provider(provider);
        const accounts = await web3Provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          setSigner(web3Provider.getSigner());
          setFcContract(faucetContract(web3Provider));
          setWalletAddress(accounts[0]);
          console.log("Wallet already connected:", accounts[0]);
        } else {
          console.log("Please connect your wallet.");
        }
      } catch (err) {
        console.error("Error getting current wallet:", err.message);
      }
    } else {
      console.log("Please install or enable an EVM-compatible wallet.");
    }
  }, []);

  const addWalletListener = useCallback(() => {
    const provider = getEVMProvider();
    if (provider) {
      provider.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          console.log("Account changed:", accounts[0]);
        } else {
          disconnectWallet();
        }
      });
    } else {
      console.log("No EVM-compatible wallet to listen to.");
    }
  }, []);

  useEffect(() => {
    getCurrentWalletConnected();
    addWalletListener();
  }, [getCurrentWalletConnected, addWalletListener]);

  const connectWallet = async () => {
    const provider = getEVMProvider();
    if (provider) {
      try {
        const web3Provider = new ethers.providers.Web3Provider(provider);
        const accounts = await web3Provider.send("eth_requestAccounts", []);

        const network = await web3Provider.getNetwork();
        if (network.chainId !== parseInt(EXPECTED_CHAIN_ID, 16)) {
          // Prompt the user to switch to the correct network
          setWithdrawError(`Wrong network! Please switch to Minato Testnet.`);
          setWithdrawSuccess(""); // Clear success messages
          await switchNetwork(); // Handle switching or adding the network
          return; // Stop further execution until the correct network is active
        }

        // Successfully connected to the correct network
        setSigner(web3Provider.getSigner());
        setFcContract(faucetContract(web3Provider));
        setWalletAddress(accounts[0]);
        setWithdrawError(""); // Clear any previous errors
        console.log("Connected wallet:", accounts[0]);
      } catch (err) {
        console.error("Error connecting wallet:", err.message);
        setWithdrawError(`Connection failed: ${err.message}`);
      }
    } else {
      console.log("Please install or enable an EVM-compatible wallet.");
      setWithdrawError("No EVM-compatible wallet detected.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddress("");
    setSigner(null);
    setFcContract(null);
    console.log("Disconnected wallet");
  };

  const getHAHAHandler = async () => {
    setWithdrawError("");
    setWithdrawSuccess("");
    try {
      const fcContractWithSigner = fcContract.connect(signer);
      const resp = await fcContractWithSigner.requestTokens();
      console.log(resp);
      setWithdrawSuccess("Operation succeeded - enjoy your $HAHA");
      setTransactionData(resp.hash);
    } catch (err) {
      /*
      console.error(err.message);
      setWithdrawError(err.message);
      */

      let errorMessage = "";

      // First, check if err has a data.message field (common with smart contract errors)
      if (err.message) {
        // Extract the reason section from the message using regex
        const reasonMatch = err.message.match(/reason="([^"]+)"/);
        if (reasonMatch && reasonMatch[1]) {
          errorMessage = reasonMatch[1]; // Extracted reason
        } else {
          errorMessage = err.message; // Default to the full error message
        }
      } else {
        errorMessage = "An unknown error occurred.";
      }

      console.error(`Error reason: ${errorMessage}`);
      setWithdrawError(`Error reason: ${errorMessage}`); // Display the reason
    }
  };

  return (
    <div>
      <nav className="navbar">
        <div className="container">
          <div className="logo">
            <img src={logo} alt="HAHA Logo" />
          </div>
          <div>
            <h1 className="navbar-item is-size-4 is-align-items-center">
              HAHA on Minato{" "}
            </h1>
          </div>

          <div className="navbar-end is-align-items-center">
            <button
              className="button is-white connect-wallet"
              onClick={walletAddress ? disconnectWallet : connectWallet}
            >
              <span className="is-link has-text-weight-bold">
                {walletAddress && walletAddress.length > 0
                  ? `Disconnect (${walletAddress.substring(
                      0,
                      6
                    )}...${walletAddress.substring(38)})`
                  : "Connect Wallet"}
              </span>
            </button>
          </div>
        </div>
      </nav>
      <section className="hero is-fullheight">
        <div className="faucet-hero-body">
          <div className="container has-text-centered main-content">
            <h1 className="title is-1">Faucet</h1>
            <p>MAMA's on Minato! Get 100m $HAHA per day.</p>
            <div className="mt-5">
              {withdrawError && (
                <div className="withdraw-error">
                  {withdrawError}{" "}
                  {withdrawError.includes("add it manually") && (
                    <a
                      href="https://soneium-minato.blockscout.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="has-text-link"
                    >
                      Add Minato Testnet
                    </a>
                  )}
                </div>
              )}
              {withdrawSuccess && (
                <div className="withdraw-success">{withdrawSuccess}</div>
              )}
            </div>

            <div className="box address-box">
              <div className="columns">
                <div className="column is-four-fifths">
                  <input
                    className="input is-medium"
                    type="text"
                    placeholder="Connect your wallet address (0x...)"
                    defaultValue={walletAddress}
                  />
                </div>
                <div className="column">
                  <button
                    className="button is-link is-medium"
                    onClick={getHAHAHandler}
                    disabled={walletAddress ? false : true}
                  >
                    GET $HAHA
                  </button>
                </div>
              </div>
              <article className="panel is-grey-darker">
                <p className="panel-heading">Transaction Data</p>
                <div className="panel-block">
                  <p>
                    Check on Soneium Testnet Explorer:
                    {transactionData ? (
                      <a
                        href={linkab + transactionData}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {` ${transactionData}`}
                      </a>
                    ) : (
                      "--"
                    )}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
