import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch,
  Space, Popconfirm, message, Typography, Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title } = Typography;

export default function V2LimitManager({ machine, token }) {
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();

  const headers = { Authorization: `Bearer ${token}` };
  const baseUrl = `${server.TSV2_LIMITS}/${machine.id}/limits`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(baseUrl, { headers });
      setLimits(res.data.limits || []);
    } catch {
      message.error('Failed to load limits');
    } finally {
      setLoading(false);
    }
  }, [machine.id, token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ min_inclusive: true, max_inclusive: true, sort_order: 0 });
    setModal({ open: true, record: null });
  };

  const openEdit = (record) => {
    form.setFieldsValue(record);
    setModal({ open: true, record });
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (modal.record) {
        await axios.put(`${server.TSV2_LIMIT_ITEM}/${modal.record.id}`, values, { headers });
        message.success('Updated');
      } else {
        await axios.post(baseUrl, values, { headers });
        message.success('Created');
      }
      setModal({ open: false, record: null });
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${server.TSV2_LIMIT_ITEM}/${id}`, { headers });
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const formatRange = (r) => {
    const parts = [];
    if (r.min_value !== null && r.min_value !== undefined)
      parts.push(`${r.min_inclusive ? '≥' : '>'} ${r.min_value}`);
    if (r.max_value !== null && r.max_value !== undefined)
      parts.push(`${r.max_inclusive ? '≤' : '<'} ${r.max_value}`);
    return parts.join(' , ') || '—';
  };

  const columns = [
    { title: 'Input Var', dataIndex: 'input_var', key: 'input_var', width: 100,
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Range', key: 'range', render: (_, r) => formatRange(r) },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'Order', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Confirm delete?" onConfirm={() => remove(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>Machine Limits — {machine.label || machine.machine_name}</Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>Add Limit</Button>
      </div>

      <Table rowKey="id" dataSource={limits} columns={columns} loading={loading} size="small" pagination={false} />

      <Modal
        title={modal.record ? 'Edit Limit' : 'Add Limit'}
        open={modal.open}
        onOk={save}
        onCancel={() => setModal({ open: false, record: null })}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="input_var" label="Input Variable" rules={[{ required: true }]}>
            <Input placeholder="OD, ID, W, SD …" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="min_value" label="Min Value">
              <InputNumber style={{ width: '100%' }} placeholder="Leave empty = no limit" />
            </Form.Item>
            <Form.Item name="min_inclusive" label="Min Inclusive (≥)" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="max_value" label="Max Value">
              <InputNumber style={{ width: '100%' }} placeholder="Leave empty = no limit" />
            </Form.Item>
            <Form.Item name="max_inclusive" label="Max Inclusive (≤)" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
