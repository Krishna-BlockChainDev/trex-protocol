/**
 * TransactionHistorySection
 *
 * Displays a paginated table of ALL on-chain events for the active ecosystem,
 * styled to match the Etherscan Sepolia transaction list layout:
 *   - Status icon inline with Tx Hash (✓/✗ icon, no separate Status column)
 *   - Method/Type badge (our "Method" equivalent)
 *   - Block number
 *   - Relative age ("X days ago") as primary, absolute datetime on hover
 *   - From → To (clickable links, IN/OUT direction badge)
 *   - Amount
 *   - Tx Fee
 *
 * Category and Status are hidden from columns — category is exposed only via
 * the filter tabs; status surfaces as a coloured dot on the hash cell.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  SettingOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { formatUnits } from 'viem';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { useDeployedAddresses } from '@/hooks/useDeployedAddresses';
import type { DbTransaction } from '@/lib/api/transactions';
import type { ColumnsType } from 'antd/es/table';
import { message } from 'antd';

const { Text } = Typography;

// ── Category metadata ─────────────────────────────────────────────────────────

type CategoryMeta = { icon: React.ReactNode; color: string; label: string };

const CATEGORY_META: Record<string, CategoryMeta> = {
  Token: {
    icon: <ThunderboltOutlined />,
    color: '#1677ff',
    label: 'Token',
  },
  Identity: {
    icon: <SafetyOutlined />,
    color: '#52c41a',
    label: 'Identity',
  },
  Compliance: {
    icon: <SettingOutlined />,
    color: '#fa8c16',
    label: 'Compliance',
  },
  Deploy: {
    icon: <DeploymentUnitOutlined />,
    color: '#722ed1',
    label: 'Deploy',
  },
  Infra: {
    icon: <SettingOutlined />,
    color: '#595959',
    label: 'Infra',
  },
};

// ── Event type metadata ───────────────────────────────────────────────────────

type EventMeta = { color: string; label: string };

const EVENT_META: Record<string, EventMeta> = {
  // Token
  Transfer: { color: 'blue', label: 'Transfer' },
  Mint: { color: 'green', label: 'Mint' },
  Burn: { color: 'red', label: 'Burn' },
  AddAgent: { color: 'cyan', label: 'Add Agent' },
  RemoveAgent: { color: 'orange', label: 'Remove Agent' },
  SetCompliance: { color: 'geekblue', label: 'Set Compliance' },
  ForcedTransfer: { color: 'volcano', label: 'Forced Transfer' },
  TokensFrozen: { color: 'orange', label: 'Tokens Frozen' },
  TokensUnfrozen: { color: 'cyan', label: 'Tokens Unfrozen' },
  AddressFrozen: { color: 'volcano', label: 'Addr Frozen' },
  AddressUnfrozen: { color: 'geekblue', label: 'Addr Unfrozen' },
  Paused: { color: 'magenta', label: 'Paused' },
  Unpaused: { color: 'lime', label: 'Unpaused' },
  Recovery: { color: 'purple', label: 'Recovery' },
  // Identity
  RegisterIdentity: { color: 'green', label: 'Register Identity' },
  DeleteIdentity: { color: 'red', label: 'Delete Identity' },
  UpdateIdentity: { color: 'blue', label: 'Update Identity' },
  UpdateCountry: { color: 'cyan', label: 'Update Country' },
  AddClaim: { color: 'geekblue', label: 'Add Claim' },
  RemoveClaim: { color: 'volcano', label: 'Remove Claim' },
  AddKey: { color: 'lime', label: 'Add Key' },
  RemoveKey: { color: 'orange', label: 'Remove Key' },
  ExecuteClaim: { color: 'purple', label: 'Execute Claim' },
  CreateIdentity: { color: 'green', label: 'Create Identity' },
  AddTrustedIssuer: { color: 'geekblue', label: 'Add Trusted Issuer' },
  // Compliance
  AddModule: { color: 'green', label: 'Add Module' },
  RemoveModule: { color: 'red', label: 'Remove Module' },
  ModuleCall: { color: 'orange', label: 'Module Call' },
  SetMaxBalance: { color: 'blue', label: 'Set Max Balance' },
  SetSupplyLimit: { color: 'geekblue', label: 'Set Supply Limit' },
  SetCountryAllow: { color: 'cyan', label: 'Allow Country' },
  SetCountryRestrict: { color: 'volcano', label: 'Restrict Country' },
  SetClaimTopic: { color: 'purple', label: 'Set Claim Topic' },
  SetTrustedIssuer: { color: 'magenta', label: 'Trusted Issuer' },
  // Deploy
  DeployToken: { color: 'purple', label: 'Deploy Token' },
  Deploy: { color: 'purple', label: 'Deploy' },
  // Infra
  AddTokenFactory: { color: 'geekblue', label: 'Add Token Factory' },
  BindRegistry: { color: 'geekblue', label: 'Bind Registry' },
  ContractCall: { color: 'default', label: 'Contract Call' },
};

function methodBadge(eventType: string) {
  const meta = EVENT_META[eventType] ?? { color: 'default', label: eventType };
  return (
    <Tag
      color={meta.color}
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        padding: '0 6px',
        maxWidth: 130,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      title={meta.label}
    >
      {meta.label}
    </Tag>
  );
}

// ── Status icon (inline with Tx Hash, Etherscan style) ────────────────────────

function StatusIcon({ txStatus }: { txStatus: string | null }) {
  if (!txStatus || txStatus === 'pending') {
    return (
      <Tooltip title="Pending">
        <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
      </Tooltip>
    );
  }
  if (txStatus === 'success') {
    return (
      <Tooltip title="Success">
        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 13 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Failed">
      <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />
    </Tooltip>
  );
}

// ── Explorer URL helpers ──────────────────────────────────────────────────────

const EXPLORER_BASES: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  56: 'https://bscscan.com',
  97: 'https://testnet.bscscan.com',
};

function explorerTxUrl(
  chainId: number | undefined,
  txHash: string,
): string | null {
  const base = chainId ? EXPLORER_BASES[chainId] : null;
  return base ? `${base}/tx/${txHash}` : null;
}

function explorerAddrUrl(
  chainId: number | undefined,
  addr: string,
): string | null {
  const base = chainId ? EXPLORER_BASES[chainId] : null;
  return base ? `${base}/address/${addr}` : null;
}

// ── Address cell (link-style, Etherscan UX) ───────────────────────────────────

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function AddressCell({
  address,
  chainId,
  messageApi,
  label,
}: {
  address: string | null;
  chainId: number | undefined;
  messageApi: ReturnType<typeof message.useMessage>[0];
  label?: string; // optional override label (e.g. "Contract Creation")
}) {
  if (!address || address === ZERO_ADDR) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label ?? '—'}
      </Text>
    );
  }

  const short = label ?? `${address.slice(0, 8)}…${address.slice(-6)}`;
  const explorerUrl = explorerAddrUrl(chainId, address);

  return (
    <Space size={4}>
      <Tooltip title={address}>
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#1677ff', fontFamily: 'monospace' }}
          >
            {short}
          </a>
        ) : (
          <Text code style={{ fontSize: 12 }}>
            {short}
          </Text>
        )}
      </Tooltip>
      <Tooltip title="Copy address">
        <CopyOutlined
          style={{ fontSize: 11, color: '#bfbfbf', cursor: 'pointer' }}
          onClick={() =>
            navigator.clipboard
              .writeText(address)
              .then(() => messageApi.success('Address copied'))
          }
        />
      </Tooltip>
    </Space>
  );
}

// ── Gas / fee formatting helpers ──────────────────────────────────────────────

function formatTxFee(txFeeWei: string | null): string | null {
  if (!txFeeWei || txFeeWei === '0') return null;
  try {
    const eth = parseFloat(formatUnits(BigInt(txFeeWei), 18));
    if (eth === 0) return null;
    return (
      eth.toLocaleString(undefined, { maximumSignificantDigits: 5 }) + ' ETH'
    );
  } catch {
    return null;
  }
}

function formatTotalFee(totalFeeWei: string): { value: string; unit: string } {
  if (!totalFeeWei || totalFeeWei === '0') return { value: '0', unit: 'ETH' };
  try {
    const eth = parseFloat(formatUnits(BigInt(totalFeeWei), 18));
    if (eth >= 0.001) {
      return {
        value: eth.toLocaleString(undefined, { maximumFractionDigits: 6 }),
        unit: 'ETH',
      };
    }
    const gwei = Number(BigInt(totalFeeWei)) / 1e9;
    return {
      value: gwei.toLocaleString(undefined, { maximumFractionDigits: 4 }),
      unit: 'Gwei',
    };
  } catch {
    return { value: totalFeeWei, unit: 'wei' };
  }
}

// ── Timestamp helpers (Etherscan-style relative time) ────────────────────────

function timeAgo(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs} secs ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/** Format the absolute datetime in Etherscan style: "2026-06-16 3:19:48" */
function formatAbsDatetime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const h = d.getHours();
  const time = `${h}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
}

// ── Event type options per category ───────────────────────────────────────────

const EVENT_OPTIONS_ALL = [
  { value: 'all', label: 'All Event Types' },
  // Token
  { value: 'Transfer', label: 'Transfer' },
  { value: 'Mint', label: 'Mint' },
  { value: 'Burn', label: 'Burn' },
  { value: 'AddAgent', label: 'Add Agent' },
  { value: 'RemoveAgent', label: 'Remove Agent' },
  { value: 'SetCompliance', label: 'Set Compliance' },
  { value: 'ForcedTransfer', label: 'Forced Transfer' },
  { value: 'TokensFrozen', label: 'Tokens Frozen' },
  { value: 'TokensUnfrozen', label: 'Tokens Unfrozen' },
  { value: 'AddressFrozen', label: 'Address Frozen' },
  { value: 'AddressUnfrozen', label: 'Address Unfrozen' },
  { value: 'Paused', label: 'Paused' },
  { value: 'Unpaused', label: 'Unpaused' },
  { value: 'Recovery', label: 'Recovery' },
  // Identity
  { value: 'RegisterIdentity', label: 'Register Identity' },
  { value: 'CreateIdentity', label: 'Create Identity' },
  { value: 'DeleteIdentity', label: 'Delete Identity' },
  { value: 'UpdateIdentity', label: 'Update Identity' },
  { value: 'UpdateCountry', label: 'Update Country' },
  { value: 'AddClaim', label: 'Add Claim' },
  { value: 'RemoveClaim', label: 'Remove Claim' },
  { value: 'AddKey', label: 'Add Key' },
  { value: 'RemoveKey', label: 'Remove Key' },
  { value: 'ExecuteClaim', label: 'Execute Claim' },
  { value: 'AddTrustedIssuer', label: 'Add Trusted Issuer' },
  // Compliance
  { value: 'AddModule', label: 'Add Module' },
  { value: 'RemoveModule', label: 'Remove Module' },
  { value: 'ModuleCall', label: 'Module Call' },
  { value: 'SetMaxBalance', label: 'Set Max Balance' },
  { value: 'SetSupplyLimit', label: 'Set Supply Limit' },
  { value: 'SetCountryAllow', label: 'Allow Country' },
  { value: 'SetCountryRestrict', label: 'Restrict Country' },
  { value: 'SetClaimTopic', label: 'Set Claim Topic' },
  { value: 'SetTrustedIssuer', label: 'Trusted Issuer' },
  // Deploy
  { value: 'DeployToken', label: 'Deploy Token' },
  { value: 'Deploy', label: 'Deploy (proxy)' },
  // Infra
  { value: 'AddTokenFactory', label: 'Add Token Factory' },
  { value: 'BindRegistry', label: 'Bind Registry' },
  { value: 'ContractCall', label: 'Contract Call' },
];

// ── Main component ────────────────────────────────────────────────────────────

export function TransactionHistorySection() {
  const [messageApi, contextHolder] = message.useMessage();
  const { activeToken, chainId } = useDeployedAddresses();
  const {
    transactions,
    total,
    page,
    pages,
    isLoading,
    isSyncing,
    isError,
    errorMessage,
    filters,
    setFilters,
    setPage,
    refresh,
    totalFeeWei,
    ecosystemId,
    lastSyncedAt,
    syncStatus,
  } = useTransactionHistory();

  const decimals = activeToken?.decimals ?? 18;
  const symbol = activeToken?.symbol ?? '';

  // Local address search state (applied on blur/enter)
  const [addressDraft, setAddressDraft] = useState('');
  // Tick every 15 s to refresh the "X ago" label
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const applyAddressFilter = () => setFilters({ address: addressDraft.trim() });

  const totalFeeFormatted = formatTotalFee(totalFeeWei);

  // Category tab items
  const categoryTabs = [
    { key: 'all', label: 'All' },
    { key: 'Token', label: '⚡ Token' },
    { key: 'Identity', label: '🛡 Identity' },
    { key: 'Compliance', label: '⚙️ Compliance' },
    { key: 'Deploy', label: '🚀 Deploy' },
    { key: 'Infra', label: '🔧 Infra' },
  ];

  // ── Table columns (Etherscan-style) ────────────────────────────────────────
  const columns: ColumnsType<DbTransaction> = [
    // ① Status icon + Tx Hash (combined, Etherscan style)
    {
      title: 'Transaction Hash',
      dataIndex: 'txHash',
      width: 210,
      render: (hash: string, record) => {
        const url = explorerTxUrl(chainId, hash);
        const short = `${hash.slice(0, 12)}…${hash.slice(-8)}`;
        return (
          <Space size={6} align="center">
            <StatusIcon txStatus={record.txStatus} />
            {url ? (
              <Tooltip title={hash} placement="topLeft">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#1677ff',
                  }}
                >
                  {short}
                </a>
              </Tooltip>
            ) : (
              <Tooltip title={hash} placement="topLeft">
                <Text code style={{ fontSize: 12 }}>
                  {short}
                </Text>
              </Tooltip>
            )}
            <Tooltip title="Copy hash">
              <CopyOutlined
                style={{ fontSize: 11, color: '#bfbfbf', cursor: 'pointer' }}
                onClick={() =>
                  navigator.clipboard
                    .writeText(hash)
                    .then(() => messageApi.success('Tx hash copied'))
                }
              />
            </Tooltip>
          </Space>
        );
      },
    },

    // ② Method (our "eventType" — Etherscan calls this "Method")
    {
      title: 'Method',
      dataIndex: 'eventType',
      width: 148,
      render: (v: string) => methodBadge(v),
    },

    // ③ Block
    {
      title: 'Block',
      dataIndex: 'blockNumber',
      width: 96,
      align: 'right' as const,
      render: (bn: string, record) => {
        const blockUrl = chainId
          ? `${EXPLORER_BASES[chainId] ?? ''}/block/${bn}`
          : null;
        return blockUrl ? (
          <a
            href={blockUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#1677ff' }}
          >
            {Number(bn).toLocaleString()}
          </a>
        ) : (
          <Text style={{ fontSize: 12 }}>{Number(bn).toLocaleString()}</Text>
        );
      },
    },

    // ④ Age (relative, with absolute on hover — Etherscan style)
    {
      title: 'Age',
      dataIndex: 'timestamp',
      width: 130,
      render: (ts: string) => {
        if (!ts) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={formatAbsDatetime(ts)} placement="top">
            <Text style={{ fontSize: 12, color: '#595959', cursor: 'default' }}>
              {timeAgo(ts)}
            </Text>
          </Tooltip>
        );
      },
    },

    // ⑤ From
    {
      title: 'From',
      dataIndex: 'fromAddress',
      width: 178,
      render: (addr: string) => (
        <AddressCell address={addr} chainId={chainId} messageApi={messageApi} />
      ),
    },

    // ⑥ Direction arrow (IN / OUT relative to the token contract)
    {
      title: '',
      dataIndex: 'fromAddress',
      key: 'direction',
      width: 52,
      align: 'center' as const,
      render: (_: string, record) => {
        const tokenAddr = activeToken?.tokenProxy?.toLowerCase();
        const isIn = tokenAddr && record.toAddress?.toLowerCase() === tokenAddr;
        return isIn ? (
          <Tag
            color="green"
            style={{
              fontSize: 10,
              padding: '0 4px',
              margin: 0,
              borderRadius: 3,
            }}
          >
            IN
          </Tag>
        ) : (
          <Tag
            color="volcano"
            style={{
              fontSize: 10,
              padding: '0 4px',
              margin: 0,
              borderRadius: 3,
            }}
          >
            OUT
          </Tag>
        );
      },
    },

    // ⑦ To
    {
      title: 'To',
      dataIndex: 'toAddress',
      width: 178,
      render: (addr: string) => (
        <AddressCell
          address={addr}
          chainId={chainId}
          messageApi={messageApi}
          label={!addr || addr === ZERO_ADDR ? 'Contract Creation' : undefined}
        />
      ),
    },

    // ⑧ Amount
    {
      title: `Amount${symbol ? ` (${symbol})` : ''}`,
      dataIndex: 'amount',
      width: 130,
      align: 'right' as const,
      render: (amt: string) => {
        if (!amt || amt === '0')
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              —
            </Text>
          );
        try {
          const formatted = parseFloat(
            formatUnits(BigInt(amt), decimals),
          ).toLocaleString(undefined, { maximumFractionDigits: 6 });
          return (
            <Text strong style={{ fontSize: 12 }}>
              {formatted}
            </Text>
          );
        } catch {
          return (
            <Text code style={{ fontSize: 11 }}>
              {amt}
            </Text>
          );
        }
      },
    },

    // ⑨ Tx Fee
    {
      title: 'Tx Fee',
      dataIndex: 'txFee',
      width: 130,
      align: 'right' as const,
      render: (fee: string | null) => {
        const formatted = formatTxFee(fee);
        return formatted ? (
          <Text style={{ fontSize: 12 }}>{formatted}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Text>
        );
      },
    },
  ];

  // ── No ecosystem selected ──────────────────────────────────────────────────
  if (!ecosystemId) {
    return (
      <Card>
        <Alert
          type="info"
          showIcon
          message="No Ecosystem Selected"
          description="Select a token ecosystem from the header to view transaction history."
        />
      </Card>
    );
  }

  return (
    <>
      {contextHolder}

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Total transactions */}
        <Col xs={24} sm={12} md={8}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic
              title={
                <Space>
                  <HistoryOutlined style={{ color: '#1677ff' }} />
                  <span>Total Transactions</span>
                </Space>
              }
              value={total}
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              All on-chain operations in this ecosystem
            </Text>
          </Card>
        </Col>

        {/* Total operation cost */}
        <Col xs={24} sm={12} md={8}>
          <Card
            size="small"
            style={{
              height: '100%',
              background: 'linear-gradient(135deg, #fff7e6, #fff1f0)',
              border: '1px solid #ffd591',
            }}
          >
            <Statistic
              title={
                <Space>
                  <DollarOutlined style={{ color: '#fa8c16' }} />
                  <span>Total Operation Cost</span>
                </Space>
              }
              value={totalFeeFormatted.value}
              suffix={totalFeeFormatted.unit}
              valueStyle={{ color: '#fa8c16' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Sum of all gas fees paid on-chain
            </Text>
          </Card>
        </Col>

        {/* Live sync info */}
        <Col xs={24} sm={24} md={8}>
          <Card size="small" style={{ height: '100%' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {/* Header row: title + LIVE badge */}
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text strong>
                  <HistoryOutlined /> Explorer Sync
                </Text>
                {syncStatus === 'polling' ? (
                  <Badge
                    status="processing"
                    text={
                      <Text style={{ fontSize: 11, color: '#1677ff' }}>
                        Syncing…
                      </Text>
                    }
                  />
                ) : syncStatus === 'error' ? (
                  <Badge
                    status="error"
                    text={
                      <Text style={{ fontSize: 11, color: '#ff4d4f' }}>
                        Sync error
                      </Text>
                    }
                  />
                ) : (
                  <Badge
                    status="success"
                    text={
                      <Text style={{ fontSize: 11, color: '#52c41a' }}>
                        LIVE
                      </Text>
                    }
                  />
                )}
              </Space>

              {/* Contract address */}
              {activeToken?.tokenProxy && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Token:{' '}
                  <a
                    href={
                      explorerAddrUrl(chainId, activeToken.tokenProxy) ?? '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  >
                    {activeToken.tokenProxy.slice(0, 10)}…
                    {activeToken.tokenProxy.slice(-6)}
                  </a>
                </Text>
              )}

              {/* Last synced timestamp */}
              {lastSyncedAt ? (
                <Tooltip title={formatAbsDatetime(lastSyncedAt)}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Last synced: {timeAgo(lastSyncedAt)}
                  </Text>
                </Tooltip>
              ) : (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Auto-syncs every 30 s
                </Text>
              )}

              {/* Manual refresh button */}
              <Button
                icon={<ReloadOutlined spin={isSyncing} />}
                loading={isSyncing}
                onClick={refresh}
                disabled={isSyncing || syncStatus === 'polling'}
                size="small"
                type="primary"
                ghost
              >
                {isSyncing ? 'Syncing…' : 'Refresh Now'}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ── Error alert ───────────────────────────────────────────────────── */}
      {isError && (
        <Alert
          type="error"
          showIcon
          message="Could not load transactions"
          description={
            errorMessage ??
            'Explorer sync failed. Check your API key and network.'
          }
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {/* ── Category tabs ─────────────────────────────────────────────────── */}
      <Card
        size="small"
        style={{ marginBottom: 0 }}
        bodyStyle={{ padding: '8px 16px 0' }}
      >
        <Tabs
          activeKey={filters.category}
          onChange={(key) => setFilters({ category: key, eventType: 'all' })}
          size="small"
          items={categoryTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
          style={{ marginBottom: 0 }}
        />
      </Card>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
        }}
      >
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Select
              value={filters.eventType}
              options={EVENT_OPTIONS_ALL}
              onChange={(v) => setFilters({ eventType: v })}
              style={{ width: '100%' }}
              placeholder="Filter by method"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Col>
          <Col xs={24} sm={14} md={12}>
            <Input
              placeholder="Filter by address (from / to)"
              prefix={<SearchOutlined />}
              value={addressDraft}
              onChange={(e) => setAddressDraft(e.target.value)}
              onBlur={applyAddressFilter}
              onPressEnter={applyAddressFilter}
              allowClear
              onClear={() => {
                setAddressDraft('');
                setFilters({ address: '' });
              }}
            />
          </Col>
          <Col xs={24} sm={24} md={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {total.toLocaleString()} result{total !== 1 ? 's' : ''}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Table<DbTransaction>
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 1280 }}
          size="small"
          locale={{
            emptyText: isLoading
              ? 'Loading transactions…'
              : 'No transactions found. Click "Refresh Now" to sync from explorer.',
          }}
          rowClassName={(record) => {
            if (record.txStatus === 'failed') return 'tx-row-failed';
            return '';
          }}
        />
      </Card>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {pages > 1 && (
        <Row justify="end" style={{ marginTop: 16 }}>
          <Pagination
            current={page}
            total={total}
            pageSize={20}
            onChange={setPage}
            showSizeChanger={false}
            showTotal={(t) => `${t.toLocaleString()} total`}
          />
        </Row>
      )}

      {/* ── Inline styles ─────────────────────────────────────────────────── */}
      <style>{`
        .tx-row-failed td {
          background: #fff2f0 !important;
        }
        /* Etherscan-style link hover */
        .ant-table-tbody td a:hover {
          text-decoration: underline;
        }
        /* Tighten up the small table rows */
        .ant-table-small .ant-table-tbody > tr > td {
          padding: 6px 8px;
        }
        .ant-table-small .ant-table-thead > tr > th {
          padding: 6px 8px;
          font-size: 12px;
          color: #8c8c8c;
          background: #fafafa;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
