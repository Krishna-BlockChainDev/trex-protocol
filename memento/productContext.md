# Product Context

## Why This Project Exists

Security tokens under ERC-3643 require a complex stack of smart contracts for compliance enforcement, identity verification, and transfer control. Operators need a dashboard that lets them:

1. Deploy compliant security tokens without deep Solidity knowledge
2. Manage investor identities (KYC/AML verification)
3. Configure compliance rules (country restrictions, balance caps)
4. Monitor token activity in real time

## Problems It Solves

### Before (Old Architecture)

- Every token deployment ran ~39 transactions, re-deploying 9 shared implementation contracts per token
- No factory pattern usage — ignored T-REX's built-in `TREXFactory.deployTREXSuite()`
- All addresses stored in a single `addresses` JSONB blob in the DB
- No separation between chain-level shared infra and token-specific instances

### After (New Architecture)

- Chain infrastructure deployed ONCE per chain (15 contracts, one script)
- New tokens deploy in ~9 transactions via `TREXFactory.deployTREXSuite()`
- DB split into `chain_infrastructure` + `token_ecosystem` tables
- Per-token proxy addresses stored as flat columns for easy querying

## How It Should Work

### Operator Flow

1. **Admin runs `deploy-infrastructure.ts`** once per chain → 15 contracts deployed, addresses stored in DB
2. **Operator opens Deploy Wizard** → wizard reads infra from DB (or static config fallback)
3. **Operator fills token name/symbol/decimals** → wizard calls `TREXFactory.deployTREXSuite()`
4. **Wizard completes ~9 on-chain steps** → ecosystem registered in DB
5. **Dashboard switches to new token** → all pages (Token, Identity, Compliance) work immediately

### Investor Flow

1. Operator registers investor identity on-chain
2. Claim issuer issues KYC claim to investor's OnchainID
3. Token transfer checks identity registry → compliance module → passes

## User Experience Goals

- Deploy wizard shows clear step-by-step progress with tx hashes
- Resumable deployment if browser closes mid-way (localStorage WIP)
- Multi-token selector: switch between deployed ecosystems per chain
- Infrastructure status visible: shows whether chain infra is deployed
