# Token Batch Transfer Process

This README provides step-by-step instructions for performing batch transfers of tokens on the Astar zkEVM chain. The process includes downloading holder data, fetching balances, splitting batches, and sending transactions.

## Prerequisites

1. **Node.js and npm**: Ensure you have Node.js installed.
2. **Python**: Python is required for processing holder data.
3. **Virtual Environment**: A Python virtual environment is recommended for dependencies.
4. **Private Key**: Add your private key and RPC URL to the `.env` file in the following format:
   ```
   PRIVATE_KEY=<your-private-key>
   MINATO_RPC_URL=https://rpc.startale.com/astar-zkevm
   ```

---

## Step-by-Step Guide

### 1. Download Holder Data

1. Visit [Astar zkEVM Explorer](https://astar-zkevm.explorer.startale.com/token/0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18?tab=holders).
2. Export the holders' data as a CSV file.
3. Save the file to the `batchsend` directory as `holders.csv`.

---

### 2. Test Blockchain Connection

Run the following command to ensure a successful connection to the blockchain:

```bash
node batchsend/test_connection.js
```

If the connection fails, verify your `.env` file configuration.

---

### 3. Process Holder Data

Activate the Python virtual environment and run the script to extract holder addresses:

1. Activate the environment:
   ```bash
   source venv/bin/activate
   ```
2. Run the holder extraction script:
   ```bash
   python batchsend/holders_list.py
   ```
3. Deactivate the environment after processing:
   ```bash
   deactivate
   ```

This will create `holders_list.json` in the `batchsend` directory.

---

### 4. Fetch Balances

Run the following command to fetch token balances for all holder addresses:

```bash
node batchsend/fetch_balances.js
```

- The script will generate two files:
  1. **`holders_balances.json`**: Contains all wallet addresses with their balances.
  2. **`zero_balances.txt`**: Lists all addresses with zero balance.

**Action Required**: Check the `zero_balances.txt` file and review it to ensure accuracy.

---

### 5. Split Batches

Run the following command to split the holder balances into manageable batch files:

```bash
node batchsend/split_batches.js
```

- The script generates batch files (e.g., `batch_001.json`, `batch_002.json`) in the `batchsend/batches` folder.
- Files are named with leading zeros to ensure correct processing order.

---

### 6. Send Batches

Send token batches to their respective wallets using the following command:

```bash
node batchsend/batch_transfer.js
```

- The script will loop through all JSON files in the `batches` folder and process them one by one.
- **Best Practice**: For large transfers, move only the batches you want to process into the `batches` folder. Archive processed files to prevent reprocessing.

**Note**: If any errors occur (e.g., insufficient gas or invalid wallets), the script will stop and log the issue.

---

### Additional Notes

- **Error Handling**:
  - Review logs after each step for any issues.
  - Address any errors (e.g., zero balances, invalid addresses) before proceeding to the next step.
- **Migration to Soneium**: Update the RPC URL and token contract address in the `.env` file when migrating to the Soneium network.

---

By following this guide, you can ensure smooth and error-free batch transfers. Save this document for future reference, especially when migrating to the Soneium chain.
