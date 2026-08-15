/**
 * CountryRestrictPanel – Admin panel for CountryRestrictModule.
 *
 * Lets the compliance owner:
 *  - Add / remove individual country restrictions
 *  - Batch-restrict or batch-unrestrict multiple countries at once
 *  - Query whether a specific country is currently restricted
 *
 * All restrict / unrestrict operations are mirrored to localStorage so the UI
 * always shows which countries are currently on the blacklist without having to
 * query the chain for every code individually.
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
  StopOutlined,
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

// Common ISO 3166-1 numeric codes for quick-add
const PRESET_COUNTRIES: { code: number; name: string }[] = [
  { code: 364, name: 'Iran' },
  { code: 408, name: 'North Korea' },
  { code: 862, name: 'Venezuela' },
  { code: 112, name: 'Belarus' },
  { code: 643, name: 'Russia' },
  { code: 760, name: 'Syria' },
  { code: 192, name: 'Cuba' },
  { code: 716, name: 'Zimbabwe' },
];

type Props = {
  data: UseComplianceModulesReturn;
  chainName?: string;
};

export function CountryRestrictPanel({ data, chainName = 'sepolia' }: Props) {
  const { countryRestrict, actions, txState } = data;
  const { activeTokenId } = useTokenRegistryContext();

  // ── DB / localStorage list ───────────────────────────────────────────────
  const storageKey = `trex_restricted_countries_${chainName}`;
  const restrictedList = useCountryList(
    activeTokenId,
    'countryRestrict',
    storageKey,
  );

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
      const result = await countryRestrict.checkCountry(checkCode);
      setCheckResult(result);
    } finally {
      setCheckLoading(false);
    }
  };

  const disabled = txState.isPending || !countryRestrict.isBound;

  // ── Action helpers that also update localStorage ─────────────────────────

  const restrictOne = (code: number) =>
    actions.restrictCountry(code).then((hash) => {
      if (hash) restrictedList.add([code]);
      data.refetch();
      return hash;
    });

  const unrestrictOne = (code: number) =>
    actions.unrestrictCountry(code).then((hash) => {
      if (hash) restrictedList.remove([code]);
      data.refetch();
      return hash;
    });

  const batchRestrict = (codes: number[]) =>
    actions.batchRestrictCountries(codes).then((hash) => {
      if (hash) restrictedList.add(codes);
      data.refetch();
      return hash;
    });

  const batchUnrestrict = (codes: number[]) =>
    actions.batchUnrestrictCountries(codes).then((hash) => {
      if (hash) restrictedList.remove(codes);
      data.refetch();
      return hash;
    });

  return (
    <Card
      size="small"
      title={
        <Space>
          <StopOutlined style={{ color: '#ff4d4f' }} />
          <Text strong>Country Restrict Module</Text>
          <Tag color="red">Blacklist</Tag>
          <ModuleStatusBadge
            hasAddress={countryRestrict.hasAddress}
            isBound={countryRestrict.isBound}
            address={countryRestrict.address}
          />
        </Space>
      }
      extra={
        <Tooltip title="Blocks transfers to receivers in any restricted country. Uses ISO 3166-1 numeric codes.">
          <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
        </Tooltip>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Transfers to investors whose country code is on the{' '}
        <strong>blacklist</strong> are blocked. Configure via the compliance
        owner wallet.
      </Paragraph>

      {!countryRestrict.isBound && countryRestrict.hasAddress && (
        <Alert
          type="warning"
          showIcon
          title="Module not bound to compliance"
          description="Use the Module Binding section to add this module first."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Restricted Countries List ──────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Restricted Countries{' '}
          <Tag color="red" style={{ fontSize: 11 }}>
            {restrictedList.codes.length}
          </Tag>
        </Text>
        {restrictedList.codes.length > 0 && (
          <Popconfirm
            title="Clear all restricted countries from local list?"
            description="This only clears the local record, not the on-chain state."
            onConfirm={() => restrictedList.clear()}
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
          background: '#fff1f0',
          border: '1px solid #ffa39e',
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        {restrictedList.codes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                No restricted countries recorded yet. Restrict a country to add
                it here.
              </Text>
            }
            style={{ margin: '4px 0' }}
          />
        ) : (
          restrictedList.codes.map((code) => (
            <Tag
              key={code}
              color="red"
              closable={!disabled}
              onClose={(e) => {
                e.preventDefault();
                void unrestrictOne(code);
              }}
              style={{ marginBottom: 4 }}
            >
              <StopOutlined style={{ marginRight: 3 }} />
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
            color={restrictedList.codes.includes(c.code) ? 'default' : 'red'}
            style={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              marginBottom: 6,
              opacity: restrictedList.codes.includes(c.code) ? 0.5 : 1,
            }}
            onClick={() => {
              if (disabled || restrictedList.codes.includes(c.code)) return;
              void restrictOne(c.code);
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
            danger
            icon={<StopOutlined />}
            loading={txState.isPending}
            disabled={disabled || singleCountry === null}
            onClick={() => {
              if (singleCountry === null) return;
              void restrictOne(singleCountry).then(() =>
                setSingleCountry(null),
              );
            }}
          >
            Restrict
          </Button>
        </Col>
        <Col>
          <Button
            icon={<DeleteOutlined />}
            loading={txState.isPending}
            disabled={disabled || singleCountry === null}
            onClick={() => {
              if (singleCountry === null) return;
              void unrestrictOne(singleCountry).then(() =>
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
            placeholder="e.g. 364, 408, 862"
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
          />
        </Col>
        <Col>
          <Button
            type="primary"
            danger
            disabled={disabled || parseBatch(batchInput).length === 0}
            loading={txState.isPending}
            onClick={() =>
              void batchRestrict(parseBatch(batchInput)).then(() =>
                setBatchInput(''),
              )
            }
          >
            Batch Restrict
          </Button>
        </Col>
        <Col>
          <Button
            disabled={disabled || parseBatch(batchInput).length === 0}
            loading={txState.isPending}
            onClick={() =>
              void batchUnrestrict(parseBatch(batchInput)).then(() =>
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
            disabled={!countryRestrict.hasAddress || checkCode === null}
            onClick={handleCheckCountry}
          >
            Check
          </Button>
        </Col>
        {checkResult !== null && (
          <Col>
            {checkResult ? (
              <Tag color="red">
                <StopOutlined /> Restricted
              </Tag>
            ) : (
              <Tag color="green">
                <CheckOutlined /> Not restricted
              </Tag>
            )}
          </Col>
        )}
      </Row>

      <TxFeedback txState={txState} chainName={chainName} />
    </Card>
  );
}
