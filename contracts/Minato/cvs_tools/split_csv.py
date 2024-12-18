import pandas as pd
import os

# Input file path
input_csv = "cvs_tools/holders_0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18.csv"
output_folder = "./batches"  # Output folder for batch files
batch_size = 20  # Batch size: 20 wallets
log_file = "./batch_log.txt"  # Log file for validation and batch summaries

# Ensure output folder exists
os.makedirs(output_folder, exist_ok=True)

# Prepare log file
with open(log_file, "w") as log:
    log.write("Batch Processing Log\n")
    log.write("=" * 50 + "\n")

# Load the snapshot CSV file
try:
    # Read CSV with headers (Column A: Wallet, Column B: Balance)
    df = pd.read_csv(input_csv, header=0, dtype={0: str, 1: float})
except FileNotFoundError:
    print(f"Error: File '{input_csv}' not found.")
    exit()
except Exception as e:
    print(f"Error reading the CSV file: {e}")
    exit()

# Filter out burn addresses and zero addresses
burn_addresses = [
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dEaD"
]
df = df[~df.iloc[:, 0].isin(burn_addresses)]  # Filter based on the first column (Wallet Address)
print(f"Filtered out burn addresses. Remaining rows: {len(df)}")

# Ensure balances are integers without decimals
def preprocess_balance(balance):
    try:
        # Convert balance to integer representing raw token value (10^18)
        return int(balance * 10**18)
    except Exception as e:
        print(f"Error converting balance {balance}: {e}")
        return 0

df.iloc[:, 1] = df.iloc[:, 1].apply(preprocess_balance)

# Validate data
invalid_rows = df[df.iloc[:, 1] <= 0]  # Find rows with invalid balances
if not invalid_rows.empty:
    print(f"Found {len(invalid_rows)} invalid rows. Logging them.")
    with open(log_file, "a") as log:
        log.write("Invalid Rows:\n")
        log.write(invalid_rows.to_csv(index=False, header=False) + "\n")
    df = df[df.iloc[:, 1] > 0]  # Remove invalid rows
print(f"Total valid rows: {len(df)}")

# Split the file into batches and log sums
with open(log_file, "a") as log:
    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i + batch_size]
        batch_filename = os.path.join(output_folder, f"batch_{i // batch_size + 1}.csv")
        
        # Save batch file without headers
        batch.to_csv(batch_filename, index=False, header=False, quoting=3)  # quoting=3 avoids quotes
        print(f"Created batch file: {batch_filename}")
        
        # Log batch sum and details
        batch_sum = batch.iloc[:, 1].sum()
        log.write(f"Batch {i // batch_size + 1}:\n")
        log.write(f"- Wallets: {len(batch)}\n")
        log.write(f"- Total Balance: {batch_sum}\n")
        log.write("-" * 50 + "\n")

print(f"Total batches created: {len(df) // batch_size + (1 if len(df) % batch_size > 0 else 0)}")
