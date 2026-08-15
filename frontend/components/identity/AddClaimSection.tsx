/**
 * AddClaimSection – Step 3 / "Add KYC Claim" tab.
 *
 * Exports:
 *   AddClaimForm          – form: calls /api/sign-claim then identity.addClaim()
 *   AddClaimHowItWorksPanel – right-column explainer
 *
 * Topic handling
 * ──────────────
 * The deployed ClaimTopicsRegistry may require topics that are large
 * keccak256 hashes (e.g. keccak256("CLAIM_TOPIC")).  The topic is therefore
 * stored as a decimal string internally so we can round-trip BigInt values
 * without precision loss.  The sign-claim API and on-chain addClaim both
 * receive the string representation which is then BigInt-parsed server/client
 * side.
 *
 * When `registeredClaimTopics` (read from the deployed CTR) is provided the
 * form auto-selects the first registered topic so users don't need to know
 * the underlying numeric value.
 */

import { useState } from 'react';
import {
  Typography,
  Card,
  Alert,
  Space,
  Input,
  Button,
  Tag,
  Descriptions,
  Badge,
  Divider,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  QuestionCircleOutlined,
  SafetyOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import {
  isAddress,
  type Address,
  type WalletClient,
  type PublicClient,
} from 'viem';
import { useWallet } from '@/hooks/useWallet';
import { useTransaction } from '@/hooks/useTransaction';
import { addClaim } from '@/contracts/identity';
import { CopyableAddress } from './CopyableAddress';
import { readInvestorName } from '@/lib/investorName';
import { useSaveTransaction } from '@/hooks/useSaveTransaction';

const { Text, Paragraph } = Typography;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a topic value for display. Small values are shown as decimal; large
 *  ones (> 9999) are shown as truncated hex so they fit on screen. */
function formatTopic(topicStr: string): string {
  try {
    const n = BigInt(topicStr);
    if (n <= BigInt(9999)) return n.toString();
    const hex = n.toString(16);
    return `0x${hex.slice(0, 8)}…${hex.slice(-6)}`;
  } catch {
    return topicStr;
  }
}

/** Returns true when `topicStr` is a valid non-negative integer (decimal or
 *  0x-prefixed hex). */
function isValidTopic(topicStr: string): boolean {
  if (!topicStr.trim()) return false;
  try {
    const n = BigInt(topicStr.trim());
    return n >= BigInt(0);
  } catch {
    return false;
  }
}

// ─── Standard presets ────────────────────────────────────────────────────────

const STANDARD_PRESETS: { topic: string; label: string }[] = [
  { topic: '1', label: '🪪 KYC (1)' },
  { topic: '2', label: '🔍 AML (2)' },
  { topic: '3', label: '🏦 Accredited (3)' },
];

// ─── How it works panel ───────────────────────────────────────────────────────

export function AddClaimHowItWorksPanel({
  claimIssuerAddress,
}: {
  claimIssuerAddress: string | null;
}) {
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <QuestionCircleOutlined style={{ color: '#52c41a' }} />
            <Text strong>What is a Claim?</Text>
          </Space>
        }
      >
        <Paragraph style={{ margin: 0, fontSize: 13, color: '#595959' }}>
          An <Text strong>ERC-735 Claim</Text> is a cryptographically signed
          attestation stored on the investor&apos;s OnchainID contract. The{' '}
          <Text strong>ClaimIssuer</Text> (an authority) signs the claim
          off-chain; the investor&apos;s wallet submits it on-chain via{' '}
          <Text code style={{ fontSize: 11 }}>
            addClaim()
          </Text>
          .
        </Paragraph>
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#fa8c16' }} />
            <Text strong>How It Works</Text>
          </Space>
        }
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {[
            {
              num: 1,
              color: '#1677ff',
              title: 'API generates signature',
              desc: 'The server signs keccak256(abi.encode(identity, topic, data)) with the issuer private key — never exposed to the browser.',
            },
            {
              num: 2,
              color: '#52c41a',
              title: 'Wallet submits on-chain',
              desc: "Your connected wallet calls identity.addClaim() with the issuer's signature. Only this step requires a wallet transaction.",
            },
            {
              num: 3,
              color: '#722ed1',
              title: 'Token transfer unlocked',
              desc: 'The T-REX compliance module reads the claim during transfer. A valid KYC claim allows the investor to send/receive tokens.',
            },
          ].map((step) => (
            <Space key={step.num} align="start" size={12}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: step.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {step.num}
                </Text>
              </div>
              <div>
                <Text strong style={{ fontSize: 13 }}>
                  {step.title}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {step.desc}
                </Text>
              </div>
            </Space>
          ))}
        </Space>
      </Card>

      {claimIssuerAddress && (
        <Card
          size="small"
          title={
            <Space>
              <SafetyOutlined style={{ color: '#52c41a' }} />
              <Text strong>ClaimIssuer Contract</Text>
              <Badge status="processing" color="green" />
            </Space>
          }
        >
          <Descriptions
            size="small"
            column={1}
            styles={{ label: { fontSize: 12 }, content: { fontSize: 12 } }}
          >
            <Descriptions.Item label="Address">
              <CopyableAddress addr={claimIssuerAddress} />
            </Descriptions.Item>
            <Descriptions.Item label="Scheme">
              <Tag color="green" style={{ fontSize: 11 }}>
                ECDSA (1)
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Space>
  );
}

// ─── Add claim form ───────────────────────────────────────────────────────────

export function AddClaimForm({
  storedIdentities,
  claimIssuerAddress,
  registeredClaimTopics,
}: {
  storedIdentities: Record<string, string>;
  claimIssuerAddress: string | null;
  /** Topics registered in the deployed ClaimTopicsRegistry proxy (bigint[]). */
  registeredClaimTopics?: bigint[];
}) {
  const [selectedWallet, setSelectedWallet] = useState('');
  const [identityAddr, setIdentityAddr] = useState('');
  // Store topic as decimal string — supports arbitrary-precision bigint values
  // (e.g. keccak256("CLAIM_TOPIC") ≈ 77 decimal digits).
  const [topic, setTopic] = useState<string>('1');
  const [dataStr, setDataStr] = useState('KYC_APPROVED');
  const [apiError, setApiError] = useState<string | null>(null);
  const [signerAddress, setSignerAddress] = useState<string | null>(null);

  const { walletClient, publicClient } = useWallet();
  const txState = useTransaction();
  const { save } = useSaveTransaction();

  // ── Auto-populate topic from deployed CTR ───────────────────────────────
  // Track which registered-topic value we last auto-applied so we correctly
  // update on ecosystem switch without re-applying if the user typed something
  // manually (while still applying a NEW registered value when it changes).
  const firstRegistered = registeredClaimTopics?.[0]?.toString() ?? null;
  const [lastAppliedDefault, setLastAppliedDefault] = useState<string | null>(
    null,
  );
  if (firstRegistered !== null && firstRegistered !== lastAppliedDefault) {
    setLastAppliedDefault(firstRegistered);
    setTopic(firstRegistered);
  }

  const isValidIdentity =
    identityAddr.trim() !== '' && isAddress(identityAddr.trim() as Address);

  const topicIsValid = isValidTopic(topic);

  const canSubmit =
    !!(walletClient && publicClient && claimIssuerAddress) &&
    isValidIdentity &&
    topicIsValid &&
    dataStr.trim() !== '' &&
    !txState.isPending;

  const storedOptions = Object.entries(storedIdentities).map(
    ([wallet, identity]) => {
      const name = readInvestorName(wallet);
      const walletShort = `${wallet.slice(0, 10)}…${wallet.slice(-8)}`;
      const identityShort = `${identity.slice(0, 8)}…${identity.slice(-6)}`;
      return {
        label: name
          ? `${name}  |  ${walletShort}  →  ${identityShort}`
          : `${walletShort}  →  ${identityShort}`,
        value: wallet,
      };
    },
  );

  // Only show the three standard presets — the registered topic is auto-applied
  // silently to avoid cluttering the UI with ecosystem-specific buttons that
  // multiply on ecosystem switches.
  const allPresets = STANDARD_PRESETS;

  const handleSelectStored = (wallet: string) => {
    setSelectedWallet(wallet);
    setIdentityAddr(storedIdentities[wallet] ?? '');
    setApiError(null);
    txState.reset();
  };

  const handleClearStored = () => {
    setSelectedWallet('');
    setIdentityAddr('');
    setApiError(null);
    txState.reset();
  };

  const handleAddClaim = async () => {
    if (!canSubmit || !walletClient || !publicClient || !claimIssuerAddress)
      return;
    setApiError(null);
    setSignerAddress(null);
    txState.reset();

    // 1. Server-side signature — pass topic as string to support bigint values
    let signature: `0x${string}`;
    let dataHex: `0x${string}`;
    let signer: string;
    try {
      const res = await fetch('/api/sign-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityAddress: identityAddr.trim(),
          topic: topic.trim(), // string — API handles BigInt(topic)
          data: dataStr.trim(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        signature: `0x${string}`;
        dataHex: `0x${string}`;
        signerAddress: string;
      };
      signature = json.signature;
      dataHex = json.dataHex;
      signer = json.signerAddress;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
      return;
    }
    setSignerAddress(signer);

    // 2. On-chain addClaim — BigInt-parse the topic string
    const hash = await txState.execute(() =>
      addClaim(
        identityAddr.trim() as Address,
        BigInt(topic.trim()),
        BigInt(1), // scheme = ECDSA
        claimIssuerAddress as Address,
        signature,
        dataHex,
        '',
        walletClient as WalletClient,
        publicClient as PublicClient,
      ),
    );
    if (hash) {
      save({
        txHash: hash,
        category: 'Identity',
        eventType: 'AddClaim',
        fromAddress: selectedWallet || undefined,
        toAddress: identityAddr.trim(),
        metadata: JSON.stringify({ topic: topic.trim(), data: dataStr.trim() }),
      });
    }
  };

  const handleReset = () => {
    setSelectedWallet('');
    setIdentityAddr('');
    // Reset to first registered topic, or default 1
    setTopic(
      registeredClaimTopics && registeredClaimTopics.length > 0
        ? registeredClaimTopics[0].toString()
        : '1',
    );
    setDataStr('KYC_APPROVED');
    setApiError(null);
    setSignerAddress(null);
    txState.reset();
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Info banner ───────────────────────────────────────── */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        title={<Text strong>Server-side claim signing</Text>}
        description="The claim signature is generated server-side using the issuer private key (never exposed to the browser). Your wallet signs only the on-chain addClaim transaction."
        style={{ padding: '8px 12px' }}
      />

      {!claimIssuerAddress && (
        <Alert
          type="warning"
          showIcon
          title="ClaimIssuer address not found in deployed addresses. Connect to the correct network."
          style={{ padding: '8px 12px' }}
        />
      )}

      {/* ── Quick-fill ───────────────────────────────────────── */}
      {storedOptions.length > 0 && (
        <div>
          <Text
            strong
            style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
          >
            Quick-fill from Created Identities
          </Text>
          <select
            style={{
              width: '100%',
              padding: '7px 11px',
              fontSize: 13,
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              background: '#fff',
            }}
            value={selectedWallet}
            onChange={(e) => {
              if (e.target.value === '') {
                handleClearStored();
              } else {
                handleSelectStored(e.target.value);
              }
            }}
          >
            <option value="">Select an identity to auto-fill…</option>
            {storedOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Identity address ──────────────────────────────────── */}
      <div>
        <Text
          strong
          style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
        >
          Identity Contract Address{' '}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            (OnchainID)
          </Text>
        </Text>
        <Input
          size="large"
          placeholder="0x…  OnchainID identity contract address"
          prefix={<SafetyOutlined style={{ color: '#bfbfbf' }} />}
          value={identityAddr}
          onChange={(e) => {
            setIdentityAddr(e.target.value);
            setApiError(null);
            txState.reset();
          }}
          status={identityAddr && !isValidIdentity ? 'error' : undefined}
          allowClear
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        {identityAddr && !isValidIdentity && (
          <Text
            type="danger"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            Not a valid EVM address.
          </Text>
        )}
      </div>

      {/* ── Claim topic ───────────────────────────────────────── */}
      <div>
        <Text
          strong
          style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
        >
          Claim Topic
          {firstRegistered && BigInt(firstRegistered) > BigInt(9999) && (
            <Tooltip
              title={`Auto-selected from deployed ecosystem. Full value: ${firstRegistered}`}
            >
              <Tag
                color="blue"
                style={{ marginLeft: 8, fontSize: 11, cursor: 'default' }}
              >
                ecosystem topic
              </Tag>
            </Tooltip>
          )}
        </Text>

        {/* Standard presets */}
        <Space wrap style={{ marginBottom: 8 }}>
          {allPresets.map((p) => (
            <Tag
              key={p.topic}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              color={topic === p.topic ? 'green' : 'default'}
              onClick={() => setTopic(p.topic)}
            >
              {p.label}
            </Tag>
          ))}
        </Space>

        {/* Topic text input — accepts decimal or 0x-hex strings */}
        <Input
          size="large"
          placeholder="e.g. 1  or  0x7da1b43b…  (decimal or hex)"
          prefix={<IdcardOutlined style={{ color: '#bfbfbf' }} />}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          status={topic && !topicIsValid ? 'error' : undefined}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        {topic && !topicIsValid && (
          <Text
            type="danger"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            Must be a non-negative integer (decimal or 0x-hex).
          </Text>
        )}
        {topicIsValid && BigInt(topic) > BigInt(9999) && (
          <Text
            type="secondary"
            style={{ fontSize: 11, marginTop: 3, display: 'block' }}
          >
            Full value: {topic}
          </Text>
        )}
      </div>

      {/* ── Claim data ────────────────────────────────────────── */}
      <div>
        <Text
          strong
          style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
        >
          Claim Data{' '}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            (plain text — encoded server-side)
          </Text>
        </Text>
        <Input
          size="large"
          placeholder="e.g. KYC_APPROVED"
          prefix={<InfoCircleOutlined style={{ color: '#bfbfbf' }} />}
          value={dataStr}
          onChange={(e) => {
            setDataStr(e.target.value);
            setApiError(null);
            txState.reset();
          }}
          allowClear
        />
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* ── Submit ────────────────────────────────────────────── */}
      {!txState.isSuccess && (
        <Button
          type="primary"
          size="large"
          icon={<IdcardOutlined />}
          onClick={handleAddClaim}
          loading={txState.isPending}
          disabled={!canSubmit}
          block
        >
          {txState.isPending ? 'Adding Claim…' : 'Add KYC Claim'}
        </Button>
      )}

      {!(walletClient && publicClient) && (
        <Text
          type="warning"
          style={{ fontSize: 12, display: 'block', textAlign: 'center' }}
        >
          Connect your wallet to a supported network first.
        </Text>
      )}

      {/* ── API error ─────────────────────────────────────────── */}
      {apiError && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          title={<Text strong>Claim signing failed</Text>}
          description={apiError}
          closable
          onClose={() => setApiError(null)}
        />
      )}

      {/* ── Issuer signer confirmed ───────────────────────────── */}
      {signerAddress && !apiError && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          title={
            <Space size={6}>
              <Text strong style={{ fontSize: 12 }}>
                Claim signed by issuer:
              </Text>
              <CopyableAddress addr={signerAddress} />
            </Space>
          }
          style={{ padding: '6px 10px' }}
        />
      )}

      {/* ── Pending ───────────────────────────────────────────── */}
      {txState.isPending && txState.txHash && (
        <Alert
          type="info"
          showIcon
          icon={<LoadingOutlined />}
          title={
            <Text strong>Transaction submitted — awaiting confirmation</Text>
          }
          description={
            <Space orientation="vertical" size={2} style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Hash:
              </Text>
              <CopyableAddress addr={txState.txHash} full />
            </Space>
          }
        />
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {txState.isError && txState.errorMessage && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          title={<Text strong>addClaim transaction failed</Text>}
          description={txState.errorMessage}
          action={
            <Button size="small" onClick={txState.reset}>
              Dismiss
            </Button>
          }
        />
      )}

      {/* ── Success ───────────────────────────────────────────── */}
      {txState.isSuccess && (
        <Card
          style={{ borderColor: '#52c41a', background: '#f6ffed' }}
          size="small"
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space>
              <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />
              <Text strong style={{ fontSize: 15, color: '#135200' }}>
                KYC Claim Added Successfully
              </Text>
            </Space>
            <Descriptions size="small" column={1} style={{ marginTop: 4 }}>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Identity</Text>}
              >
                <CopyableAddress addr={identityAddr.trim()} full />
              </Descriptions.Item>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Topic</Text>}
              >
                <Tag color="green">{formatTopic(topic)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Data</Text>}
              >
                <Text code style={{ fontSize: 11 }}>
                  {dataStr}
                </Text>
              </Descriptions.Item>
              {txState.txHash && (
                <Descriptions.Item
                  label={<Text style={{ fontSize: 12 }}>Tx hash</Text>}
                >
                  <CopyableAddress addr={txState.txHash} />
                </Descriptions.Item>
              )}
            </Descriptions>
            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              title={
                <Text style={{ fontSize: 12 }}>
                  The claim is now stored on the identity contract. The investor
                  wallet is fully KYC-verified and eligible to transfer tokens.
                </Text>
              }
              style={{ padding: '6px 10px' }}
            />
            <Button
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={handleReset}
            >
              Add another claim
            </Button>
          </Space>
        </Card>
      )}
    </Space>
  );
}
