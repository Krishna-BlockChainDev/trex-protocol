/**
 * TxFeedback – reusable transaction status feedback strip.
 * Shows a spinner while pending, a success alert with Etherscan link,
 * or an error alert on failure.
 */

import { Alert, Spin, Space, Typography } from 'antd';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UseTransactionReturn } from '@/hooks/useTransaction';

const { Text } = Typography;

type Props = {
  txState: UseTransactionReturn;
  /** Chain name used to build the block-explorer link (default: 'sepolia'). */
  chainName?: string;
};

function explorerTxUrl(hash: string, chainName: string): string {
  if (chainName === 'sepolia') return `https://sepolia.etherscan.io/tx/${hash}`;
  if (chainName === 'bscTestnet')
    return `https://testnet.bscscan.com/tx/${hash}`;
  return `#`;
}

export function TxFeedback({ txState, chainName = 'sepolia' }: Props) {
  const { isPending, isSuccess, isError, errorMessage, txHash } = txState;

  if (!isPending && !isSuccess && !isError) return null;

  if (isPending) {
    return (
      <Space size={8} style={{ marginTop: 12 }}>
        <Spin indicator={<LoadingOutlined spin />} size="small" />
        <Text type="secondary">
          {txHash
            ? 'Waiting for on-chain confirmation…'
            : 'Waiting for wallet confirmation…'}
        </Text>
        {txHash && (
          <a
            href={explorerTxUrl(txHash, chainName)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12 }}
          >
            View on Explorer ↗
          </a>
        )}
      </Space>
    );
  }

  if (isSuccess && txHash) {
    return (
      <Alert
        type="success"
        icon={<CheckCircleOutlined />}
        showIcon
        style={{ marginTop: 12 }}
        title="Transaction confirmed"
        description={
          <a
            href={explorerTxUrl(txHash, chainName)}
            target="_blank"
            rel="noreferrer"
          >
            {`${txHash.slice(0, 10)}…${txHash.slice(-6)}`} ↗
          </a>
        }
      />
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        style={{ marginTop: 12 }}
        title="Transaction failed"
        description={errorMessage ?? 'An unknown error occurred.'}
      />
    );
  }

  return null;
}
