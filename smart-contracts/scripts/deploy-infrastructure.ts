/**
 * deploy-infrastructure.ts
 *
 * Deploys the shared chain-level infrastructure for the T-REX / ERC-3643 stack.
 * Run this ONCE per chain. All subsequent token deployments call
 * TREXFactory.deployTREXSuite() and reuse these shared contracts.
 *
 * What this script deploys (Layer 1 — shared per chain):
 *   ── OnchainID stack ──────────────────────────────────────────
 *   1.  Identity impl
 *   2.  OID ImplementationAuthority
 *   3.  OID IdFactory
 *
 *   ── T-REX implementation contracts ───────────────────────────
 *   4.  ClaimTopicsRegistry impl
 *   5.  TrustedIssuersRegistry impl
 *   6.  IdentityRegistryStorage impl
 *   7.  IdentityRegistry impl
 *   8.  ModularCompliance impl
 *   9.  Token impl
 *
 *   ── Authority + factory ───────────────────────────────────────
 *   10. TREXImplementationAuthority + addAndUseTREXVersion
 *   11. TREXFactory  (registered in OID IdFactory via addTokenFactory)
 *
 *   ── Stateless compliance modules (shared across all tokens) ───
 *   12. CountryRestrictModule
 *   13. CountryAllowModule
 *   14. MaxBalanceModule
 *   15. SupplyLimitModule
 *
 * After deployment:
 *   - Writes addresses to smart-contracts/deployed-addresses.json
 *   - POSTs to /api/infrastructure (if FRONTEND_URL is set in env)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-infrastructure.ts --network sepolia
 *   npx hardhat run scripts/deploy-infrastructure.ts --network bscTestnet
 *   npx hardhat run scripts/deploy-infrastructure.ts --network hardhat
 *
 * Environment variables:
 *   FRONTEND_URL  — base URL to POST infrastructure record (e.g. http://localhost:3000)
 *                   If unset, the DB registration step is skipped.
 */

import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deploy(contractName: string, args: unknown[] = []): Promise<string> {
  const factory = await ethers.getContractFactory(contractName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = await factory.deploy(...(args as any[]));
  await instance.deployed();
  const address = instance.address;
  console.log(`  ✓ ${contractName.padEnd(36)} ${address}`);
  return address;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  const chainId = networkInfo.chainId;

  console.log('\n   T-REX Chain Infrastructure Deployment');
  console.log('═'.repeat(60));
  console.log(`  Network  : ${network.name} (chainId ${chainId})`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.utils.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log('');

  // ── Phase 1: OnchainID stack ───────────────────────────────────────────────
  console.log('Phase 1: OnchainID stack');
  const implOIDIdentity = await deploy('Identity', [deployer.address, true]);
  const oidImplAuthority = await deploy('ImplementationAuthority', [implOIDIdentity]);
  const oidIdFactory = await deploy('IdFactory', [oidImplAuthority]);
  console.log('');

  // ── Phase 2: T-REX implementation contracts ────────────────────────────────
  console.log('Phase 2: T-REX implementation contracts');
  const implCTR = await deploy('ClaimTopicsRegistry');
  const implTIR = await deploy('TrustedIssuersRegistry');
  const implIRS = await deploy('IdentityRegistryStorage');
  const implIR = await deploy('IdentityRegistry');
  const implMC = await deploy('ModularCompliance');
  const implToken = await deploy('Token');
  console.log('');

  // ── Phase 3: TREXImplementationAuthority ──────────────────────────────────
  console.log('Phase 3: Authority + Factory');
  const trexIA = await deploy('TREXImplementationAuthority', [true, ethers.constants.AddressZero, ethers.constants.AddressZero]);

  // Register the T-REX version
  const iaContract = await ethers.getContractAt('TREXImplementationAuthority', trexIA);
  await (
    await iaContract.addAndUseTREXVersion(
      { major: 4, minor: 0, patch: 0 },
      {
        tokenImplementation: implToken,
        ctrImplementation: implCTR,
        irImplementation: implIR,
        irsImplementation: implIRS,
        tirImplementation: implTIR,
        mcImplementation: implMC,
      },
    )
  ).wait();
  console.log(`  ✓ TREXImplementationAuthority.addAndUseTREXVersion`);

  // ── Phase 4: TREXFactory ───────────────────────────────────────────────────
  const trexFactory = await deploy('TREXFactory', [trexIA, oidIdFactory]);

  // Register TREXFactory in OID IdFactory so it can create token identities
  const oidFactoryContract = await ethers.getContractAt('IdFactory', oidIdFactory);
  await (await oidFactoryContract.addTokenFactory(trexFactory)).wait();
  console.log(`  ✓ OIDIdFactory.addTokenFactory`);
  console.log('');

  // ── Phase 5: Compliance modules ────────────────────────────────────────────
  console.log('Phase 5: Compliance modules');
  const modCR = await deploy('CountryRestrictModule');
  const modCA = await deploy('CountryAllowModule');
  const modMB = await deploy('MaxBalanceModule');
  const modSL = await deploy('SupplyLimitModule');
  console.log('');

  // ── Summary ────────────────────────────────────────────────────────────────
  const deployedAt = new Date().toISOString();

  const result = {
    chainId,
    deployedAt,
    deployedBy: deployer.address,

    implToken,
    implIdentityRegistry: implIR,
    implIdentityRegistryStorage: implIRS,
    implTrustedIssuersRegistry: implTIR,
    implClaimTopicsRegistry: implCTR,
    implModularCompliance: implMC,

    implOIDIdentity,
    oidImplementationAuthority: oidImplAuthority,
    oidIdFactory,

    trexImplementationAuthority: trexIA,
    trexFactory,

    moduleCountryRestrict: modCR,
    moduleCountryAllow: modCA,
    moduleMaxBalance: modMB,
    moduleSupplyLimit: modSL,
  };

  console.log('✅  All contracts deployed successfully!');
  console.log('');

  // ── Write to deployed-addresses.json ──────────────────────────────────────
  const addressesPath = path.resolve(__dirname, '../deployed-addresses.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(addressesPath, 'utf8')) as Record<string, unknown>;
  } catch {
    // file doesn't exist yet — start fresh
  }

  existing[network.name] = {
    implementations: {
      token: implToken,
      identityRegistry: implIR,
      identityRegistryStorage: implIRS,
      trustedIssuersRegistry: implTIR,
      claimTopicsRegistry: implCTR,
      modularCompliance: implMC,
      onchainIDIdentity: implOIDIdentity,
      onchainIDImplementationAuthority: oidImplAuthority,
      onchainIDFactory: oidIdFactory,
    },
    authority: {
      trexImplementationAuthority: trexIA,
      trexFactory,
    },
    modules: {
      countryRestrictModule: modCR,
      countryAllowModule: modCA,
      maxBalanceModule: modMB,
      supplyLimitModule: modSL,
    },
  };

  fs.writeFileSync(addressesPath, JSON.stringify(existing, null, 2));
  console.log(`📄  Addresses written to deployed-addresses.json`);

  // ── POST to /api/infrastructure ────────────────────────────────────────────
  const frontendUrl = process.env['FRONTEND_URL'];
  if (frontendUrl) {
    try {
      // Node 18+ has built-in fetch; for older Node use node-fetch
      const fetchFn: typeof fetch =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof fetch !== 'undefined' ? fetch : (await import('node-fetch' as any)).default;

      const resp = await fetchFn(`${frontendUrl}/api/infrastructure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (resp.ok) {
        console.log(`🗄️   Infrastructure saved to DB (${frontendUrl}/api/infrastructure)`);
      } else {
        const body = await resp.text();
        console.warn(`⚠️   DB save failed (${resp.status}): ${body}`);
      }
    } catch (err) {
      console.warn('⚠️   Could not reach frontend API:', err);
    }
  } else {
    console.log('ℹ️   Set FRONTEND_URL env var to auto-register infrastructure in DB.');
  }

  console.log('\n🎉  Infrastructure deployment complete.\n');
  return result;
}

main().catch((err) => {
  console.error('\n❌  Deployment failed:\n', err);
  process.exit(1);
});
