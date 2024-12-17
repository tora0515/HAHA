const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper to sleep between calls (in milliseconds)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const batchFolder = "./batches"; // Folder containing batch files
  const tokenAddress = "0x1E8893B544CD6fC26BbA141Fdd8e808c1570A2D0"; // HMBT token address
  const batchSenderAddress = "0xf3124d75d918eC64E6567BB2F699c6D9421CDdC8"; // Updated BatchSender address
  const delayBetweenBatches = 5000; // Delay in ms (5 seconds)

  // Get signer (deployer wallet)
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer address:", deployer.address);

  // Connect to token and batch sender contracts
  const tokenContract = await ethers.getContractAt("ERC20", tokenAddress);
  const BatchSender = await ethers.getContractAt(
    "BatchSender",
    batchSenderAddress
  );

  // Check initial allowance and balance
  const initialBalance = await tokenContract.balanceOf(deployer.address);
  const allowance = await tokenContract.allowance(
    deployer.address,
    batchSenderAddress
  );

  console.log("Initial token balance (raw):", initialBalance.toString());
  console.log("Allowance for BatchSender contract:", allowance.toString());

  // Process each batch file
  const batchFiles = fs
    .readdirSync(batchFolder)
    .filter((file) => file.endsWith(".csv"));
  console.log(`Found ${batchFiles.length} batch files.`);

  for (const [index, batchFile] of batchFiles.entries()) {
    console.log(`Processing batch file: ${batchFile}`);

    const filePath = path.join(batchFolder, batchFile);
    const rows = fs.readFileSync(filePath, "utf8").trim().split("\n");

    const recipients = [];
    const amounts = [];

    for (const [rowIndex, row] of rows.entries()) {
      try {
        const [address, amount] = row.split(",");
        const cleanedAddress = address.trim();
        let cleanedAmount = amount.trim();

        // Validate Ethereum address
        if (!ethers.isAddress(cleanedAddress)) {
          console.error(
            `Invalid address at row ${rowIndex + 1}: ${cleanedAddress}`
          );
          continue;
        }

        // Ensure the amount is treated as a clean BigInt
        cleanedAmount = cleanedAmount.replace(/\s/g, ""); // Remove extra spaces
        if (cleanedAmount.includes("E") || cleanedAmount.includes("e")) {
          cleanedAmount = BigInt(
            Number.parseFloat(cleanedAmount).toFixed(0)
          ).toString();
        }
        const parsedAmount = BigInt(cleanedAmount);

        recipients.push(cleanedAddress);
        amounts.push(parsedAmount);
      } catch (error) {
        console.error(`Error parsing row ${rowIndex + 1}: ${row}`);
        console.error(error);
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
    console.log(
      "Amounts:",
      amounts.map((a) => a.toString())
    );

    // Log balances before transfer
    const balanceBefore = await tokenContract.balanceOf(deployer.address);
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
        `Error: Total batch amount (${totalBatchAmount.toString()}) exceeds your current balance (${balanceBefore.toString()})`
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
    }

    // Log balances after transfer
    const balanceAfter = await tokenContract.balanceOf(deployer.address);
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
