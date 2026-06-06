import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Popconfirm,
  Space, Tag, App, Input as AntInput,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';

const { Search } = AntInput;

const MachineCodes = ({ theme }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then(r => {
        const seen = new Set();
        setAllMachineTypes(r.data.filter(m => m.machine_type_code && m.machine_type_name && !seen.has(m.machine_type_code) && seen.add(m.machine_type_code)));
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_CODES);
      setRows(res.data);
    } catch {
      message.error('Load failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingRow(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    form.setFieldsValue({
      machine_code: row.machine_code,
      machine_name: row.machine_name || '',
      machine_type_code: row.machine_type_code || undefined,
      remark: row.remark || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        machine_code: vals.machine_code.trim().toUpperCase(),
        machine_name: vals.machine_name?.trim() || null,
        machine_type_code: vals.machine_type_code || null,
        remark: vals.remark?.trim() || null,
      };
      if (editingRow) {
        await axios.put(`${server.MTC_SDS_V2_ADMIN_MACHINE_CODES}/${editingRow.id}`, payload);
        message.success('Updated');
      } else {
        await axios.post(server.MTC_SDS_V2_ADMIN_MACHINE_CODES, payload);
        message.success('Added');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${server.MTC_SDS_V2_ADMIN_MACHINE_CODES}/${id}`);
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.machine_code?.toLowerCase().includes(q) ||
      r.machine_name?.toLowerCase().includes(q) ||
      r.machine_type_code?.toLowerCase().includes(q) ||
      r.remark?.toLowerCase().includes(q)
    );
  });

  // machine_type_name lookup for display
  const typeMap = Object.fromEntries(
    (allMachineTypes || []).map(m => [m.machine_type_code, m.machine_type_name])
  );

  const columns = [
    {
      title: 'Machine Code',
      dataIndex: 'machine_code',
      width: 140,
      render: v => <strong>{v}</strong>,
      sorter: (a, b) => a.machine_code.localeCompare(b.machine_code),
    },
    {
      title: 'Machine Name (Model)',
      dataIndex: 'machine_name',
      width: 160,
      render: v => v || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Machine Type Code',
      dataIndex: 'machine_type_code',
      width: 160,
      render: (code) => {
        if (!code) return <span style={{ color: '#999' }}>—</span>;
        const name = typeMap[code];
        return (
          <Space size={4}>
            <Tag color="blue">{code}</Tag>
            {name && <span style={{ color: theme?.colors?.textSecondary || '#666' }}>{name}</span>}
          </Space>
        );
      },
    },
    { title: 'Remark', dataIndex: 'remark', render: v => v || '' },
    {
      title: '',
      width: 100,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this mapping?" onConfirm={() => handleDelete(row.id)} okText="Delete" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // machine type options for Select
  const typeOptions = (allMachineTypes || [])
    .filter(m => m.machine_type_name && m.machine_type_code)
    .map(m => ({ value: m.machine_type_code, label: `${m.machine_type_code} — ${m.machine_type_name}` }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
        <Search
          placeholder="Search machine code / name / type"
          allowClear
          style={{ width: 300 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ marginLeft: 'auto', color: theme?.colors?.textSecondary || '#666', alignSelf: 'center' }}>
          {filtered.length} / {rows.length} rows
        </span>
      </div>

      <Table
        dataSource={filtered.map(r => ({ ...r, key: r.id }))}
        columns={columns}
        loading={loading}
        size="small"
        pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: ['50', '100', '200'] }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingRow ? 'Edit Machine Code' : 'Add Machine Code'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editingRow ? 'Update' : 'Add'}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="machine_code" label="Machine Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. VSG-01" disabled={!!editingRow} />
          </Form.Item>
          <Form.Item name="machine_name" label="Machine Name (Model)">
            <Input placeholder="e.g. TSG-300ZNC" />
          </Form.Item>
          <Form.Item name="machine_type_code" label="Machine Type Code (SDS)">
            <Select
              showSearch
              allowClear
              placeholder="Select or type code"
              options={typeOptions}
              filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="remark" label="Remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MachineCodes;
