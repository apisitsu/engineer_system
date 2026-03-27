import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Spin } from 'antd';
import { IdcardOutlined, LockOutlined, ToolOutlined } from '@ant-design/icons';
import { login, isLoggedIn } from '../stores/authStore';
import { color } from '../constance/constance';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn()) navigate('/');
  }, [navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    const result = await login(values.empno, values.password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      Swal.fire({ icon: 'error', title: 'Login Failed', text: result.message });
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f0ebe6',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '8px 0' }}>
        <div style={{
          background: color.headerBg,
          margin: '-24px -24px 24px -24px',
          padding: '24px',
          borderRadius: '8px 8px 0 0',
          textAlign: 'center',
        }}>
          <ToolOutlined style={{ fontSize: 32, color: '#fff', marginBottom: 8 }} />
          <Title level={4} style={{ color: '#fff', margin: 0 }}>MTC Engineer</Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Maintenance Engineering System
          </Text>
        </div>

        <Spin spinning={loading}>
          <Form form={form} onFinish={onFinish} layout="vertical">
            <Form.Item name="empno" label="Employee No."
              rules={[{ required: true, message: 'Please enter your employee number' }]}>
              <Input
                prefix={<IdcardOutlined />}
                placeholder="Enter your employee number"
                onInput={e => { e.target.value = e.target.value.toUpperCase(); }}
                autoFocus
              />
            </Form.Item>
            <Form.Item name="password" label="Password"
              rules={[{ required: true, message: 'Please enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Enter your password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" block loading={loading}
                style={{ background: color.primary, borderColor: color.primary }}>
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Spin>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Use your company employee number to login
          </Text>
        </div>
      </Card>
    </div>
  );
}
