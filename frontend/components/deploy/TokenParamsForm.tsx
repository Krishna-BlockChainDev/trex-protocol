/**
 * TokenParamsForm
 *
 * Collects the parameters needed to deploy a new TREX token ecosystem:
 *   - Token name  (e.g. "Acme Security Token")
 *   - Token symbol (e.g. "AST")
 *   - Decimals    (default 18)
 *
 * Calls onSubmit with the validated params.
 */

import {
  Form,
  Input,
  InputNumber,
  Button,
  Alert,
  Typography,
  Space,
} from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import type { TokenDeployParams } from '@/hooks';

const { Text } = Typography;

interface TokenParamsFormProps {
  onSubmit: (params: TokenDeployParams) => void;
  loading?: boolean;
  /** If set, show a "Resume" button for this in-progress deployment */
  resumeParams?: TokenDeployParams;
  onResume?: () => void;
}

export function TokenParamsForm({
  onSubmit,
  loading,
  resumeParams,
  onResume,
}: TokenParamsFormProps) {
  const [form] = Form.useForm<TokenDeployParams>();

  function handleFinish(values: TokenDeployParams) {
    onSubmit({ ...values, decimals: values.decimals ?? 18 });
  }

  return (
    <div>
      {resumeParams && onResume && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
          message="Incomplete deployment found"
          description={
            <Space direction="vertical" size={4}>
              <Text>
                A previous deployment of <strong>{resumeParams.name}</strong> (
                {resumeParams.symbol}) was interrupted. You can resume from
                where it stopped.
              </Text>
              <Button
                type="primary"
                size="small"
                onClick={onResume}
                loading={loading}
              >
                Resume deployment
              </Button>
            </Space>
          }
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ decimals: 18 }}
        disabled={loading}
      >
        <Form.Item
          label="Token Name"
          name="name"
          rules={[
            { required: true, message: 'Token name is required' },
            { min: 2, message: 'At least 2 characters' },
            { max: 64, message: 'Max 64 characters' },
          ]}
          tooltip="Full name of your security token (e.g. 'Kinesis Security Token')"
        >
          <Input placeholder="Kinesis Security Token" maxLength={64} />
        </Form.Item>

        <Form.Item
          label="Token Symbol"
          name="symbol"
          rules={[
            { required: true, message: 'Symbol is required' },
            { min: 1, message: 'At least 1 character' },
            { max: 11, message: 'Max 11 characters' },
            {
              pattern: /^[A-Z0-9]+$/,
              message: 'Uppercase letters and digits only',
            },
          ]}
          tooltip="Short ticker symbol, uppercase (e.g. 'KAU')"
        >
          <Input
            placeholder="KAU"
            maxLength={11}
            style={{ textTransform: 'uppercase' }}
            onChange={(e) =>
              form.setFieldValue('symbol', e.target.value.toUpperCase())
            }
          />
        </Form.Item>

        <Form.Item
          label="Decimals"
          name="decimals"
          rules={[
            { required: true, message: 'Decimals is required' },
            {
              type: 'number',
              min: 0,
              max: 18,
              message: 'Must be between 0 and 18',
            },
          ]}
          tooltip="Number of decimal places. 18 is the ERC-20 standard."
        >
          <InputNumber min={0} max={18} style={{ width: 120 }} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<RocketOutlined />}
            loading={loading}
            size="large"
            block
          >
            Deploy TREX Ecosystem
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
