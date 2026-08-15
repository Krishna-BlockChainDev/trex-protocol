/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * /deploy  — TREX Token Ecosystem Deployment Wizard
 *
 * Two-phase UI depending on whether chain infrastructure exists in the DB:
 *
 *   Phase A – Infrastructure Missing:
 *     Shows InfraDeploymentPanel which lets the connected wallet deploy all
 *     Layer 1 shared contracts (implementations, IA, factory, modules) and
 *     save them to the database. The deployer wallet address is shown clearly.
 *
 *   Phase B – Infrastructure Present:
 *     Infrastructure health check runs automatically:
 *       • Checks OIDIdFactory.isTokenFactory(trexFactory) on-chain.
 *       • If false  → shows "Repair Infrastructure" banner + 1-click fix.
 *       • If wallet ≠ infra deployer → shows "Wrong wallet" warning.
 *         (TREXFactory.deployTREXSuite is onlyOwner — owner = infra deployer)
 *     Then shows the token deployment wizard:
 *       idle      → TokenParamsForm (+ resume prompt if WIP found)
 *       deploying → SectionedStepProgress with live grouped step updates
 *       success   → DeploymentSummary with all contract addresses
 *       error     → Error alert + retry / clear options
 *
 * Infrastructure is ONLY read from the DB (no static config file fallback).
 * deployedBy address is saved to DB and shown in the infra status card.
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Typography,
  Progress,
  Spin,
  Tag,
  Tooltip,
} from 'antd';
import {
  RocketOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  UserOutlined,
  CalendarOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Layout from '@/components/Layout';
import { TokenParamsForm } from '@/components/deploy/TokenParamsForm';
import { SectionedStepProgress } from '@/components/deploy/StepProgress';
import { DeploymentSummary } from '@/components/deploy/DeploymentSummary';
import { InfraDeploymentPanel } from '@/components/deploy/InfraDeploymentPanel';
import { useWallet, useDeploymentWizard } from '@/hooks';
import { useTokenRegistryContext } from '@/contexts/TokenRegistryContext';
import { useInfraRepair } from '@/hooks/useInfraRepair';

const { Title, Text, Paragraph } = Typography;

export default function DeployPage() {
  const {
    isConnected,
    chainId,
    networkLabel,
    address: connectedAddress,
  } = useWallet();
  const { infrastructure, isInfraLoading, refreshInfrastructure } =
    useTokenRegistryContext();
  const {
    phase,
    steps,
    wip,
    canResume,
    startDeployment,
    resumeDeployment,
    clearWIP,
    deployedEcosystem,
  } = useDeploymentWizard();

  const { repairStatus, repairError, checkIfRepairNeeded, repairInfra } =
    useInfraRepair();

  const [deployError, setDeployError] = useState<string | null>(null);

  // Infrastructure is only valid when it came from the DB (has a real UUID id).
  const infraReady = !isInfraLoading && infrastructure !== null;
  const infraMissing = !isInfraLoading && infrastructure === null;

  // Run health check whenever infra loads
  useEffect(() => {
    if (infraReady && infrastructure) {
      void checkIfRepairNeeded(infrastructure);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraReady, infrastructure?.id]);

  // Derived health state
  const infraNeedsRepair = repairStatus === 'needed';
  const repairDone = repairStatus === 'done' || repairStatus === 'not_needed';
  const isRepairing = repairStatus === 'repairing';
  const isCheckingHealth = repairStatus === 'checking';

  // Deployer mismatch: TREXFactory.deployTREXSuite is onlyOwner.
  // The owner is the wallet that deployed the infra.
  const deployerMismatch =
    infraReady &&
    infrastructure &&
    connectedAddress &&
    infrastructure.deployedBy.toLowerCase() !== connectedAddress.toLowerCase();

  async function handleStart(params: {
    name: string;
    symbol: string;
    decimals: number;
  }) {
    setDeployError(null);
    try {
      await startDeployment(params);
    } catch (err: any) {
      setDeployError(err?.shortMessage || err?.message || String(err));
    }
  }

  async function handleResume() {
    setDeployError(null);
    try {
      await resumeDeployment();
    } catch (err: any) {
      setDeployError(err?.shortMessage || err?.message || String(err));
    }
  }

  function handleClear() {
    setDeployError(null);
    clearWIP();
  }

  async function handleRepair() {
    if (!infrastructure) return;
    await repairInfra(infrastructure);
  }

  const isDeploying = phase === 'deploying';
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;
  const progressPct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Whether the token deployment form should be blocked
  const tokenDeployBlocked =
    !isConnected ||
    !infraReady ||
    infraNeedsRepair ||
    !!deployerMismatch ||
    isCheckingHealth;

  function formatDeployedAt(ts: number | string): string {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(ts);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 0' }}>
        {/* ── Page header ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <Title level={3} style={{ margin: 0 }}>
            <RocketOutlined style={{ marginRight: 10 }} />
            Deploy TREX Token Ecosystem
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Deploy a complete ERC-3643 (T-REX) token suite on-chain. Chain
            infrastructure (shared contracts) must be deployed once per network
            before deploying individual tokens.
          </Paragraph>
        </div>

        {/* ── Wallet guard ─────────────────────────────────────────────── */}
        {!isConnected && (
          <Alert
            type="warning"
            showIcon
            message="Wallet required"
            description="Connect your wallet to deploy."
            style={{ marginBottom: 24 }}
          />
        )}

        {/* ── Chain Infrastructure status banner ───────────────────────── */}
        {isConnected && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {isInfraLoading ? (
                <Spin
                  indicator={
                    <LoadingOutlined
                      style={{ fontSize: 16, color: '#1677ff' }}
                      spin
                    />
                  }
                />
              ) : infraReady ? (
                <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
              ) : (
                <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />
              )}

              <Text strong style={{ fontSize: 13 }}>
                Chain Infrastructure
              </Text>

              {isInfraLoading && <Tag color="processing">Checking DB…</Tag>}
              {infraReady && repairDone && (
                <Tag color="success">Deployed ✓ Healthy</Tag>
              )}
              {infraReady && isCheckingHealth && (
                <Tag color="processing">Checking health…</Tag>
              )}
              {infraReady && infraNeedsRepair && (
                <Tag color="warning">Deployed — Repair needed</Tag>
              )}
              {infraReady &&
                !infraNeedsRepair &&
                !repairDone &&
                !isCheckingHealth && <Tag color="success">Deployed ✓</Tag>}
              {infraMissing && <Tag color="error">Not deployed</Tag>}

              {/* TREXFactory address */}
              {infraReady && infrastructure && (
                <Tooltip title={`TREXFactory: ${infrastructure.trexFactory}`}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      cursor: 'default',
                    }}
                  >
                    Factory: {infrastructure.trexFactory.slice(0, 10)}…
                    {infrastructure.trexFactory.slice(-6)}
                  </Text>
                </Tooltip>
              )}

              {/* Deployer address */}
              {infraReady && infrastructure?.deployedBy && (
                <Tooltip title={`Deployed by: ${infrastructure.deployedBy}`}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(82, 196, 26, 0.06)',
                      border: '1px solid rgba(82, 196, 26, 0.2)',
                      borderRadius: 4,
                      padding: '1px 8px',
                      cursor: 'default',
                    }}
                  >
                    <UserOutlined style={{ fontSize: 11, color: '#52c41a' }} />
                    <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      {infrastructure.deployedBy.slice(0, 8)}…
                      {infrastructure.deployedBy.slice(-6)}
                    </Text>
                  </div>
                </Tooltip>
              )}

              {/* Deployed-at timestamp */}
              {infraReady && infrastructure?.deployedAt && (
                <Tooltip
                  title={`Deployed at: ${formatDeployedAt(infrastructure.deployedAt)}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'default',
                    }}
                  >
                    <CalendarOutlined
                      style={{ fontSize: 11, color: '#8c8c8c' }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatDeployedAt(infrastructure.deployedAt)}
                    </Text>
                  </div>
                </Tooltip>
              )}
            </div>
          </Card>
        )}

        {/* ── Infra repair banner ───────────────────────────────────────── */}
        {isConnected && infraReady && infraNeedsRepair && (
          <Alert
            type="warning"
            showIcon
            icon={<ToolOutlined />}
            message="Chain Infrastructure Repair Required"
            description={
              <div>
                <Paragraph style={{ margin: '4px 0 8px' }}>
                  The deployed infrastructure is incomplete:{' '}
                  <strong>OIDIdFactory.addTokenFactory(trexFactory)</strong> was
                  never called. Without this, <code>deployTREXSuite</code> will
                  revert with{' '}
                  <em>&quot;only Factory or owner can call&quot;</em>.
                </Paragraph>
                <Paragraph style={{ margin: '0 0 8px' }} type="secondary">
                  Connect the infra deployer wallet (
                  <Text
                    code
                    style={{ fontSize: 11 }}
                    title={infrastructure?.deployedBy}
                  >
                    {infrastructure?.deployedBy.slice(0, 10)}…
                    {infrastructure?.deployedBy.slice(-8)}
                  </Text>
                  ) and click <strong>Repair</strong> to send the missing
                  transaction.
                </Paragraph>
                {repairError && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    Error: {repairError}
                  </Text>
                )}
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    icon={<ToolOutlined />}
                    loading={isRepairing}
                    onClick={handleRepair}
                    disabled={!!deployerMismatch}
                    size="small"
                  >
                    {isRepairing
                      ? 'Repairing…'
                      : 'Repair Infrastructure (addTokenFactory)'}
                  </Button>
                  {deployerMismatch && (
                    <Text
                      type="secondary"
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      Switch to the infra deployer wallet to repair.
                    </Text>
                  )}
                </div>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ── Deployer wallet mismatch warning ─────────────────────────── */}
        {isConnected && infraReady && deployerMismatch && repairDone && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="Wrong wallet connected — token deployment will fail"
            description={
              <div>
                <Paragraph style={{ margin: '4px 0 8px' }}>
                  <strong>
                    TREXFactory.deployTREXSuite is <code>onlyOwner</code>
                  </strong>
                  . The TREXFactory owner is the wallet that deployed the chain
                  infrastructure. Only that wallet can deploy token ecosystems.
                </Paragraph>
                <Paragraph style={{ margin: 0 }} type="secondary">
                  Required deployer wallet:{' '}
                  <Text
                    code
                    style={{ fontSize: 11 }}
                    title={infrastructure?.deployedBy}
                  >
                    {infrastructure?.deployedBy}
                  </Text>
                  <br />
                  Currently connected:{' '}
                  <Text code style={{ fontSize: 11 }}>
                    {connectedAddress}
                  </Text>
                </Paragraph>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ── PHASE A: Infrastructure missing → show InfraDeploymentPanel ─ */}
        {isConnected && infraMissing && (
          <InfraDeploymentPanel onSuccess={refreshInfrastructure} />
        )}

        {/* ── PHASE B: Infrastructure present → show token deployment UI ── */}
        {isConnected && infraReady && (
          <Row gutter={[24, 24]} align="top">
            {/* ── Left column: form / progress / summary ─────────────────── */}
            <Col xs={24} lg={16}>
              {/* SUCCESS */}
              {phase === 'success' && deployedEcosystem && (
                <DeploymentSummary ecosystem={deployedEcosystem} />
              )}

              {/* IDLE: show form */}
              {phase === 'idle' && (
                <Card>
                  <Title level={5} style={{ marginTop: 0 }}>
                    Token Parameters
                  </Title>
                  {tokenDeployBlocked && repairDone && deployerMismatch ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="Switch to the infra deployer wallet to deploy a token"
                      description={
                        <Text style={{ fontSize: 12 }}>
                          Required:{' '}
                          <Text code style={{ fontSize: 11 }}>
                            {infrastructure?.deployedBy}
                          </Text>
                        </Text>
                      }
                    />
                  ) : tokenDeployBlocked && infraNeedsRepair ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="Repair the infrastructure before deploying a token"
                      description="Click the Repair button above to fix the missing addTokenFactory call."
                    />
                  ) : (
                    <TokenParamsForm
                      onSubmit={handleStart}
                      loading={
                        isDeploying || isInfraLoading || isCheckingHealth
                      }
                      resumeParams={canResume && wip ? wip.params : undefined}
                      onResume={
                        canResume && !tokenDeployBlocked
                          ? handleResume
                          : undefined
                      }
                    />
                  )}
                </Card>
              )}

              {/* DEPLOYING / ERROR */}
              {(isDeploying || phase === 'error') && (
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
                      {phase === 'error' ? 'Deployment Failed' : 'Deploying…'}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {doneCount} / {totalCount} steps complete
                    </Text>
                  </div>
                  <Progress
                    percent={progressPct}
                    size="small"
                    status={
                      phase === 'error' ||
                      steps.some((s) => s.status === 'error')
                        ? 'exception'
                        : 'active'
                    }
                    style={{ marginBottom: 16 }}
                  />

                  {phase === 'error' && deployError && (
                    <Alert
                      type="error"
                      showIcon
                      message="Error"
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
                      style={{
                        display: 'block',
                        marginBottom: 16,
                        fontSize: 13,
                      }}
                    >
                      Sign each transaction in your wallet. Do not close this
                      tab.
                    </Text>
                  )}
                  <SectionedStepProgress steps={steps} />
                </Card>
              )}
            </Col>

            {/* ── Right column: network info + infra details ──────────────── */}
            <Col xs={24} lg={8}>
              {/* Network info */}
              {phase !== 'success' && (
                <Card size="small">
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    Network
                  </Title>
                  <Text>
                    {networkLabel}{' '}
                    <Text type="secondary">(chain {chainId})</Text>
                  </Text>
                  <Paragraph
                    type="secondary"
                    style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}
                  >
                    Make sure you have enough native currency to pay gas for ~9
                    deployment transactions.
                  </Paragraph>
                </Card>
              )}

              {/* Infrastructure deployer info card */}
              {phase !== 'success' && infrastructure && (
                <Card size="small" style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    Chain Infrastructure
                  </Title>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary">
                        Deployed by (required wallet):
                      </Text>
                      <br />
                      <Text
                        style={{ fontFamily: 'monospace', fontSize: 11 }}
                        title={infrastructure.deployedBy}
                      >
                        {infrastructure.deployedBy}
                      </Text>
                      {deployerMismatch && (
                        <Tag
                          color="warning"
                          style={{ marginLeft: 4, fontSize: 10 }}
                        >
                          ≠ connected
                        </Tag>
                      )}
                      {!deployerMismatch && connectedAddress && (
                        <Tag
                          color="success"
                          style={{ marginLeft: 4, fontSize: 10 }}
                        >
                          ✓ connected
                        </Tag>
                      )}
                    </div>
                    {infrastructure.deployedAt && (
                      <div style={{ marginBottom: 6 }}>
                        <Text type="secondary">Deployed at:</Text>
                        <br />
                        <Text style={{ fontSize: 11 }}>
                          {formatDeployedAt(infrastructure.deployedAt)}
                        </Text>
                      </div>
                    )}
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary">TREXFactory:</Text>
                      <br />
                      <Text
                        style={{ fontFamily: 'monospace', fontSize: 11 }}
                        title={infrastructure.trexFactory}
                      >
                        {infrastructure.trexFactory}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">OIDIdFactory registered: </Text>
                      {isCheckingHealth && (
                        <Tag color="processing" style={{ fontSize: 10 }}>
                          Checking…
                        </Tag>
                      )}
                      {repairDone && (
                        <Tag color="success" style={{ fontSize: 10 }}>
                          ✓ Yes
                        </Tag>
                      )}
                      {infraNeedsRepair && (
                        <Tag color="error" style={{ fontSize: 10 }}>
                          ✗ No
                        </Tag>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* What gets deployed (idle only) */}
              {phase === 'idle' && !tokenDeployBlocked && (
                <Card size="small" style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    What gets deployed
                  </Title>
                  <Paragraph
                    type="secondary"
                    style={{ fontSize: 12, marginBottom: 8 }}
                  >
                    Uses shared chain infrastructure already in DB. Only
                    token-specific contracts are deployed:
                  </Paragraph>
                  <ul
                    style={{
                      paddingLeft: 18,
                      margin: 0,
                      fontSize: 13,
                      color: '#595959',
                    }}
                  >
                    {[
                      'TokenProxy (via TREXFactory CREATE2)',
                      'IdentityRegistryProxy',
                      'IdentityRegistryStorageProxy',
                      'TrustedIssuersRegistryProxy',
                      'ClaimTopicsRegistryProxy',
                      'ModularComplianceProxy',
                      'Token OnchainID (via OIDIdFactory)',
                      'ClaimIssuer contract',
                    ].map((item) => (
                      <li key={item} style={{ marginBottom: 3 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Deployment progress tips */}
              {(isDeploying || phase === 'error') && (
                <Card size="small" style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    Tips
                  </Title>
                  <ul
                    style={{
                      paddingLeft: 18,
                      margin: 0,
                      fontSize: 12,
                      color: '#595959',
                    }}
                  >
                    <li style={{ marginBottom: 4 }}>
                      Each section expands automatically when active.
                    </li>
                    <li style={{ marginBottom: 4 }}>
                      Completed sections collapse to keep the view clean.
                    </li>
                    <li style={{ marginBottom: 4 }}>
                      If your wallet times out, refresh and use{' '}
                      <strong>Resume</strong>.
                    </li>
                    <li>
                      Addresses are shown below each deploy step once confirmed.
                    </li>
                  </ul>
                </Card>
              )}
            </Col>
          </Row>
        )}

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {isConnected && isInfraLoading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin
              indicator={
                <LoadingOutlined
                  style={{ fontSize: 32, color: '#1677ff' }}
                  spin
                />
              }
            />
            <Paragraph type="secondary" style={{ marginTop: 16 }}>
              Checking database for chain infrastructure…
            </Paragraph>
          </div>
        )}
      </div>
    </Layout>
  );
}
