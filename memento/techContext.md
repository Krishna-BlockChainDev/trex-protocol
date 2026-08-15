# Tech Context

## Smart Contracts

| Technology           | Version | Notes                                                                               |
| -------------------- | ------- | ----------------------------------------------------------------------------------- |
| Solidity             | 0.8.x   | ERC-3643 T-REX protocol                                                             |
| Hardhat              | 2.x     | Compile, test, deploy                                                               |
| ethers.js            | v5      | Used in Hardhat scripts (`.address`, `.deployed()`, `ethers.constants.AddressZero`) |
| @onchain-id/solidity | latest  | OnchainID (IERC734/IERC735) contracts                                               |
| TypeScript           | 5.x     | Script authoring                                                                    |

### Important ethers v5 vs v6 differences

The smart-contracts package uses **ethers v5**:

- `instance.address` (not `await instance.getAddress()`)
- `instance.deployed()` (not `await instance.waitForDeployment()`)
- `ethers.constants.AddressZero` (not `ethers.ZeroAddress`)
- `ethers.utils.formatEther()` (not `ethers.formatEther()`)
- `ethers.utils.keccak256()` (not `ethers.keccak256()`)
- `ethers.utils.id()` for event topic hashing

## Frontend

| Technology  | Version | Notes                                             |
| ----------- | ------- | ------------------------------------------------- |
| Next.js     | 14      | Pages Router (not App Router)                     |
| TypeScript  | 5.x     | Strict mode                                       |
| wagmi       | v2      | Wallet connection + contract interaction          |
| viem        | v2      | Low-level EVM calls (used in useDeploymentWizard) |
| RainbowKit  | v2      | Wallet picker UI                                  |
| Prisma      | 5.22    | ORM — NOT v6. Use v5 schema syntax                |
| PostgreSQL  | 15+     | Primary database                                  |
| TailwindCSS | 3.x     | Styling                                           |

### Path Aliases

- `@/` → `frontend/` (configured in `tsconfig.json`)

### Key Directories

```
frontend/
  config/           ← deployed-addresses.*.json + index.ts (ChainInfrastructure types)
  contracts/        ← ABIs, deployBytecodes.ts, config.ts
  contexts/         ← TokenRegistryContext.tsx (infra + token state)
  hooks/            ← useDeploymentWizard.ts, useToken.ts, etc.
  lib/
    api/            ← client-side fetch helpers (ecosystems, infrastructure, etc.)
    db.ts           ← Prisma client singleton
  pages/
    api/            ← Next.js API routes
      ecosystems/   ← CRUD for token ecosystems
      infrastructure/ ← GET/POST chain infrastructure
      compliance/   ← compliance rules
  prisma/
    schema.prisma   ← DB schema (ChainInfrastructure + TokenEcosystem)
    migrations/     ← SQL migration files
    seed.ts         ← Seed script
    seed.data.ts    ← Seed data (Sepolia addresses)
  types/
    tokenRegistry.ts ← DeployedTokenEcosystem, DeployedChainInfrastructure, etc.
```

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- MetaMask or compatible wallet

### First-time setup

```bash
# Install dependencies
cd smart-contracts && npm install
cd ../frontend && npm install

# Set up DB
cd frontend
cp .env.local.example .env.local
# Edit .env.local: set DATABASE_URL
npx prisma migrate dev
npm run db:seed

# Start dev server
npm run dev
```

### Deploy infrastructure (once per chain)

```bash
cd smart-contracts

# Hardhat local node
npx hardhat node &
FRONTEND_URL=http://localhost:3000 npx hardhat run scripts/deploy-infrastructure.ts --network hardhat

# Sepolia
FRONTEND_URL=https://your-app.com npx hardhat run scripts/deploy-infrastructure.ts --network sepolia
```

### Deploy a token (per token)

```bash
cd smart-contracts
TOKEN_NAME="Acme Token" TOKEN_SYMBOL=ACME ISSUER_ADDRESS=0x... \
FRONTEND_URL=http://localhost:3000 \
npx hardhat run scripts/deploy-token.ts --network hardhat
```

## Environment Variables

### Frontend (`.env.local`)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/trex
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

### Smart Contracts (`.env`)

```
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
ETHERSCAN_API_KEY=...
FRONTEND_URL=http://localhost:3000
```

## Prisma Notes

- Package is `prisma@5.22.0` — NOT v6
- The VSCode Prisma extension may show v6 language errors — ignore them
- Run `npx prisma generate` after any schema change
- Run `npx prisma migrate dev --name <name>` to create migration files
- The `chainInfrastructure` model maps to `chain_infrastructure` table (`@@map`)
- The `tokenEcosystem` model maps to `token_ecosystem` table (`@@map`)
