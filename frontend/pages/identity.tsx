/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * /pages/identity.tsx – OnchainID Identity Management
 *
 * Five-tab layout:
 *   Tab 1 "Create Identity"      → Step 1 (Create)
 *   Tab 2 "Register Identity"    → Step 2 (Register)
 *   Tab 3 "Add KYC Claim"        → Step 3 (AddClaim)
 *   Tab 4 "Verification Check"   → isVerified(address) lookup
 *   Tab 5 "Manage Agents"        → identityRegistry.addAgent / removeAgent  [Owner]
 *
 * History table is always visible below the tabs.
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Typography, Card, Space, Row, Col, Divider, Tag, Tabs } from 'antd';
import {
  UserAddOutlined,
  IdcardOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAccount, usePublicClient } from 'wagmi';
import type { PublicClient } from 'viem';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import { useIdentity } from '@/hooks/useIdentity';
import { useDeployedAddresses } from '@/hooks/useDeployedAddresses';
import CTR_ABI from '@/contracts/abi/claimTopicsRegistry.json';

import {
  CreateIdentityForm,
  CreateHowItWorksPanel,
} from '@/components/identity/CreateIdentitySection';
import {
  RegisterIdentityForm,
  RegisterHowItWorksPanel,
} from '@/components/identity/RegisterIdentitySection';
import {
  AddClaimForm,
  AddClaimHowItWorksPanel,
} from '@/components/identity/AddClaimSection';
import { IdentityHistoryTable } from '@/components/identity/IdentityHistoryTable';
import {
  VerificationCheckForm,
  VerificationHowItWorksPanel,
} from '@/components/identity/VerificationCheckSection';
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
          <UserAddOutlined style={{ fontSize: 32, color: '#1677ff' }} />
        </div>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Connect your deployer wallet
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Connect MetaMask or WalletConnect to deploy OnchainID identities on
            behalf of investor wallets.
          </Paragraph>
        </div>
        <ConnectButton />
        <Divider style={{ margin: '0' }} />
        <Space size={24} wrap style={{ justifyContent: 'center' }}>
          {[
            { icon: '🔑', label: 'One identity per wallet' },
            { icon: '⚡', label: 'Factory-deployed proxy' },
            { icon: '🔒', label: 'KYC-claim ready' },
          ].map((f) => (
            <Space key={f.label} size={6}>
              <span>{f.icon}</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {f.label}
              </Text>
            </Space>
          ))}
        </Space>
      </Space>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IdentityPage() {
  const { isConnected } = useAccount();
  const {
    storedIdentities,
    factoryAddress,
    refreshIdentities,
    allIdentities,
    refreshAllIdentities,
  } = useIdentity();
  const { addresses } = useDeployedAddresses();
  const rawPublicClient = usePublicClient();
  const publicClient = rawPublicClient as PublicClient | undefined;

  const registryAddress = (addresses?.identityRegistry ?? null) as
    | string
    | null;
  const claimIssuerAddress = (addresses?.claimIssuer ?? null) as string | null;
  const ctrAddress = (addresses?.claimTopicsRegistry ?? null) as
    | `0x${string}`
    | null;

  // ── Read registered claim topics from the deployed CTR ─────────────────────
  const [ctrClaimTopics, setCtrClaimTopics] = useState<bigint[]>([]);

  useEffect(() => {
    if (!ctrAddress || !publicClient) return;

    let cancelled = false;
    publicClient
      .readContract({
        address: ctrAddress,
        abi: CTR_ABI,
        functionName: 'getClaimTopics',
      })
      .then((result) => {
        if (!cancelled) setCtrClaimTopics(result as bigint[]);
      })
      .catch(() => {
        // CTR unavailable — leave topics empty; form defaults to '1'.
      });

    return () => {
      cancelled = true;
    };
  }, [ctrAddress, publicClient]);

  const tabItems = [
    {
      key: 'create',
      label: (
        <Space size={6}>
          <UserAddOutlined />
          <span>Create Identity</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14} style={{ marginTop: 6 }}>
            <Card
              title={
                <Space>
                  <UserAddOutlined style={{ color: '#1677ff' }} />
                  <Text strong>
                    Step 1 — Create Identity for Investor Wallet
                  </Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
            >
              <CreateIdentityForm />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <CreateHowItWorksPanel factoryAddress={factoryAddress} />
          </Col>
        </Row>
      ),
    },
    {
      key: 'register',
      label: (
        <Space size={6}>
          <IdcardOutlined />
          <span>Register Identity</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14} style={{ marginTop: 6 }}>
            <Card
              title={
                <Space>
                  <IdcardOutlined style={{ color: '#722ed1' }} />
                  <Text strong>Step 2 — Register Identity in Registry</Text>
                  <Tag color="warning">Agent required</Tag>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <RegisterIdentityForm storedIdentities={storedIdentities} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <RegisterHowItWorksPanel registryAddress={registryAddress} />
          </Col>
        </Row>
      ),
    },
    {
      key: 'claim',
      label: (
        <Space size={6}>
          <SafetyOutlined />
          <span>Add KYC Claim</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14} style={{ marginTop: 6 }}>
            <Card
              title={
                <Space>
                  <IdcardOutlined style={{ color: '#52c41a' }} />
                  <Text strong>Step 3 — Add KYC Claim</Text>
                  <Tag color="success">Issuer signs off-chain</Tag>
                  <Tag color="warning">Investor&apos;s wallet required</Tag>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <AddClaimForm
                storedIdentities={storedIdentities}
                claimIssuerAddress={claimIssuerAddress}
                registeredClaimTopics={ctrClaimTopics}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <AddClaimHowItWorksPanel claimIssuerAddress={claimIssuerAddress} />
          </Col>
        </Row>
      ),
    },
    {
      key: 'verify',
      label: (
        <Space size={6}>
          <CheckCircleOutlined />
          <span>Verification Check</span>
        </Space>
      ),
      children: (
        <Row gutter={[24, 24]} align="top">
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#1677ff' }} />
                  <Text strong>Check Wallet Verification Status</Text>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <VerificationCheckForm
                registryAddress={registryAddress}
                storedIdentities={storedIdentities}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <VerificationHowItWorksPanel registryAddress={registryAddress} />
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
      children: <ManageAgentsSection contractType="identityRegistry" />,
    },
  ];

  return (
    <>
      <Head>
        <title>Identity Management · ERC-3643 T-REX</title>
        <meta
          name="description"
          content="Create OnchainID identities for investor wallets via the T-REX identity factory."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        {/* ── Page header ────────────────────────────────── */}
        <Space style={{ marginBottom: 4 }} align="center">
          <UserAddOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            Identity Management
          </Title>
        </Space>
        <Paragraph
          type="secondary"
          style={{ marginBottom: 24, marginLeft: 30 }}
        >
          Deploy an <Text strong>OnchainID IdentityProxy</Text> for investor
          wallets, register them in the <Text strong>IdentityRegistry</Text>,
          then add KYC claims — all three steps are required before any wallet
          can receive ERC-3643 tokens.
        </Paragraph>

        <Divider style={{ marginTop: 0, marginBottom: 0 }} />

        {!isConnected ? (
          <NotConnectedBanner />
        ) : (
          <Space orientation="vertical" size={24} style={{ width: '100%' }}>
            <Tabs
              defaultActiveKey="create"
              size="large"
              items={tabItems}
              style={{ marginTop: 8 }}
            />

            {/* ── History table (always visible, all identities on this chain) ── */}
            <IdentityHistoryTable
              identities={allIdentities}
              onRefresh={refreshAllIdentities}
            />
          </Space>
        )}
      </Layout>
    </>
  );
}
