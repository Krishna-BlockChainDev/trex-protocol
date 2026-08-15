/**
 * ManageAgentsSection.tsx
 *
 * Reusable component for the contract owner to add / remove agents on either:
 *   - The Token contract   (contractType="token")
 *   - The IdentityRegistry (contractType="identityRegistry")
 *
 * Includes:
 *   - Add Agent form (owner-only)
 *   - Remove Agent form (owner-only)
 *   - isAgent lookup (anyone can check)
 *   - "What can agents do?" info panel
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  UserAddOutlined,
  UserDeleteOutlined,
  SearchOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LinkOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { isAddress, type Address } from 'viem';
import { useAccount } from 'wagmi';
import { useAgents } from '@/hooks/useAgents';

const { Text, Paragraph } = Typography;

// ─── Props ────────────────────────────────────────────────────────────────────

export type ManageAgentsSectionProps = {
  /**
   * Which contract to manage agents on.
   * "token"            → uses Token.addAgent / Token.removeAgent
   * "identityRegistry" → uses IdentityRegistry.addAgent / IdentityRegistry.removeAgent
   */
  contractType: 'token' | 'identityRegistry';
};

// ─── Agent Powers info panel ──────────────────────────────────────────────────

function AgentPowersPanel({
  contractType,
}: {
  contractType: 'token' | 'identityRegistry';
}) {
  const isToken = contractType === 'token';
  const color = isToken ? '#1677ff' : '#722ed1';
  const bgGradient = isToken
    ? 'linear-gradient(135deg, #f0f5ff, #e6f7ff)'
    : 'linear-gradient(135deg, #f9f0ff, #efdbff)';
  const borderColor = isToken ? '#91caff' : '#d3adf7';

  const powers = isToken
    ? [
        { icon: '🪙', label: 'Mint tokens to any verified wallet' },
        { icon: '🔥', label: 'Burn tokens from any wallet' },
        { icon: '↔️', label: 'Forced transfer between wallets' },
        { icon: '🔒', label: 'Freeze / unfreeze wallet addresses' },
        { icon: '⏸', label: 'Pause and unpause all token transfers' },
      ]
    : [
        { icon: '🆔', label: 'Register investor identity in the registry' },
        { icon: '🗑', label: 'Delete investor identity from the registry' },
        { icon: '✏️', label: 'Update identity contract for a wallet' },
        { icon: '🌍', label: 'Update investor country code' },
        { icon: '📦', label: 'Batch register multiple identities at once' },
      ];

  return (
    <Card
      size="small"
      style={{
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        height: '100%',
      }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space>
          <InfoCircleOutlined style={{ color }} />
          <Text strong style={{ color }}>
            What can agents do?
          </Text>
          <Tag color={isToken ? 'blue' : 'purple'} style={{ margin: 0 }}>
            {isToken ? 'Token Agent' : 'Registry Agent'}
          </Tag>
        </Space>
        <Paragraph style={{ fontSize: 13, marginBottom: 0 }}>
          {isToken
            ? 'Token agents have elevated privileges to manage the token lifecycle on behalf of the token owner.'
            : 'Registry agents can manage investor identity records within the IdentityRegistry on behalf of the owner.'}
        </Paragraph>
        <Divider style={{ margin: '4px 0' }} />
        {powers.map((p) => (
          <Space key={p.label} align="start" size={8}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{p.icon}</span>
            <Text style={{ fontSize: 13 }}>{p.label}</Text>
          </Space>
        ))}
        <Divider style={{ margin: '4px 0' }} />
        <Alert
          type="warning"
          showIcon
          icon={<CrownOutlined />}
          style={{ fontSize: 12 }}
          description={
            <Text style={{ fontSize: 12 }}>
              Only the <Text strong>contract owner</Text> can add or remove
              agents. Agents do not have owner-level privileges such as changing
              the compliance or registry contracts.
            </Text>
          }
        />
      </Space>
    </Card>
  );
}

// ─── Tx result banner ─────────────────────────────────────────────────────────

function TxBanner({
  isSuccess,
  isError,
  txHash,
  errorMessage,
  onReset,
  successMsg,
  explorerUrl,
  chainName,
}: {
  isSuccess: boolean;
  isError: boolean;
  txHash?: string;
  errorMessage?: string | null;
  onReset: () => void;
  successMsg: string;
  explorerUrl?: string;
  chainName?: string;
}) {
  if (isSuccess && txHash)
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleFilled />}
        message={successMsg}
        description={
          <Space direction="vertical" size={4}>
            <Text code style={{ fontSize: 12 }}>
              {txHash}
            </Text>
            {explorerUrl && (
              <Tag
                icon={<LinkOutlined />}
                color="blue"
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  window.open(`${explorerUrl}/tx/${txHash}`, '_blank')
                }
              >
                View on {chainName ?? 'Explorer'}
              </Tag>
            )}
          </Space>
        }
      />
    );
  if (isError && errorMessage)
    return (
      <Alert
        type="error"
        showIcon
        message="Transaction failed"
        description={errorMessage}
        closable
        onClose={onReset}
      />
    );
  return null;
}

// ─── Add Agent form ────────────────────────────────────────────────────────────

function AddAgentForm({
  contractType,
}: {
  contractType: 'token' | 'identityRegistry';
}) {
  const [form] = Form.useForm();
  const { token, identityRegistry } = useAgents();
  const { chain } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const [done, setDone] = useState(false);

  const ctx = contractType === 'token' ? token : identityRegistry;

  const handleSubmit = useCallback(
    async (values: { agent: string }) => {
      setDone(false);
      ctx.txState.reset();
      const hash = await ctx.addAgent(values.agent.trim() as Address);
      if (hash) {
        setDone(true);
        form.resetFields();
      }
    },
    [ctx, form],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        icon={<CrownOutlined />}
        message="Owner-only action"
        description="Only the contract owner can add agents. The connected wallet must be the owner."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={<Text strong>Agent Wallet Address</Text>}
          name="agent"
          rules={[
            { required: true, message: 'Enter the agent wallet address.' },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Invalid Ethereum address')),
            },
          ]}
          extra="The wallet that will receive agent privileges."
        >
          <Input
            placeholder="0xAgent…"
            size="large"
            prefix={<UserAddOutlined style={{ color: '#52c41a' }} />}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<UserAddOutlined />}
            loading={ctx.txState.isPending}
            size="large"
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            {ctx.txState.isPending ? 'Adding Agent…' : 'Add Agent'}
          </Button>
          {(ctx.txState.isSuccess || ctx.txState.isError) && (
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                ctx.txState.reset();
                setDone(false);
              }}
            >
              Reset
            </Button>
          )}
        </Form.Item>
      </Form>
      <TxBanner
        isSuccess={done && ctx.txState.isSuccess}
        isError={ctx.txState.isError}
        txHash={ctx.txState.txHash}
        errorMessage={ctx.txState.errorMessage}
        onReset={() => {
          ctx.txState.reset();
          setDone(false);
        }}
        successMsg="Agent added successfully!"
        explorerUrl={explorerUrl}
        chainName={chain?.name}
      />
    </Space>
  );
}

// ─── Remove Agent form ────────────────────────────────────────────────────────

function RemoveAgentForm({
  contractType,
}: {
  contractType: 'token' | 'identityRegistry';
}) {
  const [form] = Form.useForm();
  const { token, identityRegistry } = useAgents();
  const { chain } = useAccount();
  const explorerUrl = chain?.blockExplorers?.default?.url;
  const [done, setDone] = useState(false);

  const ctx = contractType === 'token' ? token : identityRegistry;

  const handleSubmit = useCallback(
    async (values: { agent: string }) => {
      setDone(false);
      ctx.txState.reset();
      const hash = await ctx.removeAgent(values.agent.trim() as Address);
      if (hash) {
        setDone(true);
        form.resetFields();
      }
    },
    [ctx, form],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="Owner-only action"
        description="Removing an agent immediately revokes all their agent-level privileges on this contract."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={<Text strong>Agent Wallet Address</Text>}
          name="agent"
          rules={[
            { required: true, message: 'Enter the agent wallet address.' },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Invalid Ethereum address')),
            },
          ]}
          extra="The agent wallet whose privileges will be revoked."
        >
          <Input
            placeholder="0xAgent…"
            size="large"
            prefix={<UserDeleteOutlined style={{ color: '#ff4d4f' }} />}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<UserDeleteOutlined />}
            loading={ctx.txState.isPending}
            size="large"
            danger
          >
            {ctx.txState.isPending ? 'Removing Agent…' : 'Remove Agent'}
          </Button>
          {(ctx.txState.isSuccess || ctx.txState.isError) && (
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                ctx.txState.reset();
                setDone(false);
              }}
            >
              Reset
            </Button>
          )}
        </Form.Item>
      </Form>
      <TxBanner
        isSuccess={done && ctx.txState.isSuccess}
        isError={ctx.txState.isError}
        txHash={ctx.txState.txHash}
        errorMessage={ctx.txState.errorMessage}
        onReset={() => {
          ctx.txState.reset();
          setDone(false);
        }}
        successMsg="Agent removed successfully!"
        explorerUrl={explorerUrl}
        chainName={chain?.name}
      />
    </Space>
  );
}

// ─── Check isAgent form ───────────────────────────────────────────────────────

function CheckAgentForm({
  contractType,
}: {
  contractType: 'token' | 'identityRegistry';
}) {
  const [form] = Form.useForm();
  const { checkIsTokenAgent, checkIsIRAgent } = useAgents();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<boolean | undefined>(undefined);
  const [checkedAddress, setCheckedAddress] = useState('');

  const handleCheck = useCallback(
    async (values: { agent: string }) => {
      setChecking(true);
      setResult(undefined);
      const addr = values.agent.trim() as Address;
      setCheckedAddress(addr);
      const checkFn =
        contractType === 'token' ? checkIsTokenAgent : checkIsIRAgent;
      const res = await checkFn(addr);
      setResult(res);
      setChecking(false);
    },
    [contractType, checkIsTokenAgent, checkIsIRAgent],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        icon={<SearchOutlined />}
        message="Anyone can check whether a wallet holds the agent role."
      />
      <Form form={form} layout="vertical" onFinish={handleCheck}>
        <Form.Item
          label={<Text strong>Wallet Address to Check</Text>}
          name="agent"
          rules={[
            { required: true, message: 'Enter a wallet address.' },
            {
              validator: (_, v) =>
                v && isAddress(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Invalid Ethereum address')),
            },
          ]}
        >
          <Input
            placeholder="0xAddress…"
            size="large"
            prefix={<SearchOutlined />}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="default"
            htmlType="submit"
            icon={<SearchOutlined />}
            loading={checking}
            size="large"
          >
            {checking ? 'Checking…' : 'Check Agent Status'}
          </Button>
          {result !== undefined && (
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                form.resetFields();
                setResult(undefined);
                setCheckedAddress('');
              }}
            >
              Clear
            </Button>
          )}
        </Form.Item>
      </Form>

      {result !== undefined && (
        <Alert
          type={result ? 'success' : 'warning'}
          showIcon
          icon={
            result ? (
              <CheckCircleFilled style={{ color: '#52c41a' }} />
            ) : (
              <CloseCircleFilled style={{ color: '#faad14' }} />
            )
          }
          message={
            result ? (
              <Text strong style={{ color: '#52c41a' }}>
                ✓ Active Agent
              </Text>
            ) : (
              <Text strong style={{ color: '#faad14' }}>
                ✗ Not an Agent
              </Text>
            )
          }
          description={
            <Space direction="vertical" size={4}>
              <Text code style={{ fontSize: 12 }}>
                {checkedAddress}
              </Text>
              <Text style={{ fontSize: 13 }}>
                {result
                  ? `This wallet holds the ${contractType === 'token' ? 'Token' : 'Identity Registry'} Agent role.`
                  : `This wallet does NOT hold the ${contractType === 'token' ? 'Token' : 'Identity Registry'} Agent role.`}
              </Text>
            </Space>
          }
        />
      )}
    </Space>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function ManageAgentsSection({
  contractType,
}: ManageAgentsSectionProps) {
  const isToken = contractType === 'token';
  const label = isToken ? 'Token' : 'Identity Registry';
  const accentColor = isToken ? '#1677ff' : '#722ed1';

  return (
    <Row gutter={[24, 24]} align="top">
      <Col xs={24} lg={14}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* ── Add Agent ───────────────────────────────────── */}
          <Card
            title={
              <Space>
                <UserAddOutlined style={{ color: '#52c41a' }} />
                <Text strong>Add {label} Agent</Text>
                <Tag color="green">Owner only</Tag>
              </Space>
            }
            style={{ border: `1px solid ${accentColor}30` }}
          >
            <AddAgentForm contractType={contractType} />
          </Card>

          {/* ── Remove Agent ─────────────────────────────────── */}
          <Card
            title={
              <Space>
                <UserDeleteOutlined style={{ color: '#ff4d4f' }} />
                <Text strong>Remove {label} Agent</Text>
                <Tag color="red">Owner only</Tag>
              </Space>
            }
            style={{ border: `1px solid #ff4d4f30` }}
          >
            <RemoveAgentForm contractType={contractType} />
          </Card>

          {/* ── Check isAgent ─────────────────────────────────── */}
          <Card
            title={
              <Space>
                <SearchOutlined style={{ color: '#8c8c8c' }} />
                <Text strong>Check Agent Status</Text>
                <Tag>Read-only</Tag>
              </Space>
            }
          >
            <CheckAgentForm contractType={contractType} />
          </Card>
        </Space>
      </Col>

      {/* ── Info panel ──────────────────────────────────────── */}
      <Col xs={24} lg={10}>
        <AgentPowersPanel contractType={contractType} />
      </Col>
    </Row>
  );
}

// Named exports of sub-panels for optional standalone use
export { AddAgentForm, RemoveAgentForm, CheckAgentForm, AgentPowersPanel };
