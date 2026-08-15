# ERC-3643 T-REX Full Suite — Deployment Guide

> **Deploy script:** [`scripts/deploy-full-suite.ts`](../scripts/deploy-full-suite.ts)  
> **Test fixture (ground truth):** [`test/fixtures/deploy-full-suite.fixture.ts`](../test/fixtures/deploy-full-suite.fixture.ts)

---

## Prerequisites

| Requirement        | Details                                       |
| ------------------ | --------------------------------------------- |
| Node.js            | ≥ 18                                          |
| Compiled contracts | `npx hardhat compile`                         |
| Deployer wallet    | Funded with ETH on target network             |
| `.env` file        | `PRIVATE_KEY`, `RPC_URL`, `ETHERSCAN_API_KEY` |

```bash
npm install
npx hardhat compile
```

---

## Quick Start

```bash
# Local Hardhat node
npx hardhat run scripts/deploy-full-suite.ts --network hardhat

# Sepolia testnet
npx hardhat run scripts/deploy-full-suite.ts --network sepolia

# Mainnet
npx hardhat run scripts/deploy-full-suite.ts --network mainnet
```

Deployed addresses are saved/merged into [`deployed-addresses.json`](../deployed-addresses.json) under the network key. Re-running the script will **reuse** existing deployments (idempotent).

---

## Deployment Sections — Step by Step

### Section 1 — Deploy Implementations

These are logic contracts only; they hold no state and are never called directly.

| Contract                              | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| `ClaimTopicsRegistry`                 | Stores the list of required claim topics           |
| `TrustedIssuersRegistry`              | Stores the list of claim issuers trusted per topic |
| `IdentityRegistryStorage`             | Persistent storage for investor identities         |
| `IdentityRegistry`                    | Reads storage, validates identity/claims           |
| `ModularCompliance`                   | Pluggable compliance rule engine                   |
| `Token`                               | ERC-3643 security token logic                      |
| `Identity` (OnchainID)                | OnchainID identity implementation                  |
| `ImplementationAuthority` (OnchainID) | Points proxies to the correct identity logic       |
| `Factory` (OnchainID)                 | Creates identity proxies                           |

✅ **Done when:** All 9 contracts deployed, addresses saved to `deployed-addresses.json`.

---

### Section 2 — Deploy TREX Implementation Authority

`TREXImplementationAuthority` is the single source of truth for which implementation addresses all T-REX proxies delegate to.

```
TREXImplementationAuthority(isMain=true, zeroAddress, zeroAddress)
  └── addAndUseTREXVersion({ major:4, minor:0, patch:0 }, {
        tokenImplementation,
        ctrImplementation,
        irImplementation,
        irsImplementation,
        tirImplementation,
        mcImplementation
      })
```

✅ **Done when:** `addAndUseTREXVersion` transaction confirmed.

---

### Section 3 — Deploy Proxies & Factory

Each proxy stores the `TREXImplementationAuthority` address and delegates all calls to the corresponding implementation.

| Proxy Contract                 | Backed by Implementation                           |
| ------------------------------ | -------------------------------------------------- |
| `ClaimTopicsRegistryProxy`     | `ClaimTopicsRegistry`                              |
| `TrustedIssuersRegistryProxy`  | `TrustedIssuersRegistry`                           |
| `IdentityRegistryStorageProxy` | `IdentityRegistryStorage`                          |
| `IdentityRegistryProxy`        | `IdentityRegistry`                                 |
| `TREXFactory`                  | — (not a proxy; takes authority + identityFactory) |

> `identityFactory.addTokenFactory(trexFactory.address)` is called immediately after factory deployment so the identity factory recognises the T-REX factory.

✅ **Done when:** All 5 deployments confirmed, `addTokenFactory` tx confirmed.

---

### Section 4 — Deploy ModularCompliance Proxy

```
ModularComplianceProxy(trexImplementationAuthority.address)
  └── constructor calls init() via delegatecall automatically
```

The proxy is then wrapped with the `ModularCompliance` ABI for subsequent calls (`addModule`, `bindToken`, etc.).

✅ **Done when:** Proxy deployed, address saved under `compliance.modularComplianceProxy`.

---

### Section 5 — Deploy Token

Two contracts are deployed:

1. **`IdentityProxy`** (OnchainID) — the on-chain identity of the token itself
2. **`TokenProxy`** — the actual ERC-3643 token, constructed with:

```
TokenProxy(
  trexImplementationAuthority,
  identityRegistry,
  modularCompliance,   ← ModularComplianceProxy address
  tokenName,
  tokenSymbol,
  tokenDecimals,
  tokenOID
)
```

> The `TokenProxy` constructor automatically calls `modularCompliance.bindToken(tokenAddress)`.

✅ **Done when:** Both `tokenOID` and `trexTokenProxy` addresses saved.

---

### Section 6 — Deploy Claim Issuer

```
ClaimIssuer(deployer.address)
  └── addKey(keccak256(abi.encode(claimIssuerSigningKey.address)), purpose=3, type=1)
```

> **IMPORTANT:** Save the `claimIssuerSigningKey.privateKey` and `claimIssuerSigningKey.mnemonic.phrase` printed to the console. This key is used off-chain to **sign claims** for investors. If lost, you must deploy a new ClaimIssuer and re-issue all claims.

| Field         | Description                         |
| ------------- | ----------------------------------- |
| `purpose = 3` | CLAIM key (can sign ERC-735 claims) |
| `type = 1`    | ECDSA key                           |

✅ **Done when:** `ClaimIssuer` deployed, signing key added, address saved.

---

### Section 7 — Post-Deployment Configuration ⚠️

> This section is **mandatory**. The system is non-functional until all steps complete. All steps are **idempotent** — safe to re-run.

---

#### Step 7.1 — Bind IdentityRegistryStorage to IdentityRegistry

```typescript
await identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistry.address);
```

**Why:** `IdentityRegistryStorage` can be shared across multiple `IdentityRegistry` contracts (upgradeable pattern). It must explicitly know which registries are allowed to write to it. Without this, `registerIdentity` will revert.

**Caller:** `deployer` (owner of `IdentityRegistryStorage`)

---

#### Step 7.2 — Add Claim Topic to ClaimTopicsRegistry

```typescript
const claimTopics = [ethers.utils.id('CLAIM_TOPIC')];
await claimTopicsRegistry.connect(deployer).addClaimTopic(claimTopics[0]);
```

**Why:** The token compliance checks that every investor holds a valid claim whose topic is in this registry. Without a registered topic, all transfer checks return false and **no tokens can be transferred**.

**Caller:** `deployer` (owner of `ClaimTopicsRegistry` proxy)

> You can add multiple topics. Every investor must hold a valid claim for **each** registered topic.

---

#### Step 7.3 — Register ClaimIssuer as Trusted Issuer

```typescript
await trustedIssuersRegistry.connect(deployer).addTrustedIssuer(claimIssuerContract.address, claimTopics);
```

**Why:** Even if an investor has a claim for the right topic, it is only accepted if it was signed by a **trusted issuer**. Without this step, all claim verifications fail and **no tokens can be transferred**.

**Caller:** `deployer` (owner of `TrustedIssuersRegistry` proxy)

---

#### Step 7.4 — Add Deployer as IdentityRegistry Agent

```typescript
await identityRegistry.connect(deployer).addAgent(deployer.address);
```

**Why:** Only agents can call `registerIdentity`, `updateIdentity`, and `deleteIdentity`. The deployer needs this role to on-board investor identities in Steps 8+.

**Caller:** `deployer` (owner of `IdentityRegistry` proxy)

---

#### Step 7.5 — Add Token Contract as IdentityRegistry Agent

```typescript
await identityRegistry.connect(deployer).addAgent(token.address);
```

**Why:** The `Token` contract calls `identityRegistry.deleteIdentity` during forced transfer recovery. Without agent rights, recovery transactions revert.

**Caller:** `deployer` (owner of `IdentityRegistry` proxy)

---

#### Step 7.6 — Add Deployer as Token Agent

```typescript
await token.connect(deployer).addAgent(deployer.address);
```

**Why:** Token agents can `mint`, `burn`, `freeze`, `unfreeze`, and `forcedTransfer`. Without this, the deployer cannot mint the initial supply.

**Caller:** `deployer` (owner of `Token` proxy — set automatically during TokenProxy construction)

---

#### Step 7.7 — Unpause Token

```typescript
await token.connect(deployer).unpause();
```

**Why:** Tokens are deployed in a **paused state** as a safety measure. All `transfer`, `transferFrom`, and `mint` calls revert while paused. This is the final gate before the token goes live.

**Caller:** Token agent (deployer)

✅ **Done when:** `token.paused()` returns `false`.

---

## Post-Deploy Verification Checklist

Run these read calls after the full script completes to confirm correct state:

```typescript
// 1. Storage linked
await identityRegistryStorage.linkedIdentityRegistries(identityRegistry.address); // → true

// 2. Claim topics registered
await claimTopicsRegistry.getClaimTopics(); // → [keccak256('CLAIM_TOPIC')]

// 3. Trusted issuer registered
await trustedIssuersRegistry.isTrustedIssuer(claimIssuerContract.address); // → true

// 4. Agents set on IdentityRegistry
await identityRegistry.isAgent(deployer.address); // → true
await identityRegistry.isAgent(token.address); // → true

// 5. Agent set on Token
await token.isAgent(deployer.address); // → true

// 6. Token live
await token.paused(); // → false

// 7. Compliance bound
await modularCompliance.getTokenBound(); // → token.address
```

---

## Section 8 — On-Boarding an Investor (Post-Deploy, Manual)

After the full suite is deployed and configured, use these steps to on-board an investor.

### 8.1 — Deploy Investor Identity (OnchainID)

```typescript
const investorIdentity = await new ethers.ContractFactory(
  OnchainID.contracts.IdentityProxy.abi,
  OnchainID.contracts.IdentityProxy.bytecode,
  deployer,
).deploy(identityImplementationAuthority.address, investorWallet.address);

or;
OnchainIDFactory.createIdentity(_address, _salt);
```

### 8.2 — Issue a Claim for the Investor

Claims are **signed off-chain** by the `claimIssuerSigningKey` (saved in Step 6):

```typescript
const claimData = ethers.utils.hexlify(ethers.utils.toUtf8Bytes('KYC verified'));
const claimHash = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [investorIdentity.address, claimTopics[0], claimData]),
);
const signature = await claimIssuerSigningKey.signMessage(ethers.utils.arrayify(claimHash));

// Investor adds the claim to their own identity
await investorIdentity.connect(investorWallet).addClaim(claimTopics[0], 1, claimIssuerContract.address, signature, claimData, '');
```

### 8.3 — Register Investor Identity

```typescript
// Called by an IdentityRegistry agent (deployer)
await identityRegistry.connect(deployer).registerIdentity(investorWallet.address, investorIdentity.address, countryCode);
// countryCode: ISO 3166-1 numeric, e.g. 356 = India, 840 = USA
```

### 8.4 — Mint Tokens to Investor

```typescript
// Called by a Token agent (deployer)
await token.connect(deployer).mint(investorWallet.address, amount);
```

> `mint` internally calls `identityRegistry.isVerified(investorWallet.address)` — the investor must have a valid, trusted claim or the mint will revert.

---
