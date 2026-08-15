/**
 * AgentActionsSection.tsx
 * Agent-only token operations:
 *   - Forced Transfer: token.forcedTransfer(from, to, amount)
 *   - Freeze / Unfreeze: token.setAddressFrozen(wallet, bool)
 *   - Pause / Unpause: token.pause() / token.unpause()
 */

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  SwapOutlined,
  LockOutlined,
  UnlockOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  CheckCircleFilled,
  LinkOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { isAddress, parseUnits, type Address } from 'viem';
import { useToken } from '@/hooks/useToken';
import { useSaveTransaction } from '@/hooks/useSaveTransaction';

const { Text, Paragraph } = Typography;

// ─── Shared result banner ─────────────────────────────────────────────────────

function TxBanner({
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
  if (isSuccess && txHash)
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
  if (isError && errorMessage)
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
  return null;
}

// ─── Forced Transfer ──────────────────────────────────────────────────────────

export function ForcedTransferHowItWorksPanel() {
  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #fff7e6, #ffe7ba)',
        border: '1px solid #ffd591',
        height: '100%',
      }}
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#fa8c16' }} />
          <Text strong style={{ color: '#fa8c16' }}>
            About Forced Transfer
          </Text>
        </Space>
        <Paragraph style={{ fontSize: 13, marginBottom: 0 }}>
          An <Text strong>agent</Text> can forcibly move tokens from any wallet
          to another — bypassing the sender's approval. This is used for
          regulatory actions (e.g. court-ordered asset recovery).
        </Paragraph>
        {[
          'Caller must be a Token Agent.',
          'Recipient must be verified.',
          'Sender balance must be sufficient.',
        ].map((t, i) => (
          <Space key={i} align="start" size={8}>
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: '50%',
                background: '#fa8c16',
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
      </Space>
    </Card>
  );
}

export function ForcedTransferForm({
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

  const handleSubmit = useCallback(
    async (values: { from: string; to: string; amount: number }) => {
      setDone(false);
      txState.reset();
      const fromAddr = values.from.trim() as Address;
      const toAddr = values.to.trim() as Address;
      const amountWei = parseUnits(String(values.amount), decimals);
      const hash = await actions.forcedTransfer(fromAddr, toAddr, amountWei);
      if (hash) {
        setDone(true);
        form.resetFields();
        save({
          txHash: hash,
          category: 'Token',
          eventType: 'ForcedTransfer',
          fromAddress: fromAddr,
          toAddress: toAddr,
          amount: amountWei.toString(),
          operatorAddress: connectedAddress,
        });
      }
    },
    [actions, decimals, txState, form, save, connectedAddress],
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title="Agent-only action"
        description="Only token agents can perform forced transfers."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label={<Text strong>From Address</Text>}
              name="from"
              rules={[
                { required: true, message: 'Enter the source address.' },
                {
                  validator: (_, v) =>
                    v && isAddress(v.trim())
                      ? Promise.resolve()
                      : Promise.reject(new Error('Invalid address')),
                },
              ]}
            >
              <Input
                placeholder="0xFrom…"
                size="large"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label={<Text strong>To Address</Text>}
              name="to"
              rules={[
                { required: true, message: 'Enter the recipient address.' },
                {
                  validator: (_, v) =>
                    v && isAddress(v.trim())
                      ? Promise.resolve()
                      : Promise.reject(new Error('Invalid address')),
                },
              ]}
            >
              <Input
                placeholder="0xTo…"
                size="large"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label={<Text strong>Amount ({symbol || 'tokens'})</Text>}
          name="amount"
          rules={[
            { required: true, message: 'Enter amount.' },
            {
              validator: (_, v) =>
                v > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Must be > 0')),
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

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 11px',
                border: '1px solid #d9d9d9',
                borderLeft: 'none',
                borderRadius: '0 6px 6px 0',
                background: '#fafafa',
              }}
            >
              <Text>{symbol || 'tokens'}</Text>
            </div>
          </Space.Compact>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SwapOutlined />}
            loading={txState.isPending}
            size="large"
            style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
          >
            {txState.isPending ? 'Transferring…' : 'Force Transfer'}
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
      <TxBanner
        isSuccess={done && txState.isSuccess}
        isError={txState.isError}
        txHash={txState.txHash}
        errorMessage={txState.errorMessage}
        onReset={() => {
          txState.reset();
          setDone(false);
        }}
        successMsg="Forced transfer complete!"
        explorerUrl={explorerUrl}
        chainName={chain?.name}
      />
    </Space>
  );
}

// ─── Freeze / Unfreeze ────────────────────────────────────────────────────────

export function FreezeHowItWorksPanel() {
  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #f0f5ff, #d6e4ff)',
        border: '1px solid #adc6ff',
        height: '100%',
      }}
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#2f54eb' }} />
          <Text strong style={{ color: '#2f54eb' }}>
            About Freeze / Unfreeze
          </Text>
        </Space>
        <Paragraph style={{ fontSize: 13, marginBottom: 0 }}>
          Freezing a wallet prevents it from sending or receiving tokens. An
          agent can freeze any wallet for compliance reasons and unfreeze it
          later.
        </Paragraph>
        {[
          'Caller must be a Token Agent.',
          'Frozen wallets cannot transfer tokens.',
          'Toggle the switch to freeze or unfreeze.',
        ].map((t, i) => (
          <Space key={i} align="start" size={8}>
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: '50%',
                background: '#2f54eb',
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
      </Space>
    </Card>
  );
}

export function FreezeForm() {
  const [form] = Form.useForm();
  const { actions, txState } = useToken();
  const { chain, address: connectedAddress } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const [done, setDone] = useState(false);
  const [freeze, setFreeze] = useState(true);
  const { save } = useSaveTransaction();

  const handleSubmit = useCallback(
    async (values: { wallet: string }) => {
      setDone(false);
      txState.reset();
      const wallet = values.wallet.trim() as Address;
      const hash = await actions.setAddressFrozen(wallet, freeze);
      if (hash) {
        setDone(true);
        form.resetFields();
        save({
          txHash: hash,
          category: 'Token',
          eventType: freeze ? 'AddressFrozen' : 'AddressUnfrozen',
          fromAddress: connectedAddress,
          toAddress: wallet,
          operatorAddress: connectedAddress,
        });
      }
    },
    [actions, freeze, txState, form, save, connectedAddress],
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title="Agent-only action"
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={<Text strong>Wallet Address</Text>}
          name="wallet"
          rules={[
            { required: true, message: 'Enter a wallet address.' },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Invalid address')),
            },
          ]}
        >
          <Input
            placeholder="0xWallet…"
            size="large"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Form.Item label={<Text strong>Action</Text>}>
          <Space align="center" size={12}>
            <Switch
              checked={freeze}
              onChange={setFreeze}
              checkedChildren={<LockOutlined />}
              unCheckedChildren={<UnlockOutlined />}
            />
            <Tag color={freeze ? 'error' : 'success'}>
              {freeze ? 'Freeze wallet' : 'Unfreeze wallet'}
            </Tag>
          </Space>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={freeze ? <LockOutlined /> : <UnlockOutlined />}
            loading={txState.isPending}
            size="large"
            danger={freeze}
            style={
              freeze ? {} : { background: '#52c41a', borderColor: '#52c41a' }
            }
          >
            {txState.isPending
              ? 'Processing…'
              : freeze
                ? 'Freeze Wallet'
                : 'Unfreeze Wallet'}
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
      <TxBanner
        isSuccess={done && txState.isSuccess}
        isError={txState.isError}
        txHash={txState.txHash}
        errorMessage={txState.errorMessage}
        onReset={() => {
          txState.reset();
          setDone(false);
        }}
        successMsg={`Wallet ${freeze ? 'frozen' : 'unfrozen'} successfully!`}
        explorerUrl={explorerUrl}
        chainName={chain?.name}
      />
    </Space>
  );
}

// ─── Pause / Unpause ──────────────────────────────────────────────────────────

export function PauseHowItWorksPanel({ paused }: { paused: boolean }) {
  return (
    <Card
      size="small"
      style={{
        background: paused
          ? 'linear-gradient(135deg, #fff1f0, #ffccc7)'
          : 'linear-gradient(135deg, #f6ffed, #d9f7be)',
        border: paused ? '1px solid #ffa39e' : '1px solid #b7eb8f',
        height: '100%',
      }}
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined
            style={{ color: paused ? '#ff4d4f' : '#52c41a' }}
          />
          <Text strong style={{ color: paused ? '#ff4d4f' : '#52c41a' }}>
            About Pause / Unpause
          </Text>
        </Space>
        <Paragraph style={{ fontSize: 13, marginBottom: 0 }}>
          Pausing halts <Text strong>all token transfers</Text> globally. No
          wallet can send or receive tokens while the token is paused.
        </Paragraph>
        {[
          'Caller must be the token owner or an agent.',
          'Pause affects all transfers — including compliance-checked ones.',
          'Unpause to resume normal operations.',
        ].map((t, i) => (
          <Space key={i} align="start" size={8}>
            <div
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: '50%',
                background: paused ? '#ff4d4f' : '#52c41a',
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
        <Tag
          color={paused ? 'error' : 'success'}
          style={{ fontSize: 13, padding: '4px 12px' }}
        >
          Current status: {paused ? '⏸ Paused' : '▶ Active'}
        </Tag>
      </Space>
    </Card>
  );
}

export function PauseForm({
  paused,
  onSuccess,
}: {
  paused: boolean;
  onSuccess?: () => void;
}) {
  const { actions, txState } = useToken();
  const { chain, address: connectedAddress } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const [done, setDone] = useState(false);
  const { save } = useSaveTransaction();

  const handleToggle = useCallback(async () => {
    setDone(false);
    txState.reset();
    const hash = paused ? await actions.unpause() : await actions.pause();
    if (hash) {
      setDone(true);
      onSuccess?.();
      save({
        txHash: hash,
        category: 'Token',
        eventType: paused ? 'Unpaused' : 'Paused',
        fromAddress: connectedAddress,
        operatorAddress: connectedAddress,
      });
    }
  }, [actions, paused, txState, onSuccess, save, connectedAddress]);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type={paused ? 'error' : 'info'}
        showIcon
        title={
          paused
            ? 'Token is currently PAUSED — all transfers are blocked.'
            : 'Token is currently ACTIVE — transfers are allowed.'
        }
      />
      <Card style={{ border: `2px solid ${paused ? '#ff4d4f' : '#52c41a'}` }}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 16 }}>
            {paused ? '▶ Unpause Token' : '⏸ Pause Token'}
          </Text>
          <Text type="secondary">
            {paused
              ? 'Click below to resume all token transfers. Ensure the token ecosystem is ready before unpausing.'
              : 'Click below to halt all token transfers globally. Use in emergency situations or for maintenance.'}
          </Text>
          <Button
            type="primary"
            icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            loading={txState.isPending}
            onClick={handleToggle}
            size="large"
            danger={!paused}
            style={
              paused ? { background: '#52c41a', borderColor: '#52c41a' } : {}
            }
          >
            {txState.isPending
              ? paused
                ? 'Unpausing…'
                : 'Pausing…'
              : paused
                ? 'Unpause Token'
                : 'Pause Token'}
          </Button>
          {(txState.isSuccess || txState.isError) && (
            <Button
              onClick={() => {
                txState.reset();
                setDone(false);
              }}
            >
              Reset
            </Button>
          )}
        </Space>
      </Card>
      <TxBanner
        isSuccess={done && txState.isSuccess}
        isError={txState.isError}
        txHash={txState.txHash}
        errorMessage={txState.errorMessage}
        onReset={() => {
          txState.reset();
          setDone(false);
        }}
        successMsg={
          paused
            ? 'Token unpaused — transfers are live!'
            : 'Token paused — all transfers halted.'
        }
        explorerUrl={explorerUrl}
        chainName={chain?.name}
      />
    </Space>
  );
}
