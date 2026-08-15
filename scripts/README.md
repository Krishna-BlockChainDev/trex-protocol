# Etherscan Mainnet Label Fetcher

Reads a JSON list of Ethereum addresses, fetches their **Etherscan mainnet labels** (name tags, token info, contract names), and exports two output files:

| Output                          | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `output/labeled-addresses.json` | Enriched JSON with all fetched fields       |
| `output/labeled-addresses.xlsx` | Formatted Excel workbook with Summary sheet |

---

## Quick Start

### 1. Install dependencies

```bash
cd scripts
npm install
```

### 2. Set your Etherscan API key

```bash
cp .env.example .env
# Edit .env and set ETHERSCAN_API_KEY=<your_key>
```

> Get a free API key at [etherscan.io/myapikey](https://etherscan.io/myapikey)

### 3. Prepare your address list

Edit `addresses.json` (or pass your own file via `--input`).

**Supported formats:**

```jsonc
// Object array (with optional notes)
[
  { "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7", "note": "USDT" },
  { "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }
]

// Plain string array
["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]
```

### 4. Run the script

```bash
# Using the default addresses.json
npm run fetch

# Custom input file
npm run fetch -- --input /path/to/my-addresses.json

# Custom input + output directory
npm run fetch -- --input /path/to/my-addresses.json --output /path/to/results/
```

---

## Output Schema

### JSON (`labeled-addresses.json`)

```jsonc
[
  {
    "address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "note": "USDT Token",
    "etherscanLabel": "Tether USD", // Best available label
    "contractName": "TetherToken", // Verified source contract name
    "tokenName": "Tether USD", // ERC-20 token name
    "tokenSymbol": "USDT",
    "tokenDecimals": "6",
    "tokenType": "ERC-20",
    "website": "",
    "twitter": "",
    "isContract": true,
    "fetchedAt": "2024-06-25T07:30:00.000Z",
    "error": "", // Non-empty if fetch failed
  },
]
```

### Excel (`labeled-addresses.xlsx`)

Two sheets:

- **Etherscan Labels** – full data table with auto-filter and frozen header row
- **Summary** – counts for total addresses, labels found, contracts, tokens, coverage %

---

## How Labels Are Resolved

The script tries three sources in priority order:

```
1. Etherscan Token Info API   → tokenName  (best for ERC-20 tokens)
2. Contract Source Code API   → ContractName (verified contracts)
3. HTML scrape of address page → Public Name Tag (fallback)
```

---

## Rate Limiting

- Default: **250 ms** between requests (well within the free-tier 5 req/s limit)
- Each address triggers **2 parallel API calls** + 1 optional HTML scrape
- Retries: **3 attempts** with exponential back-off on failures

---

## Environment Variables

| Variable            | Required | Description            |
| ------------------- | -------- | ---------------------- |
| `ETHERSCAN_API_KEY` | ✅ Yes   | Your Etherscan API key |

---

## Project Structure

```
scripts/
├── fetch-etherscan-labels.ts   ← Main script
├── addresses.json              ← Sample input (edit or replace)
├── package.json
├── tsconfig.json
├── .env.example                ← Copy to .env and fill in your key
├── .env                        ← (gitignored) Your actual API key
├── output/                     ← Generated output files (gitignored)
│   ├── labeled-addresses.json
│   └── labeled-addresses.xlsx
└── README.md
```
