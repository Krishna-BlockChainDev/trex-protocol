/**
 * /pages/transactions.tsx – Transaction History
 *
 * Standalone page showing all on-chain transactions for the active
 * TokenEcosystem, fetched from the Ethereum / Sepolia / BSC explorer
 * and cached in PostgreSQL.
 *
 * Categories:
 *   Token      – Transfer, Mint, Burn, ForcedTransfer, AddressFrozen, Paused…
 *   Identity   – CreateIdentity, RegisterIdentity, AddClaim, RemoveClaim
 *   Compliance – AddModule, RemoveModule, SetMaxBalance, SetSupplyLimit…
 *   System     – Deploy
 */

import Head from 'next/head';
import { Space, Typography, Divider } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import Layout from '@/components/Layout';
import { TransactionHistorySection } from '@/components/token/TransactionHistorySection';

const { Title, Paragraph, Text } = Typography;

export default function TransactionsPage() {
  return (
    <>
      <Head>
        <title>Transaction History · ERC-3643 T-REX</title>
        <meta
          name="description"
          content="Full on-chain transaction history for the ERC-3643 security token ecosystem, fetched from Ethereum/Sepolia explorer."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        {/* ── Page header ────────────────────────────────── */}
        <Space style={{ marginBottom: 4 }} align="center">
          <HistoryOutlined style={{ fontSize: 22, color: '#722ed1' }} />
          <Title level={3} style={{ margin: 0 }}>
            Transaction History
          </Title>
        </Space>
        <Paragraph
          type="secondary"
          style={{ marginBottom: 16, marginLeft: 30 }}
        >
          All on-chain transactions for the active{' '}
          <Text strong>Token Ecosystem</Text>, synced from the blockchain
          explorer. Includes token transfers, mints, burns, identity
          registrations, compliance updates, and deployment events. Use the
          filters to narrow by category, event type, or wallet address.
        </Paragraph>

        <Divider style={{ marginTop: 0, marginBottom: 16 }} />

        <TransactionHistorySection />
      </Layout>
    </>
  );
}
