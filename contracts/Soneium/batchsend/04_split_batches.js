const fs = require("fs");
const path = require("path");

// Input file
const inputFile = "./batchsend/out_03_holders_balances.json";
// Output directory
const outputDir = "./batchsend/batches/";
// Batch size
const batchSize = 20;

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function splitBatches() {
  try {
    // Read balances file
    const balances = JSON.parse(fs.readFileSync(inputFile, "utf-8"));

    // Validate input
    if (!Array.isArray(balances)) {
      throw new Error(
        "Input file must contain an array of wallet-balance objects."
      );
    }

    console.log(`Loaded ${balances.length} wallet-balance pairs.`);

    // Calculate the total number of batches
    const totalBatches = Math.ceil(balances.length / batchSize);
    const batchDigits = totalBatches.toString().length; // Number of digits in the total batch count

    console.log(`Total batches to create: ${totalBatches}`);

    // Split into batches
    let batchNumber = 0;
    for (let i = 0; i < balances.length; i += batchSize) {
      batchNumber++;
      const batch = balances.slice(i, i + batchSize);

      // Generate batch file name with leading zeros
      const paddedBatchNumber = String(batchNumber).padStart(batchDigits, "0");
      const batchFileName = path.join(
        outputDir,
        `batch_${paddedBatchNumber}.json`
      );

      // Save each batch to a separate JSON file
      fs.writeFileSync(batchFileName, JSON.stringify(batch, null, 2), "utf-8");

      console.log(
        `Created batch file: ${batchFileName} with ${batch.length} entries.`
      );
    }

    console.log(`Successfully split into ${batchNumber} batches.`);
  } catch (error) {
    console.error("Error processing batches:", error.message);
  }
}

// Run the batch splitting function
splitBatches();
