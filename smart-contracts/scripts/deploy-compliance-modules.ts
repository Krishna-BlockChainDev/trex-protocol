/**
 * deploy-compliance-modules.ts
 *
 * Deploys the four modular-compliance module contracts onto the target network
 * and registers them with the already-deployed ModularComplianceProxy.
 *
 * Pre-requisites (must already exist in deployed-addresses.json):
 *   compliance.modularComplianceProxy  — the ModularCompliance proxy
 *   token.trexTokenProxy               — the token proxy
 *
 * Run:
 *   npx hardhat run scripts/deploy-compliance-modules.ts --network sepolia
 *
 * Fully idempotent — skips steps already recorded in deployed-addresses.json.
 */

import { ethers, network } from 'hardhat';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModulesSection {
  countryRestrictModule?: string;
  countryAllowModule?: string;
  maxBalanceModule?: string;
  supplyLimitModule?: string;
  [key: string]: string | undefined;
}

interface ComplianceSection {
  modularComplianceProxy?: string;
  modules?: ModulesSection;
  [key: string]: unknown;
}

interface TokenSection {
  trexTokenProxy?: string;
  [key: string]: string | undefined;
}

interface NetworkData {
  compliance?: ComplianceSection;
  token?: TokenSection;
  [key: string]: unknown;
}

type AllData = Record<string, NetworkData>;

// ─── ABI snippets ─────────────────────────────────────────────────────────────

const MODULAR_COMPLIANCE_ABI = [
  'function addModule(address _module) external',
  'function isModuleBound(address _module) external view returns (bool)',
  'function getTokenBound() external view returns (address)',
  'function bindToken(address _token) external',
  'function owner() external view returns (address)',
];

const TOKEN_ABI = [
  'function compliance() external view returns (address)',
  'function setCompliance(address _compliance) external',
  'function owner() external view returns (address)',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadAllData(filePath: string): AllData {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AllData;
    } catch (_) {
      console.warn('Could not parse deployed-addresses.json — starting fresh.');
    }
  }
  return {};
}

function saveAllData(filePath: string, data: AllData): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

interface ModuleSpec {
  key: string;
  contractName: string;
}

const MODULE_SPECS: ModuleSpec[] = [
  { key: 'countryRestrictModule', contractName: 'CountryRestrictModule' },
  { key: 'countryAllowModule', contractName: 'CountryAllowModule' },
  { key: 'maxBalanceModule', contractName: 'MaxBalanceModule' },
  { key: 'supplyLimitModule', contractName: 'SupplyLimitModule' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer]: SignerWithAddress[] = await ethers.getSigners();
  console.log(`\nDeployer     : ${deployer.address}`);
  console.log(`Network      : ${network.name}`);

  const outputPath = path.join(__dirname, '../deployed-addresses.json');
  const allData = loadAllData(outputPath);

  const net: NetworkData = (allData[network.name] as NetworkData) ?? {};
  allData[network.name] = net;

  const compliance: ComplianceSection = net.compliance ?? {};
  net.compliance = compliance;

  const saveNow = () => saveAllData(outputPath, allData);

  // ── Validate prerequisites ──────────────────────────────────────────────────
  const modularComplianceProxyAddr = compliance.modularComplianceProxy;
  if (!modularComplianceProxyAddr) {
    throw new Error(`No compliance.modularComplianceProxy in deployed-addresses.json for "${network.name}". Run deploy-full-suite.ts first.`);
  }

  const tokenProxyAddr = net.token?.trexTokenProxy;
  if (!tokenProxyAddr) {
    throw new Error(`No token.trexTokenProxy in deployed-addresses.json for "${network.name}". Run deploy-full-suite.ts first.`);
  }

  console.log(`\nModularComplianceProxy : ${modularComplianceProxyAddr}`);
  console.log(`Token Proxy            : ${tokenProxyAddr}`);

  const modularCompliance = new ethers.Contract(modularComplianceProxyAddr, MODULAR_COMPLIANCE_ABI, deployer);
  const token = new ethers.Contract(tokenProxyAddr, TOKEN_ABI, deployer);

  const modules: ModulesSection = (compliance.modules as ModulesSection) ?? {};
  compliance.modules = modules;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Deploy module contracts (sequential — each tx must confirm first)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 1. DEPLOY MODULE CONTRACTS ───────────────────────────────');

  const deployedAddrs: ModulesSection = {};

  await MODULE_SPECS.reduce(async (prev, spec) => {
    await prev;
    if (modules[spec.key]) {
      console.log(`  [SKIP] ${spec.contractName} already at ${modules[spec.key]}`);
      deployedAddrs[spec.key] = modules[spec.key];
      return;
    }
    console.log(`  Deploying ${spec.contractName}...`);
    const factory = await ethers.getContractFactory(spec.contractName, deployer);
    const contract = await factory.deploy();
    await contract.deployed();
    modules[spec.key] = contract.address;
    deployedAddrs[spec.key] = contract.address;
    saveNow();
    console.log(`  ✓ ${spec.contractName} deployed at ${contract.address}`);
  }, Promise.resolve());

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Register modules with ModularCompliance
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 2. ADD MODULES TO ModularComplianceProxy ─────────────────');

  await MODULE_SPECS.reduce(async (prev, spec) => {
    await prev;
    const moduleAddr = deployedAddrs[spec.key];
    if (!moduleAddr) return;

    const alreadyBound: boolean = await modularCompliance.isModuleBound(moduleAddr);
    if (alreadyBound) {
      console.log(`  [SKIP] ${spec.contractName} already bound to compliance`);
      return;
    }
    console.log(`  Binding ${spec.contractName} (${moduleAddr})...`);
    const tx = await modularCompliance.connect(deployer).addModule(moduleAddr);
    await tx.wait();
    console.log(`  ✓ ${spec.contractName} added — tx: ${tx.hash}`);
  }, Promise.resolve());

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Ensure token points to the ModularCompliance proxy
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 3. VERIFY TOKEN ↔ ModularCompliance BINDING ──────────────');

  const currentCompliance: string = await token.compliance();
  console.log(`  Token's current compliance : ${currentCompliance}`);

  if (currentCompliance.toLowerCase() === modularComplianceProxyAddr.toLowerCase()) {
    console.log('  ✓ Token already uses ModularComplianceProxy — no action needed.');
  } else {
    console.log(`  Token uses ${currentCompliance}. Switching to ModularComplianceProxy...`);
    try {
      const tx = await token.connect(deployer).setCompliance(modularComplianceProxyAddr);
      await tx.wait();
      console.log(`  ✓ Token compliance updated — tx: ${tx.hash}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ setCompliance failed: ${msg}`);
      console.warn(`  Manual fix: call token.setCompliance("${modularComplianceProxyAddr}") as token owner.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Ensure ModularCompliance has the token bound
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n─── 4. VERIFY ModularCompliance BOUND TOKEN ──────────────────');

  const tokenBound: string = await modularCompliance.getTokenBound();
  console.log(`  ModularCompliance.getTokenBound() : ${tokenBound}`);

  if (tokenBound.toLowerCase() === tokenProxyAddr.toLowerCase()) {
    console.log('  ✓ ModularCompliance already has the token bound — no action needed.');
  } else if (tokenBound === ethers.constants.AddressZero) {
    console.log('  Token not yet bound — calling bindToken...');
    try {
      const tx = await modularCompliance.connect(deployer).bindToken(tokenProxyAddr);
      await tx.wait();
      console.log(`  ✓ Token bound to ModularCompliance — tx: ${tx.hash}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ bindToken failed: ${msg}`);
      console.warn(`  Manual fix: call modularCompliance.bindToken("${tokenProxyAddr}") as compliance owner.`);
    }
  } else {
    console.warn(`  ⚠ ModularCompliance is bound to a different token: ${tokenBound}`);
    console.warn(`  Expected: ${tokenProxyAddr}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Final save + summary
  // ─────────────────────────────────────────────────────────────────────────────
  saveNow();

  console.log('\n✅ Compliance modules deployment complete!');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ModularComplianceProxy : ${modularComplianceProxyAddr}`);
  console.log(`  Token Proxy            : ${tokenProxyAddr}`);
  console.log('  Modules registered:');
  MODULE_SPECS.forEach((spec) => {
    console.log(`    ${spec.contractName.padEnd(25)} ${deployedAddrs[spec.key] ?? '(unknown)'}`);
  });
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`\nAddresses saved to ${outputPath} under network: "${network.name}"`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Post-deploy usage guide
  // ─────────────────────────────────────────────────────────────────────────────
  const crAddr = deployedAddrs.countryRestrictModule ?? '<CountryRestrictModule>';
  const caAddr = deployedAddrs.countryAllowModule ?? '<CountryAllowModule>';
  const mbAddr = deployedAddrs.maxBalanceModule ?? '<MaxBalanceModule>';
  const slAddr = deployedAddrs.supplyLimitModule ?? '<SupplyLimitModule>';

  console.log('\n📋 HOW TO CONFIGURE MODULES (call as compliance owner):');
  console.log('');
  console.log(`  // Restrict Iran (364) & North Korea (408):`);
  console.log(`  const crMod = await ethers.getContractAt("CountryRestrictModule", "${crAddr}");`);
  console.log(`  await modularCompliance.callModuleFunction(`);
  console.log(`    crMod.interface.encodeFunctionData("batchRestrictCountries", [[364, 408]]),`);
  console.log(`    "${crAddr}"`);
  console.log(`  );`);
  console.log('');
  console.log(`  // Whitelist India (356) & USA (840) only:`);
  console.log(`  const caMod = await ethers.getContractAt("CountryAllowModule", "${caAddr}");`);
  console.log(`  await modularCompliance.callModuleFunction(`);
  console.log(`    caMod.interface.encodeFunctionData("batchAllowCountries", [[356, 840]]),`);
  console.log(`    "${caAddr}"`);
  console.log(`  );`);
  console.log('');
  console.log(`  // Max 10 000 tokens per wallet:`);
  console.log(`  const mbMod = await ethers.getContractAt("MaxBalanceModule", "${mbAddr}");`);
  console.log(`  await modularCompliance.callModuleFunction(`);
  console.log(`    mbMod.interface.encodeFunctionData("setMaxBalance", [ethers.utils.parseEther("10000")]),`);
  console.log(`    "${mbAddr}"`);
  console.log(`  );`);
  console.log('');
  console.log(`  // Cap total supply at 1 000 000 tokens:`);
  console.log(`  const slMod = await ethers.getContractAt("SupplyLimitModule", "${slAddr}");`);
  console.log(`  await modularCompliance.callModuleFunction(`);
  console.log(`    slMod.interface.encodeFunctionData("setSupplyLimit", [ethers.utils.parseEther("1000000")]),`);
  console.log(`    "${slAddr}"`);
  console.log(`  );`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
