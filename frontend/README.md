# ERC-3643 Frontend

A [Next.js](https://nextjs.org) interface for interacting with the ERC-3643 (T-REX) protocol — token management, identity registry, and compliance workflows.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
  - [Local Development](#local-development)
  - [QA / Production (Docker)](#qa--production-docker)
  - [Variable Reference](#variable-reference)
- [Local Development](#local-development-1)
- [Docker — Build & Run](#docker--build--run)
  - [Using docker compose](#using-docker-compose)
  - [Using plain docker CLI](#using-plain-docker-cli)
- [Health Check](#health-check)
- [Project Structure](#project-structure)

---

## Prerequisites

| Tool           | Version                       |
| -------------- | ----------------------------- |
| Node.js        | 20 +                          |
| npm            | 10 +                          |
| Docker         | 24 + (for containerised runs) |
| Docker Compose | v2 + (for compose runs)       |

---

## Environment Variables

### Local Development

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

`.env.local` is loaded automatically by Next.js for `npm run dev` and is **gitignored** — never commit it.

### QA / Production (Docker)

Two pre-configured env files are provided:

| File        | Used for            |
| ----------- | ------------------- |
| `.env.qa`   | QA / staging builds |
| `.env.prod` | Production builds   |

Both files are **gitignored**. Populate them from the template before building:

```bash
cp .env.example .env.qa
cp .env.example .env.prod
# then edit each file with the correct values
```

> **`ISSUER_PRIVATE_KEY`** must be left **blank** in both files and injected at runtime via your secrets manager (AWS ECS Task Definition secrets, Kubernetes Secret, SSM Parameter Store, etc.).

### Variable Reference

| Variable                               | Scope                          | Description                                                                                                          |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Build-time                     | WalletConnect Cloud project ID — get one at [cloud.walletconnect.com](https://cloud.walletconnect.com)               |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL`          | Build-time                     | JSON-RPC endpoint for the Sepolia testnet                                                                            |
| `NEXT_PUBLIC_MAINNET_RPC_URL`          | Build-time                     | JSON-RPC endpoint for Ethereum mainnet                                                                               |
| `NEXT_PUBLIC_BSC_TESTNET_RPC_URL`      | Build-time                     | JSON-RPC endpoint for BSC testnet                                                                                    |
| `NEXT_PUBLIC_HARDHAT_RPC_URL`          | Build-time                     | Local Hardhat node URL (dev only)                                                                                    |
| `NEXT_PUBLIC_NETWORK`                  | Build-time                     | Default network shown in the UI (`sepolia` / `mainnet` / `bscTestnet`)                                               |
| `ISSUER_PRIVATE_KEY`                   | **Runtime** (server-side only) | Private key of the ClaimIssuer signing wallet — used only in `/api/sign-claim`. **Never prefix with `NEXT_PUBLIC_`** |

> `NEXT_PUBLIC_*` variables are baked into the JavaScript bundle by Next.js at **build time**. Changing them after the image is built has no effect.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# edit .env.local with your values

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Other useful commands:

```bash
npm run build   # production build
npm run start   # start the production server locally
npm run lint    # run ESLint
```

---

## Docker — Build & Run

The Docker image uses a multi-stage build. The `BUILD_ENV` build argument selects which env file (`.env.qa` or `.env.prod`) is used to bake `NEXT_PUBLIC_*` variables into the bundle.

### Using docker compose

```bash
cd frontend   # all compose commands run from the frontend/ directory

# QA (default)
BUILD_ENV=qa docker compose up --build

# Production
BUILD_ENV=prod docker compose up --build

# Run in the background
BUILD_ENV=prod docker compose up --build -d

# Tear down
docker compose down
```

At runtime `docker compose` also loads the matching env file via `env_file`, which provides `ISSUER_PRIVATE_KEY` for local testing. In a real deployment inject this secret through your orchestration layer instead.

### Using plain docker CLI

#### QA

```bash
# Build
docker build \
  --build-arg BUILD_ENV=qa \
  -t erc3643-frontend:qa \
  ./frontend

# Run
docker run -d \
  --name erc3643-qa \
  -p 3000:3000 \
  -e ISSUER_PRIVATE_KEY=<your_qa_private_key> \
  erc3643-frontend:qa
```

#### Production

```bash
# Build
docker build \
  --build-arg BUILD_ENV=prod \
  -t erc3643-frontend:prod \
  ./frontend

# Run
docker run -d \
  --name erc3643-prod \
  -p 3000:3000 \
  -e ISSUER_PRIVATE_KEY=<your_prod_private_key> \
  erc3643-frontend:prod
```

App is available at **http://localhost:3000**.

---

## Health Check

The container exposes a health-check endpoint used by Docker and load balancers:

```
GET /v1/health-check
```

```bash
curl http://localhost:3000/v1/health-check
```

---

## Project Structure

```
frontend/
├── components/        # Shared React components
├── config/            # Deployed contract address configs per network
├── contracts/         # ABI files and typed contract helpers
├── hooks/             # Custom React hooks (wallet, token, identity …)
├── lib/               # Utility helpers (wagmi config, etc.)
├── pages/             # Next.js pages and API routes
│   └── api/
│       ├── sign-claim.ts      # Server-side claim signing (uses ISSUER_PRIVATE_KEY)
│       └── v1/health-check.ts
├── public/            # Static assets
├── styles/            # Global CSS
├── .env.example       # Variable template — copy to .env.local / .env.qa / .env.prod
├── .env.qa            # QA environment values (gitignored)
├── .env.prod          # Production environment values (gitignored)
├── Dockerfile         # Multi-stage Docker build
└── docker-compose.yml # Local containerised dev / QA
```
