/**
 * MaxBalancePanel – Admin panel for MaxBalanceModule.
 *
 * Lets the compliance owner set or remove the per-investor maximum balance cap.
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
  ControlOutlined,
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

export function MaxBalancePanel({
  data,
  symbol = 'TKN',
  chainName = 'sepolia',
}: Props) {
  const { maxBalance, actions, txState, decimals } = data;

  const [newMax, setNewMax] = useState<number | null>(null);

  const disabled = txState.isPending || !maxBalance.isBound;

  const handleSet = () => {
    if (newMax === null) return;
    const wei = parseUnits(String(newMax), decimals);
    void actions.setMaxBalance(wei).then(() => {
      setNewMax(null);
      data.refetch();
    });
  };

  const handleRemoveCap = () => {
    void actions.setMaxBalance(BigInt(0)).then(() => data.refetch());
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <ControlOutlined style={{ color: '#faad14' }} />
          <Text strong>Max Balance Module</Text>
          <Tag color="gold">Per-investor cap</Tag>
          <ModuleStatusBadge
            hasAddress={maxBalance.hasAddress}
            isBound={maxBalance.isBound}
            address={maxBalance.address}
          />
        </Space>
      }
      extra={
        <Tooltip title="Caps the maximum token balance any single investor wallet may hold. Set to 0 to remove the cap.">
          <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
        </Tooltip>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Blocks transfers that push a receiver balance above the configured
        maximum. A value of <Text code>0</Text> means no cap.
      </Paragraph>

      {!maxBalance.isBound && maxBalance.hasAddress && (
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
        title="Current max balance"
        value={maxBalance.formattedMaxBalance}
        suffix={maxBalance.maxBalance > BigInt(0) ? symbol : undefined}
        valueStyle={{
          color: maxBalance.maxBalance > BigInt(0) ? '#faad14' : '#8c8c8c',
        }}
      />

      <Divider style={{ margin: '16px 0' }} />

      {/* ── Set new cap ──────────────────────────────────────── */}
      <Text strong style={{ fontSize: 13 }}>
        Set maximum balance
      </Text>
      <Row gutter={[12, 12]} style={{ marginTop: 8 }} align="middle">
        <Col flex="auto">
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={decimals > 4 ? 4 : decimals}
            placeholder={`Max balance in ${symbol} (0 = no cap)`}
            value={newMax}
            onChange={(v) => setNewMax(v)}
            addonAfter={symbol}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<ControlOutlined />}
            loading={txState.isPending}
            disabled={disabled || newMax === null}
            onClick={handleSet}
          >
            Set Cap
          </Button>
        </Col>
        <Col>
          <Tooltip title="Set max balance to 0 — removes the cap entirely">
            <Button
              icon={<DeleteOutlined />}
              danger
              loading={txState.isPending}
              disabled={disabled}
              onClick={handleRemoveCap}
            >
              Remove Cap
            </Button>
          </Tooltip>
        </Col>
      </Row>

      <TxFeedback txState={txState} chainName={chainName} />
    </Card>
  );
}
