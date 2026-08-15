/**
 * TransferSection.tsx
 * ERC-20 compatible token.transfer(to, amount)
 * Any token holder can call this (subject to compliance checks).
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
  SendOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  LinkOutlined,
} from '@ant-design/icons';
import { usePublicClient, useWalletClient } from 'wagmi';
import { isAddress, parseUnits, type Address } from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import { useTransaction } from '@/hooks/useTransaction';
import { useContracts } from '@/hooks/useContracts';
import { TokenABI } from '@/contracts/token';
import { useSaveTransaction } from '@/hooks/useSaveTransaction';

const { Text } = Typography;

// ─── How it works panel ───────────────────────────────────────────────────────

export function TransferHowItWorksPanel({ symbol }: { symbol: string }) {
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
            How Transfer Works
          </Text>
        </Space>

        {[
          {
            step: '1',
            text: (
              <>
                Enter the <Text strong>recipient address</Text> and the{' '}
                <Text strong>amount</Text> of {symbol || 'tokens'} to send.
              </>
            ),
          },
          {
            step: '2',
            text: (
              <>
                The token calls <Text code>transfer(to, amount)</Text> — the
                standard ERC-20 method.
              </>
            ),
          },
          {
            step: '3',
            text: 'ERC-3643 compliance rules are checked automatically: both sender and receiver must be verified investors.',
          },
          {
            step: '4',
            text: 'If the transfer is compliant, tokens move from your wallet to the recipient.',
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

        <div
          style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          <Text style={{ fontSize: 12, color: '#874d00' }}>
            ⚠️ Both sender and receiver must be{' '}
            <Text strong style={{ color: '#874d00' }}>
              verified
            </Text>{' '}
            in the Identity Registry — otherwise the transfer will revert.
          </Text>
        </div>
      </Space>
    </Card>
  );
}

// ─── Transfer form ────────────────────────────────────────────────────────────

interface TransferFormProps {
  symbol: string;
  decimals: number;
  balance: bigint | undefined;
  formattedBalance: string;
}

export function TransferForm({
  symbol,
  decimals,
  balance,
  formattedBalance,
}: TransferFormProps) {
  const [form] = Form.useForm();
  const { chain, address: connectedAddress } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const rawPublicClient = usePublicClient();
  const { data: rawWalletClient } = useWalletClient();
  const publicClient = rawPublicClient as PublicClient | undefined;
  const walletClient = rawWalletClient as WalletClient | undefined;
  const { addresses } = useContracts();
  const txState = useTransaction();
  const [submitted, setSubmitted] = useState(false);
  const { save } = useSaveTransaction();

  const tokenAddress = addresses?.token as Address | undefined;

  const handleSubmit = useCallback(
    async (values: { to: string; amount: number }) => {
      if (!walletClient || !publicClient || !tokenAddress) return;

      setSubmitted(false);
      txState.reset();

      const to = values.to.trim() as Address;
      const amountWei = parseUnits(String(values.amount), decimals);

      const hash = await txState.execute(async () => {
        const h = await walletClient.writeContract({
          address: tokenAddress,
          abi: TokenABI as Parameters<
            typeof walletClient.writeContract
          >[0]['abi'],
          functionName: 'transfer',
          args: [to, amountWei],
          account: walletClient.account!,
          chain: walletClient.chain,
        });
        return h;
      });

      if (hash) {
        setSubmitted(true);
        form.resetFields();
        save({
          txHash: hash,
          category: 'Token',
          eventType: 'Transfer',
          fromAddress: connectedAddress,
          toAddress: to,
          amount: amountWei.toString(),
        });
      }
    },
    [
      walletClient,
      publicClient,
      tokenAddress,
      decimals,
      txState,
      form,
      save,
      connectedAddress,
    ],
  );

  const notReady = !walletClient || !tokenAddress;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {/* Balance chip */}
      <div>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Your balance:{' '}
        </Text>
        <Text strong>
          {formattedBalance} {symbol}
        </Text>
      </div>

      {notReady && (
        <Alert
          type="warning"
          showIcon
          title="Wallet not connected or token address unavailable."
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
            { required: true, message: 'Enter amount to transfer.' },
            {
              validator: (_, v) =>
                v > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Amount must be greater than 0')),
            },
            {
              validator: (_, v) => {
                if (!balance) return Promise.resolve();
                try {
                  const wei = parseUnits(String(v), decimals);
                  return wei <= balance
                    ? Promise.resolve()
                    : Promise.reject(new Error('Amount exceeds your balance'));
                } catch {
                  return Promise.resolve();
                }
              },
            },
          ]}
        >
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              min={0}
              step={1}
              precision={decimals > 4 ? 4 : decimals}
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
            type="primary"
            htmlType="submit"
            icon={<SendOutlined />}
            loading={txState.isPending}
            disabled={notReady}
            size="large"
          >
            {txState.isPending ? 'Transferring…' : 'Transfer'}
          </Button>
          {(txState.isSuccess || txState.isError) && (
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                txState.reset();
                setSubmitted(false);
              }}
            >
              Reset
            </Button>
          )}
        </Form.Item>
      </Form>

      {/* Success banner */}
      {submitted && txState.isSuccess && txState.txHash && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleFilled />}
          title="Transfer successful!"
          description={
            <Space orientation="vertical" size={4}>
              <Text>
                Tx Hash:{' '}
                <Text code style={{ fontSize: 12 }}>
                  {txState.txHash}
                </Text>
              </Text>
              {explorerUrl && (
                <Tag
                  icon={<LinkOutlined />}
                  color="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    window.open(`${explorerUrl}/tx/${txState.txHash}`, '_blank')
                  }
                >
                  View on {chain?.name ?? 'Explorer'}
                </Tag>
              )}
            </Space>
          }
        />
      )}

      {/* Error banner */}
      {txState.isError && txState.errorMessage && (
        <Alert
          type="error"
          showIcon
          title="Transfer failed"
          description={txState.errorMessage}
          closable
          onClose={txState.reset}
        />
      )}
    </Space>
  );
}
