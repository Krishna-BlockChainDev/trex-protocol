/**
 * DeploymentSummary
 *
 * Displayed after a successful TREX ecosystem deployment.
 *
 * Shows:
 *   - Success banner with auto-switch confirmation
 *   - DB persistence note + JSON export button
 *   - All deployed contract addresses in collapsible groups
 *   - "Go to Dashboard" CTA
 */

import {
  Result,
  Descriptions,
  Collapse,
  Button,
  Typography,
  Tag,
  Space,
  Alert,
  Tooltip,
} from 'antd';
import {
  CheckCircleFilled,
  DownloadOutlined,
  SwapOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import type { DeployedTokenEcosystem } from '@/hooks';

const { Text, Paragraph } = Typography;

interface DeploymentSummaryProps {
  ecosystem: DeployedTokenEcosystem;
}

// ── Address row helper ────────────────────────────────────────────────────────

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <Descriptions.Item label={label}>
      <Text
        style={{ fontFamily: 'monospace', fontSize: 12 }}
        copyable={{ text: address }}
      >
        {address}
      </Text>
    </Descriptions.Item>
  );
}

// ── JSON export ───────────────────────────────────────────────────────────────

function downloadJSON(ecosystem: DeployedTokenEcosystem) {
  const payload = {
    name: ecosystem.name,
    symbol: ecosystem.symbol,
    chainId: ecosystem.chainId,
    salt: ecosystem.salt,
    deployerAddress: ecosystem.deployerAddress,
    deployedAt: new Date(ecosystem.deployedAt).toISOString(),
    tokenProxy: ecosystem.tokenProxy,
    identityRegistryProxy: ecosystem.identityRegistryProxy,
    identityRegistryStorageProxy: ecosystem.identityRegistryStorageProxy,
    trustedIssuersRegistryProxy: ecosystem.trustedIssuersRegistryProxy,
    claimTopicsRegistryProxy: ecosystem.claimTopicsRegistryProxy,
    modularComplianceProxy: ecosystem.modularComplianceProxy,
    tokenOnchainID: ecosystem.tokenOnchainID,
    claimIssuer: ecosystem.claimIssuer,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ecosystem.symbol.toLowerCase()}-addresses-chain${ecosystem.chainId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeploymentSummary({ ecosystem }: DeploymentSummaryProps) {
  const router = useRouter();
  const deployedAt = new Date(ecosystem.deployedAt).toLocaleString();

  const collapseItems = [
    {
      key: 'token',
      label: (
        <Space>
          <span>Token Contracts</span>
          <Tag color="green">Active</Tag>
        </Space>
      ),
      children: (
        <Descriptions column={1} size="small" bordered>
          <AddressRow label="tokenProxy" address={ecosystem.tokenProxy} />
          <AddressRow
            label="tokenOnchainID"
            address={ecosystem.tokenOnchainID}
          />
          <AddressRow label="claimIssuer" address={ecosystem.claimIssuer} />
        </Descriptions>
      ),
    },
    {
      key: 'proxies',
      label: 'Registry Proxies',
      children: (
        <Descriptions column={1} size="small" bordered>
          <AddressRow
            label="identityRegistryProxy"
            address={ecosystem.identityRegistryProxy}
          />
          <AddressRow
            label="identityRegistryStorageProxy"
            address={ecosystem.identityRegistryStorageProxy}
          />
          <AddressRow
            label="trustedIssuersRegistryProxy"
            address={ecosystem.trustedIssuersRegistryProxy}
          />
          <AddressRow
            label="claimTopicsRegistryProxy"
            address={ecosystem.claimTopicsRegistryProxy}
          />
        </Descriptions>
      ),
    },
    {
      key: 'compliance',
      label: 'Compliance',
      children: (
        <Descriptions column={1} size="small" bordered>
          <AddressRow
            label="modularComplianceProxy"
            address={ecosystem.modularComplianceProxy}
          />
        </Descriptions>
      ),
    },
  ];

  return (
    <div>
      {/* ── Success banner ──────────────────────────────────────────────── */}
      <Result
        icon={<CheckCircleFilled style={{ color: '#52c41a' }} />}
        status="success"
        title={
          <span>
            {ecosystem.name}{' '}
            <Tag
              color="green"
              style={{ fontSize: 14, verticalAlign: 'middle' }}
            >
              {ecosystem.symbol}
            </Tag>{' '}
            deployed!
          </span>
        }
        subTitle={
          <Text type="secondary">
            Deployed {deployedAt} on chain {ecosystem.chainId}
          </Text>
        }
        extra={[
          <Button
            key="dashboard"
            type="primary"
            size="large"
            onClick={() => router.push('/')}
          >
            Go to Dashboard
          </Button>,
          <Tooltip
            key="export"
            title="Download all contract addresses as a JSON backup file"
          >
            <Button
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => downloadJSON(ecosystem)}
            >
              Export Addresses
            </Button>
          </Tooltip>,
        ]}
      />

      {/* ── Storage & active-ecosystem notice ───────────────────────────── */}
      <Alert
        type="info"
        showIcon
        icon={<SwapOutlined />}
        style={{ marginBottom: 12 }}
        message="Dashboard switched to your new ecosystem"
        description={
          <Paragraph style={{ margin: 0, fontSize: 13 }}>
            The header <strong>ecosystem selector</strong> is now pointing to{' '}
            <strong>
              {ecosystem.name} ({ecosystem.symbol})
            </strong>
            . Every page in the dashboard (Compliance, Identity, Issuers…) now
            reads from these on-chain contracts.
            <br />
            You can switch back to the platform token or select a different
            deployed ecosystem from the selector at any time.
          </Paragraph>
        }
      />

      <Alert
        type="warning"
        showIcon
        icon={<DatabaseOutlined />}
        style={{ marginBottom: 16 }}
        message="Addresses are stored in the dashboard database"
        description={
          <Paragraph style={{ margin: 0, fontSize: 13 }}>
            All contract addresses are persisted in the PostgreSQL database and
            will be available across sessions and devices.{' '}
            <strong>
              Click &ldquo;Export Addresses&rdquo; above to also download a JSON
              backup.
            </strong>
          </Paragraph>
        }
      />

      {/* ── Contract address groups ──────────────────────────────────────── */}
      <Collapse
        size="small"
        defaultActiveKey={['token', 'proxies', 'compliance']}
        items={collapseItems}
      />
    </div>
  );
}
