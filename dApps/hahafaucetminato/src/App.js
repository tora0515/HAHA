import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { ethers } from "ethers";
import faucetContract from "./ethereum/faucet";
import logo from "./images/mamaround.png";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [signer, setSigner] = useState();
  const [fcContract, setFcContract] = useState();
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [transactionData, setTransactionData] = useState("");

  const linkab = "https://soneium-minato.blockscout.com/tx/";

  const getCurrentWalletConnected = useCallback(async () => {
    if (typeof window != "undefined" && typeof window.ethereum != "undefined") {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          setSigner(provider.getSigner());
          setFcContract(faucetContract(provider));
          setWalletAddress(accounts[0]);
          console.log(accounts[0]);
        } else {
          console.log("Connect by using the Connect Wallet button");
        }
      } catch (err) {
        console.error(err.message);
      }
    } else {
      console.log("Please install MetaMask");
    }
  }, []); // Stable since it depends on no external variables

  const addWalletListener = useCallback(() => {
    if (typeof window != "undefined" && typeof window.ethereum != "undefined") {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          console.log(accounts[0]);
        } else {
          disconnectWallet();
        }
      });
    } else {
      console.log("Please install MetaMask");
    }
  }, []); // Stable since it depends on no external variables

  useEffect(() => {
    getCurrentWalletConnected();
    addWalletListener();
  }, [getCurrentWalletConnected, addWalletListener]);

  const connectWallet = async () => {
    if (typeof window != "undefined" && typeof window.ethereum != "undefined") {
      try {
        /* get provider */
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        /* get accounts */
        const accounts = await provider.send("eth_requestAccounts", []);
        /* get signer */
        setSigner(provider.getSigner());
        /* local contract instance */
        setFcContract(faucetContract(provider));

        setWalletAddress(accounts[0]);
        console.log(accounts[0]);
      } catch (err) {
        console.error(err.message);
      }
    } else {
      /* MetaMask is not installed */
      console.log("Please install MetaMask");
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
                <div class="withdraw-error">{withdrawError}</div>
              )}
              {withdrawSuccess && (
                <div class="withdraw-success">{withdrawSuccess}</div>
              )}{" "}
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
