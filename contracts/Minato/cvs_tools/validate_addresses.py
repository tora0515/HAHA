from eth_utils import is_checksum_address

# Path to the batch file
batch_file = "./batches/batch_1.csv"

# Read the CSV and validate addresses
with open(batch_file, "r") as file:
    lines = file.readlines()

# Skip the header row and validate addresses
invalid_addresses = []
for i, line in enumerate(lines[1:], start=2):  # Start at line 2 (index 1) for clarity
    address = line.split(",")[0].strip()  # Get the first column (address)
    if not is_checksum_address(address):
        invalid_addresses.append((i, address))

if invalid_addresses:
    print("Invalid addresses found:")
    for line_num, address in invalid_addresses:
        print(f"Line {line_num}: {address}")
else:
    print("All addresses are valid!")
