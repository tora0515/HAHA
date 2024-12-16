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
    const rows = data.trim().split("\n").slice(1); // Skip header

    // Parse wallet addresses and token amounts
    const recipients = [];
    const amounts = [];
    for (const row of rows) {
      const [address, amount] = row.split(",");
      recipients.push(address.trim());
      amounts.push(ethers.parseUnits(amount.trim(), 18)); // Adjust decimals as needed
    }

    // Call batchTransfer
    console.log(`Sending to ${recipients.length} recipients...`);
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
