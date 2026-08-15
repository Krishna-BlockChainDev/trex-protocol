import Head from 'next/head';
import Link from 'next/link';
import {
  type ReactNode,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Alert,
  Space,
  Divider,
  Statistic,
  Input,
  Button,
  Tooltip,
  Tag,
  Table,
  Collapse,
  Modal,
} from 'antd';
import {
  WalletOutlined,
  SafetyOutlined,
  AuditOutlined,
  LinkOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  DeploymentUnitOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useAccount, useBalance } from 'wagmi';
import Layout from '@/components/Layout';
import dynamic from 'next/dynamic';
import { useDeployedAddresses } from '@/hooks/useDeployedAddresses';

const { Title, Paragraph, Text } = Typography;

// Dynamically load ConnectButton to prevent SSR issues
const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => m.ConnectButton),
  { ssr: false },
);

/** localStorage key for a given address. */
const nameKey = (address: string) =>
  `trex_wallet_name_${address.toLowerCase()}`;

/**
 * useSyncExternalStore-based localStorage reader.
 * Returns the stored string (or '') on the client, '' on the server.
 */
function useLocalStorageValue(key: string): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('storage', cb);
      return () => window.removeEventListener('storage', cb);
    },
    () => localStorage.getItem(key) ?? '',
    () => '', // server snapshot
  );
}

/**
 * Editable account-name field backed by localStorage.
 */
function AccountNameField({ address }: { address: string }) {
  // Read directly from localStorage via useSyncExternalStore — no useEffect needed.
  const name = useLocalStorageValue(nameKey(address));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = useCallback(() => {
    setDraft(name);
    setEditing(true);
  }, [name]);

  const save = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed) {
      localStorage.setItem(nameKey(address), trimmed);
    } else {
      localStorage.removeItem(nameKey(address));
    }
    // Manually dispatch 'storage' event so useSyncExternalStore picks up the
    // change (the 'storage' event only fires in other tabs by default).
    window.dispatchEvent(
      new StorageEvent('storage', { key: nameKey(address) }),
    );
    setEditing(false);
  }, [address, draft]);

  const cancel = useCallback(() => setEditing(false), []);

  if (editing) {
    return (
      <Space size={4}>
        <Input
          size="small"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={save}
          placeholder="Enter account name"
          style={{ width: 160 }}
          maxLength={40}
        />
        <Tooltip title="Save">
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            onClick={save}
          />
        </Tooltip>
        <Tooltip title="Cancel">
          <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
        </Tooltip>
      </Space>
    );
  }

  return (
    <Space size={4} align="center">
      <Text style={{ fontSize: 14 }}>
        {name || (
          <Text type="secondary" style={{ fontSize: 14 }}>
            —
          </Text>
        )}
      </Text>
      <Tooltip title="Set account name">
        <EditOutlined
          style={{ cursor: 'pointer', color: '#1677ff', fontSize: 13 }}
          onClick={startEdit}
        />
      </Tooltip>
    </Space>
  );
}

/** Shows wallet details when connected, otherwise a prompt to connect. */
function WalletPanel() {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });

  if (!isConnected) {
    return (
      <Alert
        title="Wallet Not Connected"
        description={
          <Space orientation="vertical" style={{ marginTop: 8 }}>
            <Text>
              Connect MetaMask or WalletConnect to interact with the T-REX
              protocol. Supported networks: Sepolia, BSC Testnet, Hardhat.
            </Text>
            <ConnectButton />
          </Space>
        }
        type="warning"
        showIcon
        icon={<WalletOutlined />}
        style={{ marginBottom: 24 }}
      />
    );
  }

  return (
    <Alert
      title="Wallet Connected"
      description={
        <Row gutter={24} style={{ marginTop: 8 }}>
          <Col>
            <Statistic
              title="Account Name"
              formatter={() => <AccountNameField address={address!} />}
            />
          </Col>
          <Col>
            <Statistic
              title="Address"
              value={`${address?.slice(0, 8)}…${address?.slice(-6)}`}
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
          <Col>
            <Statistic
              title="Network"
              value={chain?.name ?? '—'}
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
          <Col>
            <Statistic
              title="Balance"
              value={
                balance
                  ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}`
                  : '—'
              }
              styles={{ content: { fontSize: 14 } }}
            />
          </Col>
        </Row>
      }
      type="success"
      showIcon
      icon={<WalletOutlined />}
      style={{ marginBottom: 24 }}
    />
  );
}

// ── Address copy cell ─────────────────────────────────────────────────────────

function CopyableAddress({ addr }: { addr: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [addr]);

  return (
    <Space size={4}>
      <Text style={{ fontFamily: 'monospace', fontSize: 12 }} title={addr}>
        {addr.slice(0, 10)}…{addr.slice(-8)}
      </Text>
      <Tooltip title={copied ? 'Copied!' : 'Copy full address'}>
        {copied ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
        ) : (
          <CopyOutlined
            style={{ cursor: 'pointer', color: '#1677ff', fontSize: 12 }}
            onClick={copy}
          />
        )}
      </Tooltip>
    </Space>
  );
}

// ── Deployed Addresses Panel ──────────────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  implementations: 'Implementations',
  authorities: 'Authorities',
  proxies: 'Proxies',
  factories: 'Factories',
  token: 'Token',
  compliance: 'Compliance',
};

const CHAIN_TAG_COLOR: Record<number, string> = {
  11155111: 'blue',
  97: 'gold',
  31337: 'purple',
};

function DeployedAddressesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addresses, networkLabel, chainId, isSupported } =
    useDeployedAddresses();

  const tableColumns = [
    {
      title: 'Contract',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      render: (addr: string) => <CopyableAddress addr={addr} />,
    },
  ];

  const modalContent = !isSupported ? (
    <Alert
      title="No deployments found for this network"
      description="Switch your wallet to Sepolia, BSC Testnet, or a local Hardhat node to view deployed contract addresses."
      type="warning"
      showIcon
    />
  ) : (
    (() => {
      const groups = Object.entries(addresses!) as [
        string,
        Record<string, string>,
      ][];
      const nonEmptyGroups = groups.filter(
        ([, entries]) => Object.keys(entries).length > 0,
      );
      const collapseItems = nonEmptyGroups.map(([group, entries]) => ({
        key: group,
        label: (
          <Text strong style={{ fontSize: 13 }}>
            {GROUP_LABELS[group] ?? group}
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              ({Object.keys(entries).length} contracts)
            </Text>
          </Text>
        ),
        children: (
          <Table
            size="small"
            pagination={false}
            rowKey="name"
            columns={tableColumns}
            dataSource={Object.entries(entries).map(([name, address]) => ({
              name,
              address,
            }))}
            style={{ fontSize: 12 }}
          />
        ),
      }));
      return (
        <Collapse
          size="small"
          defaultActiveKey={['token', 'proxies']}
          items={collapseItems}
        />
      );
    })()
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      title={
        <Space>
          <DeploymentUnitOutlined style={{ color: '#1677ff' }} />
          <Text strong>Deployed Contracts</Text>
          {chainId && (
            <Tag color={CHAIN_TAG_COLOR[chainId] ?? 'default'}>
              {networkLabel}
            </Tag>
          )}
        </Space>
      }
      width={680}
      styles={{
        body: { maxHeight: '60vh', overflowY: 'auto', paddingTop: 12 },
      }}
    >
      {modalContent}
    </Modal>
  );
}

function DeployedAddressesButton() {
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);

  if (!isConnected) return null;

  return (
    <>
      <Button
        icon={<DeploymentUnitOutlined />}
        onClick={() => setOpen(true)}
        style={{ marginBottom: 24 }}
      >
        View Deployed Addresses
      </Button>
      <DeployedAddressesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURE_CARDS: {
  title: string;
  icon: ReactNode;
  description: string;
  href?: string;
  tag?: string;
  step: number;
}[] = [
  {
    step: 1,
    title: 'Identity Management',
    icon: <UserAddOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    description:
      'Deploy OnchainID identities for investor wallets. Required before any wallet can hold tokens.',
    href: '/identity',
    tag: 'Live',
  },
  {
    step: 2,
    title: 'Token Management',
    icon: <AuditOutlined style={{ fontSize: 28, color: '#1677ff' }} />,
    description:
      'Mint, burn, transfer and manage ERC-3643 token supply, balances and pause / resume transfers.',
    href: '/token',
    tag: 'Live',
  },
  {
    step: 3,
    title: 'Compliance Rules',
    icon: <SafetyOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
    description:
      'Configure modular compliance policies – country restrictions, holding limits and monthly caps.',
    href: '/compliance',
    tag: 'Live',
  },
  {
    step: 4,
    title: 'Contract Explorer',
    icon: <LinkOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    description:
      'Inspect deployed T-REX contract addresses and verify state directly from the dashboard.',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Head>
        <title>ERC-3643 T-REX</title>
        <meta name="description" content="ERC-3643 T-REX Token Management" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        {/* ── Hero ──────────────────────────────────────── */}
        <Title level={2} style={{ marginBottom: 4 }}>
          T-REX Dashboard
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          Manage ERC-3643 compliant security tokens · Sepolia · BSC Testnet ·
          Hardhat
        </Paragraph>

        {/* ── Wallet status / connect prompt ────────────── */}
        <WalletPanel />

        {/* ── Chain-specific deployed addresses ─────────── */}
        <DeployedAddressesButton />

        <Divider />

        {/* ── Feature cards ─────────────────────────────── */}
        <Title level={4} style={{ marginBottom: 16 }}>
          Protocol Modules
        </Title>
        <Row gutter={[16, 16]}>
          {FEATURE_CARDS.map((card) => {
            const cardBody = (
              <Card
                hoverable={Boolean(card.href)}
                style={{
                  height: '100%',
                  cursor: card.href ? 'pointer' : 'default',
                  opacity: card.href ? 1 : 0.75,
                  position: 'relative',
                }}
                styles={{
                  body: { display: 'flex', flexDirection: 'column', gap: 10 },
                }}
              >
                {/* Step badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: card.href ? '#1677ff' : '#d9d9d9',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.step}
                </div>

                {card.icon}

                <Space size={8} align="center">
                  <Text strong style={{ fontSize: 15 }}>
                    {card.title}
                  </Text>
                  {card.tag ? (
                    <Tag
                      color="green"
                      style={{ fontSize: 11, lineHeight: '18px' }}
                    >
                      {card.tag}
                    </Tag>
                  ) : (
                    <Tag
                      color="default"
                      style={{ fontSize: 11, lineHeight: '18px' }}
                    >
                      Coming Soon
                    </Tag>
                  )}
                </Space>

                <Text type="secondary" style={{ fontSize: 13, flex: 1 }}>
                  {card.description}
                </Text>

                {card.href ? (
                  <Space
                    style={{ color: '#1677ff', fontSize: 13, marginTop: 4 }}
                  >
                    <Text style={{ color: '#1677ff', fontSize: 13 }}>Open</Text>
                    <ArrowRightOutlined style={{ fontSize: 12 }} />
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                    Not yet available
                  </Text>
                )}
              </Card>
            );

            return (
              <Col key={card.title} xs={24} sm={12} lg={6}>
                {card.href ? (
                  <Link
                    href={card.href}
                    style={{ display: 'block', height: '100%' }}
                  >
                    {cardBody}
                  </Link>
                ) : (
                  cardBody
                )}
              </Col>
            );
          })}
        </Row>
      </Layout>
    </>
  );
}
