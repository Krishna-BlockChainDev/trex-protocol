/**
 * ModuleStatusBadge – small pill showing bound / unbound / unconfigured state.
 */

import { Badge, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

type Props = {
  hasAddress: boolean;
  isBound: boolean;
  address: string;
};

export function ModuleStatusBadge({ hasAddress, isBound, address }: Props) {
  if (!hasAddress) {
    return (
      <Tooltip title="Module address not configured in deployed-addresses.sepolia.json">
        <Tag icon={<QuestionCircleOutlined />} color="default">
          Not configured
        </Tag>
      </Tooltip>
    );
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  if (isBound) {
    return (
      <Tooltip title={address}>
        <Badge status="success" />
        <Tag icon={<CheckCircleOutlined />} color="success">
          Bound · {short}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={address}>
      <Badge status="error" />
      <Tag icon={<CloseCircleOutlined />} color="error">
        Not bound · {short}
      </Tag>
    </Tooltip>
  );
}
