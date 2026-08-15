/**
 * /pages/token.tsx – ERC-3643 Token Operations
 *
 * Seven-tab layout:
 *   Tab 1 "Transfer"          → token.transfer(to, amount)
 *   Tab 2 "Mint"              → token.mint(to, amount)          [Agent]
 *   Tab 3 "Burn"              → token.burn(from, amount)        [Agent]
 *   Tab 4 "Forced Transfer"   → token.forcedTransfer(…)         [Agent]
 *   Tab 5 "Freeze / Unfreeze" → token.setAddressFrozen(…)       [Agent]
 *   Tab 6 "Pause / Unpause"   → token.pause() / unpause()       [Agent]
 *   Tab 7 "Manage Agents"     → token.addAgent / removeAgent    [Owner]
 *
 * Transaction History is now a standalone page at /transactions.
 * Token info banner always visible at top.
 */

import Head from 'next/head';
import {
  Alert,
  Badge,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  SendOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  SwapOutlined,
  LockOutlined,
  PauseCircleOutlined,
  DollarOutlined,
  CopyOutlined,
  LinkOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAccount } from 'wagmi';
import dynamic from 'next/dynamic';
import { formatUnits } from 'viem';
import Layout from '@/components/Layout';
import { useToken } from '@/hooks/useToken';
import { useDeployedAddresses } from '@/hooks/useDeployedAddresses';

import {
  TransferForm,
  TransferHowItWorksPanel,
} from '@/components/token/TransferSection';
import {
  MintForm,
  MintHowItWorksPanel,
  BurnForm,
  BurnHowItWorksPanel,
} from '@/components/token/MintBurnSection';
import {
  ForcedTransferForm,
  ForcedTransferHowItWorksPanel,
  FreezeForm,
  FreezeHowItWorksPanel,
  PauseForm,
  PauseHowItWorksPanel,
} from '@/components/token/AgentActionsSection';
import { ManageAgentsSection } from '@/components/common/ManageAgentsSection';

const { Title, Paragraph, Text } = Typography;

const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => m.ConnectButton),
  { ssr: false },
);

// ─── Not connected banner ─────────────────────────────────────────────────────

function NotConnectedBanner() {
  return (
    <Card style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1677ff20, #1677ff40)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <DollarOutlined style={{ fontSize: 32, color: '#1677ff' }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Connect your wallet
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Connect MetaMask or WalletConnect to perform token operations on the
            ERC-3643 security token.
          </Paragraph>
        </div>
        <ConnectButton />
      </Space>
    </Card>
  );
}

// ─── Token info banner ────────────────────────────────────────────────────────

function TokenInfoBanner() {
  const {
    info,
    balance,
    isLoading,
    isError,
    refetch,
    isAgent,
    isAgentLoading,
  } = useToken();
  const {
    activeToken,
    addresses,
    isLoading: ecosystemLoading,
  } = useDeployedAddresses();
  const [messageApi, contextHolder] = message.useMessage();

  if (isLoading || ecosystemLoading)
    return <Skeleton active paragraph={{ rows: 2 }} />;
  if (isError || !info)
    return (
      <Alert
        type="warning"
        showIcon
        title="Could not load token data"
        description="Check that the token contract address is deployed on this network and an ecosystem is selected."
        action={
          <a onClick={refetch} style={{ cursor: 'pointer' }}>
            Retry
          </a>
        }
      />
    );

  const totalSupplyFormatted = parseFloat(
    formatUnits(info.totalSupply, info.decimals),
  ).toLocaleString(undefined, { maximumFractionDigits: 4 });

  const balanceFormatted =
    balance !== undefined
      ? parseFloat(formatUnits(balance, info.decimals)).toLocaleString(
          undefined,
          { maximumFractionDigits: 4 },
        )
      : '—';

  const ecosystemLabel = activeToken?.name ?? 'Platform';
  const tokenAddress = addresses?.token;

  const handleCopyAddress = () => {
    if (tokenAddress) {
      navigator.clipboard.writeText(tokenAddress).then(() => {
        messageApi.success('Token address copied!');
      });
    }
  };

  return (
    <>
      {contextHolder}
      <Card
        size="small"
        style={{
          background: 'linear-gradient(135deg, #f0f5ff, #e6f7ff)',
          border: '1px solid #91caff',
          marginBottom: 0,
        }}
      >
        <Descriptions
          column={{ xs: 1, sm: 2, md: 4 }}
          size="small"
          items={[
            {
              key: 'ecosystem',
              label: 'Ecosystem',
              children: (
                <Tag
                  color={activeToken ? 'green' : 'blue'}
                  style={{ margin: 0 }}
                >
                  {ecosystemLabel}
                </Tag>
              ),
            },
            {
              key: 'name',
              label: 'Token Name',
              children: <Text strong>{info.name}</Text>,
            },
            {
              key: 'symbol',
              label: 'Symbol',
              children: <Tag color="blue">{info.symbol}</Tag>,
            },
            {
              key: 'supply',
              label: 'Total Supply',
              children: (
                <Text strong>
                  {totalSupplyFormatted} {info.symbol}
                </Text>
              ),
            },
            {
              key: 'balance',
              label: 'My Balance',
              children: (
                <Text strong style={{ color: '#1677ff' }}>
                  {balanceFormatted} {info.symbol}
                </Text>
              ),
            },
            {
              key: 'agent',
              label: 'My Role',
              children: isAgentLoading ? (
                <Tag color="default">Checking…</Tag>
              ) : isAgent === true ? (
                <Tag color="green">✓ Agent</Tag>
              ) : isAgent === false ? (
                <Tag color="default">Non-Agent</Tag>
              ) : (
                <Tag color="default">—</Tag>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              children: info.paused ? (
                <Badge status="error" text={<Tag color="error">Paused</Tag>} />
              ) : (
                <Badge
                  status="success"
                  text={<Tag color="success">Active</Tag>}
                />
              ),
            },
            ...(tokenAddress
              ? [
                  {
                    key: 'address',
                    label: 'Token Contract',
                    children: (
                      <Space size={4}>
                        <Tooltip title={tokenAddress}>
                          <Text
                            code
                            style={{ fontSize: 11, cursor: 'default' }}
                          >
                            {tokenAddress.slice(0, 10)}…{tokenAddress.slice(-8)}
                          </Text>
                        </Tooltip>
                        <Tooltip title="Copy address">
                          <CopyOutlined
                            style={{
                              color: '#1677ff',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                            onClick={handleCopyAddress}
                          />
                        </Tooltip>
                        {activeToken?.chainId && (
                          <Tooltip title="View on explorer">
                            <LinkOutlined
                              style={{
                                color: '#8c8c8c',
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                              onClick={() => {
                                const explorers: Record<number, string> = {
                                  11155111: 'https://sepolia.etherscan.io',
                                  97: 'https://testnet.bscscan.com',
                                  1: 'https://etherscan.io',
                                  56: 'https://bscscan.com',
                                };
                                const base =
                                  explorers[activeToken.chainId] ?? '';
                                if (base)
                                  window.open(
                                    `${base}/address/${tokenAddress}`,
                                    '_blank',
                                  );
                              }}
                            />
                          </Tooltip>
                        )}
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TokenPage() {
  const { isConnected } = useAccount();
  const { info, balance, formattedTokenBalance, refetch } = useToken();

  const symbol = info?.symbol ?? '';
  const decimals = info?.decimals ?? 18;
  const paused = info?.paused ?? false;

  const tabItems = [
    {
      key: 'transfer',
      label: (
        <Space size={6}>
          <SendOutlined />
          <span>Transfer</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <SendOutlined style={{ color: '#1677ff' }} />
                  <Text strong>Transfer Tokens</Text>
                  <Tag color="blue">ERC-20</Tag>
                </Space>
              }
            >
              <TransferForm
                symbol={symbol}
                decimals={decimals}
                balance={balance}
                formattedBalance={formattedTokenBalance}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <TransferHowItWorksPanel symbol={symbol} />
          </Col>
        </Row>
      ),
    },
    {
      key: 'mint',
      label: (
        <Space size={6}>
          <PlusCircleOutlined />
          <span>Mint</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <PlusCircleOutlined style={{ color: '#52c41a' }} />
                  <Text strong>Mint Tokens</Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
            >
              <MintForm symbol={symbol} decimals={decimals} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <MintHowItWorksPanel />
          </Col>
        </Row>
      ),
    },
    {
      key: 'burn',
      label: (
        <Space size={6}>
          <MinusCircleOutlined />
          <span>Burn</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <MinusCircleOutlined style={{ color: '#ff4d4f' }} />
                  <Text strong>Burn Tokens</Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
            >
              <BurnForm symbol={symbol} decimals={decimals} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <BurnHowItWorksPanel />
          </Col>
        </Row>
      ),
    },
    {
      key: 'forced',
      label: (
        <Space size={6}>
          <SwapOutlined />
          <span>Forced Transfer</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <SwapOutlined style={{ color: '#fa8c16' }} />
                  <Text strong>Forced Transfer</Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
            >
              <ForcedTransferForm symbol={symbol} decimals={decimals} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <ForcedTransferHowItWorksPanel />
          </Col>
        </Row>
      ),
    },
    {
      key: 'freeze',
      label: (
        <Space size={6}>
          <LockOutlined />
          <span>Freeze</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <LockOutlined style={{ color: '#2f54eb' }} />
                  <Text strong>Freeze / Unfreeze Wallet</Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
            >
              <FreezeForm />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <FreezeHowItWorksPanel />
          </Col>
        </Row>
      ),
    },
    {
      key: 'pause',
      label: (
        <Space size={6}>
          <PauseCircleOutlined />
          <span>Pause</span>
          {paused && (
            <Tag color="error" style={{ margin: 0, fontSize: 11 }}>
              PAUSED
            </Tag>
          )}
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <PauseCircleOutlined
                    style={{ color: paused ? '#ff4d4f' : '#52c41a' }}
                  />
                  <Text strong>Pause / Unpause Token</Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
            >
              <PauseForm paused={paused} onSuccess={refetch} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <PauseHowItWorksPanel paused={paused} />
          </Col>
        </Row>
      ),
    },
    {
      key: 'agents',
      label: (
        <Space size={6}>
          <TeamOutlined />
          <span>Manage Agents</span>
          <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
            Owner
          </Tag>
        </Space>
      ),
      children: <ManageAgentsSection contractType="token" />,
    },
  ];

  return (
    <>
      <Head>
        <title>Token Operations · ERC-3643 T-REX</title>
        <meta
          name="description"
          content="Transfer, mint, burn, freeze and pause the ERC-3643 security token."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        {/* ── Page header ────────────────────────────────── */}
        <Space style={{ marginBottom: 4 }} align="center">
          <DollarOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            Token Operations
          </Title>
        </Space>
        <Paragraph
          type="secondary"
          style={{ marginBottom: 16, marginLeft: 30 }}
        >
          Perform <Text strong>transfer</Text>, <Text strong>mint</Text>,{' '}
          <Text strong>burn</Text>, <Text strong>forced transfer</Text>,{' '}
          <Text strong>freeze</Text>, and <Text strong>pause</Text> operations
          on the ERC-3643 security token. Agent-only actions require the
          connected wallet to hold the Token Agent role. The{' '}
          <Text strong>Manage Agents</Text> tab allows the contract owner to add
          or remove agent wallets.
        </Paragraph>

        <Divider style={{ marginTop: 0, marginBottom: 16 }} />

        {!isConnected ? (
          <NotConnectedBanner />
        ) : (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <TokenInfoBanner />
            <Tabs
              defaultActiveKey="transfer"
              size="large"
              items={tabItems}
              style={{ marginTop: 0 }}
            />
          </Space>
        )}
      </Layout>
    </>
  );
}
