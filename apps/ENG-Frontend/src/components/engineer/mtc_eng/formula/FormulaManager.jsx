import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Typography, Card, Table, Space, Button,
  Form, Input, Select, Modal, App
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';

const { Content } = Layout;
const { Title, Text } = Typography;

const FormulaManagerContent = () => {
  const { message, modal } = App.useApp();
  const { theme } = useTheme();
  const [machines] = useState(['KS400B', 'KS03A', 'KS500RD', 'KS400B5', 'KS400B6', 'TSG300']);
  const [selectedMachine, setSelectedMachine] = useState('KS400B');
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchFormulas = useCallback(async (machine) => {
    setLoading(true);
    try {
      const res = await axios.get(`${server.MTC_FORMULAS}/${machine}`);
      setFormulas(res.data.formulas || []);
    } catch (err) {
      message.error('Failed to fetch formulas');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (selectedMachine) fetchFormulas(selectedMachine);
  }, [selectedMachine, fetchFormulas]);

  const columns = [
    { title: 'Category', dataIndex: 'tool_category', key: 'tool_category', render: (cat) => <span>{cat || '-'}</span> },
    { title: 'Parameter', dataIndex: 'param_key', key: 'param_key', render: (key) => <Text strong>{key || ''}</Text> },
    { title: 'Formula', dataIndex: 'formula', key: 'formula', render: (f) => <Text code>{f || ''}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => {
            setEditingRecord(record);
            form.setFieldsValue(record);
            setIsModalOpen(true);
          }} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => {
             modal.confirm({
                title: 'Are you sure?',
                onOk: async () => {
                  await axios.delete(`${server.MTC_FORMULAS}/${record.id}`);
                  fetchFormulas(selectedMachine);
                }
             });
          }} />
        </Space>
      ),
    },
  ];

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingRecord?.id) {
        await axios.put(`${server.MTC_FORMULAS}/${editingRecord.id}`, values);
        message.success('Updated');
      } else {
        await axios.post(server.MTC_FORMULAS, { ...values, machine_type: selectedMachine });
        message.success('Created');
      }
      setIsModalOpen(false);
      fetchFormulas(selectedMachine);
    } catch (err) {
      if (err?.errorFields) return; // validation error, stay open
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout style={{ padding: '24px', backgroundColor: theme.colors.background }}>
      <Content>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <Title level={4}><CalculatorOutlined /> MTC Formula Manager</Title>
          <Space>
            <Select value={selectedMachine} onChange={setSelectedMachine} style={{ width: 150 }}>
              {machines.map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingRecord(null);
              form.resetFields();
              setIsModalOpen(true);
            }}>Add</Button>
          </Space>
        </div>
        <Card variant="borderless">
          <Table dataSource={formulas} columns={columns} loading={loading} rowKey="id" />
        </Card>
      </Content>

      <Modal
        title={editingRecord ? 'Edit Formula' : 'Add Formula'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        okText="Save"
        okButtonProps={{ loading: saving }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="tool_category" label="Category">
            <Input placeholder="e.g. GRINDING" />
          </Form.Item>
          <Form.Item name="param_key" label="Parameter" rules={[{ required: true }]}>
            <Input placeholder="e.g. speed_rpm" />
          </Form.Item>
          <Form.Item name="formula" label="Formula" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="e.g. diameter * 3.14 * rpm / 1000" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

const FormulaManager = () => (
  <App>
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="admin-formula" defaultOpenKeys="admin-config" />
      <FormulaManagerContent />
    </Layout>
  </App>
);
export default FormulaManager;
