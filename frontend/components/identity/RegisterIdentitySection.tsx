/**
 * RegisterIdentitySection – Step 2 of identity onboarding.
 *
 * Exports:
 *   RegisterIdentityForm    – form that calls IdentityRegistry.registerIdentity()
 *   RegisterHowItWorksPanel – right-column explainer
 */

import { useState, useCallback } from 'react';
import {
  Typography,
  Card,
  Alert,
  Space,
  Input,
  InputNumber,
  Button,
  Tag,
  Descriptions,
  Badge,
  Divider,
  Select,
} from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  QuestionCircleOutlined,
  SafetyOutlined,
  WalletOutlined,
  GlobalOutlined,
  IdcardOutlined,
  //TeamOutlined,
} from '@ant-design/icons';
import {
  isAddress,
  type Address,
  type WalletClient,
  type PublicClient,
} from 'viem';
import { useWallet } from '@/hooks/useWallet';
import { useDeployedAddresses } from '@/hooks/useDeployedAddresses';
import { useTransaction } from '@/hooks/useTransaction';
import { registerIdentity } from '@/contracts/identityRegistry';
import { CopyableAddress } from './CopyableAddress';
import { readInvestorName } from '@/lib/investorName';
import { useSaveTransaction } from '@/hooks/useSaveTransaction';

const { Text, Paragraph } = Typography;

// ─── Country presets ──────────────────────────────────────────────────────────

const COUNTRY_PRESETS: { code: number; label: string }[] = [
  { code: 840, label: '🇺🇸 USA (840)' },
  { code: 356, label: '🇮🇳 India (356)' },
  { code: 826, label: '🇬🇧 UK (826)' },
  { code: 276, label: '🇩🇪 Germany (276)' },
  { code: 702, label: '🇸🇬 Singapore (702)' },
  { code: 784, label: '🇦🇪 UAE (784)' },
  // { code: 392, label: '🇯🇵 Japan (392)' },
];

// ─── How it works panel ───────────────────────────────────────────────────────

export function RegisterHowItWorksPanel({
  registryAddress,
}: {
  registryAddress: string | null;
}) {
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <QuestionCircleOutlined style={{ color: '#722ed1' }} />
            <Text strong>What does this do?</Text>
          </Space>
        }
      >
        <Paragraph style={{ margin: 0, fontSize: 13, color: '#595959' }}>
          <Text strong>Registering an identity</Text> links an investor wallet
          to their OnchainID contract inside the{' '}
          <Text code style={{ fontSize: 12 }}>
            IdentityRegistry
          </Text>
          . Once registered, the investor can receive and transfer ERC-3643
          tokens — subject to their claims being valid.
        </Paragraph>
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#fa8c16' }} />
            <Text strong>Requirements</Text>
          </Space>
        }
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {[
            {
              num: 1,
              color: '#fa8c16',
              title: 'Agent wallet',
              desc: 'The signing wallet must hold the Agent role on the IdentityRegistry. Non-agents will revert.',
            },
            {
              num: 2,
              color: '#1677ff',
              title: 'Deployed identity',
              desc: 'The OnchainID IdentityProxy must already exist (use the Create Identity step above).',
            },
            {
              num: 3,
              color: '#52c41a',
              title: 'ISO country code',
              desc: "Provide the ISO 3166-1 numeric code for the investor's country (e.g. 840 = USA, 356 = India).",
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

      {registryAddress && (
        <Card
          size="small"
          title={
            <Space>
              <SafetyOutlined style={{ color: '#722ed1' }} />
              <Text strong>Identity Registry</Text>
              <Badge status="processing" color="purple" />
            </Space>
          }
        >
          <Descriptions
            size="small"
            column={1}
            styles={{ label: { fontSize: 12 }, content: { fontSize: 12 } }}
          >
            <Descriptions.Item label="Contract">
              <CopyableAddress addr={registryAddress} />
            </Descriptions.Item>
            <Descriptions.Item label="Network">
              <Tag color="purple" style={{ fontSize: 11 }}>
                Connected
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Space>
  );
}

// ─── Register identity form ───────────────────────────────────────────────────

export function RegisterIdentityForm({
  storedIdentities,
}: {
  storedIdentities: Record<string, string>;
}) {
  const [userWallet, setUserWallet] = useState('');
  const [identityAddr, setIdentityAddr] = useState('');
  const [countryCode, setCountryCode] = useState<number | null>(null);

  const { walletClient, publicClient } = useWallet();
  const { addresses } = useDeployedAddresses();
  const txState = useTransaction();
  const { save } = useSaveTransaction();

  const registryAddress = (addresses?.identityRegistry ??
    null) as Address | null;
  const isWalletConnected = !!(walletClient && publicClient);
  const isReady = !!(isWalletConnected && registryAddress);

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

  const handleSelectStored = useCallback(
    (wallet: string) => {
      setUserWallet(wallet);
      setIdentityAddr(storedIdentities[wallet] ?? '');
      txState.reset();
    },
    [storedIdentities, txState],
  );

  const handleClearStored = useCallback(() => {
    setUserWallet('');
    setIdentityAddr('');
    txState.reset();
  }, [txState]);

  const isValidUserWallet =
    userWallet.trim() !== '' && isAddress(userWallet.trim() as Address);
  const isValidIdentityAddr =
    identityAddr.trim() !== '' && isAddress(identityAddr.trim() as Address);
  const canRegister =
    isReady &&
    isValidUserWallet &&
    isValidIdentityAddr &&
    countryCode !== null &&
    !txState.isPending;

  const handleRegister = useCallback(async () => {
    if (
      !canRegister ||
      !walletClient ||
      !publicClient ||
      !registryAddress ||
      countryCode === null
    )
      return;
    txState.reset();
    const hash = await txState.execute(() =>
      registerIdentity(
        registryAddress,
        userWallet.trim() as Address,
        identityAddr.trim() as Address,
        countryCode,
        walletClient as WalletClient,
        publicClient as PublicClient,
      ),
    );
    if (hash) {
      save({
        txHash: hash,
        category: 'Identity',
        eventType: 'RegisterIdentity',
        fromAddress: userWallet.trim(),
        toAddress: identityAddr.trim(),
        metadata: JSON.stringify({ countryCode }),
      });
    }
  }, [
    canRegister,
    walletClient,
    publicClient,
    registryAddress,
    countryCode,
    userWallet,
    identityAddr,
    txState,
    save,
  ]);

  const handleReset = useCallback(() => {
    setUserWallet('');
    setIdentityAddr('');
    setCountryCode(null);
    txState.reset();
  }, [txState]);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Agent warning ────────────────────────────────────── */}
      {/* <Alert
        type="warning"
        showIcon
        icon={<TeamOutlined />}
        title={<Text strong>Agent wallet required</Text>}
        description="The connected wallet must hold the Agent role on the IdentityRegistry contract. Transactions from non-agent wallets will revert."
        style={{ padding: '8px 12px' }}
      /> */}

      {/* ── Quick-fill ───────────────────────────────────────── */}
      {storedOptions.length > 0 && (
        <div>
          <Text
            strong
            style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
          >
            Quick-fill from Created Identities
          </Text>
          <Select
            placeholder="Select a recently created identity to auto-fill…"
            style={{ width: '100%' }}
            allowClear
            onSelect={handleSelectStored}
            onClear={handleClearStored}
            options={storedOptions}
            optionLabelProp="label"
          />
          <Text
            type="secondary"
            style={{ fontSize: 11, marginTop: 4, display: 'block' }}
          >
            Selecting an entry fills both the investor wallet and identity
            address fields below.
          </Text>
        </div>
      )}

      {/* ── Investor wallet input ─────────────────────────────── */}
      <div>
        <Text
          strong
          style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
        >
          Investor Wallet Address
        </Text>
        <Input
          size="large"
          placeholder="0x…  investor wallet address"
          prefix={<WalletOutlined style={{ color: '#bfbfbf' }} />}
          value={userWallet}
          onChange={(e) => {
            setUserWallet(e.target.value);
            txState.reset();
          }}
          status={userWallet && !isValidUserWallet ? 'error' : undefined}
          allowClear
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        {userWallet && !isValidUserWallet && (
          <Text
            type="danger"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            Not a valid EVM address.
          </Text>
        )}
      </div>

      {/* ── Identity address input ────────────────────────────── */}
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
            txState.reset();
          }}
          status={identityAddr && !isValidIdentityAddr ? 'error' : undefined}
          allowClear
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        {identityAddr && !isValidIdentityAddr && (
          <Text
            type="danger"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            Not a valid EVM address.
          </Text>
        )}
      </div>

      {/* ── Country code ─────────────────────────────────────── */}
      <div>
        <Text
          strong
          style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
        >
          Country Code{' '}
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            (ISO 3166-1 numeric)
          </Text>
        </Text>
        <Space wrap style={{ marginBottom: 8 }}>
          {COUNTRY_PRESETS.map((p) => (
            <Tag
              key={p.code}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              color={countryCode === p.code ? 'blue' : 'default'}
              onClick={() => setCountryCode(p.code)}
            >
              {p.label}
            </Tag>
          ))}
        </Space>
        <Space.Compact style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 11px',
              border: '1px solid #d9d9d9',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              background: '#fafafa',
            }}
          >
            <GlobalOutlined />
          </div>

          <InputNumber
            size="large"
            min={1}
            max={999}
            placeholder="e.g. 840"
            value={countryCode}
            onChange={(val) => setCountryCode(val ?? 1)}
            style={{ width: '100%' }}
          />
        </Space.Compact>
        <Text
          type="secondary"
          style={{ fontSize: 11, marginTop: 4, display: 'block' }}
        >
          Select a preset above or enter any valid ISO 3166-1 numeric code.
        </Text>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* ── Register button ────────────────────────────────────── */}
      {!txState.isSuccess && (
        <Button
          type="primary"
          size="large"
          icon={<IdcardOutlined />}
          onClick={handleRegister}
          loading={txState.isPending}
          disabled={!canRegister}
          block
        >
          {txState.isPending ? 'Registering…' : 'Register Identity'}
        </Button>
      )}

      {!isWalletConnected && (
        <Text
          type="warning"
          style={{ fontSize: 12, display: 'block', textAlign: 'center' }}
        >
          Connect your wallet to a supported network first.
        </Text>
      )}

      {isWalletConnected && !registryAddress && (
        <Text
          type="warning"
          style={{ fontSize: 12, display: 'block', textAlign: 'center' }}
        >
          No token ecosystem selected. Select a deployed token from the
          top-right selector to continue.
        </Text>
      )}

      {/* ── Pending ──────────────────────────────────────────── */}
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

      {/* ── Error ────────────────────────────────────────────── */}
      {txState.isError && txState.errorMessage && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          title={<Text strong>Registration failed</Text>}
          description={txState.errorMessage}
          action={
            <Button size="small" onClick={txState.reset}>
              Dismiss
            </Button>
          }
        />
      )}

      {/* ── Success ──────────────────────────────────────────── */}
      {txState.isSuccess && (
        <Card
          style={{ borderColor: '#52c41a', background: '#f6ffed' }}
          size="small"
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space>
              <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />
              <Text strong style={{ fontSize: 15, color: '#135200' }}>
                Identity Registered Successfully
              </Text>
            </Space>
            <Descriptions size="small" column={1} style={{ marginTop: 4 }}>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Investor wallet</Text>}
              >
                <CopyableAddress addr={userWallet.trim()} full />
              </Descriptions.Item>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Identity address</Text>}
              >
                <CopyableAddress addr={identityAddr.trim()} full />
              </Descriptions.Item>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Country code</Text>}
              >
                <Tag color="blue">{countryCode}</Tag>
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
              title={
                <Text style={{ fontSize: 12 }}>
                  The investor wallet is now linked to their OnchainID in the
                  IdentityRegistry.
                </Text>
              }
              style={{ padding: '6px 10px' }}
            />
            <Button
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={handleReset}
            >
              Register another
            </Button>
          </Space>
        </Card>
      )}
    </Space>
  );
}
