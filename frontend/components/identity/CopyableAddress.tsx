import { useState, useCallback } from 'react';
import { Typography, Space, Tooltip } from 'antd';
import { CheckCircleOutlined, CopyOutlined } from '@ant-design/icons';

const { Text } = Typography;

/** Truncated + copyable address cell. */
export function CopyableAddress({
  addr,
  full = false,
}: {
  addr: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [addr]);

  const display = full ? addr : `${addr.slice(0, 10)}…${addr.slice(-8)}`;

  return (
    <Space size={6} align="center">
      <Text style={{ fontFamily: 'monospace', fontSize: 13 }} title={addr}>
        {display}
      </Text>
      <Tooltip title={copied ? 'Copied!' : 'Copy address'}>
        {copied ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
        ) : (
          <CopyOutlined
            style={{ cursor: 'pointer', color: '#1677ff', fontSize: 12 }}
            onClick={copy}
          />
        )}
      </Tooltip>
    </Space>
  );
}
