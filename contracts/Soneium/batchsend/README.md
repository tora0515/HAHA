# Token Batch Transfer Process

This README provides step-by-step instructions for performing batch transfers of tokens on the Astar zkEVM to Soneium/Minato. The process includes downloading holder data, fetching balances, splitting batches, and sending transactions.

## Prerequisites

1. **Node.js and npm**: Ensure you have Node.js installed.
2. **Python**: Python is required for processing holder data.
3. **Virtual Environment**: A Python virtual environment is recommended for dependencies.
4. **Private Key**: Add your private key and RPC URL to the `.env` file in the following format:
   ```
   PRIVATE_KEY=<your-private-key>
   MINATO_RPC_URL=https://rpc.startale.com/astar-zkevm**
   ```

**Make sure to allow HAHA to be spent by Batchsend Contract**

---

## Step-by-Step Guide

### 1. Download Holder Data

1. Visit [Astar zkEVM Explorer](https://astar-zkevm.explorer.startale.com/token/0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18?tab=holders).
2. Export the holders' data as a CSV file.
3. Save the file to the `batchsend` directory as holders_0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18.csv.
4. Cleans the wallets (remove team wallet, dead/0x...000 wallets, etc)

---

### 2. Test Blockchain Connection

cd into the correct directory contracts/Minato or contracts/Soneium

Run the following command to ensure a successful connection to the blockchain:

```bash
node batchsend/01_test_connection.js
```

If the connection fails, verify your `.env` file configuration.

Be sure to test all chains, rpc urls are commented above the variable.

---

### 3. Process Holder Data

Open 02_holders_list.py and double check the paths varaibles at the top. ensure the input_csv = variable is correctly defined (matches the name of the file downloaded in step 1)

Activate the Python virtual environment and run the script to extract holder addresses:

1. Activate the environment:
   ```bash
   source venv/bin/activate
   ```
2. Run the holder extraction script:

   ```bash
   python batchsend/02_holders_list.py
   ```

   You can ignore the expected number warning (was used for testing) But make sure the Actual number of addresses saved equals the holders less any exclusions from step 1.

   As of Jan 25, there are 6 wallets to remove during the cleansing step. Make sure the Actual number of addresses saved is 6 less thant the total holders at snapshot. Time of snapshot: 1343 wallets, less 6, 1337 wallets to transfer to.

3. Deactivate the environment after processing:
   ```bash
   deactivate
   ```

This will create `02_holders_list.json` in the `batchsend` directory.

---

### 4. Fetch Balances

Run the following command to fetch token balances for all holder addresses:

```bash
node batchsend/03_fetch_balances.js
```

This will take some time. (record start and end time printed at the end of the log. This as the official snapshot)

- The script will generate two files:

  1. **`out_03_holders_balances.json`**: Contains all wallet addresses with their balances.
  2. **`out_03_zero_balances.txt`**: Lists all addresses with zero balance.

  **Action Required**: Check the `zero_balances.txt` file and review it to ensure accuracy.
  **Remove all zero ballance wallets** This may occur due to timing: reading balances from the block takes time, there may be a sell during this time that zero's a wallet. Make sure to check

  **NOTE**:

  - Holder's snapshot is saved in /batchsend/out_03_holders_snapshot.csv. Save this file in google drive and provide link to socials.

  - Make sure wallet numbers and total HAHA match input file.

---

### 5. Split Batches

Run the following command to split the holder balances into manageable batch files:

```bash
node batchsend/04_split_batches.js
```

- The script generates batch files (e.g., `batch_001.json`, `batch_002.json`) in the `batchsend/batches` folder.
- Files are named with leading zeros to ensure correct processing order.

---

### 6. Prep and Send Batches

**Approve Wallet**

0. Copy the batchsender address: 0xFc53306FAAd5583Fb3985622189e260e786035ea (Current: Soneium contract)

1. Go to https://soneium.blockscout.com/ and search for the token you are sending
2. Connect the token holding wallet
3. Navigate to the Contract tab and the Write section
4. in the 2. approve write section:
   a. enter the blocksender address into the 'spender(address)\*' section
   b. enter the total number of tokens to be batchsent and click the x10^18 button. (best to round up a bit)
5. Click simulate to check if it will work, then click 'Write'

**Open 05_batch_transfer.js**
Change the following consts:

1. const tokenAddress
2. (Only if changing wallets/networks)
   a. change the PRIVATE_KEY in the .env file and update name in const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
   b. Create/change the RPC_URL variable in .env file and update in const provider = new ethers.JsonRpcProvider(process.env.MINATO_RPC_URL);

- The script will loop through all JSON files in the `batches` folder and process them one by one.
- **Best Practice**: For large transfers, move only the batches you want to process into the `batches` folder. Archive processed files to prevent reprocessing.

**Note**: If any errors occur (e.g., insufficient gas or invalid wallets), the script will stop and log the issue.

Send token batches to their respective wallets using the following command:

```bash
node batchsend/05_batch_transfer.js
```

---

### Additional Notes

- **Error Handling**:
  - Review logs after each step for any issues.
  - Address any errors (e.g., zero balances, invalid addresses) before proceeding to the next step.
- **Migration to Soneium**: Update the RPC URL and token contract address in the `.env` file when migrating to the Soneium network.

---

By following this guide, you can ensure smooth and error-free batch transfers. Save this document for future reference, especially when migrating to the Soneium chain.
