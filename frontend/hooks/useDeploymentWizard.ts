/**
 * useDeploymentWizard — Factory-based TREX token deployment hook.
 *
 * Two-layer architecture:
 *   Layer 1 (Chain Infrastructure): deployed ONCE per chain via the InfraDeploymentPanel.
 *     - 6 impl contracts, TREXImplementationAuthority, TREXFactory, OID stack, 4 compliance modules
 *   Layer 2 (Token Instance): deployed PER TOKEN in the steps below via this hook.
 *
 * What TREXFactory.deployTREXSuite() handles INTERNALLY (no post-steps needed):
 *   • Deploys 6 proxy contracts: Token, IR, IRS, TIR, CTR, MC (CREATE2)
 *   • IRS.bindIdentityRegistry(IR)
 *   • IR.addAgent(token)                         ← token contract is IR agent
 *   • IR.addAgent(irAgents[i])                   ← deployer wallet is IR agent
 *   • Token.addAgent(tokenAgents[i])             ← deployer wallet is Token agent
 *   • CTR.addClaimTopic(claimTopics[i])          ← claim topics registered
 *   • TIR.addTrustedIssuer(issuers[i], claims)   ← if issuers passed (we don't, ClaimIssuer not deployed yet)
 *   • OIDIdFactory.createTokenIdentity(token, owner, salt) + token.setOnchainID(oid)
 *
 * Post-factory steps (what THIS hook does after deployTREXSuite):
 *   1.  Load chain infrastructure from DB (read-only — no tx)
 *   2.  TREXFactory.deployTREXSuite(salt, tokenDetails, claimDetails)
 *   3.  Read token.onchainID() — set by factory, no separate tx needed
 *   4.  Deploy ClaimIssuer contract
 *   5.  ClaimIssuer.addKey(issuerKeyHash, 3, 1)
 *   6.  TrustedIssuersRegistry.addTrustedIssuer(claimIssuer, claimTopics)
 *   7.  Token.unpause()  ← factory does NOT unpause; deployer is already token agent via factory
 *   8.  Register ecosystem in dashboard DB
 *
 * NOTE: Steps that used to call IR.addAgent(deployer), IR.addAgent(token), and
 * Token.addAgent(deployer) have been removed — TREXFactory already calls these
 * when irAgents:[deployer] and tokenAgents:[deployer] are passed in tokenDetails.
 * Calling addAgent again would revert with "Roles: account already has role".
 *
 * State is persisted to localStorage after every successful sub-step so the
 * wizard can be resumed if the browser is closed mid-deployment.
 */

import { useState } from 'react';
import {
  useWalletClient,
  usePublicClient,
  useAccount,
  useChainId,
} from 'wagmi';
import type { Abi, WalletClient, PublicClient } from 'viem';
import { keccak256, encodeAbiParameters } from 'viem';
import * as Artifacts from '@/contracts/deployBytecodes';
import { useTokenRegistryContext } from '@/contexts/TokenRegistryContext';
import type {
  DeployedTokenEcosystem,
  DeployedChainInfrastructure,
} from '@/types/tokenRegistry';

// ── Public types ──────────────────────────────────────────────────────────────

export interface TokenDeployParams {
  name: string;
  symbol: string;
  decimals: number;
  /** Optional: override the default KYC claim topic (default: 1) */
  claimTopics?: number[];
}

export type DeployStepId =
  | 'infra_load'
  | 'factory_deployTREXSuite'
  | 'token_createIdentity'
  | 'claimIssuer_deploy'
  | 'claimIssuer_addKey'
  | 'tir_addTrustedIssuer'
  | 'token_unpause'
  | 'done';

export type DeployStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface DeployStep {
  id: DeployStepId;
  label: string;
  status: DeployStepStatus;
  txHash?: `0x${string}`;
  address?: `0x${string}`;
  error?: string;
}

/** Addresses accumulated during the token deployment (Layer 2 only) */
export interface WIPAddresses {
  /** TokenProxy address (from TREXFactory receipt) */
  tokenProxy: `0x${string}`;
  /** IdentityRegistry proxy */
  identityRegistryProxy: `0x${string}`;
  /** IdentityRegistryStorage proxy */
  identityRegistryStorageProxy: `0x${string}`;
  /** TrustedIssuersRegistry proxy */
  trustedIssuersRegistryProxy: `0x${string}`;
  /** ClaimTopicsRegistry proxy */
  claimTopicsRegistryProxy: `0x${string}`;
  /** ModularCompliance proxy */
  modularComplianceProxy: `0x${string}`;
  /** Token OnchainID — set by OIDIdFactory inside TREXFactory.deployTREXSuite */
  tokenOnchainID: `0x${string}`;
  /** ClaimIssuer contract */
  claimIssuer: `0x${string}`;
}

export interface DeployWIPState {
  chainId: number;
  deployer: `0x${string}`;
  params: TokenDeployParams;
  /** CREATE2 salt for TREXFactory.deployTREXSuite */
  salt: string;
  addresses: Partial<WIPAddresses>;
  completedSteps: DeployStepId[];
  /** Infra snapshot captured at deploy-start (avoids re-fetching mid-resume) */
  infrastructure: DeployedChainInfrastructure | null;
}

export type WizardPhase = 'idle' | 'deploying' | 'success' | 'error';

export interface UseDeploymentWizardReturn {
  phase: WizardPhase;
  steps: DeployStep[];
  wip: DeployWIPState | null;
  canResume: boolean;
  startDeployment: (params: TokenDeployParams) => Promise<void>;
  resumeDeployment: () => Promise<void>;
  clearWIP: () => void;
  deployedEcosystem: DeployedTokenEcosystem | null;
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEP_DEFS: { id: DeployStepId; label: string }[] = [
  { id: 'infra_load', label: 'Load chain infrastructure' },
  {
    id: 'factory_deployTREXSuite',
    label: 'Deploy token suite via TREXFactory (proxies + agents + topics)',
  },
  {
    id: 'token_createIdentity',
    label: 'Read token OnchainID (set by TREXFactory internally)',
  },
  { id: 'claimIssuer_deploy', label: 'Deploy ClaimIssuer' },
  { id: 'claimIssuer_addKey', label: 'Register signing key on ClaimIssuer' },
  {
    id: 'tir_addTrustedIssuer',
    label: 'Register ClaimIssuer as trusted issuer',
  },
  {
    id: 'token_unpause',
    label: 'Unpause token (deployer already agent via factory)',
  },
  { id: 'done', label: 'Register ecosystem in dashboard' },
];

function buildSteps(completed: DeployStepId[] = []): DeployStep[] {
  return STEP_DEFS.map(({ id, label }) => ({
    id,
    label,
    status: completed.includes(id) ? 'done' : 'pending',
  }));
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function wipKey(chainId: number, deployer: string) {
  return `trex_deploy_wip_${chainId}_${deployer.toLowerCase()}`;
}

function saveWIP(state: DeployWIPState): void {
  try {
    localStorage.setItem(
      wipKey(state.chainId, state.deployer),
      JSON.stringify(state),
    );
  } catch {
    /* ignore */
  }
}

function loadWIP(chainId: number, deployer: string): DeployWIPState | null {
  try {
    const raw = localStorage.getItem(wipKey(chainId, deployer));
    return raw ? (JSON.parse(raw) as DeployWIPState) : null;
  } catch {
    return null;
  }
}

function clearWIPStorage(chainId: number, deployer: string): void {
  try {
    localStorage.removeItem(wipKey(chainId, deployer));
  } catch {
    /* ignore */
  }
}

// ── Salt generation ───────────────────────────────────────────────────────────

/** Generate a deterministic CREATE2 salt from symbol + deployer + timestamp */
function generateSalt(symbol: string, deployer: string): string {
  const ts = Date.now().toString(16);
  return `${symbol.toLowerCase()}-${deployer.slice(2, 8).toLowerCase()}-${ts}`;
}

// ── Engine context ────────────────────────────────────────────────────────────

interface EngineCtx {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: `0x${string}`;
  chainId: number;
  wipState: DeployWIPState;
  onStep: (id: DeployStepId, patch: Partial<DeployStep>) => void;
}

/** Deploy a contract — skips if already in WIP cache. */
async function deployStep(
  ctx: EngineCtx,
  stepId: DeployStepId,
  artifact: { abi: Abi; bytecode: `0x${string}` },
  args: readonly unknown[] = [],
): Promise<`0x${string}`> {
  const { walletClient, publicClient, account, wipState, onStep } = ctx;

  if (wipState.completedSteps.includes(stepId)) {
    const cached = wipState.addresses[stepId as keyof WIPAddresses];
    if (cached) return cached;
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
    (wipState.addresses as Record<string, `0x${string}`>)[stepId] = addr;
    wipState.completedSteps.push(stepId);
    saveWIP(wipState);

    onStep(stepId, { status: 'done', address: addr });
    return addr;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onStep(stepId, { status: 'error', error: msg });
    throw err;
  }
}

/** Send a write transaction — skips if already completed. */
async function txStep(
  ctx: EngineCtx,
  stepId: DeployStepId,
  to: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<void> {
  const { walletClient, publicClient, account, wipState, onStep } = ctx;

  if (wipState.completedSteps.includes(stepId)) return;

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
    saveWIP(wipState);

    onStep(stepId, { status: 'done' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onStep(stepId, { status: 'error', error: msg });
    throw err;
  }
}

// ── TREXFactory.deployTREXSuite result parsing ────────────────────────────────

/**
 * TREXSuiteDeployed event emitted by TREXFactory.deployTREXSuite():
 *
 *   event TREXSuiteDeployed(
 *     address indexed _token,
 *     address _ir,
 *     address _irs,
 *     address _tir,
 *     address _ctr,
 *     address _mc,
 *     string indexed _salt
 *   );
 */
const TREX_SUITE_DEPLOYED_TOPIC =
  '0x' +
  keccak256(
    Buffer.from(
      'TREXSuiteDeployed(address,address,address,address,address,address,string)',
    ) as unknown as `0x${string}`,
  ).slice(2);

interface TREXSuiteAddresses {
  tokenProxy: `0x${string}`;
  identityRegistryProxy: `0x${string}`;
  identityRegistryStorageProxy: `0x${string}`;
  trustedIssuersRegistryProxy: `0x${string}`;
  claimTopicsRegistryProxy: `0x${string}`;
  modularComplianceProxy: `0x${string}`;
}

function parseTREXSuiteEvent(
  receipt: Awaited<ReturnType<PublicClient['waitForTransactionReceipt']>>,
  trexFactory: `0x${string}`,
): TREXSuiteAddresses {
  // The event log has:
  //   topics[0] = event signature hash
  //   topics[1] = indexed _token (address, padded to 32 bytes)
  //   topics[2] = indexed _salt (keccak256 of salt string)
  // data = abi-encoded (address ir, address irs, address tir, address ctr, address mc)

  const log = receipt.logs.find(
    (l) =>
      l.address.toLowerCase() === trexFactory.toLowerCase() &&
      l.topics[0]?.toLowerCase() === TREX_SUITE_DEPLOYED_TOPIC.toLowerCase(),
  );

  if (!log) {
    throw new Error(
      'TREXSuiteDeployed event not found in transaction receipt. ' +
        'Check TREXFactory address and event signature.',
    );
  }

  // topics[1] = _token (indexed address) — last 20 bytes of the 32-byte topic
  const tokenProxy = ('0x' + log.topics[1]!.slice(-40)) as `0x${string}`;

  // data = abi-encoded 5 addresses (each 32 bytes): ir, irs, tir, ctr, mc
  const data = log.data.slice(2); // strip 0x
  function extractAddr(offset: number): `0x${string}` {
    return ('0x' +
      data.slice(offset * 64 + 24, offset * 64 + 64)) as `0x${string}`;
  }

  return {
    tokenProxy,
    identityRegistryProxy: extractAddr(0),
    identityRegistryStorageProxy: extractAddr(1),
    trustedIssuersRegistryProxy: extractAddr(2),
    claimTopicsRegistryProxy: extractAddr(3),
    modularComplianceProxy: extractAddr(4),
  };
}

// ── Full deployment sequence ───────────────────────────────────────────────────

async function runAll(ctx: EngineCtx): Promise<Omit<WIPAddresses, never>> {
  const { walletClient, publicClient, account, wipState, onStep } = ctx;
  const infra = wipState.infrastructure;

  if (!infra) throw new Error('Chain infrastructure not loaded');

  const claimTopics = wipState.params.claimTopics ?? [1]; // default: KYC = 1

  // ── Step 1: infra_load (already done — just mark it) ─────────────────────
  if (!wipState.completedSteps.includes('infra_load')) {
    wipState.completedSteps.push('infra_load');
    saveWIP(wipState);
  }
  onStep('infra_load', { status: 'done' });

  // ── Step 2: TREXFactory.deployTREXSuite ───────────────────────────────────
  //
  // This single transaction deploys ALL 6 proxy contracts AND:
  //   • IRS.bindIdentityRegistry(IR)
  //   • IR.addAgent(token)              ← token contract as IR agent
  //   • IR.addAgent(account)            ← deployer as IR agent (via irAgents:[account])
  //   • Token.addAgent(account)         ← deployer as Token agent (via tokenAgents:[account])
  //   • CTR.addClaimTopic(1)            ← KYC topic registered (via claimTopics:[1])
  //   • OIDIdFactory.createTokenIdentity + token.setOnchainID()
  //
  // DO NOT call IR.addAgent or Token.addAgent afterwards — factory already did it.
  let suiteAddrs: TREXSuiteAddresses;

  if (
    wipState.completedSteps.includes('factory_deployTREXSuite') &&
    wipState.addresses.tokenProxy
  ) {
    // Resume: reconstruct from WIP cache
    suiteAddrs = {
      tokenProxy: wipState.addresses.tokenProxy,
      identityRegistryProxy: wipState.addresses.identityRegistryProxy!,
      identityRegistryStorageProxy:
        wipState.addresses.identityRegistryStorageProxy!,
      trustedIssuersRegistryProxy:
        wipState.addresses.trustedIssuersRegistryProxy!,
      claimTopicsRegistryProxy: wipState.addresses.claimTopicsRegistryProxy!,
      modularComplianceProxy: wipState.addresses.modularComplianceProxy!,
    };
    onStep('factory_deployTREXSuite', {
      status: 'done',
      address: suiteAddrs.tokenProxy,
    });
  } else {
    onStep('factory_deployTREXSuite', { status: 'running' });
    try {
      const hash = await walletClient.writeContract({
        address: infra.trexFactory as `0x${string}`,
        abi: Artifacts.TREXFactory.abi as Abi,
        functionName: 'deployTREXSuite',
        args: [
          wipState.salt, // _salt
          {
            // TokenDetails
            owner: account,
            name: wipState.params.name,
            symbol: wipState.params.symbol,
            decimals: wipState.params.decimals,
            irs: '0x0000000000000000000000000000000000000000', // factory creates new IRS
            ONCHAINID: '0x0000000000000000000000000000000000000000', // factory creates via OIDIdFactory
            // Factory calls IR.addAgent(account) and Token.addAgent(account) for these
            irAgents: [account],
            tokenAgents: [account],
            complianceModules: [
              infra.moduleCountryRestrict,
              infra.moduleCountryAllow,
              infra.moduleMaxBalance,
              infra.moduleSupplyLimit,
            ].filter(Boolean) as string[],
            complianceSettings: [],
          },
          {
            // ClaimDetails — factory calls CTR.addClaimTopic for each topic
            claimTopics,
            // No issuers yet — ClaimIssuer not deployed until Step 4
            // We call TIR.addTrustedIssuer manually after ClaimIssuer is deployed
            issuers: [],
            issuerClaims: [],
          },
        ],
        account,
        chain: null,
      });

      onStep('factory_deployTREXSuite', { txHash: hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      suiteAddrs = parseTREXSuiteEvent(
        receipt,
        infra.trexFactory as `0x${string}`,
      );

      // Persist all 6 proxy addresses to WIP
      Object.assign(wipState.addresses, suiteAddrs);
      wipState.completedSteps.push('factory_deployTREXSuite');
      saveWIP(wipState);

      onStep('factory_deployTREXSuite', {
        status: 'done',
        address: suiteAddrs.tokenProxy,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStep('factory_deployTREXSuite', { status: 'error', error: msg });
      throw err;
    }
  }

  // ── Step 3: Read token OnchainID (set by TREXFactory internally) ──────────
  //
  // TREXFactory.deployTREXSuite() internally calls:
  //   OIDIdFactory.createTokenIdentity(address(token), owner, _salt)
  // and then calls token.setOnchainID(_tokenID).
  //
  // DO NOT call createTokenIdentity again — salt is already consumed and
  // would revert with "salt already taken".
  // Read token.onchainID() which is a pure view call (no transaction).
  let tokenOnchainID: `0x${string}`;

  if (
    wipState.completedSteps.includes('token_createIdentity') &&
    wipState.addresses.tokenOnchainID
  ) {
    tokenOnchainID = wipState.addresses.tokenOnchainID;
    onStep('token_createIdentity', { status: 'done', address: tokenOnchainID });
  } else {
    onStep('token_createIdentity', { status: 'running' });
    try {
      const TOKEN_ONCHAIN_ID_ABI: Abi = [
        {
          name: 'onchainID',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'address' }],
        },
      ];

      const oid = await publicClient.readContract({
        address: suiteAddrs.tokenProxy,
        abi: TOKEN_ONCHAIN_ID_ABI,
        functionName: 'onchainID',
      });

      tokenOnchainID = oid as `0x${string}`;

      if (
        !tokenOnchainID ||
        tokenOnchainID === '0x0000000000000000000000000000000000000000'
      ) {
        throw new Error(
          'token.onchainID() returned zero address — TREXFactory may not have set it. ' +
            'Ensure OIDIdFactory.addTokenFactory(trexFactory) was called during infra deployment.',
        );
      }

      wipState.addresses.tokenOnchainID = tokenOnchainID;
      wipState.completedSteps.push('token_createIdentity');
      saveWIP(wipState);

      onStep('token_createIdentity', {
        status: 'done',
        address: tokenOnchainID,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStep('token_createIdentity', { status: 'error', error: msg });
      throw err;
    }
  }

  // ── Step 4: Deploy ClaimIssuer ────────────────────────────────────────────
  const claimIssuer = await deployStep(
    ctx,
    'claimIssuer_deploy',
    Artifacts.OIDClaimIssuer,
    [account],
  );
  wipState.addresses.claimIssuer = claimIssuer;

  // ── Step 5: ClaimIssuer.addKey ────────────────────────────────────────────
  // Register the backend signing key (ISSUER_PRIVATE_KEY from the environment).
  // Key type 3 = CLAIM signer key.
  const issuerAddress =
    '0xB5D24F6EbdAe0a2B0D11FA8f9c76178500CD7d2C' as `0x${string}`;
  const keyHash = keccak256(
    encodeAbiParameters([{ type: 'address' }], [issuerAddress]),
  );

  await txStep(
    ctx,
    'claimIssuer_addKey',
    claimIssuer,
    Artifacts.OIDClaimIssuer.abi as Abi,
    'addKey',
    [keyHash, 3, 1],
  );

  // ── Step 6: TrustedIssuersRegistry.addTrustedIssuer ──────────────────────
  // Factory was called with issuers:[] — ClaimIssuer wasn't deployed yet.
  // Now register it manually.
  await txStep(
    ctx,
    'tir_addTrustedIssuer',
    suiteAddrs.trustedIssuersRegistryProxy,
    Artifacts.TrustedIssuersRegistry.abi as Abi,
    'addTrustedIssuer',
    [claimIssuer, claimTopics],
  );

  // ── Step 7: Token.unpause() ───────────────────────────────────────────────
  //
  // The factory already called Token.addAgent(account) via tokenAgents:[account].
  // The deployer wallet is already a Token agent — DO NOT call addAgent again.
  // Only unpause is needed here.
  if (!wipState.completedSteps.includes('token_unpause')) {
    onStep('token_unpause', { status: 'running' });
    try {
      const tokenAbi = Artifacts.Token.abi as Abi;
      const tp = suiteAddrs.tokenProxy;

      const hash = await walletClient.writeContract({
        address: tp,
        abi: tokenAbi,
        functionName: 'unpause',
        args: [],
        account,
        chain: null,
      });
      onStep('token_unpause', { txHash: hash });
      await publicClient.waitForTransactionReceipt({ hash });

      wipState.completedSteps.push('token_unpause');
      saveWIP(wipState);
      onStep('token_unpause', { status: 'done' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onStep('token_unpause', { status: 'error', error: msg });
      throw err;
    }
  } else {
    onStep('token_unpause', { status: 'done' });
  }

  return {
    tokenProxy: suiteAddrs.tokenProxy,
    identityRegistryProxy: suiteAddrs.identityRegistryProxy,
    identityRegistryStorageProxy: suiteAddrs.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: suiteAddrs.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: suiteAddrs.claimTopicsRegistryProxy,
    modularComplianceProxy: suiteAddrs.modularComplianceProxy,
    tokenOnchainID,
    claimIssuer,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDeploymentWizard(): UseDeploymentWizardReturn {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const chainId = useChainId();
  const { addToken, setMode, setActiveTokenId, infrastructure } =
    useTokenRegistryContext();

  const savedWIP = account ? loadWIP(chainId, account) : null;

  const [phase, setPhase] = useState<WizardPhase>('idle');
  const [steps, setSteps] = useState<DeployStep[]>(
    buildSteps(savedWIP?.completedSteps),
  );
  const [wip, setWip] = useState<DeployWIPState | null>(savedWIP);
  const [deployedEcosystem, setDeployedEcosystem] =
    useState<DeployedTokenEcosystem | null>(null);

  function updateStep(id: DeployStepId, patch: Partial<DeployStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function execute(wipState: DeployWIPState): Promise<void> {
    if (!walletClient || !publicClient || !account) {
      throw new Error('Wallet not connected');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wc = walletClient as unknown as WalletClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pc = publicClient as unknown as PublicClient;

    setPhase('deploying');

    try {
      const ctx: EngineCtx = {
        walletClient: wc,
        publicClient: pc,
        account,
        chainId,
        wipState,
        onStep: updateStep,
      };

      const addresses = await runAll(ctx);

      // ── Register in TokenRegistry ──────────────────────────────────────────
      updateStep('done', { status: 'running' });

      const ecosystem: DeployedTokenEcosystem = {
        id: crypto.randomUUID(),
        name: wipState.params.name,
        symbol: wipState.params.symbol,
        decimals: wipState.params.decimals,
        chainId,
        salt: wipState.salt,
        deployerAddress: account,
        deployedAt: Date.now(),
        tokenProxy: addresses.tokenProxy,
        identityRegistryProxy: addresses.identityRegistryProxy,
        identityRegistryStorageProxy: addresses.identityRegistryStorageProxy,
        trustedIssuersRegistryProxy: addresses.trustedIssuersRegistryProxy,
        claimTopicsRegistryProxy: addresses.claimTopicsRegistryProxy,
        modularComplianceProxy: addresses.modularComplianceProxy,
        tokenOnchainID: addresses.tokenOnchainID,
        claimIssuer: addresses.claimIssuer,
      };

      await addToken(ecosystem);
      setMode('custom');
      setActiveTokenId(ecosystem.id);

      wipState.completedSteps.push('done');
      saveWIP(wipState);
      clearWIPStorage(chainId, account); // clean up after success

      updateStep('done', { status: 'done' });
      setDeployedEcosystem(ecosystem);
      setWip({ ...wipState });
      setPhase('success');
    } catch (err) {
      setPhase('error');
      throw err;
    }
  }

  async function startDeployment(params: TokenDeployParams): Promise<void> {
    if (!account) throw new Error('Wallet not connected');

    // DB validation: infrastructure MUST exist in the DB for this chain.
    // Static config JSON files are NOT accepted — the chain infrastructure
    // must have been deployed via the InfraDeploymentPanel and saved to the DB.
    if (!infrastructure) {
      throw new Error(
        `Chain infrastructure has not been deployed for chain ${chainId}. ` +
          'Use the "Deploy Chain Infrastructure" panel to deploy and register ' +
          'the shared contracts (TREXFactory, implementations, compliance modules) ' +
          'for this chain before deploying tokens.',
      );
    }

    const salt = generateSalt(params.symbol, account);

    const wipState: DeployWIPState = {
      chainId,
      deployer: account,
      params,
      salt,
      addresses: {},
      completedSteps: [],
      infrastructure,
    };

    setWip(wipState);
    setSteps(buildSteps());
    saveWIP(wipState);

    await execute(wipState);
  }

  async function resumeDeployment(): Promise<void> {
    if (!wip) throw new Error('No deployment to resume');
    // Refresh infra snapshot in case it wasn't set during original deploy
    const currentWip = {
      ...wip,
      infrastructure: wip.infrastructure ?? infrastructure ?? null,
    };
    setSteps(buildSteps(currentWip.completedSteps));
    await execute(currentWip);
  }

  function clearWIP(): void {
    if (account) clearWIPStorage(chainId, account);
    setWip(null);
    setSteps(buildSteps());
    setPhase('idle');
    setDeployedEcosystem(null);
  }

  return {
    phase,
    steps,
    wip,
    canResume: savedWIP !== null && savedWIP.completedSteps.length > 0,
    startDeployment,
    resumeDeployment,
    clearWIP,
    deployedEcosystem,
  };
}
