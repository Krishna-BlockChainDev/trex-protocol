/**
 * TokenEcosystemSelector
 *
 * A compact selector that lets the user switch between:
 *   - "Platform token" mode  (reads static bundled addresses)
 *   - Any custom ecosystem they've deployed via the wizard
 *
 * Intended for the dashboard header / index page so users can switch
 * which token ecosystem the entire dashboard reads from.
 */

import { Select, Tag, Tooltip, Typography, Space } from 'antd';
import {
  SwapOutlined,
  RocketOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import { useTokenRegistry } from '@/hooks';

const { Text } = Typography;

interface TokenEcosystemSelectorProps {
  /** Optional additional style for the wrapper div */
  style?: React.CSSProperties;
}

export function TokenEcosystemSelector({ style }: TokenEcosystemSelectorProps) {
  const router = useRouter();
  const { mode, setMode, tokens, activeTokenId, setActiveTokenId } =
    useTokenRegistry();

  /** The current select value:
   *  - 'platform' when in platform mode
   *  - the token id when in custom mode
   */
  const selectValue =
    mode === 'platform' ? 'platform' : (activeTokenId ?? 'platform');

  function handleChange(value: string) {
    if (value === 'platform') {
      setMode('platform');
      setActiveTokenId(null);
    } else if (value === '__deploy__') {
      void router.push('/deploy');
    } else {
      setMode('custom');
      setActiveTokenId(value);
    }
  }

  const options = [
    {
      value: 'platform',
      label: (
        <Space size={6}>
          <GlobalOutlined style={{ color: '#1677ff' }} />
          <span>Platform Token</span>
          <Tag color="blue" style={{ marginLeft: 2, fontSize: 11 }}>
            default
          </Tag>
        </Space>
      ),
    },
    ...tokens.map((t) => ({
      value: t.id,
      label: (
        <Space size={6}>
          <RocketOutlined style={{ color: '#52c41a' }} />
          <span>{t.name}</span>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t.symbol}
          </Text>
        </Space>
      ),
    })),
    {
      value: '__deploy__',
      label: (
        <Space size={6}>
          <RocketOutlined style={{ color: '#faad14' }} />
          <span style={{ color: '#faad14' }}>Deploy new ecosystem…</span>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      <Tooltip title="Switch token ecosystem" placement="bottom">
        <SwapOutlined style={{ color: '#8c8c8c', flexShrink: 0 }} />
      </Tooltip>
      <Select
        value={selectValue}
        onChange={handleChange}
        options={options}
        style={{ minWidth: 220 }}
        size="small"
        variant="borderless"
        popupMatchSelectWidth={false}
      />
    </div>
  );
}
