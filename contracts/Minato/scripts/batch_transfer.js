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

  console.log("Initial token balance:", ethers.formatUnits(initialBalance, 18));
  console.log(
    "Current allowance for BatchSender contract:",
    ethers.formatUnits(allowance, 18)
  );

  // Ensure sufficient allowance is set
  const totalNeeded = ethers.parseUnits("1000000", 18); // Example amount to approve
  if (allowance < totalNeeded) {
    console.log("Approving tokens for BatchSender contract...");
    const approveTx = await tokenContract.approve(
      batchSenderAddress,
      totalNeeded
    );
    await approveTx.wait();
    console.log("Tokens approved successfully!");
  }

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

        // Parse amount to 18 decimals
        const parsedAmount = ethers.parseUnits(cleanedAmount, 18);
        recipients.push(cleanedAddress);
        amounts.push(parsedAmount);
      } catch (error) {
        console.error(`Error parsing row ${rowIndex + 1}: ${row}`);
        console.error(error);
        continue;
      }
    }

    // Log balances before transfer
    const balanceBefore = await tokenContract.balanceOf(deployer.address);
    console.log(
      `Sender balance before transfer: ${ethers.formatUnits(
        balanceBefore,
        18
      )} tokens`
    );

    const totalBatchAmount = amounts.reduce(
      (sum, amount) => sum.add(amount),
      ethers.BigNumber.from(0)
    );

    // Log the total batch amount
    console.log(
      `Total tokens to transfer in this batch: ${ethers.formatUnits(
        totalBatchAmount,
        18
      )} tokens`
    );

    // Validate against the sender's balance
    const deployerBalance = await tokenContract.balanceOf(deployer.address);
    if (totalBatchAmount.gt(deployerBalance)) {
      console.error(
        `Error: Total batch amount (${ethers.formatUnits(
          totalBatchAmount,
          18
        )}) exceeds your current balance (${ethers.formatUnits(
          deployerBalance,
          18
        )})`
      );
      return; // Stop further execution for this batch
    }

    // Proceed with the batch transfer if validation passes
    console.log("Batch validated. Proceeding with transfer...");

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

    // Log balances after transfer
    const balanceAfter = await tokenContract.balanceOf(deployer.address);
    console.log(
      `Sender balance after transfer: ${ethers.formatUnits(
        balanceAfter,
        18
      )} tokens`
    );

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
