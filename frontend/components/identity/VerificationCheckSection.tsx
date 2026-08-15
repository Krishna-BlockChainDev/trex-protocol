/**
 * VerificationCheckSection.tsx
 *
 * Tab: "Verification Check"
 * Calls identityRegistry.isVerified(address) and identityRegistry.contains(address)
 * to show whether a wallet is fully verified or just registered.
 */

import { useState, useCallback } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Alert,
  Descriptions,
} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  SearchOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { usePublicClient } from 'wagmi';
import { isAddress, type Address } from 'viem';
import {
  isVerified,
  contains,
  getIdentityAddress,
  getInvestorCountry,
} from '@/contracts/identityRegistry';
import { CopyableAddress } from '@/components/identity/CopyableAddress';
import { readInvestorName } from '@/lib/investorName';

const { Paragraph, Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  address: string;
  verified: boolean;
  registered: boolean;
  identityContract: string | null;
  countryCode: number | null;
}

// ─── How it works panel ───────────────────────────────────────────────────────

export function VerificationHowItWorksPanel({
  registryAddress,
}: {
  registryAddress: string | null;
}) {
  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #f0f5ff, #e6f7ff)',
        border: '1px solid #91caff',
        height: '100%',
      }}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ color: '#1677ff' }}>
            How Verification Works
          </Text>
        </Space>

        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {[
            {
              step: '1',
              text: 'Enter any wallet address to check its verification status.',
            },
            {
              step: '2',
              text: (
                <>
                  <Text code>contains(address)</Text> checks if the wallet is
                  registered in the Identity Registry.
                </>
              ),
            },
            {
              step: '3',
              text: (
                <>
                  <Text code>isVerified(address)</Text> additionally validates
                  that the linked OnchainID holds a valid KYC claim from a
                  trusted issuer.
                </>
              ),
            },
            {
              step: '4',
              text: 'Only fully verified wallets can receive ERC-3643 tokens.',
            },
          ].map((item) => (
            <Space key={item.step} align="start" size={8}>
              <div
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#1677ff',
                  color: '#fff',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              <Text style={{ fontSize: 13 }}>{item.text}</Text>
            </Space>
          ))}
        </Space>

        {registryAddress && (
          <>
            <div
              style={{
                borderTop: '1px solid #91caff',
                paddingTop: 10,
                marginTop: 4,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Identity Registry
              </Text>
              <div style={{ marginTop: 4 }}>
                <CopyableAddress addr={registryAddress} />
              </div>
            </div>
          </>
        )}

        <div
          style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          <Text style={{ fontSize: 12, color: '#874d00' }}>
            ⚠️{' '}
            <Text strong style={{ color: '#874d00' }}>
              Registered ≠ Verified.
            </Text>{' '}
            A wallet can be registered without a valid KYC claim — transfers
            will still be blocked until a claim is added.
          </Text>
        </div>
      </Space>
    </Card>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function VerificationResultCard({ result }: { result: CheckResult }) {
  const statusColor = result.verified
    ? '#52c41a'
    : result.registered
      ? '#fa8c16'
      : '#ff4d4f';

  const statusIcon = result.verified ? (
    <CheckCircleFilled style={{ fontSize: 48, color: '#52c41a' }} />
  ) : (
    <CloseCircleFilled
      style={{ fontSize: 48, color: result.registered ? '#fa8c16' : '#ff4d4f' }}
    />
  );

  const statusLabel = result.verified
    ? 'Verified'
    : result.registered
      ? 'Registered — Not Verified'
      : 'Not Registered';

  const statusDescription = result.verified
    ? 'This wallet has a registered OnchainID with a valid KYC claim. It can receive ERC-3643 tokens.'
    : result.registered
      ? 'This wallet is registered in the Identity Registry but does not have a valid KYC claim yet. Add a claim to complete verification.'
      : 'This wallet is not registered in the Identity Registry. Complete Steps 1 and 2 first.';

  return (
    <Card
      style={{
        border: `2px solid ${statusColor}`,
        borderRadius: 8,
        marginTop: 16,
      }}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {/* Status banner */}
        <div style={{ textAlign: 'center' }}>
          {statusIcon}
          <div style={{ marginTop: 8 }}>
            <Tag
              color={
                result.verified
                  ? 'success'
                  : result.registered
                    ? 'warning'
                    : 'error'
              }
              style={{ fontSize: 16, padding: '4px 16px', borderRadius: 20 }}
            >
              {statusLabel}
            </Tag>
          </div>
          <Paragraph
            type="secondary"
            style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}
          >
            {statusDescription}
          </Paragraph>
        </div>

        {/* Details table */}
        <Descriptions
          column={1}
          size="small"
          bordered
          styles={{
            label: { fontWeight: 600, width: 160 },
          }}
        >
          <Descriptions.Item label="Wallet Address">
            <CopyableAddress addr={result.address} />
          </Descriptions.Item>
          <Descriptions.Item label="Registered">
            {result.registered ? (
              <Tag color="success">Yes</Tag>
            ) : (
              <Tag color="error">No</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Verified (KYC)">
            {result.verified ? (
              <Tag color="success">Yes</Tag>
            ) : (
              <Tag color="error">No</Tag>
            )}
          </Descriptions.Item>
          {result.identityContract && (
            <Descriptions.Item label="OnchainID Contract">
              <CopyableAddress addr={result.identityContract!} />
            </Descriptions.Item>
          )}
          {result.countryCode !== null && (
            <Descriptions.Item label="Country Code">
              <Text code>{result.countryCode}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Action hints */}
        {!result.verified && (
          <Alert
            type={result.registered ? 'warning' : 'info'}
            showIcon
            title={
              result.registered
                ? 'Next: Add a KYC claim — switch to the "Add KYC Claim" tab.'
                : 'Next: Create and register an identity — use the "Create Identity" and "Register Identity" tabs.'
            }
          />
        )}
      </Space>
    </Card>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function VerificationCheckForm({
  registryAddress,
  storedIdentities = {},
}: {
  registryAddress: string | null;
  storedIdentities?: Record<string, string>;
}) {
  const [form] = Form.useForm();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quickFillOptions = Object.entries(storedIdentities).map(
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

  const handleQuickFill = useCallback(
    (wallet: string) => {
      form.setFieldsValue({ address: wallet });
      setResult(null);
      setError(null);
    },
    [form],
  );

  const handleCheck = useCallback(
    async (values: { address: string }) => {
      if (!registryAddress) {
        setError(
          'Identity Registry address not found. Check your deployed-addresses config.',
        );
        return;
      }
      if (!publicClient) {
        setError(
          'No public client available. Make sure your wallet is connected.',
        );
        return;
      }

      const addr = values.address.trim() as Address;
      if (!isAddress(addr)) {
        setError('Invalid Ethereum address.');
        return;
      }

      setError(null);
      setResult(null);
      setLoading(true);

      try {
        const regAddr = registryAddress as Address;

        const [isReg, isVerif] = await Promise.all([
          contains(regAddr, addr, publicClient),
          isVerified(regAddr, addr, publicClient),
        ]);

        let identityContract: string | null = null;
        let countryCode: number | null = null;

        if (isReg) {
          try {
            const [idAddr, country] = await Promise.all([
              getIdentityAddress(regAddr, addr, publicClient),
              getInvestorCountry(regAddr, addr, publicClient),
            ]);
            identityContract =
              idAddr !== '0x0000000000000000000000000000000000000000'
                ? idAddr
                : null;
            countryCode = country;
          } catch {
            // non-critical — skip
          }
        }

        setResult({
          address: addr,
          verified: isVerif,
          registered: isReg,
          identityContract,
          countryCode,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Check failed: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [registryAddress, publicClient],
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {!registryAddress && (
        <Alert
          type="warning"
          showIcon
          title="Identity Registry address not configured"
          description="No registry address was found in deployed-addresses. Deploy the contract suite first."
        />
      )}

      {/* ── Quick-fill from stored identities ───────────────── */}
      {quickFillOptions.length > 0 && (
        <div>
          <Text
            strong
            style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
          >
            <ThunderboltOutlined style={{ color: '#fa8c16', marginRight: 6 }} />
            Quick-fill from Created Identities
          </Text>
          <Select
            placeholder="Select an investor to auto-fill the wallet address…"
            style={{ width: '100%' }}
            allowClear
            onSelect={handleQuickFill}
            onClear={() => {
              form.resetFields(['address']);
              setResult(null);
              setError(null);
            }}
            options={quickFillOptions}
          />
          <Text
            type="secondary"
            style={{ fontSize: 11, marginTop: 4, display: 'block' }}
          >
            Selecting an entry fills the wallet address field below.
          </Text>
        </div>
      )}

      <Form form={form} layout="vertical" onFinish={handleCheck}>
        <Form.Item
          label={<Text strong>Wallet Address to Check</Text>}
          name="address"
          rules={[
            { required: true, message: 'Please enter a wallet address.' },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Enter a valid 0x… address')),
            },
          ]}
          extra="Enter any investor wallet address to check its verification status."
        >
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="0xAbc123…"
            size="large"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SafetyOutlined />}
            loading={loading}
            disabled={!registryAddress}
            size="large"
            block
          >
            {loading ? 'Checking…' : 'Check Verification'}
          </Button>
        </Form.Item>
      </Form>

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="large" description="Querying Identity Registry…" />
        </div>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          closable
          onClose={() => setError(null)}
        />
      )}

      {result && !loading && <VerificationResultCard result={result} />}
    </Space>
  );
}
