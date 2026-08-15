/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * CreateIdentitySection – Step 1 of identity onboarding.
 *
 * Exports:
 *   CreateIdentityForm   – form that calls IdFactory.createIdentity()
 *   CreateHowItWorksPanel – right-column explainer
 */

import { useState, useCallback } from 'react';
import {
  Typography,
  Card,
  Alert,
  Space,
  Input,
  Button,
  Tag,
  Descriptions,
  Steps,
  Badge,
  Divider,
} from 'antd';
import {
  UserAddOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  QuestionCircleOutlined,
  SafetyOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { isAddress, type Address } from 'viem';
import { useIdentity } from '@/hooks/useIdentity';
import { CopyableAddress } from './CopyableAddress';

const { Text, Paragraph } = Typography;

// ─── How it works panel ───────────────────────────────────────────────────────

export function CreateHowItWorksPanel({
  factoryAddress,
}: {
  factoryAddress: Address | null;
}) {
  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space>
            <QuestionCircleOutlined style={{ color: '#1677ff' }} />
            <Text strong>What is an OnchainID?</Text>
          </Space>
        }
      >
        <Paragraph style={{ margin: 0, fontSize: 13, color: '#595959' }}>
          An <Text strong>OnchainID Identity</Text> is a smart contract deployed
          for each investor. It holds cryptographic claims (e.g. KYC approval)
          issued by a trusted authority, and is required before an investor can
          receive ERC-3643 tokens.
        </Paragraph>
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#fa8c16' }} />
            <Text strong>3-Step Process</Text>
          </Space>
        }
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {[
            {
              num: 1,
              color: '#1677ff',
              title: 'Enter investor wallet',
              desc: 'Paste the investor\u2019s EVM wallet address (0x\u2026).',
            },
            {
              num: 2,
              color: '#52c41a',
              title: 'Check existing identity',
              desc: 'Query the factory to see if an identity already exists for this wallet.',
            },
            {
              num: 3,
              color: '#722ed1',
              title: 'Create & deploy',
              desc: 'Deployer signs a transaction \u2014 the factory deploys an IdentityProxy linked to the wallet.',
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
    </Space>
  );
}

// ─── Create identity form ─────────────────────────────────────────────────────

export function CreateIdentityForm() {
  const [walletInput, setWalletInput] = useState('');
  const [customSalt, setCustomSalt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const {
    factoryAddress,
    checkIdentity,
    existingIdentity,
    isChecking,
    checkError,
    create,
    txState,
    createdIdentity,
    storedIdentities,
    refreshIdentities,
    isReady,
  } = useIdentity();

  // suppress unused-var; used at page level via useIdentity
  void storedIdentities;

  const normalizedWallet = walletInput.trim() as Address;
  const isValidAddress = isAddress(normalizedWallet);

  // ── Step index for visual indicator ───────────────────────────────────────
  let currentStep = 0;
  if (isValidAddress && hasChecked) currentStep = 1;
  if (txState.isPending) currentStep = 2;
  if (txState.isSuccess) currentStep = 3;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleWalletChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setWalletInput(e.target.value);
      setHasChecked(false);
      txState.reset();
    },
    [txState],
  );

  const handleCheck = useCallback(async () => {
    if (!isValidAddress) return;
    setHasChecked(false);
    await checkIdentity(normalizedWallet);
    setHasChecked(true);
  }, [checkIdentity, normalizedWallet, isValidAddress]);

  const handleCreate = useCallback(async () => {
    if (!isValidAddress) return;
    txState.reset();
    await create(normalizedWallet, customSalt || undefined);
  }, [create, normalizedWallet, customSalt, isValidAddress, txState]);

  const handleReset = useCallback(() => {
    setWalletInput('');
    setCustomSalt('');
    setHasChecked(false);
    txState.reset();
  }, [txState]);

  const showExistingFound =
    hasChecked && existingIdentity && !txState.isSuccess;
  const showCreatePanel =
    hasChecked && !existingIdentity && !txState.isSuccess && !txState.isPending;
  const showSuccessPanel = txState.isSuccess;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Progress steps ──────────────────────────────────── */}
      <Steps
        current={currentStep}
        size="small"
        items={[
          { title: 'Enter Wallet' },
          { title: 'Verify' },
          {
            title: 'Deploying',
            icon: txState.isPending ? <LoadingOutlined /> : undefined,
          },
          { title: 'Done' },
        ]}
        style={{ marginBottom: 4 }}
      />

      {/* ── Wallet input ─────────────────────────────────────── */}
      <div>
        <Text
          strong
          style={{ fontSize: 13, display: 'block', marginBottom: 6 }}
        >
          Investor Wallet Address
        </Text>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            size="large"
            placeholder="0x…  paste investor wallet address"
            prefix={<WalletOutlined style={{ color: '#bfbfbf' }} />}
            value={walletInput}
            onChange={handleWalletChange}
            status={walletInput && !isValidAddress ? 'error' : undefined}
            allowClear
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            onPressEnter={handleCheck}
          />
          <Button
            size="large"
            type={isValidAddress ? 'primary' : 'default'}
            ghost={isValidAddress}
            icon={isChecking ? <LoadingOutlined /> : <SearchOutlined />}
            onClick={handleCheck}
            disabled={!isValidAddress || !isReady || isChecking}
            style={{ minWidth: 100 }}
          >
            {isChecking ? 'Checking…' : 'Check'}
          </Button>
        </Space.Compact>
        {walletInput && !isValidAddress && (
          <Text
            type="danger"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            Not a valid EVM address — must start with 0x and be 42 characters.
          </Text>
        )}
        {!isReady && !factoryAddress && (
          <Text
            type="warning"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            Connect your wallet to a supported network first.
          </Text>
        )}
      </div>

      {/* ── Check error ──────────────────────────────────────── */}
      {checkError && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          title={checkError}
          closable
        />
      )}

      {/* ── Existing identity found ───────────────────────────── */}
      {showExistingFound && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          title={<Text strong>Identity already exists for this wallet</Text>}
          description={
            <Space orientation="vertical" size={4} style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 12 }}>Identity contract address:</Text>
              <CopyableAddress addr={existingIdentity!} full />
            </Space>
          }
          action={
            <Button size="small" onClick={handleReset} style={{ marginTop: 4 }}>
              Check another wallet
            </Button>
          }
        />
      )}

      {/* ── No identity → show create panel ──────────────────── */}
      {showCreatePanel && (
        <Card
          size="small"
          style={{ borderColor: '#d9d9d9', background: '#fafafa' }}
          title={
            <Space>
              <InfoCircleOutlined style={{ color: '#fa8c16' }} />
              <Text strong style={{ fontSize: 13 }}>
                No identity found for this wallet
              </Text>
              <Tag color="orange">Ready to deploy</Tag>
            </Space>
          }
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Investor wallet</Text>}
              >
                <CopyableAddress addr={normalizedWallet} full />
              </Descriptions.Item>
              <Descriptions.Item
                label={<Text style={{ fontSize: 12 }}>Salt (auto)</Text>}
              >
                <Text
                  code
                  style={{ fontSize: 11 }}
                  title="The salt is used as a CREATE2 seed to deterministically derive the identity address"
                >
                  {customSalt || normalizedWallet.toLowerCase()}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? '▲ Hide advanced' : '▼ Advanced options'}
            </Button>

            {showAdvanced && (
              <Space.Compact style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    border: '1px solid #d9d9d9',
                    borderRight: 'none',
                    borderRadius: '6px 0 0 6px',
                    background: '#fafafa',
                    fontSize: 12,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>Salt</Text>
                </div>

                <Input
                  size="small"
                  placeholder={`Default: ${normalizedWallet.toLowerCase()}`}
                  value={customSalt}
                  onChange={(e) => setCustomSalt(e.target.value)}
                />
              </Space.Compact>
            )}

            <Divider style={{ margin: '4px 0' }} />

            <Button
              type="primary"
              size="large"
              icon={<UserAddOutlined />}
              onClick={handleCreate}
              loading={txState.isPending}
              disabled={!isReady || txState.isPending}
              block
            >
              Deploy Identity Contract
            </Button>

            <Text
              type="secondary"
              style={{ fontSize: 11, textAlign: 'center', display: 'block' }}
            >
              Your wallet (deployer) will be prompted to sign a transaction. Gas
              fees apply.
            </Text>
          </Space>
        </Card>
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

      {/* ── Transaction error ─────────────────────────────────── */}
      {txState.isError && txState.errorMessage && (
        <Alert
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          title={<Text strong>Transaction failed</Text>}
          description={txState.errorMessage}
          action={
            <Button size="small" onClick={txState.reset}>
              Dismiss
            </Button>
          }
        />
      )}

      {/* ── Success ───────────────────────────────────────────── */}
      {showSuccessPanel && (
        <Card
          style={{ borderColor: '#52c41a', background: '#f6ffed' }}
          size="small"
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Space>
              <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />
              <Text strong style={{ fontSize: 15, color: '#135200' }}>
                Identity Deployed Successfully
              </Text>
            </Space>

            {createdIdentity ? (
              <Descriptions size="small" column={1} style={{ marginTop: 4 }}>
                <Descriptions.Item
                  label={<Text style={{ fontSize: 12 }}>Identity address</Text>}
                >
                  <CopyableAddress addr={createdIdentity} full />
                </Descriptions.Item>
                <Descriptions.Item
                  label={<Text style={{ fontSize: 12 }}>Investor wallet</Text>}
                >
                  <CopyableAddress addr={normalizedWallet} />
                </Descriptions.Item>
                {txState.txHash && (
                  <Descriptions.Item
                    label={<Text style={{ fontSize: 12 }}>Tx hash</Text>}
                  >
                    <CopyableAddress addr={txState.txHash} />
                  </Descriptions.Item>
                )}
              </Descriptions>
            ) : (
              <Space orientation="vertical" size={4}>
                <Text style={{ fontSize: 13 }}>
                  Transaction confirmed. Click below to look up the identity
                  address.
                </Text>
                {txState.txHash && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Tx:{' '}
                    <Text code style={{ fontSize: 11 }}>
                      {txState.txHash}
                    </Text>
                  </Text>
                )}
                <Button
                  size="small"
                  icon={<SearchOutlined />}
                  onClick={handleCheck}
                  style={{ marginTop: 4 }}
                >
                  Look up identity
                </Button>
              </Space>
            )}

            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              title={
                <Text style={{ fontSize: 12 }}>
                  Identity address saved successfully. It appears in the history
                  table below.
                </Text>
              }
              style={{ padding: '6px 10px' }}
            />

            <Button
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={() => {
                handleReset();
                refreshIdentities();
              }}
            >
              Create another identity
            </Button>
          </Space>
        </Card>
      )}

      {/* ── Active Factory footer ─────────────────────────────── */}
      {factoryAddress && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 2px',
            borderTop: '1px solid #f0f0f0',
            marginTop: 4,
          }}
        >
          <SafetyOutlined style={{ color: '#52c41a', fontSize: 12 }} />
          <Text style={{ fontSize: 12, color: '#595959' }}>Factory:</Text>
          <Badge status="processing" color="green" />
          <CopyableAddress addr={factoryAddress} />
        </div>
      )}
    </Space>
  );
}
