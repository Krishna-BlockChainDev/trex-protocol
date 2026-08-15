/**
 * CountryAllowPanel – Admin panel for CountryAllowModule.
 *
 * Lets the compliance owner:
 *  - Add / remove individual allowed countries (whitelist)
 *  - Batch-allow or batch-disallow multiple countries
 *  - Query whether a specific country is currently allowed
 *
 * All allow / disallow operations are mirrored to localStorage so the UI
 * always shows which countries are currently on the whitelist without querying
 * the chain for every code individually.
 */

import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  InputNumber,
  Popconfirm,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
  Alert,
} from 'antd';
import {
  GlobalOutlined,
  CheckOutlined,
  QuestionCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import { TxFeedback } from './TxFeedback';
import type { UseComplianceModulesReturn } from '@/hooks/useComplianceModules';
import { useCountryList, countryLabel } from '@/hooks/useCountryList';
import { useTokenRegistryContext } from '@/contexts/TokenRegistryContext';

const { Text, Paragraph } = Typography;

// Common ISO 3166-1 numeric codes for quick-add to the allow list
const PRESET_COUNTRIES: { code: number; name: string }[] = [
  { code: 356, name: 'India' },
  { code: 840, name: 'USA' },
  { code: 826, name: 'UK' },
  { code: 276, name: 'Germany' },
  { code: 250, name: 'France' },
  { code: 392, name: 'Japan' },
  { code: 36, name: 'Australia' },
  { code: 124, name: 'Canada' },
];

type Props = {
  data: UseComplianceModulesReturn;
  chainName?: string;
};

export function CountryAllowPanel({ data, chainName = 'sepolia' }: Props) {
  const { countryAllow, actions, txState } = data;
  const { activeTokenId } = useTokenRegistryContext();

  // ── DB / localStorage list ───────────────────────────────────────────────
  const storageKey = `trex_allowed_countries_${chainName}`;
  const allowedList = useCountryList(activeTokenId, 'countryAllow', storageKey);

  const [singleCountry, setSingleCountry] = useState<number | null>(null);
  const [batchInput, setBatchInput] = useState('');
  const [checkCode, setCheckCode] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const parseBatch = (raw: string): number[] =>
    raw
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n) && n > 0 && n <= 65535);

  const handleCheckCountry = async () => {
    if (checkCode === null) return;
    setCheckLoading(true);
    try {
      const result = await countryAllow.checkCountry(checkCode);
      setCheckResult(result);
    } finally {
      setCheckLoading(false);
    }
  };

  const disabled = txState.isPending || !countryAllow.isBound;

  // ── Action helpers that also update localStorage ─────────────────────────

  const allowOne = (code: number) =>
    actions.allowCountry(code).then((hash) => {
      if (hash) allowedList.add([code]);
      data.refetch();
      return hash;
    });

  const disallowOne = (code: number) =>
    actions.disallowCountry(code).then((hash) => {
      if (hash) allowedList.remove([code]);
      data.refetch();
      return hash;
    });

  const batchAllow = (codes: number[]) =>
    actions.batchAllowCountries(codes).then((hash) => {
      if (hash) allowedList.add(codes);
      data.refetch();
      return hash;
    });

  const batchDisallow = (codes: number[]) =>
    actions.batchDisallowCountries(codes).then((hash) => {
      if (hash) allowedList.remove(codes);
      data.refetch();
      return hash;
    });

  return (
    <Card
      size="small"
      title={
        <Space>
          <GlobalOutlined style={{ color: '#52c41a' }} />
          <Text strong>Country Allow Module</Text>
          <Tag color="green">Whitelist</Tag>
          <ModuleStatusBadge
            hasAddress={countryAllow.hasAddress}
            isBound={countryAllow.isBound}
            address={countryAllow.address}
          />
        </Space>
      }
      extra={
        <Tooltip title="Only investors whose country code is on the allow list can receive tokens. Uses ISO 3166-1 numeric codes.">
          <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
        </Tooltip>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Only transfers to investors whose country is{' '}
        <strong>whitelisted</strong> are permitted. An empty whitelist blocks
        all transfers.
      </Paragraph>

      {!countryAllow.isBound && countryAllow.hasAddress && (
        <Alert
          type="warning"
          showIcon
          title="Module not bound to compliance"
          description="Use the Module Binding section to add this module first."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Allowed Countries List ─────────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Allowed Countries{' '}
          <Tag color="green" style={{ fontSize: 11 }}>
            {allowedList.codes.length}
          </Tag>
        </Text>
        {allowedList.codes.length > 0 && (
          <Popconfirm
            title="Clear all allowed countries from local list?"
            description="This only clears the local record, not the on-chain state."
            onConfirm={() => allowedList.clear()}
            okText="Clear"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" icon={<ClearOutlined />} type="text" danger>
              Clear list
            </Button>
          </Popconfirm>
        )}
      </Row>

      <div
        style={{
          minHeight: 40,
          padding: '8px 10px',
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        {allowedList.codes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                No allowed countries recorded yet. Allow a country to add it
                here.
              </Text>
            }
            style={{ margin: '4px 0' }}
          />
        ) : (
          allowedList.codes.map((code) => (
            <Tag
              key={code}
              color="green"
              closable={!disabled}
              onClose={(e) => {
                e.preventDefault();
                void disallowOne(code);
              }}
              style={{ marginBottom: 4 }}
            >
              <CheckOutlined style={{ marginRight: 3 }} />
              {countryLabel(code)}
            </Tag>
          ))
        )}
      </div>

      {/* ── Quick presets ─────────────────────────────────────── */}
      <Text strong style={{ fontSize: 13 }}>
        Quick presets
      </Text>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        {PRESET_COUNTRIES.map((c) => (
          <Tag
            key={c.code}
            color={allowedList.codes.includes(c.code) ? 'default' : 'green'}
            style={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              marginBottom: 6,
              opacity: allowedList.codes.includes(c.code) ? 0.5 : 1,
            }}
            onClick={() => {
              if (disabled || allowedList.codes.includes(c.code)) return;
              void allowOne(c.code);
            }}
          >
            <PlusOutlined /> {c.name} ({c.code})
          </Tag>
        ))}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* ── Single country ────────────────────────────────────── */}
      <Row gutter={[12, 12]} align="middle">
        <Col flex="auto">
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={65535}
            placeholder="Country code (e.g. 356 = India)"
            value={singleCountry}
            onChange={(v) => setSingleCountry(v)}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={txState.isPending}
            disabled={disabled || singleCountry === null}
            onClick={() => {
              if (singleCountry === null) return;
              void allowOne(singleCountry).then(() => setSingleCountry(null));
            }}
          >
            Allow
          </Button>
        </Col>
        <Col>
          <Button
            icon={<DeleteOutlined />}
            loading={txState.isPending}
            disabled={disabled || singleCountry === null}
            onClick={() => {
              if (singleCountry === null) return;
              void disallowOne(singleCountry).then(() =>
                setSingleCountry(null),
              );
            }}
          >
            Remove
          </Button>
        </Col>
      </Row>

      <Divider style={{ margin: '12px 0' }} />

      {/* ── Batch ─────────────────────────────────────────────── */}
      <Text strong style={{ fontSize: 13 }}>
        Batch (comma or space separated codes)
      </Text>
      <Row gutter={[12, 8]} style={{ marginTop: 8 }} align="middle">
        <Col flex="auto">
          <input
            style={{
              width: '100%',
              padding: '6px 11px',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              fontSize: 14,
              outline: 'none',
            }}
            placeholder="e.g. 356, 840, 826"
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            disabled={disabled || parseBatch(batchInput).length === 0}
            loading={txState.isPending}
            onClick={() =>
              void batchAllow(parseBatch(batchInput)).then(() =>
                setBatchInput(''),
              )
            }
          >
            Batch Allow
          </Button>
        </Col>
        <Col>
          <Button
            disabled={disabled || parseBatch(batchInput).length === 0}
            loading={txState.isPending}
            onClick={() =>
              void batchDisallow(parseBatch(batchInput)).then(() =>
                setBatchInput(''),
              )
            }
          >
            Batch Remove
          </Button>
        </Col>
      </Row>

      <Divider style={{ margin: '12px 0' }} />

      {/* ── Check country ────────────────────────────────────── */}
      <Text strong style={{ fontSize: 13 }}>
        Check a country code
      </Text>
      <Row gutter={[12, 8]} style={{ marginTop: 8 }} align="middle">
        <Col flex="auto">
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={65535}
            placeholder="Country code"
            value={checkCode}
            onChange={(v) => {
              setCheckCode(v);
              setCheckResult(null);
            }}
          />
        </Col>
        <Col>
          <Button
            icon={<CheckOutlined />}
            loading={checkLoading}
            disabled={!countryAllow.hasAddress || checkCode === null}
            onClick={handleCheckCountry}
          >
            Check
          </Button>
        </Col>
        {checkResult !== null && (
          <Col>
            {checkResult ? (
              <Tag color="green">
                <CheckOutlined /> Allowed
              </Tag>
            ) : (
              <Tag color="red">Not allowed</Tag>
            )}
          </Col>
        )}
      </Row>

      <TxFeedback txState={txState} chainName={chainName} />
    </Card>
  );
}
