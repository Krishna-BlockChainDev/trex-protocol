# Progress

## What Works

### Core Infrastructure

- ✅ Next.js 14 app with Prisma + PostgreSQL
- ✅ Wallet connection (wagmi + viem)
- ✅ Token ecosystem selector (`TokenEcosystemSelector`)
- ✅ Layout with navigation tabs

### Deployment Wizard

- ✅ Infrastructure deployment panel (TREXFactory, IdentityRegistry, etc.)
- ✅ Token deployment wizard (6-step)
- ✅ Deployment summary with contract addresses

### Token Operations

- ✅ Mint / Burn tokens
- ✅ Transfer / Forced Transfer
- ✅ Freeze / Unfreeze addresses and partial tokens
- ✅ Pause / Unpause token
- ✅ Recovery address management
- ✅ Agent management (addAgent / removeAgent)

### Identity

- ✅ Register investor identity (OID + IdentityRegistry)
- ✅ Add / remove claims
- ✅ Create identity via IdFactory
- ✅ Verification check

### Compliance

- ✅ Bind / unbind compliance modules
- ✅ CountryAllowModule — batch allow/disallow countries
- ✅ CountryRestrictModule — batch restrict/unrestrict countries
- ✅ MaxBalanceModule — set max balance
- ✅ SupplyLimitModule — set supply limit
- ✅ Transfer check panel
- ✅ Module status badge

### Transaction History (fully working as of 2026-06-24)

- ✅ Prisma `TokenTransaction` model with full enrichment fields
- ✅ Etherscan V2 API sync (`lib/explorer.ts`)
- ✅ Two-pass strategy: `txlist` (all contracts) + `getLogs` (semantic events)
- ✅ Duplicate prevention via `@@unique([ecosystemId, txHash, eventType])`
- ✅ 8 contracts scanned per ecosystem:
  - tokenProxy, identityRegistryProxy, identityRegistryStorageProxy
  - trustedIssuersRegistryProxy, claimTopicsRegistryProxy, modularComplianceProxy
  - trexFactory (captures `deployTREXSuite`)
  - oidIdFactory (captures `createIdentity`)
- ✅ Transaction classification by 5 categories:
  - `Token` — mint/burn/transfer/freeze/pause/recovery + addAgent/removeAgent
  - `Identity` — registerIdentity/addClaim/createIdentity/etc.
  - `Compliance` — addModule/setMaxBalance/setCountries/callModuleFunction/etc.
  - `Deploy` — deployTREXSuite (factory), raw EVM proxy creations
  - `Infra` — addTokenFactory, bindRegistry, unknown contract calls
- ✅ Enrichment: gasUsed, gasPrice, txFee, nonce, txIndex, senderAddress, txStatus
- ✅ Incremental sync: `fromBlock = lastSyncedBlock + 1`
- ✅ `lastSyncedAt` + `lastSyncedBlock` tracked on `TokenEcosystem`
- ✅ `GET /api/transactions/sync` endpoint — 25s rate-limited cooldown
- ✅ Client-side auto-polling every 30s via `useTransactionHistory`
- ✅ Live "● LIVE" sync indicator in `TransactionHistorySection`
- ✅ Manual "Refresh Now" button
- ✅ Category filter tabs: All / ⚡ Token / 🛡 Identity / ⚙️ Compliance / 🚀 Deploy / 🔧 Infra
- ✅ Event-type dropdown filter
- ✅ Address search (from / to / sender)
- ✅ Pagination (20 per page)
- ✅ Total Operation Cost card (sum of txFee)
- ✅ Explorer deep-link per tx hash
- ✅ BigInt serialization fixed (no JSON.stringify crash)

## Current DB State (Sepolia, 2 ecosystems, 2026-06-24)

- **99 total rows** across KAU + TREX ecosystems
- **KAU**: 17 rows, highestBlock=11069948
- **TREX**: 82 rows, highestBlock=11069964
- **Zero `System` rows** — all fully classified

## Known Issues / Limitations

- Etherscan free tier: 5 req/sec, offset limit 10,000 txs per call — sufficient for current scale
- `callModuleFunction` events show as `Compliance/ModuleCall` without revealing which subfunction was called (limitation of the encoding — would require ABI decoding of the `bytes` calldata argument)
- `Deploy/Deploy` rows are raw EVM contract creations (proxy + implementation contracts) — not meaningful to end users but captured for completeness

## What's Left to Build

- [ ] Investor portal / investor-facing views
- [ ] CSV export of transaction history
- [ ] Webhook support for real-time push (alternative to polling)
- [ ] Multi-chain support UI (BSC mainnet/testnet currently wired in backend, not exposed in UI)
- [ ] Agent dashboard (view all agents per token)
- [ ] Identity registry browser (view all registered investors)
