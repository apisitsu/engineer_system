import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Select,
  Space, Popconfirm, message, Typography
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title } = Typography;

export default function V2MachineManager({ token, onMachineSelect }) {
  const [machines, setMachines] = useState([]);
  const [invTables, setInvTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        axios.get(server.TSV2_MACHINES, { headers }),
        axios.get(server.TSV2_INVENTORY_TABLES, { headers }),
      ]);
      setMachines(mRes.data.machines || []);
      setInvTables(tRes.data.tables || []);
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    form.resetFields();
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
        await axios.put(`${server.TSV2_MACHINES}/${modal.record.id}`, values, { headers });
        message.success('Updated');
      } else {
        await axios.post(server.TSV2_MACHINES, values, { headers });
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
      await axios.delete(`${server.TSV2_MACHINES}/${id}`, { headers });
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { title: 'Machine Name', dataIndex: 'machine_name', key: 'machine_name', width: 140 },
    { title: 'Label', dataIndex: 'label', key: 'label' },
    { title: 'Inventory Table', dataIndex: 'inventory_table', key: 'inventory_table', width: 180 },
    { title: 'Machine Filter', dataIndex: 'inventory_machine_filter', key: 'inventory_machine_filter', width: 140 },
    { title: 'Enabled', dataIndex: 'enabled', key: 'enabled', width: 80, render: (v) => v ? 'Yes' : 'No' },
    {
      title: 'Actions', key: 'actions', width: 180,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          <Button size="small" type="primary" onClick={() => onMachineSelect?.(r)}>Manage</Button>
          <Popconfirm title="Confirm delete?" onConfirm={() => remove(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Machine Registry</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Machine</Button>
      </div>

      <Table
        rowKey="id"
        dataSource={machines}
        columns={columns}
        loading={loading}
        size="small"
        pagination={false}
      />

      <Modal
        title={modal.record ? 'Edit Machine' : 'Add Machine'}
        open={modal.open}
        onOk={save}
        onCancel={() => setModal({ open: false, record: null })}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="machine_name" label="Machine Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. KS-B22G" />
          </Form.Item>
          <Form.Item name="label" label="Label (display in UI)">
            <Input />
          </Form.Item>
          <Form.Item name="inventory_table" label="Inventory Table">
            <Select allowClear showSearch placeholder="Select table">
              {invTables.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="inventory_machine_filter" label="Machine Filter (value in Machine column)">
            <Input placeholder="e.g. KS-B22G (leave empty to skip filter)" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
