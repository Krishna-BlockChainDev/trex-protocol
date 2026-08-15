/**
 * useInfraDeploymentWizard — Layer 1 Chain Infrastructure Deployment
 *
 * Deploys all shared contracts for a chain ONCE and saves them to the DB.
 *
 * Deployment sequence (14 on-chain transactions + 1 DB write):
 *
 *   Implementations (6):
 *     1.  ClaimTopicsRegistry implementation
 *     2.  TrustedIssuersRegistry implementation
 *     3.  IdentityRegistryStorage implementation
 *     4.  IdentityRegistry implementation
 *     5.  ModularCompliance implementation
 *     6.  Token implementation
 *
 *   OnchainID stack (3):
 *     7.  OIDIdentity implementation  (constructor: deployer, true)
 *     8.  OIDImplementationAuthority  (constructor: oidIdentityImpl)
 *     9.  OIDIdFactory                (constructor: oidImplAuthority)
 *
 *   TREX authority + factory (3):
 *     10. TREXImplementationAuthority (constructor: true, 0x0, 0x0)
 *     11. TREXImplementationAuthority.addAndUseTREXVersion({ major:4, minor:0, patch:0 }, impls)
 *     12. TREXFactory                 (constructor: trexIA, oidIdFactory)
 *     13. OIDIdFactory.addTokenFactory(trexFactory)  [allows TREXFactory to create token identities]
 *
 *   Compliance modules (4):
 *     13. CountryRestrictModule
 *     14. CountryAllowModule
 *     15. MaxBalanceModule
 *     16. SupplyLimitModule
 *
 *   Register in DB:
 *     17. POST /api/infrastructure
 *
 * State is saved to localStorage after each step so the wizard can resume
 * if the browser is closed mid-deployment.
 */

import { useState } from 'react';
import {
  useWalletClient,
  usePublicClient,
  useAccount,
  useChainId,
} from 'wagmi';
import type { Abi, WalletClient, PublicClient } from 'viem';
import * as Artifacts from '@/contracts/deployBytecodes';

// ── Step IDs ──────────────────────────────────────────────────────────────────

export type InfraStepId =
  | 'impl_claimTopicsRegistry'
  | 'impl_trustedIssuersRegistry'
  | 'impl_identityRegistryStorage'
  | 'impl_identityRegistry'
  | 'impl_modularCompliance'
  | 'impl_token'
  | 'oid_identity'
  | 'oid_implAuthority'
  | 'oid_idFactory'
  | 'trex_implAuthority'
  | 'trex_setImplementations'
  | 'trex_factory'
  | 'oid_addTokenFactory'
  | 'module_countryRestrict'
  | 'module_countryAllow'
  | 'module_maxBalance'
  | 'module_supplyLimit'
  | 'register_db';

export type InfraStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface InfraStep {
  id: InfraStepId;
  label: string;
  section: InfraStepSection;
  status: InfraStepStatus;
  txHash?: `0x${string}`;
  address?: `0x${string}`;
  error?: string;
}

export type InfraStepSection =
  | 'implementations'
  | 'onchainid'
  | 'authority'
  | 'modules'
  | 'register';

export type InfraPhase = 'idle' | 'deploying' | 'success' | 'error';

// ── WIP addresses accumulated during deployment ───────────────────────────────

export interface InfraWIPAddresses {
  implClaimTopicsRegistry?: `0x${string}`;
  implTrustedIssuersRegistry?: `0x${string}`;
  implIdentityRegistryStorage?: `0x${string}`;
  implIdentityRegistry?: `0x${string}`;
  implModularCompliance?: `0x${string}`;
  implToken?: `0x${string}`;
  implOIDIdentity?: `0x${string}`;
  oidImplementationAuthority?: `0x${string}`;
  oidIdFactory?: `0x${string}`;
  trexImplementationAuthority?: `0x${string}`;
  trexFactory?: `0x${string}`;
  moduleCountryRestrict?: `0x${string}`;
  moduleCountryAllow?: `0x${string}`;
  moduleMaxBalance?: `0x${string}`;
  moduleSupplyLimit?: `0x${string}`;
}

export interface InfraWIPState {
  chainId: number;
  deployer: `0x${string}`;
  addresses: InfraWIPAddresses;
  completedSteps: InfraStepId[];
}

// ── Step definitions ──────────────────────────────────────────────────────────

const INFRA_STEP_DEFS: {
  id: InfraStepId;
  label: string;
  section: InfraStepSection;
}[] = [
  {
    id: 'impl_claimTopicsRegistry',
    label: 'Deploy ClaimTopicsRegistry impl',
    section: 'implementations',
  },
  {
    id: 'impl_trustedIssuersRegistry',
    label: 'Deploy TrustedIssuersRegistry impl',
    section: 'implementations',
  },
  {
    id: 'impl_identityRegistryStorage',
    label: 'Deploy IdentityRegistryStorage impl',
    section: 'implementations',
  },
  {
    id: 'impl_identityRegistry',
    label: 'Deploy IdentityRegistry impl',
    section: 'implementations',
  },
  {
    id: 'impl_modularCompliance',
    label: 'Deploy ModularCompliance impl',
    section: 'implementations',
  },
  { id: 'impl_token', label: 'Deploy Token impl', section: 'implementations' },
  {
    id: 'oid_identity',
    label: 'Deploy OIDIdentity impl',
    section: 'onchainid',
  },
  {
    id: 'oid_implAuthority',
    label: 'Deploy OID ImplementationAuthority',
    section: 'onchainid',
  },
  { id: 'oid_idFactory', label: 'Deploy OID IdFactory', section: 'onchainid' },
  {
    id: 'trex_implAuthority',
    label: 'Deploy TREXImplementationAuthority',
    section: 'authority',
  },
  {
    id: 'trex_setImplementations',
    label: 'Register TREX version on IA (addAndUseTREXVersion)',
    section: 'authority',
  },
  { id: 'trex_factory', label: 'Deploy TREXFactory', section: 'authority' },
  {
    id: 'oid_addTokenFactory',
    label: 'Register TREXFactory in OIDIdFactory (addTokenFactory)',
    section: 'authority',
  },
  {
    id: 'module_countryRestrict',
    label: 'Deploy CountryRestrictModule',
    section: 'modules',
  },
  {
    id: 'module_countryAllow',
    label: 'Deploy CountryAllowModule',
    section: 'modules',
  },
  {
    id: 'module_maxBalance',
    label: 'Deploy MaxBalanceModule',
    section: 'modules',
  },
  {
    id: 'module_supplyLimit',
    label: 'Deploy SupplyLimitModule',
    section: 'modules',
  },
  {
    id: 'register_db',
    label: 'Register infrastructure in database',
    section: 'register',
  },
];

function buildInfraSteps(completed: InfraStepId[] = []): InfraStep[] {
  return INFRA_STEP_DEFS.map(({ id, label, section }) => ({
    id,
    label,
    section,
    status: completed.includes(id) ? 'done' : 'pending',
  }));
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function infraWipKey(chainId: number, deployer: string) {
  return `trex_infra_wip_${chainId}_${deployer.toLowerCase()}`;
}

function saveInfraWIP(state: InfraWIPState): void {
  try {
    localStorage.setItem(
      infraWipKey(state.chainId, state.deployer),
      JSON.stringify(state),
    );
  } catch {
    /* ignore */
  }
}

function loadInfraWIP(chainId: number, deployer: string): InfraWIPState | null {
  try {
    const raw = localStorage.getItem(infraWipKey(chainId, deployer));
    return raw ? (JSON.parse(raw) as InfraWIPState) : null;
  } catch {
    return null;
  }
}

function clearInfraWIPStorage(chainId: number, deployer: string): void {
  try {
    localStorage.removeItem(infraWipKey(chainId, deployer));
  } catch {
    /* ignore */
  }
}

// ── Deploy engine ─────────────────────────────────────────────────────────────

interface InfraEngineCtx {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: `0x${string}`;
  wipState: InfraWIPState;
  onStep: (id: InfraStepId, patch: Partial<InfraStep>) => void;
}

/** Deploy a contract, skip if already in WIP cache. Returns deployed address. */
async function infraDeployStep(
  ctx: InfraEngineCtx,
  stepId: InfraStepId,
  addrKey: keyof InfraWIPAddresses,
  artifact: { abi: Abi; bytecode: `0x${string}` },
  args: readonly unknown[] = [],
): Promise<`0x${string}`> {
  const { walletClient, publicClient, account, wipState, onStep } = ctx;

  if (wipState.completedSteps.includes(stepId) && wipState.addresses[addrKey]) {
    onStep(stepId, { status: 'done', address: wipState.addresses[addrKey] });
    return wipState.addresses[addrKey]!;
  }

  onStep(stepId, { status: 'running' });
  try {
    const hash = await walletClient.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args,
      account,
      chain: null,
    });
    onStep(stepId, { txHash: hash });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error(`Step "${stepId}": no contractAddress in receipt`);
    }

    const addr = receipt.contractAddress;
    wipState.addresses[addrKey] = addr;
    wipState.completedSteps.push(stepId);
    saveInfraWIP(wipState);

    onStep(stepId, { status: 'done', address: addr });
    return addr;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onStep(stepId, { status: 'error', error: msg });
    throw err;
  }
}

/** Send a write tx (no deploy), skip if already completed. */
async function infraTxStep(
  ctx: InfraEngineCtx,
  stepId: InfraStepId,
  to: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<void> {
  const { walletClient, publicClient, account, wipState, onStep } = ctx;

  if (wipState.completedSteps.includes(stepId)) {
    onStep(stepId, { status: 'done' });
    return;
  }

  onStep(stepId, { status: 'running' });
  try {
    const hash = await walletClient.writeContract({
      address: to,
      abi,
      functionName,
      args,
      account,
      chain: null,
    });
    onStep(stepId, { txHash: hash });
    await publicClient.waitForTransactionReceipt({ hash });
    wipState.completedSteps.push(stepId);
    saveInfraWIP(wipState);
    onStep(stepId, { status: 'done' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onStep(stepId, { status: 'error', error: msg });
    throw err;
  }
}

// ── TREXImplementationAuthority ABI (minimal — only what we need) ─────────────

// addAndUseTREXVersion(Version, TREXContracts) — the correct function.
// setImplementations does NOT exist on TREXImplementationAuthority.
const TREX_IA_ADD_VERSION_ABI: Abi = [
  {
    name: 'addAndUseTREXVersion',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_version',
        type: 'tuple',
        components: [
          { name: 'major', type: 'uint8' },
          { name: 'minor', type: 'uint8' },
          { name: 'patch', type: 'uint8' },
        ],
      },
      {
        name: '_trex',
        type: 'tuple',
        components: [
          { name: 'tokenImplementation', type: 'address' },
          { name: 'ctrImplementation', type: 'address' },
          { name: 'irImplementation', type: 'address' },
          { name: 'irsImplementation', type: 'address' },
          { name: 'tirImplementation', type: 'address' },
          { name: 'mcImplementation', type: 'address' },
        ],
      },
    ],
    outputs: [],
  },
];

// ── Full infra deployment sequence ────────────────────────────────────────────

async function runInfraAll(ctx: InfraEngineCtx): Promise<
  Required<InfraWIPAddresses> & {
    moduleCountryRestrict: `0x${string}`;
    moduleCountryAllow: `0x${string}`;
    moduleMaxBalance: `0x${string}`;
    moduleSupplyLimit: `0x${string}`;
  }
> {
  const { account } = ctx;

  // ── 1-6: TREX implementation contracts ─────────────────────────────────────
  const implClaimTopicsRegistry = await infraDeployStep(
    ctx,
    'impl_claimTopicsRegistry',
    'implClaimTopicsRegistry',
    Artifacts.ClaimTopicsRegistry,
    [],
  );
  const implTrustedIssuersRegistry = await infraDeployStep(
    ctx,
    'impl_trustedIssuersRegistry',
    'implTrustedIssuersRegistry',
    Artifacts.TrustedIssuersRegistry,
    [],
  );
  const implIdentityRegistryStorage = await infraDeployStep(
    ctx,
    'impl_identityRegistryStorage',
    'implIdentityRegistryStorage',
    Artifacts.IdentityRegistryStorage,
    [],
  );
  const implIdentityRegistry = await infraDeployStep(
    ctx,
    'impl_identityRegistry',
    'implIdentityRegistry',
    Artifacts.IdentityRegistry,
    [],
  );
  const implModularCompliance = await infraDeployStep(
    ctx,
    'impl_modularCompliance',
    'implModularCompliance',
    Artifacts.ModularCompliance,
    [],
  );
  const implToken = await infraDeployStep(
    ctx,
    'impl_token',
    'implToken',
    Artifacts.Token,
    [],
  );

  // ── 7-9: OnchainID stack ────────────────────────────────────────────────────
  // OIDIdentity impl: constructor(address initialManagementKey, bool _isLibrary)
  // pass (deployer, true) for library mode
  const implOIDIdentity = await infraDeployStep(
    ctx,
    'oid_identity',
    'implOIDIdentity',
    Artifacts.OIDIdentity,
    [account, true],
  );

  // OIDImplementationAuthority: constructor(address implementationAddress)
  const oidImplementationAuthority = await infraDeployStep(
    ctx,
    'oid_implAuthority',
    'oidImplementationAuthority',
    Artifacts.OIDImplementationAuthority,
    [implOIDIdentity],
  );

  // OIDIdFactory: constructor(address _implementationAuthority)
  const oidIdFactory = await infraDeployStep(
    ctx,
    'oid_idFactory',
    'oidIdFactory',
    Artifacts.OIDIdFactory,
    [oidImplementationAuthority],
  );

  // ── 10: TREXImplementationAuthority ────────────────────────────────────────
  // constructor(bool _referenceStatus, address _trexFactory, address _iaFactory)
  // pass (true, 0x0, 0x0) for a standalone reference authority
  const zeroAddr =
    '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const trexImplementationAuthority = await infraDeployStep(
    ctx,
    'trex_implAuthority',
    'trexImplementationAuthority',
    Artifacts.TREXImplementationAuthority,
    [true, zeroAddr, zeroAddr],
  );

  // ── 11: TREXImplementationAuthority.addAndUseTREXVersion ───────────────────
  // setImplementations does NOT exist on this contract.
  // The correct function is addAndUseTREXVersion(Version, TREXContracts).
  // Version 4.0.0 matches the T-REX 4.x release used by this codebase.
  await infraTxStep(
    ctx,
    'trex_setImplementations',
    trexImplementationAuthority,
    TREX_IA_ADD_VERSION_ABI,
    'addAndUseTREXVersion',
    [
      { major: 4, minor: 0, patch: 0 },
      {
        tokenImplementation: implToken,
        ctrImplementation: implClaimTopicsRegistry,
        irImplementation: implIdentityRegistry,
        irsImplementation: implIdentityRegistryStorage,
        tirImplementation: implTrustedIssuersRegistry,
        mcImplementation: implModularCompliance,
      },
    ],
  );

  // ── 12: TREXFactory ─────────────────────────────────────────────────────────
  // constructor(address _implementationAuthority, address _idFactory)
  const trexFactory = await infraDeployStep(
    ctx,
    'trex_factory',
    'trexFactory',
    Artifacts.TREXFactory,
    [trexImplementationAuthority, oidIdFactory],
  );

  // ── 13: OIDIdFactory.addTokenFactory(trexFactory) ───────────────────────────
  // Required so TREXFactory can call createTokenIdentity during token deployment.
  // Without this, IdFactory reverts with "only Factory or owner can call".
  const OID_ADD_TOKEN_FACTORY_ABI: Abi = [
    {
      name: 'addTokenFactory',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: '_factory', type: 'address' }],
      outputs: [],
    },
  ];
  await infraTxStep(
    ctx,
    'oid_addTokenFactory',
    oidIdFactory,
    OID_ADD_TOKEN_FACTORY_ABI,
    'addTokenFactory',
    [trexFactory],
  );

  // ── 14-17: Compliance modules ───────────────────────────────────────────────
  const moduleCountryRestrict = await infraDeployStep(
    ctx,
    'module_countryRestrict',
    'moduleCountryRestrict',
    Artifacts.CountryRestrictModule,
    [],
  );
  const moduleCountryAllow = await infraDeployStep(
    ctx,
    'module_countryAllow',
    'moduleCountryAllow',
    Artifacts.CountryAllowModule,
    [],
  );
  const moduleMaxBalance = await infraDeployStep(
    ctx,
    'module_maxBalance',
    'moduleMaxBalance',
    Artifacts.MaxBalanceModule,
    [],
  );
  const moduleSupplyLimit = await infraDeployStep(
    ctx,
    'module_supplyLimit',
    'moduleSupplyLimit',
    Artifacts.SupplyLimitModule,
    [],
  );

  return {
    implClaimTopicsRegistry,
    implTrustedIssuersRegistry,
    implIdentityRegistryStorage,
    implIdentityRegistry,
    implModularCompliance,
    implToken,
    implOIDIdentity,
    oidImplementationAuthority,
    oidIdFactory,
    trexImplementationAuthority,
    trexFactory,
    moduleCountryRestrict,
    moduleCountryAllow,
    moduleMaxBalance,
    moduleSupplyLimit,
  };
}

// ── Hook public return type ───────────────────────────────────────────────────

export interface UseInfraDeploymentWizardReturn {
  phase: InfraPhase;
  steps: InfraStep[];
  wip: InfraWIPState | null;
  canResume: boolean;
  startInfraDeployment: () => Promise<void>;
  resumeInfraDeployment: () => Promise<void>;
  clearInfraWIP: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInfraDeploymentWizard(
  onSuccess?: () => void,
): UseInfraDeploymentWizardReturn {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const chainId = useChainId();

  const savedWIP = account ? loadInfraWIP(chainId, account) : null;

  const [phase, setPhase] = useState<InfraPhase>('idle');
  const [steps, setSteps] = useState<InfraStep[]>(
    buildInfraSteps(savedWIP?.completedSteps),
  );
  const [wip, setWip] = useState<InfraWIPState | null>(savedWIP);

  function updateStep(id: InfraStepId, patch: Partial<InfraStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function execute(wipState: InfraWIPState): Promise<void> {
    if (!walletClient || !publicClient || !account) {
      throw new Error('Wallet not connected');
    }

     
    const wc = walletClient as unknown as WalletClient;
     
    const pc = publicClient as unknown as PublicClient;

    setPhase('deploying');

    try {
      const ctx: InfraEngineCtx = {
        walletClient: wc,
        publicClient: pc,
        account,
        wipState,
        onStep: updateStep,
      };

      const addresses = await runInfraAll(ctx);

      // ── Register in DB ─────────────────────────────────────────────────────
      updateStep('register_db', { status: 'running' });

      const payload = {
        chainId,
        implToken: addresses.implToken,
        implIdentityRegistry: addresses.implIdentityRegistry,
        implIdentityRegistryStorage: addresses.implIdentityRegistryStorage,
        implTrustedIssuersRegistry: addresses.implTrustedIssuersRegistry,
        implClaimTopicsRegistry: addresses.implClaimTopicsRegistry,
        implModularCompliance: addresses.implModularCompliance,
        implOIDIdentity: addresses.implOIDIdentity,
        oidImplementationAuthority: addresses.oidImplementationAuthority,
        oidIdFactory: addresses.oidIdFactory,
        trexImplementationAuthority: addresses.trexImplementationAuthority,
        trexFactory: addresses.trexFactory,
        moduleCountryRestrict: addresses.moduleCountryRestrict,
        moduleCountryAllow: addresses.moduleCountryAllow,
        moduleMaxBalance: addresses.moduleMaxBalance,
        moduleSupplyLimit: addresses.moduleSupplyLimit,
        deployedBy: account,
        deployedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/infrastructure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to save infrastructure to DB: ${res.status} ${text}`,
        );
      }

      wipState.completedSteps.push('register_db');
      saveInfraWIP(wipState);
      clearInfraWIPStorage(chainId, account);

      updateStep('register_db', { status: 'done' });
      setWip({ ...wipState });
      setPhase('success');

      // Notify parent to reload infrastructure from DB
      onSuccess?.();
    } catch (err) {
      setPhase('error');
      throw err;
    }
  }

  async function startInfraDeployment(): Promise<void> {
    if (!account) throw new Error('Wallet not connected');

    const wipState: InfraWIPState = {
      chainId,
      deployer: account,
      addresses: {},
      completedSteps: [],
    };

    setWip(wipState);
    setSteps(buildInfraSteps());
    saveInfraWIP(wipState);

    await execute(wipState);
  }

  async function resumeInfraDeployment(): Promise<void> {
    if (!wip) throw new Error('No infrastructure deployment to resume');
    setSteps(buildInfraSteps(wip.completedSteps));
    await execute(wip);
  }

  function clearInfraWIP(): void {
    if (account) clearInfraWIPStorage(chainId, account);
    setWip(null);
    setSteps(buildInfraSteps());
    setPhase('idle');
  }

  return {
    phase,
    steps,
    wip,
    canResume: savedWIP !== null && savedWIP.completedSteps.length > 0,
    startInfraDeployment,
    resumeInfraDeployment,
    clearInfraWIP,
  };
}
