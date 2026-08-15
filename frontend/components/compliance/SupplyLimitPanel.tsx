/**
 * SupplyLimitPanel – Admin panel for SupplyLimitModule.
 *
 * Lets the compliance owner set or remove the total supply cap.
 * Setting to 0 removes the cap.
 */

import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  InputNumber,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
  Alert,
  Statistic,
} from 'antd';
import {
  FundOutlined,
  QuestionCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { parseUnits } from 'viem';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import { TxFeedback } from './TxFeedback';
import type { UseComplianceModulesReturn } from '@/hooks/useComplianceModules';

const { Text, Paragraph } = Typography;

type Props = {
  data: UseComplianceModulesReturn;
  symbol?: string;
  chainName?: string;
};

export function SupplyLimitPanel({
  data,
  symbol = 'TKN',
  chainName = 'sepolia',
}: Props) {
  const { supplyLimit, actions, txState, decimals } = data;

  const [newLimit, setNewLimit] = useState<number | null>(null);

  const disabled = txState.isPending || !supplyLimit.isBound;

  const handleSet = () => {
    if (newLimit === null) return;
    const wei = parseUnits(String(newLimit), decimals);
    void actions.setSupplyLimit(wei).then(() => {
      setNewLimit(null);
      data.refetch();
    });
  };

  const handleRemoveLimit = () => {
    void actions.setSupplyLimit(BigInt(0)).then(() => data.refetch());
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <FundOutlined style={{ color: '#722ed1' }} />
          <Text strong>Supply Limit Module</Text>
          <Tag color="purple">Total supply cap</Tag>
          <ModuleStatusBadge
            hasAddress={supplyLimit.hasAddress}
            isBound={supplyLimit.isBound}
            address={supplyLimit.address}
          />
        </Space>
      }
      extra={
        <Tooltip title="Caps the total token supply. Mint operations that would exceed the limit are blocked. Only applies to mint (from == address(0)).">
          <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
        </Tooltip>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Blocks mint operations that would push the total supply above the cap.
        Regular transfers are unaffected. A value of <Text code>0</Text> means
        no limit.
      </Paragraph>

      {!supplyLimit.isBound && supplyLimit.hasAddress && (
        <Alert
          type="warning"
          showIcon
          title="Module not bound to compliance"
          description="Use the Module Binding section to add this module first."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Current value ─────────────────────────────────────── */}
      <Statistic
        title="Current supply limit"
        value={supplyLimit.formattedSupplyLimit}
        suffix={supplyLimit.supplyLimit > BigInt(0) ? symbol : undefined}
        valueStyle={{
          color: supplyLimit.supplyLimit > BigInt(0) ? '#722ed1' : '#8c8c8c',
        }}
      />

      <Divider style={{ margin: '16px 0' }} />

      {/* ── Set new limit ─────────────────────────────────────── */}
      <Text strong style={{ fontSize: 13 }}>
        Set supply limit
      </Text>
      <Row gutter={[12, 12]} style={{ marginTop: 8 }} align="middle">
        <Col flex="auto">
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={decimals > 4 ? 4 : decimals}
            placeholder={`Max supply in ${symbol} (0 = no limit)`}
            value={newLimit}
            onChange={(v) => setNewLimit(v)}
            addonAfter={symbol}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<FundOutlined />}
            loading={txState.isPending}
            disabled={disabled || newLimit === null}
            onClick={handleSet}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
          >
            Set Limit
          </Button>
        </Col>
        <Col>
          <Tooltip title="Set supply limit to 0 — removes the cap entirely">
            <Button
              icon={<DeleteOutlined />}
              danger
              loading={txState.isPending}
              disabled={disabled}
              onClick={handleRemoveLimit}
            >
              Remove Limit
            </Button>
          </Tooltip>
        </Col>
      </Row>

      <TxFeedback txState={txState} chainName={chainName} />
    </Card>
  );
}
