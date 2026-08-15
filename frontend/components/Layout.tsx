import { ReactNode, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TokenEcosystemSelector } from '@/components/TokenEcosystemSelector';
import {
  Layout as AntLayout,
  Menu,
  Space,
  Tag,
  Typography,
  theme,
  Tooltip,
} from 'antd';
import { useAccount } from 'wagmi';
import {
  WalletOutlined,
  HomeOutlined,
  UserAddOutlined,
  DollarOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DeploymentUnitOutlined,
  UserOutlined,
  IdcardOutlined,
  SafetyOutlined,
  RocketOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer, Sider } = AntLayout;
const { Text } = Typography;

// Load ConnectButton client-side only – avoids pino / WalletConnect SSR issues
const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => m.ConnectButton),
  { ssr: false },
);

/** Navigation items for the sidebar. */
const NAV_ITEMS = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: <Link href="/">Dashboard</Link>,
  },
  {
    key: '/identity',
    icon: <UserAddOutlined />,
    label: <Link href="/identity">Identity</Link>,
  },
  {
    key: '/token',
    icon: <DollarOutlined />,
    label: <Link href="/token">Token</Link>,
  },
  {
    key: '/compliance',
    icon: <SafetyOutlined />,
    label: <Link href="/compliance">Compliance</Link>,
  },
  {
    key: '/deploy',
    icon: <RocketOutlined />,
    label: <Link href="/deploy">Deploy</Link>,
  },
  {
    key: '/transactions',
    icon: <HistoryOutlined />,
    label: <Link href="/transactions">Transactions</Link>,
  },
];

const walletNameKey = (addr: string) =>
  `trex_wallet_name_${addr.toLowerCase()}`;
const investorNameKey = (addr: string) =>
  `trex_investor_name_${addr.toLowerCase()}`;

/** Reads a single localStorage key reactively (SSR-safe). */
function useLocalStorageName(key: string): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('storage', cb);
      return () => window.removeEventListener('storage', cb);
    },
    () => (key ? (localStorage.getItem(key) ?? '') : ''),
    () => '',
  );
}

/** Displays wallet address tag + optional account/investor names when connected. */
function WalletStatus() {
  const { address, isConnected, chain } = useAccount();

  // Dashboard "Account Name" (set on the dashboard page)
  const accountName = useLocalStorageName(
    address ? walletNameKey(address) : '',
  );
  // Identity "Investor Name" (set in the Created Identities table) — fallback
  const investorName = useLocalStorageName(
    address ? investorNameKey(address) : '',
  );

  if (!isConnected || !address) return null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  // Show only one name: accountName takes priority; fall back to investorName.
  const displayName = accountName || investorName;
  const isInvestor = !accountName && !!investorName;

  return (
    <Space size={8}>
      {displayName && (
        <Tag
          icon={isInvestor ? <IdcardOutlined /> : <UserOutlined />}
          color={isInvestor ? 'cyan' : 'purple'}
          style={{ fontSize: 13, padding: '2px 10px', borderRadius: 20 }}
        >
          {displayName}
        </Tag>
      )}
      <Tag
        icon={<WalletOutlined />}
        color="success"
        style={{ fontSize: 13, padding: '2px 10px', borderRadius: 20 }}
      >
        {short}
      </Tag>
      {chain && (
        <Tag color="blue" style={{ borderRadius: 20 }}>
          {chain.name}
        </Tag>
      )}
    </Space>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { token } = theme.useToken();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Derive active menu key from the current pathname.
  const selectedKey = router.pathname;

  return (
    // Outer shell — full viewport, never scrolls itself
    <AntLayout
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={200}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '1px 0 4px rgba(0,0,0,0.06)',
          // Sidebar fills the full viewport height and scrolls internally
          height: '100vh',
          overflow: 'hidden',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: collapsed ? '18px 0' : '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>🦖</span>
          {!collapsed && (
            <Text strong style={{ fontSize: 14, letterSpacing: 0.3 }}>
              T-REX
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          style={{ border: 'none', fontSize: 14 }}
        />

        {/* Protocol label pinned to bottom */}
        {!collapsed && (
          <div
            style={{
              position: 'absolute',
              bottom: 60,
              left: 0,
              right: 0,
              padding: '0 16px',
            }}
          >
            <Space size={6} style={{ opacity: 0.4 }}>
              <DeploymentUnitOutlined style={{ fontSize: 12 }} />
              <Text style={{ fontSize: 11 }}>ERC-3643 Protocol</Text>
            </Space>
          </div>
        )}
      </Sider>

      {/* ── Right column: Header + scrollable Content + Footer ── */}
      <AntLayout
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          minWidth: 0, // prevent flex overflow
        }}
      >
        {/* Header — always visible, never scrolls away */}
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            flexShrink: 0,
            height: 56,
            lineHeight: '56px',
            zIndex: 100,
          }}
        >
          {/* Left – collapse toggle */}
          <Tooltip
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            placement="right"
          >
            <span
              style={{
                fontSize: 18,
                cursor: 'pointer',
                color: token.colorTextSecondary,
                lineHeight: 1,
              }}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
          </Tooltip>

          {/* Right – ecosystem selector + wallet status + connect button */}
          <Space size={12}>
            <TokenEcosystemSelector />
            <WalletStatus />
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus="avatar"
            />
          </Space>
        </Header>

        {/* Page content — this is the only scrollable region */}
        <Content
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 32px',
            background: token.colorBgLayout,
          }}
        >
          {children}
        </Content>

        {/* Footer — always visible at the bottom, never scrolls away */}
        <Footer
          style={{
            textAlign: 'center',
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            padding: '10px 32px',
            height: 44,
            flexShrink: 0,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            ERC-3643 T-REX Dashboard · wagmi + RainbowKit
          </Text>
        </Footer>
      </AntLayout>
    </AntLayout>
  );
}
