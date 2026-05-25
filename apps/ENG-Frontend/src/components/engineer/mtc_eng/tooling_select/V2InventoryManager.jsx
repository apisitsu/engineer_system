import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Popconfirm, message, Typography, Tag, Spin, Empty, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title, Text } = Typography;

const HIDE_COLS = new Set(['id']);
const PIN_FIRST = ['tooling_no', 'tooling_name', 'machine', 'Machine'];

const fmtLabel = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function V2InventoryManager({ machine, token }) {
  const [rows,          setRows]          = useState([]);
  const [cols,          setCols]          = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [modal,         setModal]         = useState({ open: false, record: null });
  const [toolingFilter, setToolingFilter] = useState(null);   // selected tooling_name
  const [searchText,    setSearchText]    = useState('');     // free-text search
  const [form] = Form.useForm();

  const table       = machine.inventory_table;
  const machineFilter = machine.inventory_machine_filter;

  // ── Column metadata ─────────────────────────────────────────────────────────
  const loadCols = useCallback(async () => {
    if (!table) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const r = await axios.get(`${server.TSV2_COLUMNS}/${table}`, { headers });
      const colDefs = (r.data.columns || []).map(name => ({
        name,
        isNum: /^dim_/.test(name),
      }));
      setCols(colDefs);
    } catch {
      message.error('Failed to load column info');
    }
  }, [table, token]);

  // ── Inventory rows ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!table) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = machineFilter ? { machine: machineFilter } : {};
      const r = await axios.get(`${server.TSV2_INVENTORY}/${table}`, { headers, params });
      setRows(r.data.rows || []);
    } catch {
      message.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [table, machineFilter, token]);

  useEffect(() => { loadCols(); load(); }, [loadCols, load]);

  // ── Distinct tooling names for dropdown ─────────────────────────────────────
  const toolingNames = useMemo(() => {
    const nameCol = cols.find(c => c.name === 'tooling_name' || c.name === 'tooling_Name');
    if (!nameCol) return [];
    const seen = new Set();
    return rows
      .map(r => r[nameCol.name])
      .filter(v => v && !seen.has(v) && seen.add(v))
      .sort();
  }, [rows, cols]);

  // ── Client-side filtering ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = rows;
    if (toolingFilter) {
      data = data.filter(r => r.tooling_name === toolingFilter || r.tooling_Name === toolingFilter);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      data = data.filter(r =>
        Object.values(r).some(v => v !== null && String(v).toLowerCase().includes(q))
      );
    }
    return data;
  }, [rows, toolingFilter, searchText]);

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    form.resetFields();
    if (toolingFilter) form.setFieldValue('tooling_name', toolingFilter);
    if (machineFilter) {
      const mc = cols.find(c => c.name === 'Machine' || c.name === 'machine');
      if (mc) form.setFieldValue(mc.name, machineFilter);
    }
    setModal({ open: true, record: null });
  };

  const openEdit = useCallback((record) => {
    form.setFieldsValue(record);
    setModal({ open: true, record });
  }, [form]);

  const save = async () => {
    const values = await form.validateFields();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (modal.record) {
        await axios.put(`${server.TSV2_INVENTORY}/${table}/${modal.record.id}`, values, { headers });
        message.success('Updated');
      } else {
        await axios.post(`${server.TSV2_INVENTORY}/${table}`, values, { headers });
        message.success('Added');
      }
      setModal({ open: false, record: null });
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    }
  };

  const remove = useCallback(async (id) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${server.TSV2_INVENTORY}/${table}/${id}`, { headers });
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  }, [token, table, load]);

  // ── Table columns ───────────────────────────────────────────────────────────
  const tableCols = useMemo(() => {
    const visibleCols = cols.filter(c => !HIDE_COLS.has(c.name));
    const orderedCols = [
      ...PIN_FIRST.map(p => visibleCols.find(c => c.name === p)).filter(Boolean),
      ...visibleCols.filter(c => !PIN_FIRST.includes(c.name)),
    ];

    // Only show columns that have at least one non-blank value in the CURRENT filtered data
    const colsWithData = orderedCols.filter(c => 
      filtered.some(r => r[c.name] !== null && r[c.name] !== undefined && String(r[c.name]).trim() !== '')
    );

    const baseCols = colsWithData.map(c => ({
      title:     fmtLabel(c.name),
      dataIndex: c.name,
      key:       c.name,
      width:     c.name === 'tooling_no' ? 160 : c.name.startsWith('dim_') ? 90 : 140,
      sorter:    (a, b) => {
        const valA = a[c.name];
        const valB = b[c.name];
        if (c.name.startsWith('dim_')) return (Number(valA) || 0) - (Number(valB) || 0);
        return String(valA || '').localeCompare(String(valB || ''));
      },
      render:    v => (v !== null && v !== undefined && v !== '')
        ? String(v)
        : <Text type="secondary">—</Text>,
    }));

    return [
      ...baseCols,
      {
        title: 'Actions',
        key:   'actions',
        width: 100,
        fixed: 'right',
        render: (_, r) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            <Popconfirm title="Delete this row?" onConfirm={() => remove(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
      }
    ];
  }, [cols, filtered, openEdit, remove]);

  if (!table) {
    return <Empty description="No inventory table configured for this machine" />;
  }

  const formCols = cols.filter(c => c.name !== 'id');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            Tool Inventory — {machine.label || machine.machine_name}
          </Title>
          <Tag color="default">{table}</Tag>
          {machineFilter && <Tag color="blue">{machineFilter}</Tag>}
        </Space>
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>Add Tool</Button>
        </Space>
      </div>

      {/* Filters */}
      <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
        {toolingNames.length > 0 && (
          <Col xs={24} sm={10} md={8}>
            <Select
              allowClear
              placeholder="Filter by Tool Name"
              style={{ width: '100%' }}
              value={toolingFilter}
              onChange={v => setToolingFilter(v || null)}
              options={toolingNames.map(n => ({ value: n, label: n }))}
            />
          </Col>
        )}
        <Col xs={24} sm={14} md={10}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search tooling no, dimensions…"
            allowClear
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </Col>
        <Col>
          <Text type="secondary" style={{ lineHeight: '32px' }}>
            {filtered.length} / {rows.length} rows
          </Text>
        </Col>
      </Row>

      {/* Table */}
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          dataSource={filtered}
          columns={tableCols}
          size="small"
          scroll={{ x: true }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} items` }}
          bordered
        />
      </Spin>

      {/* Add / Edit Modal */}
      <Modal
        title={modal.record ? 'Edit Tool' : 'Add Tool'}
        open={modal.open}
        onOk={save}
        onCancel={() => setModal({ open: false, record: null })}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {formCols.map(c => (
            <Form.Item
              key={c.name}
              name={c.name}
              label={fmtLabel(c.name)}
              rules={c.name === 'tooling_no' ? [{ required: true, message: 'Tooling No is required' }] : []}
            >
              {c.name === 'tooling_name' && toolingNames.length > 0
                ? (
                  <Select
                    allowClear
                    showSearch
                    placeholder="Select tool name"
                    options={toolingNames.map(n => ({ value: n, label: n }))}
                  />
                )
                : c.isNum
                  ? <InputNumber style={{ width: '100%' }} />
                  : <Input />
              }
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
