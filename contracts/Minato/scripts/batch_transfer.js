const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper to sleep between calls (in milliseconds)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const batchFolder = "./batches"; // Folder containing batch files
  const tokenAddress = "0x1E8893B544CD6fC26BbA141Fdd8e808c1570A2D0"; // Replace with HMBT token address
  const batchSenderAddress = "0x06A30D6da94A8391d0B8c1C203496F03Fc28C0Bc"; // Replace with BatchSender address
  const delayBetweenBatches = 5000; // Delay in ms (5 seconds)

  // Get signer (deployer wallet)
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer address:", deployer.address);

  // Connect to BatchSender contract
  const BatchSender = await ethers.getContractAt(
    "BatchSender",
    batchSenderAddress
  );

  // Create or clear the gas usage log file
  const gasLogFile = path.join(__dirname, "gas_usage.log");
  fs.writeFileSync(gasLogFile, "Batch,Gas Used\n"); // Clear previous log

  // Process each batch file
  const batchFiles = fs
    .readdirSync(batchFolder)
    .filter((file) => file.endsWith(".csv"));
  console.log(`Found ${batchFiles.length} batch files.`);

  for (const [index, batchFile] of batchFiles.entries()) {
    console.log(`Processing batch file: ${batchFile}`);

    // Read the batch file
    const filePath = path.join(batchFolder, batchFile);
    const data = fs.readFileSync(filePath, "utf8");
    const rows = data.trim().split("\n"); // Reads all rows

    // Parse wallet addresses and token amounts
    const recipients = [];
    const amounts = [];

    for (const [rowIndex, row] of rows.entries()) {
      try {
        const [address, amount] = row.split(",");
        const cleanedAddress = address.trim();
        const cleanedAmount = amount.trim();

        // Validate Ethereum address
        if (!ethers.isAddress(cleanedAddress)) {
          console.error(
            `Invalid address at row ${rowIndex + 1}: ${cleanedAddress}`
          );
          continue;
        }

        // Parse amount and ensure it is a valid number
        if (isNaN(cleanedAmount) || Number(cleanedAmount) <= 0) {
          console.error(
            `Invalid amount at row ${rowIndex + 1}: ${cleanedAmount}`
          );
          continue;
        }

        // Convert user-friendly amount to raw units (18 decimals)
        const parsedAmount = ethers.parseUnits(cleanedAmount, 18);
        recipients.push(cleanedAddress);
        amounts.push(parsedAmount);
      } catch (error) {
        console.error(`Error parsing row ${rowIndex + 1}: ${row}`);
        console.error(error);
        continue;
      }
    }

    // Log the inputs for this batch
    console.log(`Sending to ${recipients.length} recipients...`);
    console.log("Recipients:", recipients);
    console.log(
      "Amounts:",
      amounts.map((a) => a.toString())
    );

    // Validate the batch size
    if (recipients.length === 0) {
      console.warn(
        `Warning: Batch ${batchFile} is empty. Skipping this batch.`
      );
      continue;
    }

    // Call batchTransfer
    try {
      const tx = await BatchSender.batchTransfer(
        tokenAddress,
        recipients,
        amounts
      );
      const receipt = await tx.wait();

      // Log gas usage
      const gasUsed = receipt.gasUsed.toString();
      fs.appendFileSync(gasLogFile, `${batchFile},${gasUsed}\n`);
      console.log(`Batch ${batchFile} processed. Gas used: ${gasUsed}`);
    } catch (error) {
      console.error(
        `Error during batch transfer for file ${batchFile}:`,
        error
      );
    }

    // Wait before processing the next batch
    if (index < batchFiles.length - 1) {
      console.log(
        `Waiting ${delayBetweenBatches / 1000} seconds before the next batch...`
      );
      await sleep(delayBetweenBatches);
    }
  }

  console.log("All batches processed. Gas usage logged in 'gas_usage.log'.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during batch transfer:", error);
    process.exit(1);
  });
