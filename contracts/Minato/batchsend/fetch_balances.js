const fs = require("fs");
const ethers = require("ethers");

// Input file
const inputFilePath = "./batchsend/holders_list.json";
// Output files
const outputFilePath = "./batchsend/holders_balances.json";
const zeroBalanceLogPath = "./batchsend/zero_balances.log";

// Contract and network settings
const RPC_URL = "https://rpc.startale.com/astar-zkevm";
const TOKEN_ADDRESS = "0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18";

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC20 ABI (simplified for balanceOf)
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

// Main function
async function fetchBalances() {
  try {
    // Load wallet addresses from input file
    const wallets = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

    console.log(
      `Loaded ${wallets.length} wallet addresses from ${inputFilePath}`
    );

    // Connect to the token contract
    const tokenContract = new ethers.Contract(
      TOKEN_ADDRESS,
      ERC20_ABI,
      provider
    );

    // Prepare results and zero-balance logs
    const balances = [];
    const zeroBalances = [];

    for (const wallet of wallets) {
      try {
        // Fetch the raw balance as BigInt
        const rawBalance = await tokenContract.balanceOf(wallet);

        // Log the raw balance for debugging
        console.log(`Wallet: ${wallet}, Raw Balance: ${rawBalance.toString()}`);

        // Check if the balance is zero
        if (rawBalance === 0n) {
          console.log(`Zero balance detected for wallet: ${wallet}`);
          zeroBalances.push(wallet); // Log zero-balance wallets
        } else {
          // Add to the results if balance > 0
          balances.push({ wallet, balance: rawBalance.toString() }); // Save as string to preserve precision
        }
      } catch (err) {
        console.error(`Error fetching balance for wallet ${wallet}:`, err);
      }
    }

    // Save the non-zero balances to the output file
    fs.writeFileSync(outputFilePath, JSON.stringify(balances, null, 2));
    console.log(`Balances saved to ${outputFilePath}`);

    // Save the zero-balance wallets to a log file
    fs.writeFileSync(zeroBalanceLogPath, zeroBalances.join("\n"));
    console.log(`Zero-balance wallets logged to ${zeroBalanceLogPath}`);
  } catch (err) {
    console.error("Error in fetchBalances:", err);
  }
}

fetchBalances();
