/**
 * IdentityHistoryTable – shows ALL identities across every ecosystem on the
 * connected chain (not filtered by the active ecosystem).
 *
 * Each row has an editable "Investor Name" field backed by localStorage
 * under the key `trex_investor_name_${wallet.toLowerCase()}`.
 */

import { useState, useCallback } from 'react';
import { Typography, Card, Space, Table, Tag, Tooltip, Input } from 'antd';
import {
  HistoryOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { CopyableAddress } from './CopyableAddress';
import { readInvestorName, writeInvestorName } from '@/lib/investorName';
import type { DbIdentity } from '@/lib/api/identities';

const { Text } = Typography;

// ─── InvestorNameCell ─────────────────────────────────────────────────────────

function InvestorNameCell({ wallet }: { wallet: string }) {
  const [name, setName] = useState<string>(() => readInvestorName(wallet));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = useCallback(() => {
    setDraft(name);
    setEditing(true);
  }, [name]);

  const commit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      writeInvestorName(wallet, trimmed);
      setName(trimmed);
      setEditing(false);
    },
    [wallet],
  );

  if (editing) {
    return (
      <Input
        autoFocus
        size="small"
        value={draft}
        maxLength={40}
        placeholder="Investor name…"
        style={{ width: 160 }}
        prefix={<UserOutlined style={{ color: '#aaa', fontSize: 11 }} />}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onPressEnter={() => commit(draft)}
      />
    );
  }

  return (
    <Space size={6}>
      {name ? (
        <Text style={{ fontSize: 13 }}>{name}</Text>
      ) : (
        <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
          —
        </Text>
      )}
      <Tooltip title={name ? 'Edit name' : 'Set investor name'}>
        <EditOutlined
          style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer' }}
          onClick={startEdit}
        />
      </Tooltip>
    </Space>
  );
}

// ─── IdentityHistoryTable ─────────────────────────────────────────────────────

export function IdentityHistoryTable({
  identities,
  onRefresh,
}: {
  /** All DbIdentity rows for the connected chain (cross-ecosystem). */
  identities: DbIdentity[];
  onRefresh?: () => void;
}) {
  if (identities.length === 0) return null;

  const columns = [
    {
      title: 'Investor Name',
      key: 'name',
      width: 180,
      render: (_: unknown, record: DbIdentity) => (
        <InvestorNameCell wallet={record.walletAddress} />
      ),
    },
    {
      title: 'Investor Wallet',
      dataIndex: 'walletAddress',
      key: 'walletAddress',
      render: (w: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {`${w.slice(0, 10)}…${w.slice(-8)}`}
          <Tooltip title="Copy full address">
            <CopyOutlined
              style={{
                marginLeft: 6,
                cursor: 'pointer',
                color: '#1677ff',
                fontSize: 11,
              }}
              onClick={() => navigator.clipboard.writeText(w).catch(() => {})}
            />
          </Tooltip>
        </Text>
      ),
    },
    {
      title: 'Identity Contract',
      dataIndex: 'identityAddress',
      key: 'identityAddress',
      render: (id: string) => <CopyableAddress addr={id} />,
    },
    {
      title: 'Ecosystem',
      key: 'ecosystem',
      width: 160,
      render: (_: unknown, record: DbIdentity) => {
        const eco = record.ecosystem;
        if (!eco)
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              —
            </Text>
          );
        return (
          <Tooltip title={`ecosystem id: ${eco.id}`}>
            <Tag color="blue" style={{ fontSize: 11 }}>
              {eco.name} ({eco.symbol})
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: () => (
        <Tag icon={<CheckCircleOutlined />} color="success">
          Deployed
        </Tag>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined style={{ color: '#722ed1' }} />
          <Text strong>Created Identities</Text>
          <Tag color="purple">{identities.length} total</Tag>
        </Space>
      }
      size="small"
      extra={
        onRefresh && (
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            title="Refresh table"
          />
        )
      }
    >
      <Table
        size="small"
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        rowKey="id"
        columns={columns}
        dataSource={identities}
      />
    </Card>
  );
}
