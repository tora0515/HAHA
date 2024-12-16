import pandas as pd
import os
from decimal import Decimal, getcontext

# Set Decimal precision to 18 places
getcontext().prec = 18

# Input file path
input_csv = "cvs_tools/test-original-snapshot.csv"  # Input CSV file in cvs_tools
output_folder = "./batches"  # Output folder for batch files
batch_size = 20  # Updated batch size to 20 wallets

# Ensure output folder exists
os.makedirs(output_folder, exist_ok=True)

# Load the original CSV file
try:
    # Read CSV file and force all values to be strings to preserve precision
    df = pd.read_csv(input_csv, dtype=str)
except FileNotFoundError:
    print(f"Error: File '{input_csv}' not found.")
    exit()

# Convert 'Balance' values to Decimal and ensure correctness
try:
    df["Balance"] = df["Balance"].apply(lambda x: Decimal(x))
except KeyError:
    print("Error: The CSV must have 'HolderAddress' and 'Balance' columns.")
    exit()
except Exception as e:
    print(f"Error while converting Balance to Decimal: {e}")
    exit()

# Filter out burn addresses and zero address
burn_addresses = ["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dEaD"]
df = df[~df["HolderAddress"].isin(burn_addresses)]
print(f"Filtered out {len(df) - len(df[~df['HolderAddress'].isin(burn_addresses)])} invalid addresses.")

# Split the file into batches
for i in range(0, len(df), batch_size):
    batch = df.iloc[i:i + batch_size]
    batch_filename = os.path.join(output_folder, f"batch_{i // batch_size + 1}.csv")
    
    # Save batch file, ensuring no scientific notation and no headers
    batch.to_csv(batch_filename, index=False, header=False, float_format="%.18f")
    print(f"Created batch file: {batch_filename}")

print(f"Total batches created: {len(df) // batch_size + (1 if len(df) % batch_size > 0 else 0)}")
