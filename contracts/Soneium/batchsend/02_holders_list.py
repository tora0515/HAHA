import pandas as pd
import json

# Paths
input_csv = "batchsend/holders_0xA84DBE4602cBAcfe8Cd858Fe910b88ba0e8b8B18.csv"
output_json = "batchsend/out_02_holders_list.json"

# Load the CSV file
try:
    # Read only column A (wallet addresses), skip the header row (row 0)
    df = pd.read_csv(input_csv, usecols=[0], skiprows=1, header=None, dtype=str)
    wallet_addresses = df[0].tolist()  # Convert the column to a list
except FileNotFoundError:
    print(f"Error: File '{input_csv}' not found.")
    exit()
except Exception as e:
    print(f"Error reading the CSV file: {e}")
    exit()

# Validate wallet addresses (basic Ethereum address validation)
valid_wallets = [addr for addr in wallet_addresses if addr.startswith("0x") and len(addr) == 42]

# Save to JSON
try:
    with open(output_json, "w") as json_file:
        json.dump(valid_wallets, json_file, indent=4)
    print(f"Successfully saved {len(valid_wallets)} wallet addresses to '{output_json}'")
    print(f"Expected number of addresses: 1355")
    print(f"Actual number of addresses saved: {len(valid_wallets)}")
    if len(valid_wallets) != 1355:
        print("Warning: The number of addresses saved does not match the expected count!")
except Exception as e:
    print(f"Error saving to JSON file: {e}")
    exit()
