# Database Setup (PostgreSQL + Prisma)

## 1. Prerequisites

- PostgreSQL 14+ running locally or a managed instance (e.g. Supabase, Neon, Railway)
- Node.js 20.9+ (already confirmed)

## 2. Configure the connection

```bash
cp frontend/.env.local.example frontend/.env.local
# Edit .env.local and set DATABASE_URL
```

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/trex_dashboard?schema=public"
```

## 3. Create the database tables

```bash
# From the frontend/ directory:
npm run db:migrate
# Prompts for a migration name, e.g. "init"
```

This creates three tables:
| Table | Description |
|---|---|
| `token_ecosystem` | Every deployed TREX contract suite |
| `identity` | Wallet → OnchainID mapping per ecosystem |
| `compliance_rule` | Module configuration per ecosystem |

## 4. (Optional) View / edit data in Prisma Studio

```bash
npm run db:studio
# Opens http://localhost:5555
```

## 5. Production

```bash
npm run db:migrate:prod   # runs prisma migrate deploy (no prompts)
```

---

## Schema overview

```
TokenEcosystem
  id              UUID (PK)  — matches browser localStorage UUID
  name            String
  symbol          String
  chainId         Int
  deployerAddress String
  deployedAt      DateTime
  addresses       Json       — full AddressGroup tree
  identities      Identity[]
  complianceRules ComplianceRule[]

Identity
  id              UUID (PK)
  ecosystemId     FK → TokenEcosystem.id  (CASCADE DELETE)
  walletAddress   String
  identityAddress String     — OnchainID contract
  countryCode     Int
  claimTopics     Int[]

ComplianceRule
  id              UUID (PK)
  ecosystemId     FK → TokenEcosystem.id  (CASCADE DELETE)
  module          String     — countryRestrict | countryAllow | maxBalance | supplyLimit
  isActive        Boolean
  params          Json       — module-specific config
```

---

## API routes

| Method | Path                               | Description                                     |
| ------ | ---------------------------------- | ----------------------------------------------- |
| GET    | `/api/ecosystems?chainId=<n>`      | List ecosystems for a chain                     |
| POST   | `/api/ecosystems`                  | Create / upsert an ecosystem                    |
| GET    | `/api/ecosystems/:id`              | Get one ecosystem (includes identities + rules) |
| PUT    | `/api/ecosystems/:id`              | Update name or addresses                        |
| DELETE | `/api/ecosystems/:id`              | Delete (cascades identities + rules)            |
| GET    | `/api/identities?ecosystemId=<id>` | List identities                                 |
| POST   | `/api/identities`                  | Register / upsert identity                      |
| PUT    | `/api/identities/:id`              | Update country code, claim topics               |
| DELETE | `/api/identities/:id`              | Remove identity                                 |
| GET    | `/api/compliance?ecosystemId=<id>` | List compliance rules                           |
| POST   | `/api/compliance`                  | Save / upsert rule                              |
| PUT    | `/api/compliance/:id`              | Update rule params / active state               |
| DELETE | `/api/compliance/:id`              | Remove rule                                     |

---

## Sync strategy

`TokenRegistryContext` uses a **localStorage-first, DB-second** approach:

1. All React state reads from localStorage (instant, offline-safe)
2. Every `addToken` / `removeToken` / `updateToken` also fires a background API call (fire-and-forget)
3. On app boot, if localStorage is empty for the current chain, the context fetches from the DB and hydrates localStorage
4. A DB outage never breaks the UI
