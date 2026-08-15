/**
 * /pages/compliance.tsx – Modular Compliance Dashboard
 *
 * Two-tab layout:
 *   Tab 1 "Admin"    – Module binding + 4 module config panels (owner-gated)
 *   Tab 2 "Transfer" – canTransfer check + token transfer
 *
 * Token info banner always visible at top when connected.
 */

import Head from 'next/head';
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Modal,
  Row,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  SafetyOutlined,
  ToolOutlined,
  SendOutlined,
  ApiOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  FundOutlined,
} from '@ant-design/icons';
import { useAccount } from 'wagmi';
import dynamic from 'next/dynamic';
import { formatUnits } from 'viem';
import Layout from '@/components/Layout';
import { useToken } from '@/hooks/useToken';
import { useComplianceModules } from '@/hooks/useComplianceModules';

import { CountryRestrictPanel } from '@/components/compliance/CountryRestrictPanel';
import { CountryAllowPanel } from '@/components/compliance/CountryAllowPanel';
import { MaxBalancePanel } from '@/components/compliance/MaxBalancePanel';
import { SupplyLimitPanel } from '@/components/compliance/SupplyLimitPanel';
import { TransferCheckPanel } from '@/components/compliance/TransferCheckPanel';
import { ModuleBindingPanel } from '@/components/compliance/ModuleBindingPanel';

const { Title, Paragraph, Text } = Typography;

const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => m.ConnectButton),
  { ssr: false },
);

// ─── Not-connected banner ─────────────────────────────────────────────────────

function NotConnectedBanner() {
  return (
    <Card style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #52c41a20, #52c41a40)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <SafetyOutlined style={{ fontSize: 32, color: '#52c41a' }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Connect your wallet
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Connect MetaMask or WalletConnect to manage compliance modules and
            perform compliance-checked transfers on the ERC-3643 security token.
          </Paragraph>
        </div>
        <ConnectButton />
      </Space>
    </Card>
  );
}

// ─── Token info banner ────────────────────────────────────────────────────────

function TokenInfoBanner() {
  const { info, balance, isLoading, isError, refetch } = useToken();

  if (isLoading) return <Skeleton active paragraph={{ rows: 2 }} />;
  if (isError || !info) {
    return (
      <Alert
        type="warning"
        showIcon
        title="Could not load token data"
        description="Check that the token contract address is deployed on this network."
        action={
          <a onClick={refetch} style={{ cursor: 'pointer' }}>
            Retry
          </a>
        }
      />
    );
  }

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

  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #f6ffed, #d9f7be)',
        border: '1px solid #b7eb8f',
        marginBottom: 0,
      }}
    >
      <Descriptions
        column={{ xs: 2, sm: 3, md: 5 }}
        size="small"
        items={[
          {
            key: 'name',
            label: 'Token',
            children: <Text strong>{info.name}</Text>,
          },
          {
            key: 'symbol',
            label: 'Symbol',
            children: <Tag color="green">{info.symbol}</Tag>,
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
              <Text strong style={{ color: '#52c41a' }}>
                {balanceFormatted} {info.symbol}
              </Text>
            ),
          },
          {
            key: 'decimals',
            label: 'Decimals',
            children: <Tag color="default">{info.decimals}</Tag>,
          },
        ]}
      />
    </Card>
  );
}

// ─── Admin tab content ────────────────────────────────────────────────────────

function AdminTabContent({
  complianceData,
  chainName,
  symbol,
}: {
  complianceData: ReturnType<typeof useComplianceModules>;
  chainName: string;
  symbol: string;
}) {
  const [bindingOpen, setBindingOpen] = useState(false);

  // Nested tab items — one per module
  const moduleTabs = [
    {
      key: 'countryRestrict',
      label: (
        <Space size={5}>
          <StopOutlined style={{ color: '#ff4d4f' }} />
          <span>Country Restrict</span>
        </Space>
      ),
      children: (
        <CountryRestrictPanel data={complianceData} chainName={chainName} />
      ),
    },
    {
      key: 'countryAllow',
      label: (
        <Space size={5}>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span>Country Allow</span>
        </Space>
      ),
      children: (
        <CountryAllowPanel data={complianceData} chainName={chainName} />
      ),
    },
    {
      key: 'maxBalance',
      label: (
        <Space size={5}>
          <ControlOutlined style={{ color: '#faad14' }} />
          <span>Max Balance</span>
        </Space>
      ),
      children: (
        <MaxBalancePanel
          data={complianceData}
          chainName={chainName}
          symbol={symbol}
        />
      ),
    },
    {
      key: 'supplyLimit',
      label: (
        <Space size={5}>
          <FundOutlined style={{ color: '#722ed1' }} />
          <span>Supply Limit</span>
        </Space>
      ),
      children: (
        <SupplyLimitPanel
          data={complianceData}
          chainName={chainName}
          symbol={symbol}
        />
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Header row: info alert + binding button ─────────── */}
      <Row justify="space-between" align="middle" gutter={[12, 8]}>
        <Col flex="auto">
          <Alert
            type="info"
            showIcon
            title="Admin operations — only the compliance contract owner can configure modules."
            style={{ marginBottom: 0 }}
          />
        </Col>
        <Col>
          <Button
            icon={<ApiOutlined />}
            onClick={() => {
              setBindingOpen(true);
            }}
          >
            Manage Bindings
          </Button>
        </Col>
      </Row>

      {/* ── Module configuration tabs ────────────────────────── */}
      <Card
        size="small"
        styles={{ body: { padding: '16px 0 16px' } }}
        title={
          <Space>
            <SafetyOutlined style={{ color: '#1677ff' }} />
            <Text strong>Module Configuration</Text>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="countryRestrict"
          size="middle"
          items={moduleTabs.map((tab) => ({
            ...tab,
            children: (
              <div style={{ padding: '0 16px 0 8px' }}>{tab.children}</div>
            ),
          }))}
          tabPosition="left"
          style={{ minHeight: 380 }}
        />
      </Card>

      {/* ── Module Binding modal ─────────────────────────────── */}
      <Modal
        open={bindingOpen}
        onCancel={() => {
          setBindingOpen(false);
        }}
        footer={null}
        title={
          <Space>
            <ApiOutlined style={{ color: '#1677ff' }} />
            <span>Module Bindings</span>
          </Space>
        }
        width={520}
        destroyOnClose
      >
        <ModuleBindingPanel data={complianceData} chainName={chainName} />
      </Modal>
    </Space>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const { isConnected, chain } = useAccount();
  const { info } = useToken();

  const decimals = info?.decimals ?? 18;
  const symbol = info?.symbol ?? 'TOKEN';
  const chainName = chain?.name?.toLowerCase() ?? 'sepolia';

  const complianceData = useComplianceModules(decimals);

  const tabItems = [
    {
      key: 'admin',
      label: (
        <Space size={6}>
          <ToolOutlined />
          <span>Admin</span>
        </Space>
      ),
      children: (
        <AdminTabContent
          complianceData={complianceData}
          chainName={chainName}
          symbol={symbol}
        />
      ),
    },
    {
      key: 'transfer',
      label: (
        <Space size={6}>
          <SendOutlined />
          <span>Transfer Check</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <TransferCheckPanel chainName={chainName} />
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title={<Text strong>How it works</Text>}>
              <Space orientation="vertical" size={8}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  The <Text code>canTransfer(from, to, amount)</Text> call
                  checks all bound compliance modules synchronously before a
                  transfer is allowed.
                </Text>
                <Divider style={{ margin: '4px 0' }} />
                <Text strong style={{ fontSize: 13 }}>
                  Module checks include:
                </Text>
                <ul
                  style={{
                    paddingLeft: 16,
                    margin: 0,
                    fontSize: 13,
                    color: '#666',
                  }}
                >
                  <li>
                    CountryRestrict — sender/receiver country is not blacklisted
                  </li>
                  <li>CountryAllow — sender/receiver country is whitelisted</li>
                  <li>
                    MaxBalance — receiver balance after transfer stays within
                    cap
                  </li>
                  <li>
                    SupplyLimit — total supply remains within configured limit
                  </li>
                </ul>
                <Divider style={{ margin: '4px 0' }} />
                <Alert
                  type="warning"
                  showIcon
                  title="Both checks must pass"
                  description="canTransfer fails if ANY bound module rejects the transfer."
                  style={{ fontSize: 12 }}
                />
              </Space>
            </Card>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>Compliance Modules · ERC-3643 T-REX</title>
        <meta
          name="description"
          content="Manage modular compliance rules for the ERC-3643 security token."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        {/* ── Page header ────────────────────────────────── */}
        <Space style={{ marginBottom: 4 }} align="center">
          <SafetyOutlined style={{ fontSize: 22, color: '#52c41a' }} />
          <Title level={3} style={{ margin: 0 }}>
            Compliance Modules
          </Title>
        </Space>
        <Paragraph
          type="secondary"
          style={{ marginBottom: 16, marginLeft: 30 }}
        >
          Configure and manage <Text strong>modular compliance rules</Text> for
          the ERC-3643 security token. Bind modules, set country restrictions,
          whitelist countries, cap balances, and check transfer eligibility in
          real time.
        </Paragraph>

        <Divider style={{ marginTop: 0, marginBottom: 16 }} />

        {!isConnected ? (
          <NotConnectedBanner />
        ) : (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <TokenInfoBanner />
            <Tabs
              defaultActiveKey="admin"
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
