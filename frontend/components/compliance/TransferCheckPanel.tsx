/**
 * TransferCheckPanel – User-facing compliance check + transfer panel.
 *
 * Two sections:
 *  1. canTransfer() check — real-time compliance validation before sending
 *  2. Token transfer form — calls token.transfer(to, amount)
 */

import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  InputNumber,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { type Address, parseUnits, isAddress } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import type { PublicClient, WalletClient } from 'viem';
import { useContracts } from '@/hooks/useContracts';
import { useToken } from '@/hooks/useToken';
import { useTransaction } from '@/hooks/useTransaction';
import { ComplianceABI } from '@/contracts';
import { TxFeedback } from './TxFeedback';

const { Text, Paragraph } = Typography;

type CanTransferResult = 'idle' | 'loading' | 'allowed' | 'blocked' | 'error';

type Props = {
  chainName?: string;
};

export function TransferCheckPanel({ chainName = 'sepolia' }: Props) {
  const { addresses } = useContracts();
  const { info, balance, formattedTokenBalance } = useToken();
  const txState = useTransaction();

  const rawPublicClient = usePublicClient();
  const { data: rawWalletClient } = useWalletClient();
  const publicClient = rawPublicClient as PublicClient | undefined;
  const walletClient = rawWalletClient as WalletClient | undefined;

  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<CanTransferResult>('idle');
  const [checkError, setCheckError] = useState('');

  const symbol = info?.symbol ?? 'TKN';
  const decimals = info?.decimals ?? 18;
  const complianceAddr = addresses?.compliance as Address | undefined;

  const validTo = isAddress(toAddress);
  const validAmount = amount !== null && amount > 0;

  // ── canTransfer check ─────────────────────────────────────────────────────

  const handleCheck = async () => {
    if (
      !publicClient ||
      !complianceAddr ||
      !walletClient?.account ||
      !validTo ||
      !validAmount
    )
      return;
    setCheckResult('loading');
    setCheckError('');
    try {
      const amountWei = parseUnits(String(amount), decimals);
      const result = (await publicClient.readContract({
        address: complianceAddr,
        abi: ComplianceABI,
        functionName: 'canTransfer',
        args: [walletClient.account.address, toAddress as Address, amountWei],
      } as Parameters<typeof publicClient.readContract>[0])) as boolean;
      setCheckResult(result ? 'allowed' : 'blocked');
    } catch (err: unknown) {
      setCheckError(err instanceof Error ? err.message : String(err));
      setCheckResult('error');
    }
  };

  // ── Transfer ──────────────────────────────────────────────────────────────

  const handleTransfer = () => {
    if (
      !walletClient ||
      !publicClient ||
      !addresses?.token ||
      !validTo ||
      !validAmount
    )
      return;
    const tokenAddr = addresses.token as Address;
    const amountWei = parseUnits(String(amount), decimals);

    void txState.execute(async () => {
      const hash = await walletClient.writeContract({
        address: tokenAddr,
        abi: [
          {
            inputs: [
              { internalType: 'address', name: '_to', type: 'address' },
              { internalType: 'uint256', name: '_amount', type: 'uint256' },
            ],
            name: 'transfer',
            outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'transfer',
        args: [toAddress as Address, amountWei],
        account: walletClient.account!,
        chain: walletClient.chain,
      } as Parameters<typeof walletClient.writeContract>[0]);
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    });
  };

  const maxBalance =
    balance !== undefined
      ? parseFloat(
          (Number(balance) / 10 ** decimals).toFixed(decimals),
        ).toString()
      : undefined;

  return (
    <Card
      size="small"
      title={
        <Space>
          <SendOutlined style={{ color: '#1677ff' }} />
          <Text strong>Compliance Transfer Check</Text>
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Validate a transfer against all bound compliance modules before sending.
        Your current balance:{' '}
        <Text strong>
          {formattedTokenBalance} {symbol}
        </Text>
      </Paragraph>

      {/* ── Recipient + Amount ───────────────────────────────── */}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={14}>
          <Text
            style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
            type="secondary"
          >
            Recipient address
          </Text>
          <input
            style={{
              width: '100%',
              padding: '6px 11px',
              border: `1px solid ${validTo || !toAddress ? '#d9d9d9' : '#ff4d4f'}`,
              borderRadius: 6,
              fontSize: 14,
              outline: 'none',
              fontFamily: 'monospace',
            }}
            placeholder="0x…"
            value={toAddress}
            onChange={(e) => {
              setToAddress(e.target.value);
              setCheckResult('idle');
            }}
          />
          {toAddress && !validTo && (
            <Text type="danger" style={{ fontSize: 11 }}>
              Invalid address
            </Text>
          )}
        </Col>
        <Col xs={24} md={10}>
          <Text
            style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
            type="secondary"
          >
            Amount ({symbol})
          </Text>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={maxBalance ? parseFloat(maxBalance) : undefined}
            precision={4}
            placeholder={`Amount in ${symbol}`}
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setCheckResult('idle');
            }}
          />
        </Col>
      </Row>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── Action buttons ──────────────────────────────────── */}
      <Row gutter={[12, 12]}>
        <Col>
          <Button
            icon={
              checkResult === 'loading' ? (
                <Spin indicator={<LoadingOutlined spin />} size="small" />
              ) : (
                <CheckCircleOutlined />
              )
            }
            disabled={
              !validTo ||
              !validAmount ||
              !complianceAddr ||
              checkResult === 'loading'
            }
            onClick={() => void handleCheck()}
          >
            Check Compliance
          </Button>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={txState.isPending}
            disabled={
              !validTo || !validAmount || !walletClient || txState.isPending
            }
            onClick={handleTransfer}
          >
            Transfer
          </Button>
        </Col>
      </Row>

      {/* ── canTransfer result ──────────────────────────────── */}
      {checkResult === 'allowed' && (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginTop: 12 }}
          title="Transfer allowed"
          description="All compliance modules permit this transfer."
        />
      )}
      {checkResult === 'blocked' && (
        <Alert
          type="error"
          icon={<CloseCircleOutlined />}
          showIcon
          style={{ marginTop: 12 }}
          title="Transfer blocked by compliance"
          description="At least one compliance module rejected this transfer. Check country restrictions, max balance, or supply limits."
        />
      )}
      {checkResult === 'error' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          title="Compliance check failed"
          description={
            checkError ||
            'Could not call canTransfer. Ensure the compliance contract is accessible.'
          }
        />
      )}

      <TxFeedback txState={txState} chainName={chainName} />

      {/* ── Module status summary ───────────────────────────── */}
      <Divider style={{ margin: '16px 0' }} />
      <Space wrap>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Active compliance:
        </Text>
        {complianceAddr ? (
          <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {`${complianceAddr.slice(0, 8)}…${complianceAddr.slice(-6)}`}
          </Tag>
        ) : (
          <Tag color="default">No compliance</Tag>
        )}
      </Space>
    </Card>
  );
}
