# Active Context

## Current Focus

Transaction history sync is fully working. The `System` category has been renamed to `Deploy` + `Infra` for semantic clarity. All 99 on-chain transactions are correctly classified in the DB.

## Recent Changes (Session: 2026-06-24)

### Category Rename: System → Deploy + Infra

- **Motivation:** `System` was a catch-all that blurred the distinction between factory deploys and one-time wiring ops.
- **New taxonomy:**
  - `Deploy` — `deployTREXSuite()` factory call, raw EVM proxy creations (`initialize`)
  - `Infra` — `addTokenFactory()`, `bindIdentityRegistry()`, unknown contract calls
- **Files changed:**
  - [`frontend/lib/explorer.ts`](../frontend/lib/explorer.ts) — `METHOD_SELECTORS`, `classifyTx()` function
  - [`frontend/components/token/TransactionHistorySection.tsx`](../frontend/components/token/TransactionHistorySection.tsx) — `CATEGORY_META`, `EVENT_META`, `EVENT_OPTIONS_ALL`, `categoryTabs`
- **DB re-synced:** `npx tsx scripts/reset-and-resync.ts` — 99 rows, zero `System` rows remain

### Current DB breakdown (after re-sync)

| Category   | Count |
| ---------- | ----- |
| Token      | 35    |
| Identity   | 25    |
| Compliance | 24    |
| Deploy     | 12    |
| Infra      | 3     |

**Top event types:**

- `Token/AddAgent`: 14
- `Compliance/ModuleCall`: 14
- `Identity/CreateIdentity`: 14
- `Identity/RegisterIdentity`: 11
- `Token/Mint`: 10
- `Deploy/Deploy`: 10
- `Token/Transfer`: 6
- `Compliance/AddModule`: 5
- `Compliance/SetTrustedIssuer`: 4
- `Deploy/DeployToken`: 2
- `Infra/AddTokenFactory`: 2
- `Token/Unpaused`: 2
- `Infra/BindRegistry`: 1

## Previous Session Fixes (2026-06-22 → 2026-06-24)

### Sync bugs fixed

1. **`addAgent` classified as `System`** → Fixed to `Token/AddAgent` (it's on the Token contract's AgentRole mixin)
2. **`deployTREXSuite` never captured** → Fixed by scanning `trexFactory` + `oidIdFactory` addresses in addition to the 6 ecosystem proxies
3. **3 unknown selectors** → Added `callModuleFunction` (0xefb22d33→`Compliance/ModuleCall`), `setCompliance` (0xf8981789→`Token/SetCompliance`), `addTokenFactory` (0x9ce19365→`Infra/AddTokenFactory`)
4. **BigInt precision** → `BigInt(parseInt(row.blockNumber, 10))` → `BigInt(row.blockNumber)` directly
5. **`lastSyncedBlock` already at tip** → Reset script wipes DB + resets sync state, then full re-sync from block 0
6. **`System` category** → Replaced with `Deploy` + `Infra` (user request, more semantically clear)

### Sync architecture

- `GET /api/transactions/sync?ecosystemId=xxx` — rate-limited to 25s cooldown; incremental from `lastSyncedBlock + 1`
- Client-side polling every 30s via `setInterval` in `useTransactionHistory`
- Live "● LIVE" badge in `TransactionHistorySection`
- `lastSyncedAt` + `lastSyncedBlock` stored on `TokenEcosystem` row

## Next Steps

- No known issues
- Consider adding a `ModuleCall` subcategory breakdown (which module was called) if needed in future
- The `CreateIdentity` filter tab under `Identity` could optionally be split from `RegisterIdentity`
