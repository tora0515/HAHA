const fs = require("fs");
const ethers = require("ethers");
const { parse } = require("json2csv"); // For converting JSON to CSV

// Input file
const inputFilePath = "./batchsend/out_02_holders_list.json";
// Output files
const outputFilePath = "./batchsend/out_03_holders_balances.json";
const zeroBalanceLogPath = "./batchsend/out_03_zero_balances.log";
const csvOutputFilePath = "./batchsend/out_03_holders_snapshot.csv"; // New CSV output file

// Astar zkEVM Contract and network settings for HAHA token
const RPC_URL = "https://rpc.startale.com/astar-zkevm";
const TOKEN_ADDRESS = "0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18";

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC20 ABI (simplified for balanceOf)
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

// Helper to get current UTC time
function getUTCTime() {
  return new Date().toISOString(); // Returns ISO string in UTC
}

let scriptStartTime = getUTCTime(); // Initialize the start time here

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

// Additional function to convert balances to human-readable CSV
function createCsvFromBalances() {
  try {
    console.log(`Reading data from ${outputFilePath}...`);
    const balances = JSON.parse(fs.readFileSync(outputFilePath, "utf8"));

    // Convert raw balances (10^18) to human-readable format
    const humanReadableBalances = balances.map(({ wallet, balance }) => ({
      wallet,
      balance: ethers.formatUnits(balance, 18), // Converts from wei to ether (human-readable)
    }));

    // Convert JSON to CSV
    const csv = parse(humanReadableBalances, { fields: ["wallet", "balance"] });

    // Save the CSV file
    fs.writeFileSync(csvOutputFilePath, csv);
    console.log(`Human-readable balances saved to ${csvOutputFilePath}`);
  } catch (err) {
    console.error("Error creating CSV file:", err);
  }
}

// Run the main function and append CSV generation
fetchBalances()
  .then(() => {
    console.log(`Script started at: ${scriptStartTime}`);
    console.log(`Script finished at: ${getUTCTime()}`);
    createCsvFromBalances(); // Call the CSV generation function after fetchBalances
  })
  .catch((err) => {
    console.error("Unhandled error in script:", err);
    console.log(`Script started at: ${scriptStartTime}`);
    console.log(`Script finished at: ${getUTCTime()}`);
  });
