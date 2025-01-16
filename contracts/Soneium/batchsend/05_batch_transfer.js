require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Helper to sleep between calls (in milliseconds)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const batchFolder = "./batchsend/batches"; // Corrected folder path for JSON files
  const tokenAddress = "0xA8FeAae65C44B458A16Ea4E709036A2ee85d073A"; // HAHA Token Address, Input Soneium addr once deployed
  const batchSenderAddress = "0xFc53306FAAd5583Fb3985622189e260e786035ea"; // Updated BatchSender address once deployed on Soneium
  const delayBetweenBatches = 5000; // Delay in ms (5 seconds)

  // Get signer from private key
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  const provider = new ethers.JsonRpcProvider(process.env.SONEIUM_RPC_URL);
  const signer = wallet.connect(provider);

  console.log("Using wallet address:", signer.address);

  // Connect to token and batch sender contracts
  const tokenContract = new ethers.Contract(
    tokenAddress,
    [
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ],
    signer
  );
  const BatchSender = new ethers.Contract(
    batchSenderAddress,
    [
      "function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)",
    ],
    signer
  );

  // Get token decimals
  const decimals = await tokenContract.decimals();
  console.log(`Token decimals: ${decimals}`);

  // Check initial allowance and balance
  const initialBalance = await tokenContract.balanceOf(signer.address);
  const allowance = await tokenContract.allowance(
    signer.address,
    batchSenderAddress
  );

  console.log("Initial token balance (raw):", initialBalance.toString());
  console.log("Allowance for BatchSender contract:", allowance.toString());

  // Process each batch file
  const batchFiles = fs
    .readdirSync(batchFolder)
    .filter((file) => file.endsWith(".json"));
  console.log(`Found ${batchFiles.length} batch files.`);

  for (const [index, batchFile] of batchFiles.entries()) {
    console.log(`Processing batch file: ${batchFile}`);

    const filePath = path.join(batchFolder, batchFile);
    const batchData = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const recipients = [];
    const amounts = [];

    for (const entry of batchData) {
      try {
        // Extract wallet address and balance
        const { wallet, balance } = entry;

        // Validate Ethereum address
        if (!ethers.isAddress(wallet)) {
          console.error(`Invalid address: ${wallet}`);
          continue;
        }

        // Add to recipients and amounts arrays
        recipients.push(wallet);
        amounts.push(BigInt(balance)); // No need for decimals as amounts are raw
      } catch (error) {
        console.error(`Error processing entry in batch ${batchFile}:`, error);
        continue;
      }
    }

    // Final validation of recipients and amounts
    if (recipients.length === 0 || amounts.length === 0) {
      console.error(`Error: No valid data found in batch ${batchFile}.`);
      continue;
    }

    console.log("Validated recipients and amounts.");
    console.log("Recipients:", recipients);
    console.log("Amounts:", amounts);

    // Log balances before transfer
    const balanceBefore = await tokenContract.balanceOf(signer.address);
    console.log(
      `Sender balance before transfer (raw): ${balanceBefore.toString()}`
    );

    const totalBatchAmount = amounts.reduce((sum, amount) => sum + amount, 0n);
    console.log(
      `Total tokens to transfer in this batch: ${totalBatchAmount.toString()}`
    );

    // Validate against the sender's balance
    if (totalBatchAmount > balanceBefore) {
      console.error(
        `Error: Total batch amount (${totalBatchAmount.toString()}) exceeds your current balance (${balanceBefore.toString()}).`
      );
      continue;
    }

    // Proceed with the batch transfer
    try {
      console.log("Calling batchTransfer...");
      const tx = await BatchSender.batchTransfer(
        tokenAddress,
        recipients,
        amounts
      );
      const receipt = await tx.wait();

      console.log(
        `Batch ${batchFile} processed successfully. Gas used: ${receipt.gasUsed.toString()}`
      );
    } catch (error) {
      console.error(
        `Error during batch transfer for file ${batchFile}:`,
        error
      );
      break; // Stop the script on error
    }

    // Log balances after transfer
    const balanceAfter = await tokenContract.balanceOf(signer.address);
    console.log(
      `Sender balance after transfer (raw): ${balanceAfter.toString()}`
    );

    // Wait before processing the next batch
    if (index < batchFiles.length - 1) {
      console.log(
        `Waiting ${delayBetweenBatches / 1000} seconds before the next batch...`
      );
      await sleep(delayBetweenBatches);
    }
  }

  console.log("All batches processed successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during batch transfer:", error);
    process.exit(1);
  });
