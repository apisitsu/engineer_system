import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Popconfirm, message, Typography, Tag, Tooltip, Switch
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title } = Typography;

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function V2SearchRuleManager({ machine, token }) {
  const [rules, setRules] = useState([]);
  const [toolings, setToolings] = useState([]);
  const [columns, setColumns] = useState([]);
  const [invTables, setInvTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [toolingFilter, setToolingFilter] = useState('');
  const [form] = Form.useForm();

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const baseUrl = useMemo(() => `${server.TSV2_SEARCH_RULES}/${machine.id}/search-rules`, [machine.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, tRes, iRes] = await Promise.all([
        axios.get(baseUrl, { headers }),
        axios.get(`${server.TSV2_TOOLINGS}/${machine.id}/toolings`, { headers }),
        axios.get(server.TSV2_INVENTORY_TABLES, { headers }),
      ]);
      setRules(rRes.data.rules || []);
      setToolings(tRes.data.toolings || []);
      setInvTables(iRes.data.tables || []);
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [baseUrl, headers, machine.id]);

  // Load columns when inventory_table is known
  useEffect(() => {
    if (!machine.inventory_table) return;
    axios.get(`${server.TSV2_COLUMNS}/${machine.inventory_table}`, { headers })
      .then(r => setColumns(r.data.columns || []))
      .catch(() => {});
  }, [machine.inventory_table, headers]);

  useEffect(() => { load(); }, [load]);

  const filtered = toolingFilter ? rules.filter(r => r.tooling_name === toolingFilter) : rules;

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ sort_priority: 0, is_match_dim: true });
    setModal({ open: true, record: null });
  };

  const openEdit = (record) => {
    form.setFieldsValue({
      ...record,
      tol_plus:  record.tol_plus  !== null ? record.tol_plus  : undefined,
      tol_minus: record.tol_minus !== null ? record.tol_minus : undefined,
      inventory_tooling_filter:  record.inventory_tooling_filter  || undefined,
      inventory_table_override:  record.inventory_table_override  || undefined,
      is_match_dim: record.is_match_dim !== false,
    });
    setModal({ open: true, record });
  };

  const save = async () => {
    const values = await form.validateFields();
    values.tol_plus  = values.tol_plus  !== '' && values.tol_plus  !== undefined ? values.tol_plus  : null;
    values.tol_minus = values.tol_minus !== '' && values.tol_minus !== undefined ? values.tol_minus : null;
    values.inventory_table_override = values.inventory_table_override || null;
    try {
      if (modal.record) {
        await axios.put(`${server.TSV2_RULE_ITEM}/${modal.record.id}`, values, { headers });
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
      await axios.delete(`${server.TSV2_RULE_ITEM}/${id}`, { headers });
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const tolLabel = (r) => {
    const hasPlus  = r.tol_plus  !== null;
    const hasMinus = r.tol_minus !== null;
    if (!hasPlus && !hasMinus) return <Tag color="purple">Closest Match</Tag>;
    if (hasPlus && hasMinus)   return <Tag color="green">± -{r.tol_minus} / +{r.tol_plus}</Tag>;
    if (hasPlus)  return <Tag color="cyan">≤ computed + {r.tol_plus}</Tag>;
    return <Tag color="orange">≥ computed − {r.tol_minus}</Tag>;
  };

  const columns_def = [
    { title: 'Tooling', dataIndex: 'tooling_name', key: 'tooling_name', width: 140,
      render: v => <Tag color="geekblue">{v}</Tag> },
    { title: 'Key', dataIndex: 'output_key', key: 'output_key', width: 60,
      render: v => <Tag color="gold">{v}</Tag> },
    { title: 'Inventory Column', dataIndex: 'inventory_column', key: 'inventory_column', width: 160 },
    { title: 'Inventory Filter', dataIndex: 'inventory_tooling_filter', key: 'inventory_tooling_filter', width: 160,
      render: v => v ? <Tag color="cyan">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Table Override', dataIndex: 'inventory_table_override', key: 'inventory_table_override', width: 160,
      render: v => v ? <Tag color="volcano">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Tolerance / Strategy', key: 'tol', width: 160, render: (_, r) => tolLabel(r) },
    { title: 'Ranking', dataIndex: 'is_match_dim', key: 'is_match_dim', width: 110,
      render: v => v === false
        ? <Tag color="default">Excluded</Tag>
        : <Tag color="blue">Match dim</Tag> },
    { title: 'Priority', dataIndex: 'sort_priority', key: 'sort_priority', width: 70 },
    { title: 'Label', dataIndex: 'label', key: 'label' },
    {
      title: 'Actions', key: 'actions', width: 100,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <Title level={5} style={{ margin: 0 }}>
          Search Rules — {machine.label || machine.machine_name}
          <Tooltip title="Tolerance (tol_plus/tol_minus): empty = Closest Match (ORDER BY nearest value only)">
            <InfoCircleOutlined style={{ marginLeft: 8, color: '#8c8c8c', fontSize: 14 }} />
          </Tooltip>
        </Title>
        <Space>
          <Select
            allowClear
            placeholder="Filter Tooling"
            style={{ width: 180 }}
            value={toolingFilter || undefined}
            onChange={v => setToolingFilter(v || '')}
            options={toolings.map(n => ({ label: n, value: n }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Rule</Button>
        </Space>
      </div>

      <Table rowKey="id" dataSource={filtered} columns={columns_def} loading={loading}
        size="small" pagination={false} />

      <Modal
        title={modal.record ? 'Edit Search Rule' : 'Add Search Rule'}
        open={modal.open}
        onOk={save}
        onCancel={() => setModal({ open: false, record: null })}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="tooling_name" label="Tooling Name" rules={[{ required: true }]}>
              <Select showSearch options={toolings.map(n => ({ label: n, value: n }))}
                placeholder="Select Tooling" allowClear />
            </Form.Item>
            <Form.Item name="output_key" label="Computed Dimension Key" rules={[{ required: true }]}>
              <Select showSearch options={ALPHA.map(c => ({ label: c, value: c }))} placeholder="A, B, C …" />
            </Form.Item>
          </div>
          <Form.Item name="inventory_column" label="Inventory Column (column in inventory table)" rules={[{ required: true }]}>
            {columns.length > 0
              ? <Select showSearch allowClear options={columns.map(c => ({ label: c, value: c }))} />
              : <Input placeholder="Column name e.g. A, B, Tooling_No" />}
          </Form.Item>
          <Form.Item
            name="inventory_tooling_filter"
            label="Inventory Tooling Filter (filter by tooling_name in inventory table)"
            extra="Specify a tooling_name value to restrict the search to that tooling only — e.g. CARRIER, CHUTE COVER"
          >
            <Input placeholder="e.g. CARRIER or CHUTE COVER (leave empty to skip filter)" allowClear />
          </Form.Item>
          <Form.Item
            name="inventory_table_override"
            label="Inventory Table Override (optional — overrides machine's default inventory table for this tooling)"
            extra="Use when this tooling type is stored in a different table, e.g. PILOT PIN in tooling_ks400b6"
          >
            <Select allowClear showSearch placeholder="Leave empty to use machine's default table">
              {invTables.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <div style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#555' }}>
              <b>Both empty:</b> Closest Match (ORDER BY only — no WHERE filter)<br />
              <b>Both set:</b> <code>col BETWEEN (computed − minus) AND (computed + plus)</code><br />
              <b>Plus only:</b> <code>col ≤ computed + plus</code> (upper bound only)<br />
              <b>Minus only:</b> <code>col ≥ computed − minus</code> (lower bound only)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="tol_plus" label="Tolerance Plus (+)">
                <InputNumber style={{ width: '100%' }} placeholder="Empty = Closest Match" />
              </Form.Item>
              <Form.Item name="tol_minus" label="Tolerance Minus (−)">
                <InputNumber style={{ width: '100%' }} placeholder="Empty = Closest Match" min={0} />
              </Form.Item>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="sort_priority" label="Sort Priority (lower = higher priority)" initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="label" label="Label (shown in results)">
              <Input />
            </Form.Item>
          </div>
          <Form.Item
            name="is_match_dim"
            label="Use in closest-match ranking"
            valuePropName="checked"
            initialValue={true}
            extra="ON = this dim counts toward picking the closest tool. Turn OFF for constant / SD-lookup dims so the match is ranked by OD/ID/W part-fit dims only. Tolerance filter still applies either way."
          >
            <Switch checkedChildren="Match dim" unCheckedChildren="Excluded" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
