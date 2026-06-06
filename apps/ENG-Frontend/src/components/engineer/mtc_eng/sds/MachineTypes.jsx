import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Popconfirm,
  Space, Tag, App, Input as AntInput, Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';

const { Search } = AntInput;

// CRUD for sds_machine_type_code. Loads ALL rows (nodedupe) so every group member
// (e.g. KS-400B1 / KS-400B2 / KS-400B7) is visible and its machine_group editable.
const MachineTypes = ({ theme }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES, { params: { nodedupe: 'true' } });
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
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    form.setFieldsValue({
      machine_type_code: row.machine_type_code || '',
      machine_type_name: row.machine_type_name || '',
      machine_group: row.machine_group || '',
      grinding_area_label: row.grinding_area_label || '',
      tool_code_filter: row.tool_code_filter || '',
      is_active: row.is_active !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        machine_type_code: vals.machine_type_code.trim(),
        machine_type_name: vals.machine_type_name.trim(),
        machine_group: vals.machine_group?.trim() || null,
        grinding_area_label: vals.grinding_area_label?.trim() || null,
        tool_code_filter: vals.tool_code_filter?.trim() || null,
        is_active: vals.is_active !== false,
      };
      if (editingRow) {
        await axios.put(`${server.MTC_SDS_V2_ADMIN_MACHINE_TYPES}/${editingRow.id}`, payload);
        message.success('Updated');
      } else {
        await axios.post(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES, payload);
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

  const handleDelete = async (id, force = false) => {
    try {
      await axios.delete(`${server.MTC_SDS_V2_ADMIN_MACHINE_TYPES}/${id}`, { params: force ? { force: 'true' } : {} });
      message.success('Deleted');
      load();
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.references) {
        Modal.confirm({
          title: 'Machine type is still in use',
          content: (
            <div>
              <p>{data.error}</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>sds_parameter: {data.references.sds_parameter}</li>
                <li>sds_machine_tool: {data.references.sds_machine_tool}</li>
                <li>sds_excel_mapping: {data.references.sds_excel_mapping}</li>
              </ul>
              <p style={{ marginTop: 8, color: '#cf1322' }}>
                Force delete will orphan those config rows. Continue?
              </p>
            </div>
          ),
          okText: 'Force Delete',
          okButtonProps: { danger: true },
          onOk: () => handleDelete(id, true),
        });
        return;
      }
      message.error(data?.error || 'Delete failed');
    }
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.machine_type_code?.toLowerCase().includes(q) ||
      r.machine_type_name?.toLowerCase().includes(q) ||
      r.machine_group?.toLowerCase().includes(q) ||
      r.tool_code_filter?.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      title: 'Type Code',
      dataIndex: 'machine_type_code',
      width: 120,
      render: v => <Tag color="blue">{v}</Tag>,
      sorter: (a, b) => (a.machine_type_code || '').localeCompare(b.machine_type_code || ''),
    },
    {
      title: 'Machine Type Name',
      dataIndex: 'machine_type_name',
      width: 180,
      render: v => <strong>{v}</strong>,
      sorter: (a, b) => (a.machine_type_name || '').localeCompare(b.machine_type_name || ''),
    },
    {
      title: 'Group',
      dataIndex: 'machine_group',
      width: 200,
      render: v => v ? <Tag color="purple">{v}</Tag> : <span style={{ color: '#999' }}>—</span>,
      sorter: (a, b) => (a.machine_group || '').localeCompare(b.machine_group || ''),
    },
    { title: 'Grinding Area Label', dataIndex: 'grinding_area_label', width: 180, render: v => v || <span style={{ color: '#999' }}>—</span> },
    { title: 'Tool Code Filter', dataIndex: 'tool_code_filter', width: 130, render: v => v || <span style={{ color: '#999' }}>—</span> },
    {
      title: 'Active', dataIndex: 'is_active', width: 80, align: 'center',
      render: v => v !== false ? <Tag color="success">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: '',
      width: 100,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this machine type?" onConfirm={() => handleDelete(row.id)} okText="Delete" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="Machines that share one SDS config (e.g. KS-400B1/B2/B7, TSG-300W/TSG-300ZNC) must use the same Group value. The report resolves all members to the configured representative via this Group field."
        style={{ marginBottom: 12 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
        <Search
          placeholder="Search code / name / group"
          allowClear
          style={{ width: 320 }}
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
        title={editingRow ? 'Edit Machine Type' : 'Add Machine Type'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editingRow ? 'Update' : 'Add'}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="machine_type_code" label="Machine Type Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. 664" />
          </Form.Item>
          <Form.Item
            name="machine_type_name"
            label="Machine Type Name"
            rules={[{ required: true, message: 'Required' }]}
            extra={editingRow ? 'Renaming cascades to sds_parameter / sds_machine_tool / sds_excel_mapping and flushes SDS cache.' : undefined}
          >
            <Input placeholder="e.g. KS-400B1" />
          </Form.Item>
          <Form.Item name="machine_group" label="Group (machine_group)" extra="Same value for machines that share one SDS, e.g. KS-400B1/B2/B7. Leave blank if standalone.">
            <Input placeholder="e.g. KS-400B1/B2/B7" />
          </Form.Item>
          <Form.Item name="grinding_area_label" label="Grinding Area Label">
            <Input placeholder="e.g. OD GRINDING AREA" />
          </Form.Item>
          <Form.Item name="tool_code_filter" label="Tool Code Filter" extra="Overrides machine_type_code when filtering tools by DWG prefix.">
            <Input placeholder="(optional)" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MachineTypes;
