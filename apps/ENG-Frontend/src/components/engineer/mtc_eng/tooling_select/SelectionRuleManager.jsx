import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Space, Button, Form, Input, Modal, App, Tag,
  InputNumber, Divider, Alert, Collapse, Tooltip, Select, AutoComplete,
  Badge, Row, Col, Table, Drawer,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  QuestionCircleOutlined, CheckCircleOutlined, InfoCircleOutlined,
  WarningOutlined, ThunderboltOutlined, CopyOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Text, Paragraph } = Typography;

const COMMON_TOOL_CATEGORIES = [
  'JAW', 'BACK PLATE', 'CHUTE COVER', 'CARRIER',
  'WORK DRIVER', 'SUPPORT BLOCK', 'LOADING CHUTE', 'PLUG',
  'ROLLER SHOE', 'CPX SHOE', 'FRONT PLATE', 'MASTER RING', 'PLUG GAUGE', 'LOADER',
  'WORK CLAMP', 'SHAFT', 'WORK CHUTE', 'WORK LOADER', 'WORK CHUCK', 'WORK HOLDER',
  'CHUCK JAW', 'CHUTE GUIDE', 'STOPPER', 'LOADING PINTLE',
];

// ── DimsEditor ────────────────────────────────────────────────────────────────
// machineName  → fetches formula parameter_names for calc_key dropdown
// targetTable  → fetches real columns for tool_field dropdown

const DimsEditor = ({ value = [], onChange, machineName, targetTable }) => {
  const [formulaParams, setFormulaParams] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);

  // Load formula parameter_names whenever machineName changes
  useEffect(() => {
    if (!machineName) { setFormulaParams([]); return; }
    axios.get(`${server.MTC_TOOLING_FORMULA}/${encodeURIComponent(machineName)}`)
      .then(r => {
        const params = [...new Set((r.data.formulas || []).map(f => f.parameter_name).filter(Boolean))];
        setFormulaParams(params);
      })
      .catch(() => setFormulaParams([]));
  }, [machineName]);

  // Load real columns whenever targetTable changes
  useEffect(() => {
    if (!targetTable) { setTableColumns([]); return; }
    axios.get(`${server.MTC_TOOLING_COLUMNS}/${encodeURIComponent(targetTable)}`)
      .then(r => setTableColumns(r.data.columns || []))
      .catch(() => setTableColumns([]));
  }, [targetTable]);

  const add = () => onChange([...value, { calc_key: '', tool_field: '', tol_plus: 0.1, tol_minus: 0.1, label: '', sort_priority: 1 }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(value.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  // Highlight mismatches
  const calcKeyInvalid = (key) => key && formulaParams.length > 0 && !formulaParams.includes(key);
  const toolFieldInvalid = (field) => field && tableColumns.length > 0 && !tableColumns.includes(field);

  return (
    <div>
      {!machineName && (
        <Alert type="warning" showIcon={false} style={{ marginBottom: 8, fontSize: 11 }}
          message={<Text style={{ fontSize: 11 }}><WarningOutlined /> กรอก Machine Name ก่อนเพื่อโหลด Calc Key options</Text>} />
      )}
      {!targetTable && (
        <Alert type="warning" showIcon={false} style={{ marginBottom: 8, fontSize: 11 }}
          message={<Text style={{ fontSize: 11 }}><WarningOutlined /> กรอก Inventory Table ก่อนเพื่อโหลด Tool Column options</Text>} />
      )}

      {value.map((dim, i) => {
        const badCalcKey = calcKeyInvalid(dim.calc_key);
        const badToolField = toolFieldInvalid(dim.tool_field);
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${badCalcKey || badToolField ? '#ff4d4f' : '#d9d9d9'}`,
              borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Dimension {i + 1}</Text>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(i)} />
            </div>
            <Row gutter={8}>
              <Col span={8}>
                <Form.Item
                  label={
                    badCalcKey
                      ? <Tooltip title={`"${dim.calc_key}" ไม่มีใน tooling_formula ของ ${machineName}`}>
                        <Text type="danger" style={{ fontSize: 12 }}>Calc Key <WarningOutlined /></Text>
                      </Tooltip>
                      : 'Calc Key'
                  }
                  style={{ marginBottom: 4 }}
                >
                  <Select
                    size="small"
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    value={dim.calc_key || undefined}
                    onChange={v => update(i, 'calc_key', v || '')}
                    placeholder={formulaParams.length ? 'เลือก parameter' : 'พิมพ์ calc key...'}
                    status={badCalcKey ? 'error' : ''}
                    options={formulaParams.map(p => ({ value: p, label: p }))}
                    notFoundContent={
                      formulaParams.length === 0
                        ? <Text type="secondary" style={{ fontSize: 11 }}>ยังไม่มี formula rows สำหรับ machine นี้</Text>
                        : null
                    }
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label={
                    badToolField
                      ? <Tooltip title={`"${dim.tool_field}" ไม่มีใน ${targetTable}`}>
                        <Text type="danger" style={{ fontSize: 12 }}>Tool Column <WarningOutlined /></Text>
                      </Tooltip>
                      : 'Tool Column'
                  }
                  style={{ marginBottom: 4 }}
                >
                  <Select
                    size="small"
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    value={dim.tool_field || undefined}
                    onChange={v => update(i, 'tool_field', v || '')}
                    placeholder={tableColumns.length ? 'เลือก column' : 'พิมพ์ column...'}
                    status={badToolField ? 'error' : ''}
                    options={tableColumns.map(c => ({ value: c, label: c }))}
                    notFoundContent={
                      tableColumns.length === 0
                        ? <Text type="secondary" style={{ fontSize: 11 }}>ยังไม่ได้ระบุ Inventory Table</Text>
                        : null
                    }
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Label" style={{ marginBottom: 4 }}>
                  <Input size="small" placeholder="e.g. Size A" value={dim.label} onChange={e => update(i, 'label', e.target.value)} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="Priority" style={{ marginBottom: 4 }}>
                  <InputNumber size="small" min={1} max={10} style={{ width: '100%' }} value={dim.sort_priority} onChange={v => update(i, 'sort_priority', v)} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={4}>
                <Form.Item label="Tol +" style={{ marginBottom: 0 }}>
                  <InputNumber size="small" step={0.01} style={{ width: '100%' }} value={dim.tol_plus} onChange={v => update(i, 'tol_plus', v)} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item label="Tol -" style={{ marginBottom: 0 }}>
                  <InputNumber size="small" step={0.01} style={{ width: '100%' }} value={dim.tol_minus} onChange={v => update(i, 'tol_minus', v)} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label={<Tooltip title="หาก diff เกินค่านี้ row จะถูก penalty (optional)">Penalty Over <QuestionCircleOutlined /></Tooltip>}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber size="small" step={0.01} style={{ width: '100%' }} value={dim.penalty_over || ''} placeholder="optional" onChange={v => update(i, 'penalty_over', v || null)} />
                </Form.Item>
              </Col>
            </Row>
          </div>
        );
      })}
      <Button size="small" icon={<PlusOutlined />} onClick={add} block>Add Dimension</Button>
    </div>
  );
};

// ── ResultFieldsEditor ────────────────────────────────────────────────────────

const ResultFieldsEditor = ({ value = [], onChange, targetTable }) => {
  const [tableColumns, setTableColumns] = useState([]);

  useEffect(() => {
    if (!targetTable) { setTableColumns([]); return; }
    axios.get(`${server.MTC_TOOLING_COLUMNS}/${encodeURIComponent(targetTable)}`)
      .then(r => setTableColumns(r.data.columns || []))
      .catch(() => setTableColumns([]));
  }, [targetTable]);

  const add = () => onChange([...value, { tool_field: '', label: '' }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(value.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  const fieldInvalid = (f) => f && tableColumns.length > 0 && !tableColumns.includes(f);

  return (
    <div>
      {value.map((rf, i) => (
        <Row key={i} gutter={8} style={{ marginBottom: 6 }} align="middle">
          <Col span={10}>
            <Select
              size="small" showSearch allowClear style={{ width: '100%' }}
              value={rf.tool_field || undefined}
              onChange={v => update(i, 'tool_field', v || '')}
              placeholder={tableColumns.length ? 'Select Column' : 'tool_field...'}
              status={fieldInvalid(rf.tool_field) ? 'error' : ''}
              options={tableColumns.map(c => ({ value: c, label: c }))}
            />
          </Col>
          <Col span={10}>
            <Input size="small" placeholder="Label (e.g. Size A)" value={rf.label} onChange={e => update(i, 'label', e.target.value)} />
          </Col>
          <Col span={4}>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(i)} />
          </Col>
        </Row>
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={add}>Add Column</Button>
    </div>
  );
};

// ── Main Drawer Content ───────────────────────────────────────────────────────

export const SelectionRuleDrawer = ({ open, onClose, inline = false }) => {
  const { message, modal } = App.useApp();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [dimsValue, setDimsValue] = useState([]);
  const [resultFieldsValue, setResultFieldsValue] = useState([]);
  // Watch form fields for live validation in sub-editors
  const [watchMachine, setWatchMachine] = useState('');
  const [watchTable, setWatchTable] = useState('');
  const [availableMachines, setAvailableMachines] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [machineConfigs, setMachineConfigs] = useState([]);
  const [machineTableConfigs, setMachineTableConfigs] = useState([]);
  const [autoFillInfo, setAutoFillInfo] = useState(null);
  const [form] = Form.useForm();

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_TOOLING_RULES);
      setRules(res.data.rules || []);
    } catch {
      message.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (!open && !inline) return;
    fetchRules();
    axios.get(`${server.MTC_TOOLING_FORMULA}/machines`)
      .then(r => setAvailableMachines(r.data.machines || []))
      .catch(() => { });
    axios.get(server.MTC_TOOLING_TABLES)
      .then(r => setAvailableTables((r.data.tables || []).map(t => t.table_name)))
      .catch(() => { });
    axios.get(server.MTC_MACHINE_CONFIG)
      .then(r => setMachineConfigs(r.data.configs || []))
      .catch(() => { });
    axios.get(server.MTC_MACHINE_TABLE_CONFIG)
      .then(r => setMachineTableConfigs(r.data.configs || []))
      .catch(() => { });
  }, [open, inline, fetchRules]);

  const autoFillFromMachine = useCallback((machineName) => {
    if (!machineName) { setAutoFillInfo(null); return; }

    const calcContext = machineName;

    const configEntry = machineConfigs.find(c => c.machine_name === machineName);
    const okCondition = configEntry?.ok_flag_key || null;

    const tableEntry = machineTableConfigs.find(c => c.tfMachine === machineName);
    let table = tableEntry?.table || null;
    if (!table) {
      const normalized = machineName.toLowerCase().replace(/[-\s]/g, '');
      const guessed = `tooling_${normalized}`;
      if (availableTables.includes(guessed)) table = guessed;
    }

    form.setFieldsValue({
      calc_context: calcContext,
      machine_ok_condition: okCondition,
      ...(table ? { target_tool_table: table } : {}),
    });
    if (table) setWatchTable(table);
    setAutoFillInfo({ calcContext, okCondition, table });
  }, [machineConfigs, machineTableConfigs, availableTables, form]);

  const openAdd = () => {
    setEditingRecord(null);
    setIsCopyMode(false);
    setDimsValue([]);
    setResultFieldsValue([]);
    setWatchMachine('');
    setWatchTable('');
    setAutoFillInfo(null);
    form.resetFields();
    setIsFormOpen(true);
  };

  const openEdit = (record) => {
    setIsCopyMode(false);
    setEditingRecord(record);
    setDimsValue(Array.isArray(record.dims) ? record.dims : []);
    setResultFieldsValue(Array.isArray(record.result_fields) ? record.result_fields : []);
    setWatchMachine(record.machine_name || '');
    setWatchTable(record.target_tool_table || '');
    setAutoFillInfo({
      calcContext: record.calc_context,
      okCondition: record.machine_ok_condition,
      table: record.target_tool_table,
    });
    form.setFieldsValue({
      machine_name: record.machine_name,
      tool_category: record.tool_category,
      target_tool_table: record.target_tool_table,
      calc_context: record.calc_context,
      machine_ok_condition: record.machine_ok_condition,
    });
    setIsFormOpen(true);
  };

  const openCopy = (record) => {
    setEditingRecord(null);
    setIsCopyMode(true);
    setDimsValue(Array.isArray(record.dims) ? record.dims.map(d => ({ ...d })) : []);
    setResultFieldsValue(Array.isArray(record.result_fields) ? record.result_fields.map(f => ({ ...f })) : []);
    setWatchMachine(record.machine_name || '');
    setWatchTable(record.target_tool_table || '');
    setAutoFillInfo({
      calcContext: record.calc_context,
      okCondition: record.machine_ok_condition,
      table: record.target_tool_table,
    });
    form.setFieldsValue({
      machine_name: record.machine_name,
      tool_category: record.tool_category,
      target_tool_table: record.target_tool_table,
      calc_context: record.calc_context,
      machine_ok_condition: record.machine_ok_condition,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        dims: dimsValue.length > 0 ? dimsValue : null,
        result_fields: resultFieldsValue.length > 0 ? resultFieldsValue : null,
      };
      if (editingRecord?.id) {
        await axios.put(`${server.MTC_TOOLING_RULES}/${editingRecord.id}`, payload);
        message.success('Rule updated');
      } else {
        await axios.post(server.MTC_TOOLING_RULES, payload);
        message.success('Rule created');
      }
      setIsFormOpen(false);
      fetchRules();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    modal.confirm({
      title: 'Deactivate rule?',
      content: 'Rule จะถูก soft-delete (is_active=false)',
      onOk: async () => {
        try {
          await axios.delete(`${server.MTC_TOOLING_RULES}/${id}`);
          message.success('Rule deactivated');
          fetchRules();
        } catch { message.error('Delete failed'); }
      },
    });
  };

  const grouped = rules.reduce((acc, r) => {
    if (!acc[r.machine_name]) acc[r.machine_name] = [];
    acc[r.machine_name].push(r);
    return acc;
  }, {});

  const tableColumns = [
    { title: 'Category', dataIndex: 'tool_category', key: 'category', render: v => <Tag color="cyan">{v}</Tag> },
    { title: 'Table', dataIndex: 'target_tool_table', key: 'table', render: v => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Calc Context', dataIndex: 'calc_context', key: 'ctx', render: v => v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">-</Text> },
    {
      title: 'Dims', dataIndex: 'dims', key: 'dims', width: 60,
      render: v => Array.isArray(v) && v.length > 0
        ? <Badge count={v.length} color="#52c41a" />
        : <Text type="secondary" style={{ fontSize: 11 }}>Legacy</Text>
    },
    {
      title: '', key: 'action', width: 110,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Copy rule"><Button size="small" icon={<CopyOutlined />} onClick={() => openCopy(record)} /></Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const collapseItems = Object.entries(grouped).map(([machineName, machineRules]) => ({
    key: machineName,
    label: (
      <Space>
        <Text strong>{machineName}</Text>
        <Badge count={machineRules.length} style={{ backgroundColor: '#1890ff' }} />
        {machineRules[0]?.machine_ok_condition && <Tag color="orange">{machineRules[0].machine_ok_condition}</Tag>}
      </Space>
    ),
    children: <Table dataSource={machineRules.map(r => ({ ...r, key: r.id }))} columns={tableColumns} size="small" pagination={false} bordered />,
  }));

  const rulesContent = (
    <>
      <Alert
        type="info"
        showIcon={false}
        style={{ marginBottom: 12 }}
        message={
          <Paragraph style={{ marginBottom: 0, fontSize: 12 }}>
            <InfoCircleOutlined style={{ marginRight: 6 }} />
            {/* Rule <strong>Formula output</strong> → From <strong>Inventory Table</strong>{' '} */}
            {/* Must be setup complete 3 steps for new machine: */}
            {' '}<Tag color="green"><CheckCircleOutlined /> Add Tool</Tag>
            <Tag color="green"><CheckCircleOutlined /> Formula Setting</Tag>
            <Tag color="blue"><ApartmentOutlined /> Selection Rule (Here)</Tag>
          </Paragraph>
        }
      />

      {Object.keys(grouped).length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <ApartmentOutlined style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
          <Text type="secondary">ยังไม่มี Selection Rules — คลิก "Add Rule" เพื่อเพิ่ม</Text>
        </div>
      ) : (
        <Collapse items={collapseItems} defaultActiveKey={Object.keys(grouped)} />
      )}

      {/* ── Add/Edit Modal ── */}
      <Modal
        title={editingRecord ? 'Edit Rule' : isCopyMode ? 'Copy Rule (Save as New)' : 'Add Selection Rule'}
        open={isFormOpen}
        onOk={handleSave}
        onCancel={() => { setIsFormOpen(false); setIsCopyMode(false); }}
        okText="Save"
        okButtonProps={{ loading: saving }}
        width={720}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          size="small"
          onValuesChange={(changed) => {
            if ('machine_name' in changed) {
              const mn = changed.machine_name || '';
              setWatchMachine(mn);
              if (mn) autoFillFromMachine(mn);
              else setAutoFillInfo(null);
            }
            if ('target_tool_table' in changed) setWatchTable(changed.target_tool_table || '');
          }}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="machine_name" label="Machine Name" rules={[{ required: true }]}>
                <AutoComplete
                  placeholder="e.g. KS-B22RD"
                  options={availableMachines.map(m => ({ value: m, label: m }))}
                  filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tool_category" label="Tool Category" rules={[{ required: true }]}>
                <AutoComplete
                  placeholder="e.g. JAW"
                  options={COMMON_TOOL_CATEGORIES.map(c => ({ value: c, label: c }))}
                  filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="target_tool_table" label="Inventory Table" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="tooling_ksb22rd"
                  options={availableTables.map(t => ({ value: t, label: t }))}
                  filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Hidden: calc_context and machine_ok_condition are auto-filled from machine_name */}
          <Form.Item name="calc_context" hidden><Input /></Form.Item>
          <Form.Item name="machine_ok_condition" hidden><Input /></Form.Item>

          {autoFillInfo && (
            <Alert
              type="info"
              showIcon
              icon={<ThunderboltOutlined />}
              style={{ marginBottom: 12, padding: '4px 10px' }}
              message={
                <Space size={6} wrap>
                  <Text style={{ fontSize: 11 }}>Auto-fill:</Text>
                  <Tag color="geekblue" style={{ fontSize: 11 }}>Calc: {autoFillInfo.calcContext || '—'}</Tag>
                  {autoFillInfo.okCondition
                    ? <Tag color="orange" style={{ fontSize: 11 }}>OK flag: {autoFillInfo.okCondition}</Tag>
                    : <Tag color="default" style={{ fontSize: 11 }}>OK flag: —</Tag>
                  }
                </Space>
              }
            />
          )}

          <Divider orientation="left" style={{ fontSize: 12 }}>Dimension Matching (dims)</Divider>
          <DimsEditor
            value={dimsValue}
            onChange={setDimsValue}
            machineName={watchMachine}
            targetTable={watchTable}
          />

          <Divider orientation="left" style={{ fontSize: 12 }}>Result Columns</Divider>
          <ResultFieldsEditor
            value={resultFieldsValue}
            onChange={setResultFieldsValue}
            targetTable={watchTable}
          />
        </Form>
      </Modal>
    </>
  );

  if (inline) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Rule</Button>
        </div>
        {rulesContent}
      </div>
    );
  }

  return (
    <Drawer
      title={<Space><ApartmentOutlined /><span>Selection Rules</span></Space>}
      placement="right"
      width={760}
      open={open}
      onClose={onClose}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Rule</Button>}
      styles={{ body: { padding: 16 } }}
    >
      {rulesContent}
    </Drawer>
  );
};

export default SelectionRuleDrawer;
