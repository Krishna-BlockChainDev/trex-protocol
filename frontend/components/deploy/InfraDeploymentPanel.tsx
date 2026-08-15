/**
 * InfraDeploymentPanel
 *
 * Shown on the Deploy page when no chain infrastructure exists in the DB for
 * the currently connected network.
 *
 * Allows the connected wallet holder to deploy all Layer 1 shared contracts
 * directly from the browser:
 *   - 6 TREX implementation contracts
 *   - OnchainID stack (OIDIdentity impl, OIDImplementationAuthority, OIDIdFactory)
 *   - TREXImplementationAuthority + setImplementations + TREXFactory
 *   - 4 compliance modules (CountryRestrict, CountryAllow, MaxBalance, SupplyLimit)
 *
 * After all contracts are deployed the deployer wallet address + all contract
 * addresses are persisted to the DB via POST /api/infrastructure.
 *
 * Props:
 *   onSuccess — called after the DB write succeeds so the parent page can
 *               reload the infrastructure from DB and switch to the token
 *               deployment form.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useWallet } from '@/hooks/useWallet';
import { useInfraDeploymentWizard } from '@/hooks/useInfraDeploymentWizard';
import type {
  InfraStep,
  InfraStepSection,
} from '@/hooks/useInfraDeploymentWizard';

const { Title, Text, Paragraph } = Typography;

// ── Section labels ────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<InfraStepSection, string> = {
  implementations: 'TREX Implementation Contracts',
  onchainid: 'OnchainID Stack',
  authority: 'TREX Authority & Factory',
  modules: 'Compliance Modules',
  register: 'Register in Database',
};

const SECTION_ORDER: InfraStepSection[] = [
  'implementations',
  'onchainid',
  'authority',
  'modules',
  'register',
];

// ── Status icon helper ────────────────────────────────────────────────────────

function StepIcon({ status }: { status: InfraStep['status'] }) {
  if (status === 'done')
    return <CheckCircleFilled style={{ color: '#52c41a' }} />;
  if (status === 'running')
    return <LoadingOutlined style={{ color: '#1677ff' }} spin />;
  if (status === 'error')
    return <CloseCircleFilled style={{ color: '#ff4d4f' }} />;
  return <span style={{ color: '#d9d9d9', fontSize: 12 }}>○</span>;
}

// ── Timeline section ──────────────────────────────────────────────────────────

function StepSection({
  section,
  steps,
}: {
  section: InfraStepSection;
  steps: InfraStep[];
}) {
  const sectionSteps = steps.filter((s) => s.section === section);
  if (sectionSteps.length === 0) return null;

  const allDone = sectionSteps.every((s) => s.status === 'done');
  const hasError = sectionSteps.some((s) => s.status === 'error');
  const hasRunning = sectionSteps.some((s) => s.status === 'running');

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          {SECTION_LABELS[section]}
        </Text>
        {allDone && (
          <Tag color="success" style={{ fontSize: 11 }}>
            Done
          </Tag>
        )}
        {hasError && (
          <Tag color="error" style={{ fontSize: 11 }}>
            Error
          </Tag>
        )}
        {hasRunning && (
          <Tag color="processing" style={{ fontSize: 11 }}>
            Running…
          </Tag>
        )}
      </div>
      <Timeline
        style={{ marginLeft: 8 }}
        items={sectionSteps.map((step) => ({
          dot: <StepIcon status={step.status} />,
          children: (
            <div style={{ paddingBottom: 2 }}>
              <Text style={{ fontSize: 13 }}>{step.label}</Text>
              {step.address && (
                <Text
                  type="secondary"
                  style={{
                    display: 'block',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                  title={step.address}
                >
                  {step.address.slice(0, 14)}…{step.address.slice(-8)}
                </Text>
              )}
              {step.txHash && !step.address && (
                <Text
                  type="secondary"
                  style={{
                    display: 'block',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                  title={step.txHash}
                >
                  tx: {step.txHash.slice(0, 14)}…
                </Text>
              )}
              {step.error && (
                <Text type="danger" style={{ display: 'block', fontSize: 11 }}>
                  {step.error}
                </Text>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface InfraDeploymentPanelProps {
  onSuccess: () => void;
}

export function InfraDeploymentPanel({ onSuccess }: InfraDeploymentPanelProps) {
  const { isConnected, address, networkLabel, chainId } = useWallet();
  const [deployError, setDeployError] = useState<string | null>(null);

  const {
    phase,
    steps,
    wip,
    canResume,
    startInfraDeployment,
    resumeInfraDeployment,
    clearInfraWIP,
  } = useInfraDeploymentWizard(onSuccess);

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  async function handleStart() {
    setDeployError(null);
    try {
      await startInfraDeployment();
    } catch (err: any) {
      setDeployError(err?.shortMessage || err?.message || String(err));
    }
  }

  async function handleResume() {
    setDeployError(null);
    try {
      await resumeInfraDeployment();
    } catch (err: any) {
      setDeployError(err?.shortMessage || err?.message || String(err));
    }
  }

  function handleClear() {
    setDeployError(null);
    clearInfraWIP();
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <Card style={{ borderColor: '#52c41a' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />
          <Title level={5} style={{ margin: 0, color: '#52c41a' }}>
            Chain Infrastructure Deployed Successfully
          </Title>
        </div>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          All shared contracts have been deployed and registered in the
          database. You can now deploy a TREX token ecosystem on{' '}
          <strong>{networkLabel}</strong> (chain {chainId}).
        </Paragraph>
      </Card>
    );
  }

  // ── Idle state ────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <DatabaseOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            Deploy Chain Infrastructure
          </Title>
          <Tag color="error">Required</Tag>
        </div>

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          No chain infrastructure is deployed for{' '}
          <strong>{networkLabel}</strong> (chain {chainId}) in the database. The
          infrastructure must be deployed once per network before any TREX token
          can be created.
        </Paragraph>

        {/* Deployer info */}
        {isConnected && address && (
          <div
            style={{
              background: 'rgba(22, 119, 255, 0.04)',
              border: '1px solid rgba(22, 119, 255, 0.15)',
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Deployer wallet:
            </Text>
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                letterSpacing: '0.02em',
              }}
              title={address}
            >
              {address.slice(0, 10)}…{address.slice(-8)}
              <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>
                (full: {address})
              </Text>
            </Text>
          </div>
        )}

        {/* What will be deployed */}
        <div
          style={{
            background: 'rgba(0,0,0,0.02)',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 20,
          }}
        >
          <Text
            strong
            style={{ fontSize: 12, display: 'block', marginBottom: 6 }}
          >
            What will be deployed (~16 transactions):
          </Text>
          <Row gutter={[0, 2]}>
            {[
              '6 TREX implementation contracts',
              'OIDIdentity implementation',
              'OID ImplementationAuthority',
              'OID IdFactory',
              'TREXImplementationAuthority',
              'TREXImplementationAuthority.setImplementations()',
              'TREXFactory',
              'CountryRestrictModule',
              'CountryAllowModule',
              'MaxBalanceModule',
              'SupplyLimitModule',
              'DB registration (POST /api/infrastructure)',
            ].map((item) => (
              <Col key={item} span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  • {item}
                </Text>
              </Col>
            ))}
          </Row>
        </div>

        {!isConnected && (
          <Alert
            type="warning"
            showIcon
            message="Connect your wallet to deploy chain infrastructure"
            style={{ marginBottom: 16 }}
          />
        )}

        <Space>
          {canResume && wip ? (
            <>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleResume}
                disabled={!isConnected}
              >
                Resume Infrastructure Deployment
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleClear}>
                Clear & Start Over
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleStart}
              disabled={!isConnected}
              size="large"
            >
              Deploy Chain Infrastructure
            </Button>
          )}
        </Space>

        {canResume && wip && (
          <Alert
            type="info"
            showIcon
            message="Incomplete deployment found"
            description={`A previous infrastructure deployment was interrupted (${wip.completedSteps.length} / ${steps.length} steps completed). Click Resume to continue from where it left off.`}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  }

  // ── Deploying / Error state ───────────────────────────────────────────────
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          {phase === 'error'
            ? 'Infrastructure Deployment Failed'
            : 'Deploying Chain Infrastructure…'}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {doneCount} / {totalCount} steps
        </Text>
      </div>

      {/* Deployer address shown prominently */}
      {address && (
        <div
          style={{
            background: 'rgba(22, 119, 255, 0.04)',
            border: '1px solid rgba(22, 119, 255, 0.12)',
            borderRadius: 6,
            padding: '6px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text type="secondary" style={{ fontSize: 11 }}>
            Deployer:
          </Text>
          <Text
            style={{ fontFamily: 'monospace', fontSize: 11 }}
            title={address}
          >
            {address}
          </Text>
        </div>
      )}

      <Progress
        percent={progressPct}
        size="small"
        status={
          phase === 'error' || steps.some((s) => s.status === 'error')
            ? 'exception'
            : 'active'
        }
        style={{ marginBottom: 16 }}
      />

      {phase === 'error' && deployError && (
        <Alert
          type="error"
          showIcon
          message="Deployment Error"
          description={deployError}
          style={{ marginBottom: 16 }}
          action={
            <Space>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleResume}
              >
                Retry
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleClear}
              >
                Clear
              </Button>
            </Space>
          }
        />
      )}

      {phase !== 'error' && (
        <Text
          type="secondary"
          style={{ display: 'block', marginBottom: 16, fontSize: 13 }}
        >
          Sign each transaction in your wallet. Do not close this tab.
        </Text>
      )}

      {/* Sectioned step progress */}
      {SECTION_ORDER.map((section) => (
        <StepSection key={section} section={section} steps={steps} />
      ))}
    </Card>
  );
}
