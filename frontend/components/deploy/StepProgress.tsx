/**
 * StepProgress — Deployment progress display
 *
 * Groups the 8 deployment steps into logical sections.
 *
 * Factory-based two-layer architecture:
 *   Layer 1 (Chain Infrastructure) — deployed ONCE per chain via InfraDeploymentPanel
 *   Layer 2 (Token Instance)       — deployed PER TOKEN via TREXFactory.deployTREXSuite()
 *
 * Sections:
 *   1. Infrastructure  — load shared infra from DB (no tx)
 *   2. Token Suite     — TREXFactory deploys all 6 proxies in one tx + read token OnchainID
 *   3. Claim Issuer    — deploy ClaimIssuer + register signing key
 *   4. Configuration   — add trusted issuer, unpause token
 *                        NOTE: IR/Token agent roles are set by TREXFactory (irAgents/tokenAgents),
 *                        no separate addAgent transactions needed.
 *   5. Registration    — save ecosystem to dashboard DB
 */

import {
  CheckCircleFilled,
  LoadingOutlined,
  CloseCircleFilled,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { Collapse, Tag, Typography, Spin, Tooltip } from 'antd';
import type { DeployStep, DeployStepId, DeployStepStatus } from '@/hooks';

const { Text } = Typography;

// ── Section definitions ───────────────────────────────────────────────────────

export interface StepSection {
  key: string;
  title: string;
  description: string;
  stepIds: DeployStepId[];
  /** If true this section is labelled under "Configuration" group */
  isPostDeploy?: boolean;
}

export const STEP_SECTIONS: StepSection[] = [
  {
    key: 'infrastructure',
    title: 'Chain Infrastructure',
    description:
      'Loads the shared chain infrastructure (implementation contracts, TREXFactory, OID stack, compliance modules) that was deployed once for this chain. No transaction required.',
    stepIds: ['infra_load'],
  },
  {
    key: 'token_suite',
    title: 'Token Suite Deployment',
    description:
      'TREXFactory.deployTREXSuite() deploys all 6 token proxy contracts in a single CREATE2 transaction: Token, IdentityRegistry, IdentityRegistryStorage, TrustedIssuersRegistry, ClaimTopicsRegistry, ModularCompliance. Then creates the token OnchainID via OIDIdFactory.',
    stepIds: ['factory_deployTREXSuite', 'token_createIdentity'],
  },
  {
    key: 'claim_issuer',
    title: 'Claim Issuer',
    description:
      'Deploys a ClaimIssuer contract for this token and registers the backend signing key so it can issue KYC claims.',
    stepIds: ['claimIssuer_deploy', 'claimIssuer_addKey'],
  },
  {
    key: 'configuration',
    title: 'System Configuration',
    description:
      'Registers the ClaimIssuer as a trusted issuer on the TrustedIssuersRegistry and unpauses the token. Agent roles (deployer + token contract on IR, deployer on Token) are already granted by TREXFactory.deployTREXSuite() via irAgents/tokenAgents — no separate addAgent transactions needed.',
    stepIds: ['tir_addTrustedIssuer', 'token_unpause'],
    isPostDeploy: true,
  },
  {
    key: 'registration',
    title: 'Dashboard Registration',
    description:
      'Saves the deployed token ecosystem (all proxy addresses + metadata) to the PostgreSQL database and switches the dashboard to the new token.',
    stepIds: ['done'],
    isPostDeploy: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionStatus(
  sectionSteps: DeployStep[],
): 'pending' | 'running' | 'done' | 'error' {
  if (sectionSteps.length === 0) return 'pending';
  if (sectionSteps.every((s) => s.status === 'done')) return 'done';
  if (sectionSteps.some((s) => s.status === 'error')) return 'error';
  if (sectionSteps.some((s) => s.status === 'running')) return 'running';
  return 'pending';
}

/** Returns the set of Collapse panel keys that should be open. */
function computeActiveKeys(
  sections: StepSection[],
  stepMap: Map<string, DeployStep>,
): string[] {
  const active: string[] = [];

  for (const sec of sections) {
    const secSteps = sec.stepIds
      .map((id) => stepMap.get(id))
      .filter((s): s is DeployStep => s !== undefined);
    const st = sectionStatus(secSteps);
    if (st === 'running' || st === 'error') {
      active.push(sec.key);
    }
  }

  // If nothing is running yet, open the first pending section
  if (active.length === 0) {
    const firstPending = sections.find((sec) => {
      const secSteps = sec.stepIds
        .map((id) => stepMap.get(id))
        .filter((s): s is DeployStep => s !== undefined);
      return sectionStatus(secSteps) === 'pending';
    });
    if (firstPending) active.push(firstPending.key);
  }

  return active;
}

// ── Step-row component ────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: DeployStepStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 15 }} />;
    case 'running':
      return (
        <Spin
          indicator={
            <LoadingOutlined style={{ fontSize: 15, color: '#1677ff' }} spin />
          }
        />
      );
    case 'error':
      return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 15 }} />;
    default:
      return <ClockCircleOutlined style={{ color: '#bfbfbf', fontSize: 15 }} />;
  }
}

function StepRow({ step }: { step: DeployStep }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '5px 6px',
        borderRadius: 5,
        background:
          step.status === 'running'
            ? 'rgba(22,119,255,0.06)'
            : step.status === 'error'
              ? 'rgba(255,77,79,0.06)'
              : 'transparent',
      }}
    >
      <span style={{ marginTop: 2, flexShrink: 0 }}>
        <StatusIcon status={step.status} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 13,
            color:
              step.status === 'pending'
                ? '#8c8c8c'
                : step.status === 'error'
                  ? '#ff4d4f'
                  : undefined,
          }}
        >
          {step.label}
        </Text>
        {step.address && (
          <div>
            <Text
              copyable={{ text: step.address }}
              type="secondary"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
            >
              {step.address}
            </Text>
          </div>
        )}
        {step.txHash && !step.address && (
          <div>
            <Text
              type="secondary"
              style={{ fontSize: 11, fontFamily: 'monospace' }}
            >
              tx: {step.txHash.slice(0, 20)}…
            </Text>
          </div>
        )}
        {step.error && (
          <div>
            <Text type="danger" style={{ fontSize: 11 }}>
              {step.error.slice(0, 150)}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section header label ──────────────────────────────────────────────────────

function SectionLabel({
  section,
  sectionSteps,
}: {
  section: StepSection;
  sectionSteps: DeployStep[];
}) {
  const status = sectionStatus(sectionSteps);
  const doneCount = sectionSteps.filter((s) => s.status === 'done').length;
  const total = sectionSteps.length;

  const tag = () => {
    switch (status) {
      case 'done':
        return (
          <Tag color="success" style={{ marginLeft: 8 }}>
            ✓ Done
          </Tag>
        );
      case 'running':
        return (
          <Tag color="processing" style={{ marginLeft: 8 }}>
            In progress
          </Tag>
        );
      case 'error':
        return (
          <Tag color="error" style={{ marginLeft: 8 }}>
            Failed
          </Tag>
        );
      default:
        return (
          <Tag color="default" style={{ marginLeft: 8 }}>
            Pending
          </Tag>
        );
    }
  };

  const icon = () => {
    switch (status) {
      case 'done':
        return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />;
      case 'running':
        return (
          <Spin
            indicator={
              <LoadingOutlined
                style={{ fontSize: 13, color: '#1677ff' }}
                spin
              />
            }
          />
        );
      case 'error':
        return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 14 }} />;
      default:
        return (
          <MinusCircleOutlined style={{ color: '#bfbfbf', fontSize: 14 }} />
        );
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon()}
      <Tooltip title={section.description} placement="right">
        <Text strong style={{ fontSize: 13 }}>
          {section.title}
        </Text>
      </Tooltip>
      {tag()}
      {status !== 'pending' && (
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
          {doneCount}/{total}
        </Text>
      )}
    </div>
  );
}

// ── Collapse group ────────────────────────────────────────────────────────────

function SectionGroup({
  sections,
  stepMap,
}: {
  sections: StepSection[];
  stepMap: Map<string, DeployStep>;
}) {
  const activeKeys = computeActiveKeys(sections, stepMap);

  const items = sections.map((section) => {
    const sectionSteps = section.stepIds
      .map((id) => stepMap.get(id))
      .filter((s): s is DeployStep => s !== undefined);

    return {
      key: section.key,
      label: <SectionLabel section={section} sectionSteps={sectionSteps} />,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sectionSteps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      ),
    };
  });

  return (
    <Collapse
      size="small"
      activeKey={activeKeys}
      items={items}
      style={{ background: 'transparent' }}
    />
  );
}

// ── Main exported component ───────────────────────────────────────────────────

interface SectionedStepProgressProps {
  steps: DeployStep[];
}

export function SectionedStepProgress({ steps }: SectionedStepProgressProps) {
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  const duringSections = STEP_SECTIONS.filter((s) => !s.isPostDeploy);
  const postSections = STEP_SECTIONS.filter((s) => s.isPostDeploy);

  // Only show post-deploy group once at least one step has started
  const anyStarted = steps.some((s) => s.status !== 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── During-deployment: contract deployments ── */}
      <div>
        <Text
          type="secondary"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: 8,
          }}
        >
          Contract Deployments
        </Text>
        <SectionGroup sections={duringSections} stepMap={stepMap} />
      </div>

      {/* ── Post-deployment configuration ── */}
      {anyStarted && (
        <div>
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 8,
            }}
          >
            Post-deployment Configuration
          </Text>
          <SectionGroup sections={postSections} stepMap={stepMap} />
        </div>
      )}
    </div>
  );
}

// ── Legacy flat list (kept for backward compatibility) ────────────────────────

interface StepProgressProps {
  steps: DeployStep[];
}

export function StepProgress({ steps }: StepProgressProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  );
}
