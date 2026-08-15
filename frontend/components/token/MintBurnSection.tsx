/**
 * MintBurnSection.tsx
 * Mint (agent only): token.mint(to, amount)
 * Burn (agent only): token.burn(from, amount)
 */

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  PlusCircleOutlined,
  MinusCircleOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  LinkOutlined,
} from '@ant-design/icons';
import { isAddress, parseUnits, type Address } from 'viem';
import { useToken } from '@/hooks/useToken';
import { useSaveTransaction } from '@/hooks/useSaveTransaction';

const { Text } = Typography;

// ─── Shared tx result banner ──────────────────────────────────────────────────

function TxResultBanner({
  isSuccess,
  isError,
  txHash,
  errorMessage,
  onReset,
  successMsg,
  explorerUrl,
  chainName,
}: {
  isSuccess: boolean;
  isError: boolean;
  txHash?: string;
  errorMessage?: string | null;
  onReset: () => void;
  successMsg: string;
  explorerUrl?: string;
  chainName?: string;
}) {
  if (isSuccess && txHash) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleFilled />}
        title={successMsg}
        description={
          <Space orientation="vertical" size={4}>
            <Text code style={{ fontSize: 12 }}>
              {txHash}
            </Text>
            {explorerUrl && (
              <Tag
                icon={<LinkOutlined />}
                color="blue"
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  window.open(`${explorerUrl}/tx/${txHash}`, '_blank')
                }
              >
                View on {chainName ?? 'Explorer'}
              </Tag>
            )}
          </Space>
        }
      />
    );
  }
  if (isError && errorMessage) {
    return (
      <Alert
        type="error"
        showIcon
        title="Transaction failed"
        description={errorMessage}
        closable
        onClose={onReset}
      />
    );
  }
  return null;
}

// ─── Mint how it works ────────────────────────────────────────────────────────

export function MintHowItWorksPanel() {
  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #f6ffed, #d9f7be)',
        border: '1px solid #b7eb8f',
        height: '100%',
      }}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#52c41a' }} />
          <Text strong style={{ color: '#52c41a' }}>
            About Minting
          </Text>
        </Space>
        {[
          'Minting creates new tokens and assigns them to a recipient wallet.',
          'The caller must be a registered Token Agent.',
          'The recipient must be verified in the Identity Registry.',
          'Amount is entered in human-readable units (not wei).',
        ].map((t, i) => (
          <Space key={i} align="start" size={8}>
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: '50%',
                background: '#52c41a',
                color: '#fff',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <Text style={{ fontSize: 13 }}>{t}</Text>
          </Space>
        ))}
        <Alert
          type="warning"
          showIcon
          title="Agent role required"
          description="Only token agents can mint. If you see a revert, ensure your wallet is an agent."
          style={{ marginTop: 4 }}
        />
      </Space>
    </Card>
  );
}

// ─── Mint form ────────────────────────────────────────────────────────────────

export function MintForm({
  symbol,
  decimals,
}: {
  symbol: string;
  decimals: number;
}) {
  const [form] = Form.useForm();
  const { actions, txState } = useToken();
  const { chain, address: connectedAddress } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const [done, setDone] = useState(false);
  const { save } = useSaveTransaction();

  const handleMint = useCallback(
    async (values: { to: string; amount: number }) => {
      setDone(false);
      txState.reset();
      const to = values.to.trim() as Address;
      const amountWei = parseUnits(String(values.amount), decimals);
      const hash = await actions.mint(to, amountWei);
      if (hash) {
        setDone(true);
        form.resetFields();
        save({
          txHash: hash,
          category: 'Token',
          eventType: 'Mint',
          fromAddress: connectedAddress,
          toAddress: to,
          amount: amountWei.toString(),
        });
      }
    },
    [actions, decimals, txState, form, save, connectedAddress],
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Form form={form} layout="vertical" onFinish={handleMint}>
        <Form.Item
          label={<Text strong>Recipient Address</Text>}
          name="to"
          rules={[
            { required: true, message: 'Enter the recipient address.' },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Enter a valid 0x… address')),
            },
          ]}
        >
          <Input
            placeholder="0xRecipient…"
            size="large"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label={<Text strong>Amount ({symbol || 'tokens'})</Text>}
          name="amount"
          rules={[
            { required: true, message: 'Enter amount to mint.' },
            {
              validator: (_, v) =>
                v > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Amount must be > 0')),
            },
          ]}
        >
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              min={0}
              step={1}
              size="large"
              placeholder="1000"
              style={{ width: '100%' }}
            />

            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 11px',
                border: '1px solid #d9d9d9',
                borderLeft: 'none',
                borderRadius: '0 6px 6px 0',
                background: '#fafafa',
                whiteSpace: 'nowrap',
              }}
            >
              {symbol || 'tokens'}
            </span>
          </Space.Compact>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<PlusCircleOutlined />}
            loading={txState.isPending}
            size="large"
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            {txState.isPending ? 'Minting…' : 'Mint Tokens'}
          </Button>
          {(txState.isSuccess || txState.isError) && (
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                txState.reset();
                setDone(false);
              }}
            >
              Reset
            </Button>
          )}
        </Form.Item>
      </Form>

      {done && (
        <TxResultBanner
          isSuccess={txState.isSuccess}
          isError={txState.isError}
          txHash={txState.txHash}
          errorMessage={txState.errorMessage}
          onReset={() => {
            txState.reset();
            setDone(false);
          }}
          successMsg="Mint successful!"
          explorerUrl={explorerUrl}
          chainName={chain?.name}
        />
      )}
      {!done && txState.isError && (
        <TxResultBanner
          isSuccess={false}
          isError
          errorMessage={txState.errorMessage}
          onReset={() => {
            txState.reset();
            setDone(false);
          }}
          successMsg=""
          explorerUrl={explorerUrl}
          chainName={chain?.name}
        />
      )}
    </Space>
  );
}

// ─── Burn how it works ────────────────────────────────────────────────────────

export function BurnHowItWorksPanel() {
  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #fff1f0, #ffccc7)',
        border: '1px solid #ffa39e',
        height: '100%',
      }}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#ff4d4f' }} />
          <Text strong style={{ color: '#ff4d4f' }}>
            About Burning
          </Text>
        </Space>
        {[
          'Burning permanently destroys tokens from a target wallet.',
          'The caller must be a registered Token Agent.',
          'The target wallet must have sufficient balance.',
          'Burned tokens reduce the total supply permanently.',
        ].map((t, i) => (
          <Space key={i} align="start" size={8}>
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: '50%',
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <Text style={{ fontSize: 13 }}>{t}</Text>
          </Space>
        ))}
        <Alert
          type="warning"
          showIcon
          title="Agent role required"
          description="Only token agents can burn tokens from any wallet."
          style={{ marginTop: 4 }}
        />
      </Space>
    </Card>
  );
}

// ─── Burn form ────────────────────────────────────────────────────────────────

export function BurnForm({
  symbol,
  decimals,
}: {
  symbol: string;
  decimals: number;
}) {
  const [form] = Form.useForm();
  const { actions, txState } = useToken();
  const { chain, address: connectedAddress } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const [done, setDone] = useState(false);
  const { save } = useSaveTransaction();

  const handleBurn = useCallback(
    async (values: { from: string; amount: number }) => {
      setDone(false);
      txState.reset();
      const from = values.from.trim() as Address;
      const amountWei = parseUnits(String(values.amount), decimals);
      const hash = await actions.burn(from, amountWei);
      if (hash) {
        setDone(true);
        form.resetFields();
        save({
          txHash: hash,
          category: 'Token',
          eventType: 'Burn',
          fromAddress: from,
          toAddress: connectedAddress,
          amount: amountWei.toString(),
        });
      }
    },
    [actions, decimals, txState, form, save, connectedAddress],
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Form form={form} layout="vertical" onFinish={handleBurn}>
        <Form.Item
          label={<Text strong>Burn From Address</Text>}
          name="from"
          rules={[
            {
              required: true,
              message: 'Enter the wallet address to burn from.',
            },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Enter a valid 0x… address')),
            },
          ]}
        >
          <Input
            placeholder="0xWallet…"
            size="large"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label={<Text strong>Amount ({symbol || 'tokens'})</Text>}
          name="amount"
          rules={[
            { required: true, message: 'Enter amount to burn.' },
            {
              validator: (_, v) =>
                v > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Amount must be > 0')),
            },
          ]}
        >
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              min={0}
              step={1}
              size="large"
              placeholder="100"
              style={{ width: '100%' }}
            />

            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 11px',
                border: '1px solid #d9d9d9',
                borderLeft: 'none',
                borderRadius: '0 6px 6px 0',
                background: '#fafafa',
                whiteSpace: 'nowrap',
              }}
            >
              {symbol || 'tokens'}
            </span>
          </Space.Compact>
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            danger
            type="primary"
            htmlType="submit"
            icon={<MinusCircleOutlined />}
            loading={txState.isPending}
            size="large"
          >
            {txState.isPending ? 'Burning…' : 'Burn Tokens'}
          </Button>
          {(txState.isSuccess || txState.isError) && (
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                txState.reset();
                setDone(false);
              }}
            >
              Reset
            </Button>
          )}
        </Form.Item>
      </Form>

      {done && (
        <TxResultBanner
          isSuccess={txState.isSuccess}
          isError={txState.isError}
          txHash={txState.txHash}
          errorMessage={txState.errorMessage}
          onReset={() => {
            txState.reset();
            setDone(false);
          }}
          successMsg="Burn successful! Tokens have been destroyed."
          explorerUrl={explorerUrl}
          chainName={chain?.name}
        />
      )}
      {!done && txState.isError && (
        <TxResultBanner
          isSuccess={false}
          isError
          errorMessage={txState.errorMessage}
          onReset={() => {
            txState.reset();
            setDone(false);
          }}
          successMsg=""
          explorerUrl={explorerUrl}
          chainName={chain?.name}
        />
      )}
    </Space>
  );
}
