# Project Brief — ERC-3643 T-REX Dashboard

## Overview

A full-stack multi-token compliance dashboard for the ERC-3643 (T-REX) security token standard. The system allows operators to deploy, manage, and monitor ERC-3643 compliant security tokens with KYC/AML identity verification and modular compliance rules.

## Core Requirements

### Smart Contracts

- ERC-3643 / T-REX protocol (Tokeny's open-source implementation)
- OnchainID (IERC734 / IERC735) for investor identity management
- Modular compliance system (CountryRestrict, CountryAllow, MaxBalance, SupplyLimit)
- Factory + proxy pattern to avoid re-deploying shared implementation contracts

### Two-Layer Deployment Architecture

1. **Layer 1 — Chain Infrastructure** (deployed ONCE per chain)
   - 9 implementation contracts (Token, IR, IRS, TIR, CTR, MC, OIDIdentity, OIDIA, OIDFactory)
   - TREXImplementationAuthority + TREXFactory
   - 4 stateless compliance modules (shared across all tokens)

2. **Layer 2 — Token Instances** (deployed PER TOKEN via `TREXFactory.deployTREXSuite()`)
   - 6 proxy contracts deployed in one CREATE2 transaction
   - Token OnchainID via `OIDIdFactory.createTokenIdentity()`
   - ClaimIssuer per token

### Frontend Dashboard

- Next.js 14 (Pages Router) + TypeScript
- Wagmi v2 + RainbowKit for wallet connection
- PostgreSQL + Prisma ORM for persistent storage
- Multi-token selector (multiple ecosystems per chain)
- Pages: Deploy Wizard, Token, Identity, Compliance

## Goals

- Never redeploy shared infrastructure for each new token
- Minimal on-chain transactions per token deployment (~9 steps)
- DB-backed token registry with full address history
- Resumable deployment wizard (localStorage WIP state)
