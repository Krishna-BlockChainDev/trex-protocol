/**
 * lib/explorer.ts
 *
 * Server-side utility that fetches ALL on-chain transactions touching the
 * ERC-3643 token ecosystem contracts from Etherscan / BscScan, classifies
 * them by method selector and event logs, then upserts into PostgreSQL.
 *
 * Two-pass approach:
 *   Pass 1 – `account/txlist` for each ecosystem contract address
 *             → captures ALL txs (token, identity, compliance, deploy, etc.)
 *             → provides enrichment: gasUsed, gasPrice, txFee, nonce, status
 *   Pass 2 – `logs/getLogs` for token contract event topics
 *             → provides semantic fromAddress / toAddress / amount per event
 *             → fills in the "fine-grained" event rows (Mint, Transfer, etc.)
 *
 * Duplicate prevention:
 *   @@unique([ecosystemId, txHash, eventType]) in the DB schema.
 *   If a tx fires multiple events (e.g. Transfer + Frozen), each event gets
 *   its own row with a different eventType. Pure txlist rows use eventType
 *   derived from the 4-byte method selector.
 *
 * Contract addresses scanned per ecosystem:
 *   - tokenProxy            (Token operations + addAgent / removeAgent)
 *   - identityRegistryProxy (RegisterIdentity / DeleteIdentity / UpdateCountry)
 *   - identityRegistryStorageProxy
 *   - trustedIssuersRegistryProxy
 *   - claimTopicsRegistryProxy
 *   - modularComplianceProxy
 *   - trexFactory           (deployTREXSuite — the initial ecosystem deploy tx)
 *   - oidIdFactory          (CreateIdentity ops via IdFactory)
 *
 * Supported chains:
 *   1        → Ethereum Mainnet  (ETHERSCAN_API_KEY)
 *   11155111 → Sepolia Testnet   (ETHERSCAN_API_KEY)
 *   56       → BSC Mainnet       (BSCSCAN_API_KEY)
 *   97       → BSC Testnet       (BSCSCAN_API_KEY)
 */

import { db } from '@/lib/db';

// ── Constants ──────────────────────────────────────────────────────────────────

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** EVM event topic hashes (keccak256 of event signature) */
const TOPICS = {
  Transfer:
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  TokensFrozen:
    '0x0e8e77626586f73b955364c7b4bbf0bb7f7685ebd40e852b164633a4acbd3244',
  TokensUnfrozen:
    '0x1d7c520a984e6e95b53f5af1c7a2d3dfdf45a0ba43eeee7fc77e0e0d4568b291',
  AddressFrozen:
    '0xdcc16fd18a808d877bcd9a09b544844b36ae8f0a3a2a2f73f3bcf45b99c2e4e3',
  Paused: '0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258',
  Unpaused:
    '0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa',
  RecoverySuccess:
    '0x3c1697db3a63f3853ea7d98c04c4c68c00c0ab4f18f8a2a8cfe9ed1a14b9de29',
} as const;

/**
 * ERC-3643 / ERC-20 4-byte method selectors → { category, eventType }
 *
 * Category rules:
 *   Token      – any function that changes token state or manages token agents
 *                (addAgent/removeAgent live on the AgentRole mixin of the Token
 *                 contract, so they belong here — NOT in Deploy/Infra)
 *   Identity   – functions on IdentityRegistry, IdentityRegistryStorage, or OID
 *   Compliance – functions on ModularCompliance or its modules
 *   Deploy     – factory-level deploys (deployTREXSuite, proxy/implementation creation)
 *   Infra      – one-time infrastructure wiring (addTokenFactory, bindRegistry, etc.)
 *
 * Generated from keccak256(functionSignature).slice(0,4) in hex.
 */
const METHOD_SELECTORS: Record<
  string,
  { category: string; eventType: string }
> = {
  // ── Token operations ──────────────────────────────────────────────────────
  '0x40c10f19': { category: 'Token', eventType: 'Mint' },
  '0x42966c68': { category: 'Token', eventType: 'Burn' },
  '0x15b861b5': { category: 'Token', eventType: 'ForcedTransfer' },
  '0xa9059cbb': { category: 'Token', eventType: 'Transfer' },
  '0x23b872dd': { category: 'Token', eventType: 'Transfer' },
  '0x88d695b2': { category: 'Token', eventType: 'Transfer' },
  '0x68573107': { category: 'Token', eventType: 'Mint' },
  '0x57c9a463': { category: 'Token', eventType: 'TokensFrozen' },
  '0x8b92da14': { category: 'Token', eventType: 'TokensUnfrozen' },
  '0x7b8f8b05': { category: 'Token', eventType: 'AddressFrozen' },
  '0xd6e9e8aa': { category: 'Token', eventType: 'AddressFrozen' },
  '0x8456cb59': { category: 'Token', eventType: 'Paused' },
  '0x3f4ba83a': { category: 'Token', eventType: 'Unpaused' },
  '0xae2a2a84': { category: 'Token', eventType: 'Recovery' },
  // Agent management lives on the Token contract (AgentRole mixin) → Token
  '0x2d06177a': { category: 'Token', eventType: 'AddAgent' },
  '0xb2494df3': { category: 'Token', eventType: 'RemoveAgent' },

  // ── Identity operations ───────────────────────────────────────────────────
  '0x7f3c2a40': { category: 'Identity', eventType: 'RegisterIdentity' },
  '0x1ac7efac': { category: 'Identity', eventType: 'DeleteIdentity' },
  '0x1459457a': { category: 'Identity', eventType: 'UpdateIdentity' },
  '0x7b4c7e61': { category: 'Identity', eventType: 'UpdateCountry' },
  '0x3b61e803': { category: 'Identity', eventType: 'AddClaim' },
  '0x4eeb7391': { category: 'Identity', eventType: 'RemoveClaim' },
  '0x1d381240': { category: 'Identity', eventType: 'AddKey' },
  '0x738dbe52': { category: 'Identity', eventType: 'RemoveKey' },
  '0x9d6807b2': { category: 'Identity', eventType: 'ExecuteClaim' },

  // ── Compliance operations ─────────────────────────────────────────────────
  '0xcf35bdd0': { category: 'Compliance', eventType: 'AddModule' },
  '0x58edef4c': { category: 'Compliance', eventType: 'RemoveModule' },
  '0x6657732f': { category: 'Compliance', eventType: 'SetMaxBalance' },
  '0x6addcc10': { category: 'Compliance', eventType: 'SetSupplyLimit' },
  '0x2b95c4b5': { category: 'Compliance', eventType: 'SetCountryAllow' },
  '0x8c92b7c5': { category: 'Compliance', eventType: 'SetCountryAllow' },
  '0x96e9d5fc': { category: 'Compliance', eventType: 'SetCountryRestrict' },
  '0x9bafb05b': { category: 'Compliance', eventType: 'SetCountryRestrict' },
  '0x4b2b5462': { category: 'Compliance', eventType: 'SetCountryAllow' },
  '0x1daa82f5': { category: 'Compliance', eventType: 'SetCountryAllow' },
  '0x810a0813': { category: 'Compliance', eventType: 'SetCountryRestrict' },
  '0xfbc58266': { category: 'Compliance', eventType: 'SetCountryRestrict' },
  '0x6aa36e79': { category: 'Compliance', eventType: 'AddModule' },
  '0x4be91a1a': { category: 'Compliance', eventType: 'RemoveModule' },
  // callModuleFunction(bytes,address) → 0xefb22d33
  // Called on ModularCompliance to forward calls into a bound compliance module
  // (e.g. setMaxBalance, batchAllowCountries, setSupplyLimit via proxy)
  '0xefb22d33': { category: 'Compliance', eventType: 'ModuleCall' },

  // ── Token config ──────────────────────────────────────────────────────────
  // setCompliance(address) → 0xf8981789  (Token proxy — binds compliance contract)
  '0xf8981789': { category: 'Token', eventType: 'SetCompliance' },

  // ── Deploy / factory-level ────────────────────────────────────────────────
  // deployTREXSuite(string,tuple,tuple) → 0xcf753d37  (TREXFactory)
  '0xcf753d37': { category: 'Deploy', eventType: 'DeployToken' },
  // deployToken(tuple,tuple)            → 0x73ad4682  (alt factory signature)
  '0x73ad4682': { category: 'Deploy', eventType: 'DeployToken' },

  // ── Infra / one-time wiring ───────────────────────────────────────────────
  // addTokenFactory(address) → 0x9ce19365  (IdFactory — registers token factory)
  '0x9ce19365': { category: 'Infra', eventType: 'AddTokenFactory' },
  // createIdentity(address,string)      → 0x714e46d3  (IdFactory)
  '0x714e46d3': { category: 'Identity', eventType: 'CreateIdentity' },
  // createIdentityWithSalt(address,string,string) → 0x41aa92d3
  '0x41aa92d3': { category: 'Identity', eventType: 'CreateIdentity' },
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExplorerTransaction {
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
  eventType: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  operatorAddress?: string;
}

/** Enrichment data fetched from Etherscan txlist */
interface TxEnrichment {
  txStatus: string; // 'success' | 'failed' | 'pending'
  gasUsed: bigint;
  gasPrice: string; // wei as decimal string
  txFee: string; // wei as decimal string (gasUsed × gasPrice)
  nonce: number;
  txIndex: number;
  senderAddress: string;
}

interface EtherscanLog {
  transactionHash: string;
  blockNumber: string;
  timeStamp: string;
  topics: string[];
  data: string;
  address: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanLog[] | string;
}

/** Row returned by Etherscan `account/txlist` action */
interface EtherscanTxRow {
  hash: string;
  from: string;
  to: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  nonce: string;
  transactionIndex: string;
  txreceipt_status: string; // '1' = success, '0' = failed, '' = contract creation/pending
  isError: string; // '0' = no error, '1' = error
  blockNumber: string;
  timeStamp: string;
  input: string; // method selector + calldata (0x for native transfers)
  contractAddress: string; // non-empty for contract creation txs
  value: string; // ETH value in wei
  functionName: string; // human-readable function name (when available)
}

interface EtherscanTxListResponse {
  status: string;
  message: string;
  result: EtherscanTxRow[] | string;
}

// ── Explorer config ────────────────────────────────────────────────────────────

/**
 * Returns the Etherscan V2 unified API config for a given chain.
 *
 * Etherscan V2 migration (May 2025):
 *   All chains share a single base URL: https://api.etherscan.io/v2/api
 *   Chain is selected via the `chainid` query parameter.
 *   Chain-specific V1 URLs (api-sepolia.etherscan.io, etc.) are deprecated.
 *
 * BscScan is still on V1 per-chain URLs (not part of Etherscan V2).
 */
function getExplorerConfig(chainId: number): {
  apiUrl: string;
  apiKey: string;
  /** For V2: chainid query param to include in every request */
  chainIdParam?: string;
} {
  const etherscanKey = process.env.ETHERSCAN_API_KEY ?? '';
  const bscscanKey = process.env.BSCSCAN_API_KEY ?? '';

  switch (chainId) {
    // Ethereum Mainnet — V2
    case 1:
      return {
        apiUrl: 'https://api.etherscan.io/v2/api',
        apiKey: etherscanKey,
        chainIdParam: '1',
      };
    // Sepolia Testnet — V2
    case 11155111:
      return {
        apiUrl: 'https://api.etherscan.io/v2/api',
        apiKey: etherscanKey,
        chainIdParam: '11155111',
      };
    // BSC Mainnet — V1 (BscScan)
    case 56:
      return { apiUrl: 'https://api.bscscan.com/api', apiKey: bscscanKey };
    // BSC Testnet — V1 (BscScan)
    case 97:
      return {
        apiUrl: 'https://api-testnet.bscscan.com/api',
        apiKey: bscscanKey,
      };
    // Fallback: Etherscan V2 with provided chainId
    default:
      return {
        apiUrl: 'https://api.etherscan.io/v2/api',
        apiKey: etherscanKey,
        chainIdParam: chainId.toString(),
      };
  }
}

// ── Decode helpers ─────────────────────────────────────────────────────────────

/** Pad a hex address topic back to a checksummed address */
function topicToAddress(topic: string): string {
  // Topics are 32 bytes; address is the last 20 bytes
  return ('0x' + topic.slice(-40)).toLowerCase();
}

/** Decode a uint256 from 32-byte hex data */
function decodeUint256(hex: string): bigint {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    return BigInt('0x' + (clean || '0'));
  } catch {
    return BigInt(0);
  }
}

/**
 * Decode a single Etherscan log entry into a structured ExplorerTransaction.
 * Returns null if the log topic is unrecognised.
 */
function decodeLog(log: EtherscanLog): ExplorerTransaction | null {
  const topic0 = log.topics[0]?.toLowerCase();
  const blockNumber = BigInt(parseInt(log.blockNumber, 16));
  const timestamp = new Date(parseInt(log.timeStamp, 16) * 1000);
  const txHash = log.transactionHash.toLowerCase();

  // ── Transfer(from, to, value) ────────────────────────────────────────────
  if (topic0 === TOPICS.Transfer) {
    const from = topicToAddress(log.topics[1] ?? '0x' + '0'.repeat(64));
    const to = topicToAddress(log.topics[2] ?? '0x' + '0'.repeat(64));
    const amount = decodeUint256(log.data).toString();

    let eventType = 'Transfer';
    if (from === ZERO_ADDRESS) eventType = 'Mint';
    else if (to === ZERO_ADDRESS) eventType = 'Burn';

    return {
      txHash,
      blockNumber,
      timestamp,
      eventType,
      fromAddress: from,
      toAddress: to,
      amount,
    };
  }

  // ── TokensFrozen(investor, amount) ──────────────────────────────────────
  if (topic0 === TOPICS.TokensFrozen) {
    const investor = topicToAddress(log.topics[1] ?? '0x' + '0'.repeat(64));
    const amount = decodeUint256(log.data).toString();
    return {
      txHash,
      blockNumber,
      timestamp,
      eventType: 'TokensFrozen',
      fromAddress: investor,
      toAddress: investor,
      amount,
    };
  }

  // ── TokensUnfrozen(investor, amount) ────────────────────────────────────
  if (topic0 === TOPICS.TokensUnfrozen) {
    const investor = topicToAddress(log.topics[1] ?? '0x' + '0'.repeat(64));
    const amount = decodeUint256(log.data).toString();
    return {
      txHash,
      blockNumber,
      timestamp,
      eventType: 'TokensUnfrozen',
      fromAddress: investor,
      toAddress: investor,
      amount,
    };
  }

  // ── AddressFrozen(userAddress, isFrozen, owner) ──────────────────────────
  if (topic0 === TOPICS.AddressFrozen) {
    const user = topicToAddress(log.topics[1] ?? '0x' + '0'.repeat(64));
    const isFrozen = log.topics[2]?.endsWith('1') ?? false;
    const operator = topicToAddress(log.topics[3] ?? '0x' + '0'.repeat(64));
    return {
      txHash,
      blockNumber,
      timestamp,
      eventType: isFrozen ? 'AddressFrozen' : 'AddressUnfrozen',
      fromAddress: operator,
      toAddress: user,
      amount: '0',
      operatorAddress: operator,
    };
  }

  // ── Paused(account) ──────────────────────────────────────────────────────
  if (topic0 === TOPICS.Paused) {
    const account = topicToAddress(log.topics[1] ?? log.data);
    return {
      txHash,
      blockNumber,
      timestamp,
      eventType: 'Paused',
      fromAddress: account,
      toAddress: ZERO_ADDRESS,
      amount: '0',
      operatorAddress: account,
    };
  }

  // ── Unpaused(account) ────────────────────────────────────────────────────
  if (topic0 === TOPICS.Unpaused) {
    const account = topicToAddress(log.topics[1] ?? log.data);
    return {
      txHash,
      blockNumber,
      timestamp,
      eventType: 'Unpaused',
      fromAddress: account,
      toAddress: ZERO_ADDRESS,
      amount: '0',
      operatorAddress: account,
    };
  }

  // ── RecoverySuccess ──────────────────────────────────────────────────────
  if (topic0 === TOPICS.RecoverySuccess) {
    const lostWallet = topicToAddress(log.topics[1] ?? '0x' + '0'.repeat(64));
    const newWallet = topicToAddress(log.topics[2] ?? '0x' + '0'.repeat(64));
    return {
      txHash,
      blockNumber,
      timestamp,
      eventType: 'Recovery',
      fromAddress: lostWallet,
      toAddress: newWallet,
      amount: '0',
    };
  }

  return null;
}

/**
 * Classify a raw txlist row into { category, eventType } using the function
 * name string (most reliable) and 4-byte selector fallback.
 *
 * Category rules:
 *   Token      – anything that changes token state including addAgent/removeAgent
 *                (those functions live on the AgentRole mixin of the Token contract)
 *   Identity   – registerIdentity, addClaim, createIdentity (OID factory), etc.
 *   Compliance – module bindings, country lists, balance caps, supply limits
 *   Deploy     – deployTREXSuite (factory call) and raw EVM contract creations
 *   Infra      – one-time infra wiring: addTokenFactory, bindRegistry, initialize, etc.
 *
 * Falls back to 'Infra' / 'ContractCall' for unknown selectors, and
 * 'Deploy' / 'Deploy' for raw contract creation txs (to == '' && contractAddress set).
 */
function classifyTx(row: EtherscanTxRow): {
  category: string;
  eventType: string;
  /** Which contract "type" the tx targets — used to refine category for agent ops */
  contractRole?: string;
} {
  // 1. Contract creation: to is empty and contractAddress is set
  if (!row.to && row.contractAddress) {
    return { category: 'Deploy', eventType: 'Deploy' };
  }

  // 2. Native ETH transfer with no data
  if (!row.input || row.input === '0x' || row.input === '') {
    return { category: 'Infra', eventType: 'Transfer' };
  }

  // 3. functionName string matching — Etherscan provides this for known ABIs
  //    More reliable than 4-byte selectors (no ABI needed, handles proxy upgrades)
  if (row.functionName) {
    const fn = row.functionName.toLowerCase();

    // Token operations
    if (fn.startsWith('mint(')) return { category: 'Token', eventType: 'Mint' };
    if (fn.startsWith('burn(')) return { category: 'Token', eventType: 'Burn' };
    if (fn.startsWith('forcedtransfer('))
      return { category: 'Token', eventType: 'ForcedTransfer' };
    if (
      fn.startsWith('transfer(') ||
      fn.startsWith('transferfrom(') ||
      fn.startsWith('batchtransfer(')
    )
      return { category: 'Token', eventType: 'Transfer' };
    if (fn.startsWith('batchmint('))
      return { category: 'Token', eventType: 'Mint' };
    if (fn.startsWith('freezepartialtokens('))
      return { category: 'Token', eventType: 'TokensFrozen' };
    if (fn.startsWith('unfreezepartialtokens('))
      return { category: 'Token', eventType: 'TokensUnfrozen' };
    if (
      fn.startsWith('setaddressfrozen(') ||
      fn.startsWith('batchsetaddressfrozen(')
    )
      return { category: 'Token', eventType: 'AddressFrozen' };
    if (fn.startsWith('pause('))
      return { category: 'Token', eventType: 'Paused' };
    if (fn.startsWith('unpause('))
      return { category: 'Token', eventType: 'Unpaused' };
    if (fn.startsWith('recoveryaddress('))
      return { category: 'Token', eventType: 'Recovery' };

    // Agent management — addAgent/removeAgent live on the Token contract
    // (AgentRole mixin), so category = Token, NOT System
    if (fn.startsWith('addagent('))
      return { category: 'Token', eventType: 'AddAgent' };
    if (fn.startsWith('removeagent('))
      return { category: 'Token', eventType: 'RemoveAgent' };

    // Identity operations
    if (
      fn.startsWith('registeridentity(') ||
      fn.startsWith('addidentitytostorage(')
    )
      return { category: 'Identity', eventType: 'RegisterIdentity' };
    if (
      fn.startsWith('deleteidentity(') ||
      fn.startsWith('removeidentityfromstorage(')
    )
      return { category: 'Identity', eventType: 'DeleteIdentity' };
    if (fn.startsWith('updateidentity('))
      return { category: 'Identity', eventType: 'UpdateIdentity' };
    if (fn.startsWith('updatecountry('))
      return { category: 'Identity', eventType: 'UpdateCountry' };
    if (fn.startsWith('addclaim('))
      return { category: 'Identity', eventType: 'AddClaim' };
    if (fn.startsWith('removeclaim('))
      return { category: 'Identity', eventType: 'RemoveClaim' };
    if (fn.startsWith('addkey('))
      return { category: 'Identity', eventType: 'AddKey' };
    if (fn.startsWith('removekey('))
      return { category: 'Identity', eventType: 'RemoveKey' };
    // OID factory operations
    if (
      fn.startsWith('createidentity(') ||
      fn.startsWith('createidentitywithsalt(')
    )
      return { category: 'Identity', eventType: 'CreateIdentity' };

    // Token config operations
    if (fn.startsWith('setcompliance('))
      return { category: 'Token', eventType: 'SetCompliance' };

    // Compliance operations
    if (fn.startsWith('addmodule(') || fn.startsWith('bindcompliance('))
      return { category: 'Compliance', eventType: 'AddModule' };
    if (fn.startsWith('removemodule(') || fn.startsWith('unbindcompliance('))
      return { category: 'Compliance', eventType: 'RemoveModule' };
    if (fn.startsWith('setmaxbalance('))
      return { category: 'Compliance', eventType: 'SetMaxBalance' };
    if (fn.startsWith('setsupplylimit('))
      return { category: 'Compliance', eventType: 'SetSupplyLimit' };
    if (
      fn.startsWith('addallowedcountry(') ||
      fn.startsWith('removeallowedcountry(') ||
      fn.startsWith('batchallowcountries(') ||
      fn.startsWith('batchdisallowcountries(')
    )
      return { category: 'Compliance', eventType: 'SetCountryAllow' };
    if (
      fn.startsWith('addrestrictedcountry(') ||
      fn.startsWith('removerestrictedcountry(') ||
      fn.startsWith('batchrestrictcountries(') ||
      fn.startsWith('batchunrestrictcountries(')
    )
      return { category: 'Compliance', eventType: 'SetCountryRestrict' };
    // callModuleFunction — ModularCompliance forwarding calls into bound modules
    // (used for setMaxBalance, setSupplyLimit, batchAllowCountries, etc.)
    if (fn.startsWith('callmodulefunction('))
      return { category: 'Compliance', eventType: 'ModuleCall' };
    // Claim topics + trusted issuers = compliance configuration
    if (fn.startsWith('addclaimtopic(') || fn.startsWith('removeclaimtopic('))
      return { category: 'Compliance', eventType: 'SetClaimTopic' };
    if (
      fn.startsWith('addtrustedissuer(') ||
      fn.startsWith('removetrustedissuer(') ||
      fn.startsWith('updateissuerclaims(')
    )
      return { category: 'Compliance', eventType: 'SetTrustedIssuer' };

    // Factory / deploy operations
    if (
      fn.startsWith('deploytrexsuite(') ||
      fn.startsWith('deploytoken(') ||
      fn.startsWith('deploysuite(')
    )
      return { category: 'Deploy', eventType: 'DeployToken' };
    if (fn.startsWith('initialize(') || fn.startsWith('setup('))
      return { category: 'Deploy', eventType: 'Deploy' };
    // addTokenFactory — IdFactory registers a token factory (OID infra setup)
    if (fn.startsWith('addtokenfactory('))
      return { category: 'Infra', eventType: 'AddTokenFactory' };

    // Registry bindings that appear on non-token contracts (one-time infra wiring)
    if (
      fn.startsWith('bindidentityregistry(') ||
      fn.startsWith('setidentityregistry(')
    )
      return { category: 'Infra', eventType: 'BindRegistry' };
  }

  // 4. 4-byte selector fallback
  const selector = row.input.slice(0, 10).toLowerCase();
  const known = METHOD_SELECTORS[selector];
  if (known) return known;

  // 5. Unknown → Infra/ContractCall (unknown infra/setup call)
  return { category: 'Infra', eventType: 'ContractCall' };
}

// ── Sleep helper ───────────────────────────────────────────────────────────────

/** Sleep to avoid Etherscan free-tier rate limit (3 req/sec) */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Etherscan txlist fetch ─────────────────────────────────────────────────────

/**
 * Fetch ALL transactions that touch a contract address using `account/txlist`.
 * Returns raw rows — one call covers up to 10,000 txs.
 */
async function fetchTxList(
  apiUrl: string,
  apiKey: string,
  contractAddress: string,
  fromBlock = 0,
  chainIdParam?: string,
): Promise<EtherscanTxRow[]> {
  if (!apiKey) return [];

  const paramObj: Record<string, string> = {
    module: 'account',
    action: 'txlist',
    address: contractAddress,
    startblock: fromBlock.toString(),
    endblock: '99999999',
    page: '1',
    offset: '10000',
    sort: 'asc',
    apikey: apiKey,
  };

  if (chainIdParam) paramObj.chainid = chainIdParam;

  try {
    const params = new URLSearchParams(paramObj);
    const url = `${apiUrl}?${params.toString()}`;
    console.log(
      `[explorer] txlist: ${contractAddress.slice(0, 10)}… (chainid=${chainIdParam ?? 'n/a'}, fromBlock=${fromBlock})`,
    );

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'ERC-3643-Dashboard/1.0' },
      signal: AbortSignal.timeout(20_000),
    });

    if (!resp.ok) {
      console.warn(
        `[explorer] txlist HTTP ${resp.status} for ${contractAddress}`,
      );
      return [];
    }

    const json: EtherscanTxListResponse = await resp.json();

    if (json.status === '1' && Array.isArray(json.result)) {
      console.log(
        `[explorer] txlist: ${json.result.length} rows for ${contractAddress.slice(0, 10)}…`,
      );
      return json.result;
    } else if (
      json.message === 'No transactions found' ||
      json.result === 'No transactions found'
    ) {
      return [];
    } else {
      const errMsg =
        typeof json.result === 'string' ? json.result : json.message;
      console.warn(
        `[explorer] txlist warning for ${contractAddress}: ${errMsg}`,
      );
      return [];
    }
  } catch (err) {
    console.warn(
      '[explorer] txlist fetch error (non-fatal):',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

// ── Etherscan log fetch ────────────────────────────────────────────────────────

/**
 * Fetch all relevant event logs for a token contract from the explorer API.
 * Uses `eth_getLogs` style endpoint (getLogs action) per event topic.
 */
async function fetchLogsFromExplorer(
  apiUrl: string,
  apiKey: string,
  tokenAddress: string,
  fromBlock = 0,
  chainIdParam?: string,
): Promise<EtherscanLog[]> {
  if (!apiKey) {
    throw new Error(
      'ETHERSCAN_API_KEY (or BSCSCAN_API_KEY) is not set in environment variables. ' +
        'Set it in frontend/.env and restart the server.',
    );
  }

  const allLogs: EtherscanLog[] = [];
  let firstCall = true;

  // Fetch up to 1000 logs per topic in a single pass (Etherscan free tier limit)
  for (const [eventName, topicHash] of Object.entries(TOPICS)) {
    // Rate-limit guard: Etherscan free tier = 3 req/sec; add 400ms between calls
    if (!firstCall) await sleep(400);
    firstCall = false;

    const paramObj: Record<string, string> = {
      module: 'logs',
      action: 'getLogs',
      address: tokenAddress,
      fromBlock: fromBlock.toString(),
      toBlock: 'latest',
      topic0: topicHash,
      page: '1',
      offset: '1000',
      apikey: apiKey,
    };

    // V2: include chainid so the single endpoint knows which chain to query
    if (chainIdParam) {
      paramObj.chainid = chainIdParam;
    }

    const params = new URLSearchParams(paramObj);

    try {
      const url = `${apiUrl}?${params.toString()}`;
      console.log(
        `[explorer] logs/${eventName}: ${apiUrl} (chainid=${chainIdParam ?? 'n/a'})`,
      );

      const resp = await fetch(url, {
        headers: { 'User-Agent': 'ERC-3643-Dashboard/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        console.warn(`[explorer] HTTP ${resp.status} for topic ${topicHash}`);
        continue;
      }

      const json: EtherscanResponse = await resp.json();

      if (json.status === '1' && Array.isArray(json.result)) {
        console.log(`[explorer] ${eventName}: ${json.result.length} logs`);
        allLogs.push(...json.result);
      } else if (json.message === 'No records found') {
        console.log(`[explorer] ${eventName}: no records found`);
      } else {
        const errMsg =
          typeof json.result === 'string' ? json.result : json.message;
        throw new Error(`Etherscan API error for ${eventName}: ${errMsg}`);
      }
    } catch (err) {
      throw err;
    }
  }

  return allLogs;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Contract addresses for a token ecosystem to query transactions against.
 * Passed to syncTransactionsFromExplorer so it can scan all related contracts.
 *
 * New in v2:
 *   trexFactory  – The TREXFactory address from ChainInfrastructure.
 *                  Must be included so the initial deployTREXSuite() tx is captured.
 *   oidIdFactory – The OID IdFactory address from ChainInfrastructure.
 *                  Captures createIdentity() transactions for investor onboarding.
 */
export interface EcosystemContracts {
  tokenProxy: string;
  identityRegistryProxy: string;
  identityRegistryStorageProxy: string;
  trustedIssuersRegistryProxy: string;
  claimTopicsRegistryProxy: string;
  modularComplianceProxy: string;
  /** TREXFactory address — captures the initial deployTREXSuite() transaction */
  trexFactory?: string;
  /** OID IdFactory address — captures createIdentity() transactions */
  oidIdFactory?: string;
}

/**
 * Fetch ALL on-chain transactions for a token ecosystem from the blockchain
 * explorer. This includes:
 *   - Token events: Transfer, Mint, Burn, Freeze, Pause, Recovery, etc.
 *   - Token management: addAgent, removeAgent (Token category)
 *   - Identity operations: RegisterIdentity, AddClaim, DeleteIdentity, CreateIdentity, etc.
 *   - Compliance operations: AddModule, SetMaxBalance, SetCountries, etc.
 *   - System operations: deployTREXSuite (initial deploy), proxy upgrades, etc.
 *
 * Two-pass strategy:
 *   1. `txlist` for each ecosystem contract address → ALL txs with enrichment
 *      Contracts scanned: tokenProxy, identityRegistryProxy,
 *      identityRegistryStorageProxy, trustedIssuersRegistryProxy,
 *      claimTopicsRegistryProxy, modularComplianceProxy,
 *      trexFactory (optional), oidIdFactory (optional)
 *   2. `getLogs` for token contract event topics → semantic event details
 *
 * Deduplication via @@unique([ecosystemId, txHash, eventType]) in DB.
 *
 * @param chainId              EVM chain ID
 * @param tokenAddress         Token proxy address
 * @param ecosystemId          DB ecosystem UUID (FK)
 * @param contracts            All ecosystem contract addresses (optional but recommended)
 * @param fromBlockOverride    Start block for incremental sync
 * @returns Number of rows upserted
 */
export async function syncTransactionsFromExplorer(
  chainId: number,
  tokenAddress: string,
  ecosystemId: string,
  contracts?: EcosystemContracts,
  fromBlockOverride?: number,
): Promise<{ count: number; highestBlock: number }> {
  const { apiUrl, apiKey, chainIdParam } = getExplorerConfig(chainId);

  // Determine starting block:
  //   1. Caller-supplied override (for incremental polling from lastSyncedBlock)
  //   2. Highest block already in DB for this ecosystem + 1
  //   3. 0 (full scan)
  let fromBlock: number;
  if (fromBlockOverride !== undefined && fromBlockOverride > 0) {
    fromBlock = fromBlockOverride;
  } else {
    const latestSynced = await db.tokenTransaction.findFirst({
      where: { ecosystemId },
      orderBy: { blockNumber: 'desc' },
      select: { blockNumber: true },
    });
    fromBlock = latestSynced ? Number(latestSynced.blockNumber) + 1 : 0;
  }

  console.log(
    `[explorer] syncTransactionsFromExplorer: chainId=${chainId}, tokenAddress=${tokenAddress}, fromBlock=${fromBlock}`,
  );

  // ── Pass 1: Fetch txlist for all ecosystem contract addresses ──────────────

  // Build unique set of contract addresses to query.
  // Order matters: put most important first (token proxy), then infra.
  const contractAddresses = new Set<string>([tokenAddress.toLowerCase()]);
  if (contracts) {
    contractAddresses.add(contracts.identityRegistryProxy.toLowerCase());
    contractAddresses.add(contracts.identityRegistryStorageProxy.toLowerCase());
    contractAddresses.add(contracts.trustedIssuersRegistryProxy.toLowerCase());
    contractAddresses.add(contracts.claimTopicsRegistryProxy.toLowerCase());
    contractAddresses.add(contracts.modularComplianceProxy.toLowerCase());
    // Factory contracts — capture deployTREXSuite and createIdentity ops
    if (contracts.trexFactory) {
      contractAddresses.add(contracts.trexFactory.toLowerCase());
    }
    if (contracts.oidIdFactory) {
      contractAddresses.add(contracts.oidIdFactory.toLowerCase());
    }
  }

  // Fetch txlist for each contract address (with rate-limit sleep between calls)
  const allTxRows: EtherscanTxRow[] = [];
  let isFirst = true;
  for (const addr of contractAddresses) {
    if (!isFirst) await sleep(400);
    isFirst = false;
    const rows = await fetchTxList(
      apiUrl,
      apiKey,
      addr,
      fromBlock,
      chainIdParam,
    );
    allTxRows.push(...rows);
  }

  // Deduplicate txlist rows by hash (same tx may appear when querying multiple contracts)
  const txMap = new Map<string, EtherscanTxRow>();
  for (const row of allTxRows) {
    const hash = row.hash.toLowerCase();
    if (!txMap.has(hash)) txMap.set(hash, row);
  }

  console.log(
    `[explorer] txlist total: ${allTxRows.length} rows → ${txMap.size} unique txs`,
  );

  // Build enrichment map from txlist
  const enrichMap = new Map<string, TxEnrichment>();
  for (const row of txMap.values()) {
    const hash = row.hash.toLowerCase();
    const gasUsed = BigInt(row.gasUsed || '0');
    const gasPriceWei = BigInt(row.gasPrice || '0');
    const txFeeWei = (gasUsed * gasPriceWei).toString();

    let txStatus = 'pending';
    if (row.txreceipt_status === '1') txStatus = 'success';
    else if (row.txreceipt_status === '0' || row.isError === '1')
      txStatus = 'failed';

    enrichMap.set(hash, {
      txStatus,
      gasUsed,
      gasPrice: row.gasPrice || '0',
      txFee: txFeeWei,
      nonce: parseInt(row.nonce || '0', 10),
      txIndex: parseInt(row.transactionIndex || '0', 10),
      senderAddress: (row.from || '').toLowerCase(),
    });
  }

  // ── Pass 2: Fetch event logs for token contract ────────────────────────────

  let decodedLogs: ExplorerTransaction[] = [];
  try {
    await sleep(400); // rate-limit gap before log fetches
    const rawLogs = await fetchLogsFromExplorer(
      apiUrl,
      apiKey,
      tokenAddress,
      fromBlock,
      chainIdParam,
    );
    decodedLogs = rawLogs
      .map((log) => decodeLog(log))
      .filter((tx): tx is ExplorerTransaction => tx !== null);
    console.log(`[explorer] decoded ${decodedLogs.length} event logs`);
  } catch (err) {
    // Log fetch failure is non-fatal if we have txlist data
    console.warn(
      '[explorer] event log fetch failed (non-fatal):',
      err instanceof Error ? err.message : err,
    );
  }

  // Build a set of txHash+eventType pairs already covered by event logs
  // so we don't double-count them from txlist
  const logKeys = new Set<string>();
  for (const tx of decodedLogs) {
    logKeys.add(`${tx.txHash}::${tx.eventType}`);
  }

  // ── Upsert event log rows (semantic, with exact from/to/amount) ────────────

  let upsertCount = 0;

  for (const tx of decodedLogs) {
    const enrich = enrichMap.get(tx.txHash);
    try {
      await db.tokenTransaction.upsert({
        where: {
          ecosystemId_txHash_eventType: {
            ecosystemId,
            txHash: tx.txHash,
            eventType: tx.eventType,
          },
        },
        create: {
          ecosystemId,
          txHash: tx.txHash,
          blockNumber: tx.blockNumber,
          timestamp: tx.timestamp,
          category: 'Token',
          eventType: tx.eventType,
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          operatorAddress: tx.operatorAddress ?? null,
          txStatus: enrich?.txStatus ?? 'success',
          gasUsed: enrich?.gasUsed ?? null,
          gasPrice: enrich?.gasPrice ?? null,
          txFee: enrich?.txFee ?? null,
          nonce: enrich?.nonce ?? null,
          txIndex: enrich?.txIndex ?? null,
          senderAddress: enrich?.senderAddress ?? null,
        },
        update: {
          blockNumber: tx.blockNumber,
          timestamp: tx.timestamp,
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          operatorAddress: tx.operatorAddress ?? null,
          txStatus: enrich?.txStatus ?? 'success',
          gasUsed: enrich?.gasUsed ?? null,
          gasPrice: enrich?.gasPrice ?? null,
          txFee: enrich?.txFee ?? null,
          nonce: enrich?.nonce ?? null,
          txIndex: enrich?.txIndex ?? null,
          senderAddress: enrich?.senderAddress ?? null,
        },
      });
      upsertCount++;
    } catch (err) {
      console.warn('[explorer] event log upsert error:', err);
    }
  }

  // ── Upsert txlist rows not already covered by event logs ──────────────────

  for (const row of txMap.values()) {
    const hash = row.hash.toLowerCase();
    const enrich = enrichMap.get(hash)!;
    const { category, eventType } = classifyTx(row);

    // Skip if this exact txHash+eventType combo was already handled by event logs
    if (logKeys.has(`${hash}::${eventType}`)) continue;

    const blockNum = BigInt(row.blockNumber);
    const timestamp = new Date(Number(row.timeStamp) * 1000);

    // For txlist-only rows: `to` field is the contract being called
    const toAddress = (
      row.to ||
      row.contractAddress ||
      ZERO_ADDRESS
    ).toLowerCase();
    const fromAddress = (row.from || ZERO_ADDRESS).toLowerCase();

    try {
      await db.tokenTransaction.upsert({
        where: {
          ecosystemId_txHash_eventType: {
            ecosystemId,
            txHash: hash,
            eventType,
          },
        },
        create: {
          ecosystemId,
          txHash: hash,
          blockNumber: blockNum,
          timestamp,
          category,
          eventType,
          fromAddress,
          toAddress,
          amount: '0',
          txStatus: enrich.txStatus,
          gasUsed: enrich.gasUsed,
          gasPrice: enrich.gasPrice,
          txFee: enrich.txFee,
          nonce: enrich.nonce,
          txIndex: enrich.txIndex,
          senderAddress: enrich.senderAddress,
          metadata: row.functionName
            ? JSON.stringify({
                functionName: row.functionName,
                input: row.input.slice(0, 10),
              })
            : null,
        },
        update: {
          blockNumber: blockNum,
          timestamp,
          category,
          fromAddress,
          toAddress,
          txStatus: enrich.txStatus,
          gasUsed: enrich.gasUsed,
          gasPrice: enrich.gasPrice,
          txFee: enrich.txFee,
          nonce: enrich.nonce,
          txIndex: enrich.txIndex,
          senderAddress: enrich.senderAddress,
          metadata: row.functionName
            ? JSON.stringify({
                functionName: row.functionName,
                input: row.input.slice(0, 10),
              })
            : null,
        },
      });
      upsertCount++;
    } catch (err) {
      console.warn('[explorer] txlist upsert error:', err);
    }
  }

  // ── Track highest block seen across all upserted rows ─────────────────────

  // Find the highest block number among all synced rows for this ecosystem
  const highestBlockRow = await db.tokenTransaction.findFirst({
    where: { ecosystemId },
    orderBy: { blockNumber: 'desc' },
    select: { blockNumber: true },
  });
  const highestBlock = highestBlockRow
    ? Number(highestBlockRow.blockNumber)
    : fromBlock;

  // Update lastSyncedAt + lastSyncedBlock on the ecosystem row
  try {
    await db.tokenEcosystem.update({
      where: { id: ecosystemId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncedBlock: BigInt(highestBlock),
      },
    });
  } catch (updateErr) {
    console.warn('[explorer] failed to update lastSyncedAt:', updateErr);
  }

  console.log(
    `[explorer] total upserted: ${upsertCount}, highestBlock: ${highestBlock}`,
  );
  return { count: upsertCount, highestBlock };
}
