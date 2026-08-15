/**
 * ModuleBindingPanel – Admin panel to add/remove modules from ModularCompliance.
 *
 * Shows each of the four module slots with their bound status and
 * Add / Remove buttons. Derives the currently-bound list from the
 * module state already fetched by useComplianceModules – no extra RPC call needed.
 */

import {
  Button,
  Card,
  Col,
  Row,
  Space,
  Tag,
  Typography,
  Divider,
  Alert,
} from 'antd';
import {
  LinkOutlined,
  DisconnectOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import type { Address } from 'viem';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import { TxFeedback } from './TxFeedback';
import type { UseComplianceModulesReturn } from '@/hooks/useComplianceModules';

const { Text, Paragraph } = Typography;

const MODULE_META: Array<{
  key:
    | 'countryRestrictModule'
    | 'countryAllowModule'
    | 'maxBalanceModule'
    | 'supplyLimitModule';
  stateKey: 'countryRestrict' | 'countryAllow' | 'maxBalance' | 'supplyLimit';
  label: string;
  color: string;
}> = [
  {
    key: 'countryRestrictModule',
    stateKey: 'countryRestrict',
    label: 'CountryRestrictModule',
    color: '#ff4d4f',
  },
  {
    key: 'countryAllowModule',
    stateKey: 'countryAllow',
    label: 'CountryAllowModule',
    color: '#52c41a',
  },
  {
    key: 'maxBalanceModule',
    stateKey: 'maxBalance',
    label: 'MaxBalanceModule',
    color: '#faad14',
  },
  {
    key: 'supplyLimitModule',
    stateKey: 'supplyLimit',
    label: 'SupplyLimitModule',
    color: '#722ed1',
  },
];

type Props = {
  data: UseComplianceModulesReturn;
  chainName?: string;
};

export function ModuleBindingPanel({ data, chainName = 'sepolia' }: Props) {
  const {
    countryRestrict,
    countryAllow,
    maxBalance,
    supplyLimit,
    actions,
    txState,
    refetch,
  } = data;

  const moduleStateMap = {
    countryRestrict,
    countryAllow,
    maxBalance,
    supplyLimit,
  } as const;

  // Derive bound-module addresses from already-fetched state
  const boundAddresses = MODULE_META.map((m) => moduleStateMap[m.stateKey])
    .filter((s) => s.hasAddress && s.isBound)
    .map((s) => s.address);

  const isPending = txState.isPending;

  function handleAdd(address: string) {
    void actions.addModule(address as Address).then(() => {
      refetch();
    });
  }

  function handleRemove(address: string) {
    void actions.removeModule(address as Address).then(() => {
      refetch();
    });
  }

  return (
    <Card
      size="small"
      title={
        <Space>
          <SafetyOutlined style={{ color: '#1677ff' }} />
          <Text strong>Module Binding</Text>
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Bind or unbind compliance modules from the ModularCompliance proxy. Only
        the compliance owner can perform these operations.
      </Paragraph>

      {/* ── Module slots ──────────────────────────────────────── */}
      {MODULE_META.map((meta) => {
        const state = moduleStateMap[meta.stateKey];

        return (
          <Row
            key={meta.key}
            gutter={[12, 8]}
            align="middle"
            style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}
          >
            <Col flex="auto">
              <Space orientation="vertical" size={2}>
                <Text strong style={{ fontSize: 13, color: meta.color }}>
                  {meta.label}
                </Text>
                <ModuleStatusBadge
                  hasAddress={state.hasAddress}
                  isBound={state.isBound}
                  address={state.address}
                />
              </Space>
            </Col>
            <Col>
              {state.hasAddress && !state.isBound && (
                <Button
                  type="primary"
                  size="small"
                  icon={<LinkOutlined />}
                  loading={isPending}
                  onClick={() => {
                    handleAdd(state.address);
                  }}
                >
                  Add
                </Button>
              )}
              {state.hasAddress && state.isBound && (
                <Button
                  size="small"
                  danger
                  icon={<DisconnectOutlined />}
                  loading={isPending}
                  onClick={() => {
                    handleRemove(state.address);
                  }}
                >
                  Remove
                </Button>
              )}
              {!state.hasAddress && (
                <Tag color="default" style={{ fontSize: 11 }}>
                  No address configured
                </Tag>
              )}
            </Col>
          </Row>
        );
      })}

      {/* ── Currently bound summary ────────────────────────────── */}
      {boundAddresses.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 8px' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Bound modules ({boundAddresses.length}):
          </Text>
          <div style={{ marginTop: 6 }}>
            {boundAddresses.map((addr) => (
              <Tag
                key={addr}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  marginBottom: 4,
                }}
                color="blue"
              >
                {`${addr.slice(0, 10)}…${addr.slice(-6)}`}
              </Tag>
            ))}
          </div>
        </>
      )}

      {boundAddresses.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          title="No modules bound"
          description="Add at least one compliance module using the buttons above."
        />
      )}

      <TxFeedback txState={txState} chainName={chainName} />
    </Card>
  );
}
