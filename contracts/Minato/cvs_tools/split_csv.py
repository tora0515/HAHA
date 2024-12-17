import pandas as pd
import os

# Input file path
input_csv = "cvs_tools/processed-test-original-snapshot.csv"  # Updated input file
output_folder = "./batches"  # Output folder for batch files
batch_size = 20  # Batch size: 20 wallets

# Ensure output folder exists
os.makedirs(output_folder, exist_ok=True)

# Load the processed CSV file
try:
    # Read CSV without headers, skipping the header row explicitly
    df = pd.read_csv(input_csv, header=None, skiprows=1, dtype={0: str, 1: str})
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
df = df[~df[0].isin(burn_addresses)]  # Filter based on the first column (HolderAddress)
print(f"Filtered out burn addresses. Remaining rows: {len(df)}")

# Split the file into batches
for i in range(0, len(df), batch_size):
    batch = df.iloc[i:i + batch_size]
    batch_filename = os.path.join(output_folder, f"batch_{i // batch_size + 1}.csv")
    
    # Save batch file without headers and ensure values are saved as plain strings
    batch[1] = batch[1].apply(lambda x: str(int(float(x))))  # Ensure no scientific notation
    batch.to_csv(batch_filename, index=False, header=False, quoting=3)  # quoting=3 avoids quotes
    print(f"Created batch file: {batch_filename}")

print(f"Total batches created: {len(df) // batch_size + (1 if len(df) % batch_size > 0 else 0)}")
