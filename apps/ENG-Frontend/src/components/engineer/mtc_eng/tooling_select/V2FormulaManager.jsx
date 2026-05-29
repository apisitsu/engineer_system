import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select,
  Space, Popconfirm, message, Typography, Tag, Alert
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title } = Typography;
const { TextArea } = Input;

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ── Spec variable groups — insert into formula_expr and condition_expr ────────
const VAR_GROUPS = [
  {
    group: 'After — nominal',
    color: 'blue',
    vars: [
      { name: 'OD',  desc: 'OD After nominal  (= odAft)' },
      { name: 'ID',  desc: 'ID After nominal  (= idAft)' },
      { name: 'W',   desc: 'Width After nominal  (= wAft)' },
      { name: 'SD',  desc: 'SD' },
    ],
  },
  {
    group: 'After — Max / Min (absolute bound = nominal + tolerance)',
    color: 'cyan',
    vars: [
      { name: 'odAft_max', desc: 'OD After upper bound  (od_aft + tol+)' },
      { name: 'odAft_min', desc: 'OD After lower bound  (od_aft + tol−)' },
      { name: 'idAft_max', desc: 'ID After upper bound' },
      { name: 'idAft_min', desc: 'ID After lower bound' },
      { name: 'wAft_max',  desc: 'Width After upper bound' },
      { name: 'wAft_min',  desc: 'Width After lower bound' },
    ],
  },
  {
    group: 'Before — nominal',
    color: 'green',
    vars: [
      { name: 'odBf', desc: 'OD Before nominal' },
      { name: 'idBf', desc: 'ID Before nominal' },
      { name: 'wBf',  desc: 'Width Before nominal' },
    ],
  },
  {
    group: 'Before — Max / Min (absolute bound = nominal + tolerance)',
    color: 'lime',
    vars: [
      { name: 'odBf_max', desc: 'OD Before upper bound  (odBf + tol+)' },
      { name: 'odBf_min', desc: 'OD Before lower bound  (odBf + tol−)' },
      { name: 'idBf_max', desc: 'ID Before upper bound' },
      { name: 'idBf_min', desc: 'ID Before lower bound' },
      { name: 'wBf_max',  desc: 'Width Before upper bound' },
      { name: 'wBf_min',  desc: 'Width Before lower bound' },
    ],
  },
  {
    group: 'Flags (1 = true / 0 = false)',
    color: 'orange',
    vars: [
      { name: 'isBallInner', desc: 'type includes INNER or yball=Y' },
      { name: 'isABR',       desc: 'type includes ABR' },
      { name: 'isIDtoOD',    desc: 'process = ID→OD' },
      { name: 'isODtoID',    desc: 'process = OD→ID' },
    ],
  },
];

const VAR_SELECT_OPTIONS = VAR_GROUPS.map(g => ({
  label: g.group,
  options: g.vars.map(v => ({
    label: <span>{v.name}<span style={{ color: '#999', marginLeft: 8, fontSize: 11 }}>{v.desc}</span></span>,
    value: v.name,
  })),
}));

// ── Condition quick-insert buttons ──────────────────────────────────────────
const CONDITION_PRESETS = [
  { label: 'isBallInner', value: 'isBallInner', desc: 'type includes INNER or yball=Y', color: 'orange' },
  { label: 'isABR',       value: 'isABR',       desc: 'type includes ABR',              color: 'volcano' },
  { label: 'isIDtoOD',    value: 'isIDtoOD',    desc: 'process = ID→OD',               color: 'geekblue' },
  { label: 'isODtoID',    value: 'isODtoID',    desc: 'process = OD→ID',               color: 'purple' },
  { label: 'OD >',        value: 'OD > ',       desc: 'compare OD After',              color: 'default' },
  { label: 'OD <',        value: 'OD < ',       desc: 'compare OD After',              color: 'default' },
  { label: 'W >',         value: 'W > ',        desc: 'compare Width After',           color: 'default' },
  { label: 'odBf >',      value: 'odBf > ',     desc: 'compare OD Before',             color: 'green' },
];

function ConditionField({ form }) {
  const inputRef = React.useRef(null);
  const cursor = React.useRef({ start: 0, end: 0 });
  const [selectVal, setSelectVal] = React.useState(undefined);

  const saveCursor = () => {
    const el = inputRef.current?.input;
    if (el) cursor.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const insert = (value) => {
    const el = inputRef.current?.input;
    const current = form.getFieldValue('condition_expr') || '';
    const { start, end } = cursor.current;
    const next = current.slice(0, start) + value + current.slice(end);
    const pos  = start + value.length;
    form.setFieldValue('condition_expr', next);
    setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(pos, pos); } }, 0);
  };

  const onSelectVar = (val) => { insert(val); setSelectVal(undefined); };

  return (
    <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Condition (optional)</span>
        <Select
          value={selectVal}
          onChange={onSelectVar}
          options={VAR_SELECT_OPTIONS}
          placeholder="Insert variable…"
          style={{ width: 200 }}
          size="small"
          popupMatchSelectWidth={false}
        />
      </div>
      <Form.Item name="condition_expr" style={{ marginBottom: 8 }}>
        <Input
          ref={inputRef}
          placeholder="Empty = always active (default)"
          style={{ fontFamily: 'monospace' }}
          allowClear
          onKeyUp={saveCursor}
          onClick={saveCursor}
          onSelect={saveCursor}
        />
      </Form.Item>

      {/* Quick-insert tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {CONDITION_PRESETS.map(p => (
          <Tag
            key={p.value}
            color={p.color}
            style={{ cursor: 'pointer', userSelect: 'none', fontSize: 12 }}
            title={p.desc}
            onClick={() => insert(p.value)}
          >
            {p.label}
          </Tag>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#7a5c00' }}>
        Click a tag or select from the dropdown to insert a variable · Empty = default (always active) ·{' '}
        <span style={{ color: '#555' }}>lower sort_order = evaluated first</span>
      </div>
    </div>
  );
}

// ── Formula function dropdown ────────────────────────────────────────────────
const FORMULA_PRESETS = [
  { group: 'Round up',   label: 'Round up ±0.5',        insert: 'ceil05()',  cursorBack: 1 },
  { group: 'Round up',   label: 'Round up (integer)',    insert: 'ceil()',    cursorBack: 1 },
  { group: 'Round',      label: 'Round ±0.5',            insert: 'round05()', cursorBack: 1 },
  { group: 'Round',      label: 'Round (integer)',        insert: 'round()',   cursorBack: 1 },
  { group: 'Round down', label: 'Round down ±0.5',       insert: 'floor05()', cursorBack: 1 },
  { group: 'Round down', label: 'Round down (integer)',   insert: 'floor()',   cursorBack: 1 },
  { group: 'Conditional', label: 'if  (condition, ✓, ✗)', insert: 'if(, , )',  cursorBack: 5 },
  { group: 'Math',        label: 'abs  (absolute value)', insert: 'abs()',     cursorBack: 1 },
  { group: 'Math',        label: 'lookup  (table)',        insert: 'lookup()',  cursorBack: 1 },
];

const FORMULA_SELECT_OPTIONS = Object.entries(
  FORMULA_PRESETS.reduce((acc, p) => {
    (acc[p.group] = acc[p.group] || []).push({
      label: <span>{p.label}<span style={{ color: '#8c8c8c', marginLeft: 8 }}>→ {p.insert}</span></span>,
      value: p.insert,
    });
    return acc;
  }, {})
).map(([label, options]) => ({ label, options }));

function FormulaField({ form }) {
  const textAreaRef = React.useRef(null);
  const cursor = React.useRef({ start: 0, end: 0 });
  const [fnSelectVal, setFnSelectVal] = React.useState(undefined);
  const [varSelectVal, setVarSelectVal] = React.useState(undefined);

  const saveCursor = () => {
    const el = textAreaRef.current?.resizableTextArea?.textArea;
    if (el) cursor.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const insertToken = (text, cursorBack = 0) => {
    const el = textAreaRef.current?.resizableTextArea?.textArea;
    const current = form.getFieldValue('formula_expr') || '';
    const { start, end } = cursor.current;
    const next = current.slice(0, start) + text + current.slice(end);
    const pos  = start + text.length - cursorBack;
    form.setFieldValue('formula_expr', next);
    setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(pos, pos); } }, 0);
  };

  const onSelectFn = (val) => {
    const preset = FORMULA_PRESETS.find(p => p.insert === val);
    if (preset) insertToken(preset.insert, preset.cursorBack);
    setFnSelectVal(undefined);
  };

  const onSelectVar = (val) => { insertToken(val, 0); setVarSelectVal(undefined); };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14 }}>
          Formula Expression <span style={{ color: '#ff4d4f' }}>*</span>
        </span>
        <Select
          value={varSelectVal}
          onChange={onSelectVar}
          options={VAR_SELECT_OPTIONS}
          placeholder="Insert variable…"
          style={{ width: 200 }}
          size="small"
          popupMatchSelectWidth={false}
        />
        <Select
          value={fnSelectVal}
          onChange={onSelectFn}
          options={FORMULA_SELECT_OPTIONS}
          placeholder="Insert function…"
          style={{ width: 210 }}
          size="small"
          popupMatchSelectWidth={false}
        />
      </div>
      <Form.Item name="formula_expr" rules={[{ required: true, message: 'Formula expression is required' }]} style={{ marginBottom: 12 }}>
        <TextArea
          ref={textAreaRef}
          rows={2}
          onKeyUp={saveCursor}
          onClick={saveCursor}
          onSelect={saveCursor}
          placeholder="e.g.  ceil05(OD + 0.3)   or  if(isBallInner, ceil05(18.5 + W - 2), ceil05(18.5 + W/2 + 3))"
          style={{ fontFamily: 'monospace' }}
        />
      </Form.Item>
    </>
  );
}

export default function V2FormulaManager({ machine, token }) {
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, record: null });
  const [testModal, setTestModal] = useState(false);
  const [testExpr, setTestExpr] = useState('');
  const [testCtx, setTestCtx] = useState('{}');
  const [testResult, setTestResult] = useState(null);
  const [toolingFilter, setToolingFilter] = useState('');
  const [form] = Form.useForm();

  const headers = { Authorization: `Bearer ${token}` };
  const baseUrl = `${server.TSV2_FORMULAS}/${machine.id}/formulas`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(baseUrl, { headers });
      setFormulas(res.data.formulas || []);
    } catch {
      message.error('Failed to load formulas');
    } finally {
      setLoading(false);
    }
  }, [machine.id, token]);

  useEffect(() => { load(); }, [load]);

  const toolingNames = [...new Set(formulas.map(f => f.tooling_name))].sort();

  const filtered = toolingFilter
    ? formulas.filter(f => f.tooling_name === toolingFilter)
    : formulas;

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ sort_order: 0 });
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
        await axios.put(`${server.TSV2_FORMULA_ITEM}/${modal.record.id}`, values, { headers });
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
      await axios.delete(`${server.TSV2_FORMULA_ITEM}/${id}`, { headers });
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const runTest = async () => {
    try {
      let ctx = {};
      try { ctx = JSON.parse(testCtx); } catch { message.error('Context must be valid JSON'); return; }
      const res = await axios.post(server.TSV2_FORMULA_TEST,
        { formula_expr: testExpr, context: ctx }, { headers });
      setTestResult({ success: true, value: res.data.result });
    } catch (err) {
      setTestResult({ success: false, error: err.response?.data?.error || err.message });
    }
  };

  const columns = [
    { title: 'Tooling', dataIndex: 'tooling_name', key: 'tooling_name', width: 140,
      render: v => <Tag color="geekblue">{v}</Tag> },
    { title: 'Key', dataIndex: 'output_key', key: 'output_key', width: 60,
      render: v => <Tag color="gold">{v}</Tag> },
    {
      title: 'Condition',
      dataIndex: 'condition_expr',
      key: 'condition_expr',
      width: 160,
      render: v => v ? <code style={{ fontSize: 11, background: '#fff7e6', padding: '1px 4px', borderRadius: 3, color: '#d46b08' }}>{v}</code> : <span style={{ color: '#bbb', fontSize: 11 }}>default</span>,
    },
    { title: 'Formula', dataIndex: 'formula_expr', key: 'formula_expr',
      render: v => <code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{v}</code> },
    { title: 'Order', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    { title: 'Description', dataIndex: 'description', key: 'description' },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <Title level={5} style={{ margin: 0 }}>Formulas — {machine.label || machine.machine_name}</Title>
        <Space>
          <Select
            allowClear
            placeholder="Filter Tooling"
            style={{ width: 180 }}
            value={toolingFilter || undefined}
            onChange={v => setToolingFilter(v || '')}
            options={toolingNames.map(n => ({ label: n, value: n }))}
          />
          <Button icon={<ThunderboltOutlined />} onClick={() => { setTestExpr(''); setTestCtx('{}'); setTestResult(null); setTestModal(true); }}>
            Test Formula
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Formula</Button>
        </Space>
      </div>

      <Table rowKey="id" dataSource={filtered} columns={columns} loading={loading} size="small"
        pagination={{ pageSize: 20 }} />

      {/* Create / Edit Modal */}
      <Modal
        title={modal.record ? 'Edit Formula' : 'Add Formula'}
        open={modal.open}
        onOk={save}
        onCancel={() => setModal({ open: false, record: null })}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="tooling_name" label="Tooling Name" rules={[{ required: true }]}>
              <Input placeholder="JAW, BACK PLATE, CHUTE …" />
            </Form.Item>
            <Form.Item name="output_key" label="Output Key (A–Z)" rules={[{ required: true, max: 10 }]}>
              <Select showSearch options={ALPHA.map(c => ({ label: c, value: c }))} placeholder="Select Dimension" />
            </Form.Item>
          </div>
          <FormulaField form={form} />
          <ConditionField form={form} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="sort_order" label="Sort Order" initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Test Modal */}
      <Modal
        title="Test Formula Expression"
        open={testModal}
        onOk={runTest}
        okText="Evaluate"
        onCancel={() => setTestModal(false)}
        destroyOnHidden
        width={560}
      >
        <Form layout="vertical">
          <Form.Item label="Formula Expression">
            <TextArea rows={2} value={testExpr} onChange={e => setTestExpr(e.target.value)}
              placeholder="e.g.  OD + 0.3  or  ceil05(odBf_max - odAft_min)" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item
            label={
              <span>
                Context (JSON) — input values
                <Button
                  size="small" type="link" style={{ paddingLeft: 8 }}
                  onClick={() => setTestCtx(JSON.stringify({
                    OD: 20, ID: 15, W: 10, SD: 0,
                    odAft_max: 20.05, odAft_min: 19.95,
                    idAft_max: 15.05, idAft_min: 14.95,
                    wAft_max: 10.1, wAft_min: 9.9,
                    odBf: 21, idBf: 14, wBf: 11,
                    odBf_max: 21.1, odBf_min: 20.9,
                    idBf_max: 14.1, idBf_min: 13.9,
                    wBf_max: 11.1, wBf_min: 10.9,
                    isBallInner: 0, isABR: 0, isIDtoOD: 0, isODtoID: 0,
                  }, null, 2))}
                >
                  Fill sample
                </Button>
              </span>
            }
          >
            <TextArea rows={6} value={testCtx} onChange={e => setTestCtx(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
        </Form>
        {testResult && (
          testResult.success
            ? <Alert type="success" message={`Result: ${testResult.value}`} />
            : <Alert type="error" message={testResult.error} />
        )}
      </Modal>
    </div>
  );
}
