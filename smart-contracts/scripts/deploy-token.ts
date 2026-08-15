/**
 * deploy-token.ts
 *
 * Deploys a single ERC-3643 token ecosystem using the pre-deployed
 * chain infrastructure (TREXFactory.deployTREXSuite).
 *
 * Prerequisites:
 *   - Run deploy-infrastructure.ts first so TREXFactory + OID IdFactory exist.
 *   - deployed-addresses.json must contain the current network's infrastructure.
 *
 * What this script does (Layer 2 — per token):
 *   1.  Read chain infrastructure from deployed-addresses.json
 *   2.  TREXFactory.deployTREXSuite(salt, tokenDetails, claimDetails)
 *       → deploys all 6 token proxy contracts in ONE CREATE2 transaction
 *   3.  OIDIdFactory.createTokenIdentity(tokenProxy, owner, salt)
 *       → creates the token's OnchainID
 *   4.  Deploy ClaimIssuer contract
 *   5.  ClaimIssuer.addKey(issuerKeyHash, 3, 1)
 *   6.  TrustedIssuersRegistry.addTrustedIssuer(claimIssuer, claimTopics)
 *   7.  IdentityRegistry.addAgent(deployer) + addAgent(tokenProxy)
 *   8.  Token.addAgent(deployer)
 *   9.  Token.unpause()
 *
 * After deployment:
 *   - Prints all addresses to console
 *   - POSTs to /api/ecosystems (if FRONTEND_URL is set in env)
 *
 * Usage:
 *   TOKEN_NAME="Acme Security Token" TOKEN_SYMBOL=ACME TOKEN_DECIMALS=18 \
 *   ISSUER_ADDRESS=0x... FRONTEND_URL=http://localhost:3000 \
 *   npx hardhat run scripts/deploy-token.ts --network sepolia
 *
 * Environment variables:
 *   TOKEN_NAME        — token name (required)
 *   TOKEN_SYMBOL      — token symbol (required)
 *   TOKEN_DECIMALS    — decimals (default: 18)
 *   CLAIM_TOPICS      — comma-separated claim topic IDs (default: 1)
 *   ISSUER_ADDRESS    — signing key address for ClaimIssuer (defaults to deployer)
 *   TOKEN_SALT        — CREATE2 salt (default: auto-generated from symbol + timestamp)
 *   FRONTEND_URL      — base URL to POST ecosystem record (e.g. http://localhost:3000)
 */

import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InfrastructureAddresses {
  implementations: {
    token: string;
    identityRegistry: string;
    identityRegistryStorage: string;
    trustedIssuersRegistry: string;
    claimTopicsRegistry: string;
    modularCompliance: string;
    onchainIDIdentity: string;
    onchainIDImplementationAuthority: string;
    onchainIDFactory: string;
  };
  authority: {
    trexImplementationAuthority: string;
    trexFactory: string;
  };
  modules: {
    countryRestrictModule?: string;
    countryAllowModule?: string;
    maxBalanceModule?: string;
    supplyLimitModule?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadInfrastructure(networkName: string): InfrastructureAddresses {
  const addressesPath = path.resolve(__dirname, '../deployed-addresses.json');
  if (!fs.existsSync(addressesPath)) {
    throw new Error(`deployed-addresses.json not found. Run deploy-infrastructure.ts first.`);
  }

  const all = JSON.parse(fs.readFileSync(addressesPath, 'utf8')) as Record<string, unknown>;
  const infra = all[networkName] as InfrastructureAddresses | undefined;

  if (!infra?.authority?.trexFactory) {
    throw new Error(`No infrastructure found for network "${networkName}". Run deploy-infrastructure.ts --network ${networkName} first.`);
  }

  return infra;
}

function generateSalt(symbol: string): string {
  return `${symbol.toLowerCase()}-${Date.now().toString(16)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();
  const chainId = networkInfo.chainId;

  // ── Token parameters from env ────────────────────────────────────────────
  const tokenName = process.env['TOKEN_NAME'];
  const tokenSymbol = process.env['TOKEN_SYMBOL'];
  if (!tokenName || !tokenSymbol) {
    throw new Error('TOKEN_NAME and TOKEN_SYMBOL env vars are required');
  }

  const tokenDecimals = parseInt(process.env['TOKEN_DECIMALS'] ?? '18', 10);
  const claimTopicsRaw = process.env['CLAIM_TOPICS'] ?? '1';
  const claimTopics = claimTopicsRaw.split(',').map((t) => parseInt(t.trim(), 10));

  const issuerAddress: string = process.env['ISSUER_ADDRESS'] ?? deployer.address;

  const salt = process.env['TOKEN_SALT'] ?? generateSalt(tokenSymbol);

  console.log('\n🪙   T-REX Token Deployment');
  console.log('═'.repeat(60));
  console.log(`  Network      : ${network.name} (chainId ${chainId})`);
  console.log(`  Deployer     : ${deployer.address}`);
  console.log(`  Token Name   : ${tokenName}`);
  console.log(`  Token Symbol : ${tokenSymbol}`);
  console.log(`  Decimals     : ${tokenDecimals}`);
  console.log(`  Claim Topics : ${claimTopics.join(', ')}`);
  console.log(`  Salt         : ${salt}`);
  console.log('');

  // ── Load infrastructure ────────────────────────────────────────────────────
  const infra = loadInfrastructure(network.name);
  console.log(`📌  TREXFactory : ${infra.authority.trexFactory}`);
  console.log(`📌  OIDIdFactory: ${infra.implementations.onchainIDFactory}`);
  console.log('');

  // ── Step 1: TREXFactory.deployTREXSuite ───────────────────────────────────
  console.log('Step 1: TREXFactory.deployTREXSuite');

  const complianceModules = [
    infra.modules.countryRestrictModule,
    infra.modules.countryAllowModule,
    infra.modules.maxBalanceModule,
    infra.modules.supplyLimitModule,
  ].filter(Boolean) as string[];

  const trexFactory = await ethers.getContractAt('TREXFactory', infra.authority.trexFactory);

  const suiteTx = await trexFactory.deployTREXSuite(
    salt,
    {
      owner: deployer.address,
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      irs: ethers.constants.AddressZero, // factory creates a new IRS
      ONCHAINID: ethers.constants.AddressZero, // created post-deploy
      irAgents: [deployer.address],
      tokenAgents: [deployer.address],
      complianceModules,
      complianceSettings: [],
    },
    {
      claimTopics,
      issuers: [], // ClaimIssuer not yet deployed — added in step 6
      issuerClaims: [],
    },
  );
  const suiteReceipt = await suiteTx.wait();
  console.log(`  ✓ TREXSuite deployed (tx: ${suiteReceipt.transactionHash})`);

  // Parse TREXSuiteDeployed event
  // event TREXSuiteDeployed(address indexed _token, address _ir, address _irs,
  //                          address _tir, address _ctr, address _mc, string indexed _salt)
  const suiteDeployedTopic = ethers.utils.id('TREXSuiteDeployed(address,address,address,address,address,address,string)');
  const suiteLog = suiteReceipt.logs.find(
    (l: { address: string; topics: string[] }) =>
      l.address.toLowerCase() === infra.authority.trexFactory.toLowerCase() && l.topics[0] === suiteDeployedTopic,
  );
  if (!suiteLog) {
    throw new Error('TREXSuiteDeployed event not found in receipt');
  }

  const tokenProxy = '0x' + suiteLog.topics[1].slice(-40);
  const data = suiteLog.data.slice(2); // strip 0x
  const extractAddr = (offset: number) => '0x' + data.slice(offset * 64 + 24, offset * 64 + 64);

  const irProxy = extractAddr(0);
  const irsProxy = extractAddr(1);
  const tirProxy = extractAddr(2);
  const ctrProxy = extractAddr(3);
  const mcProxy = extractAddr(4);

  console.log(`  ✓ tokenProxy                  : ${tokenProxy}`);
  console.log(`  ✓ identityRegistryProxy        : ${irProxy}`);
  console.log(`  ✓ identityRegistryStorageProxy : ${irsProxy}`);
  console.log(`  ✓ trustedIssuersRegistryProxy  : ${tirProxy}`);
  console.log(`  ✓ claimTopicsRegistryProxy     : ${ctrProxy}`);
  console.log(`  ✓ modularComplianceProxy       : ${mcProxy}`);
  console.log('');

  // ── Step 2: Create token OnchainID ────────────────────────────────────────
  console.log('Step 2: Create token OnchainID via OIDIdFactory');
  const oidFactory = await ethers.getContractAt('IdFactory', infra.implementations.onchainIDFactory);
  const oidTx = await oidFactory.createTokenIdentity(tokenProxy, deployer.address, salt);
  const oidReceipt = await oidTx.wait();

  // Parse TokenDeployed event: event TokenDeployed(address indexed token, address indexed identity)
  const tokenDeployedTopic = ethers.utils.id('TokenDeployed(address,address)');
  const oidLog = oidReceipt.logs.find(
    (l: { address: string; topics: string[] }) =>
      l.address.toLowerCase() === infra.implementations.onchainIDFactory.toLowerCase() && l.topics[0] === tokenDeployedTopic,
  );

  const tokenOnchainID = oidLog ? '0x' + oidLog.topics[2].slice(-40) : ethers.constants.AddressZero;

  console.log(`  ✓ tokenOnchainID : ${tokenOnchainID}`);
  console.log('');

  // ── Step 3: Deploy ClaimIssuer ────────────────────────────────────────────
  console.log('Step 3: Deploy ClaimIssuer');
  const claimIssuerFactory = await ethers.getContractFactory('ClaimIssuer');
  const claimIssuerContract = await claimIssuerFactory.deploy(deployer.address);
  await claimIssuerContract.deployed();
  const claimIssuer = claimIssuerContract.address;
  console.log(`  ✓ ClaimIssuer : ${claimIssuer}`);
  console.log('');

  // ── Step 4: ClaimIssuer.addKey ────────────────────────────────────────────
  console.log('Step 4: Register signing key on ClaimIssuer');
  const keyHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [issuerAddress]));
  await (await claimIssuerContract.addKey(keyHash, 3, 1)).wait();
  console.log(`  ✓ Added signing key for ${issuerAddress}`);
  console.log('');

  // ── Step 5: TrustedIssuersRegistry.addTrustedIssuer ──────────────────────
  console.log('Step 5: Register ClaimIssuer as trusted issuer');
  const tirContract = await ethers.getContractAt('TrustedIssuersRegistry', tirProxy);
  await (await tirContract.addTrustedIssuer(claimIssuer, claimTopics)).wait();
  console.log(`  ✓ Registered ${claimIssuer} as trusted issuer for topics [${claimTopics.join(', ')}]`);
  console.log('');

  // ── Step 6: IdentityRegistry agent roles ─────────────────────────────────
  console.log('Step 6: Grant IdentityRegistry agent roles');
  const irContract = await ethers.getContractAt('IdentityRegistry', irProxy);
  await (await irContract.addAgent(deployer.address)).wait();
  console.log(`  ✓ Added deployer as IR agent`);
  await (await irContract.addAgent(tokenProxy)).wait();
  console.log(`  ✓ Added token as IR agent`);
  console.log('');

  // ── Step 7: Token agent role + unpause ────────────────────────────────────
  console.log('Step 7: Grant Token agent role + unpause');
  const tokenContract = await ethers.getContractAt('Token', tokenProxy);
  await (await tokenContract.addAgent(deployer.address)).wait();
  console.log(`  ✓ Added deployer as Token agent`);
  await (await tokenContract.unpause()).wait();
  console.log(`  ✓ Token unpaused`);
  console.log('');

  // ── Summary ────────────────────────────────────────────────────────────────
  const result = {
    id: `${chainId}-${tokenSymbol}-${Date.now()}`,
    name: tokenName,
    symbol: tokenSymbol,
    decimals: tokenDecimals,
    chainId: Number(chainId),
    salt,
    deployerAddress: deployer.address,
    deployedAt: new Date().toISOString(),
    tokenProxy,
    identityRegistryProxy: irProxy,
    identityRegistryStorageProxy: irsProxy,
    trustedIssuersRegistryProxy: tirProxy,
    claimTopicsRegistryProxy: ctrProxy,
    modularComplianceProxy: mcProxy,
    tokenOnchainID,
    claimIssuer,
  };

  console.log('✅  Token deployment complete!');
  console.log(JSON.stringify(result, null, 2));

  // ── POST to /api/ecosystems ────────────────────────────────────────────────
  const frontendUrl = process.env['FRONTEND_URL'];
  if (frontendUrl) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchFn: typeof fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch' as any)).default;

      const resp = await fetchFn(`${frontendUrl}/api/ecosystems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...result,
          deployedAt: Date.now(), // API expects Unix ms
        }),
      });
      if (resp.ok) {
        console.log(`\n🗄️   Ecosystem saved to DB (${frontendUrl}/api/ecosystems)`);
      } else {
        const body = await resp.text();
        console.warn(`\n⚠️   DB save failed (${resp.status}): ${body}`);
      }
    } catch (err) {
      console.warn('\n⚠️   Could not reach frontend API:', err);
    }
  } else {
    console.log('\nℹ️   Set FRONTEND_URL env var to auto-register ecosystem in DB.');
  }

  console.log('\n🎉  Token deployment complete.\n');
  return result;
}

main().catch((err) => {
  console.error('\n❌  Token deployment failed:\n', err);
  process.exit(1);
});
