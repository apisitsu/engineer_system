import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Table, Button, Form, Input, Select, Space, message,
  Popconfirm, Divider, Tag, Typography, Row, Col, Switch,
  Collapse, Tooltip, Badge, Drawer, InputNumber, Card
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SettingOutlined, EditOutlined,
  SaveOutlined, CloseOutlined, ReloadOutlined, DatabaseOutlined,
  CheckCircleOutlined, StopOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title, Text } = Typography;
const { Panel } = Collapse;

// ─── ตาราง Tooling และ Calc Context ที่รองรับ ──────────────────────────────
const TOOL_TABLES = [
  'tooling_ks400b', 'tooling_ks400b5', 'tooling_ks400b6',
  'tooling_ks03a', 'tooling_ks500rd',
  'tooling_ksb22g', 'tooling_ksb80', 'tooling_tsg300',
];
const CALC_CONTEXTS = [
  { value: 'ks400b',  label: 'KS400B (ks400b_calc)' },
  { value: 'ks03a',   label: 'KS03A (ks03a_calc)' },
  { value: 'ks500rd', label: 'KS500RD (ks500rd_calc)' },
  { value: 'ks400b5', label: 'KS400B5 (ks400b5_calc)' },
  { value: 'ks400b6', label: 'KS400B6 (ks400b6_calc)' },
  { value: 'tsg',     label: 'TSG-300 (calc)' },
];
const OK_FLAGS = [
  'ks400bOK', 'ks03aOK', 'ks500rdOK', 'ks400b5OK', 'ks400b6OK', 'ksb22gOK', 'ksb80OK'
];
const DIM_FIELDS = ['dim_a','dim_b','dim_c','dim_d','dim_e','dim_f','dim_g','dim_h',
                    'dim_i','dim_j','dim_k','dim_l','dim_m','dim_n','dim_o','dim_p',
                    'dim_q','dim_r','dim_s','dim_t','dim_u','dim_v','dim_w','dim_x'];

// ─── Sub-component: Dim Rows Editor ────────────────────────────────────────
const DimsEditor = ({ value = [], onChange }) => {
  const addDim = () => onChange([...value, { calc_key: '', tool_field: 'dim_a', label: '', tol_plus: 1, tol_minus: 1, sort_priority: value.length + 1 }]);
  const removeDim = (idx) => onChange(value.filter((_, i) => i !== idx));
  const updateDim = (idx, field, val) => {
    const next = [...value];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  return (
    <div style={{ border: '1px solid #303030', borderRadius: 6, padding: 8, background: '#141414' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: '#8c8c8c', fontSize: 12 }}>Dimension Matching Rules (dims)</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={addDim} type="dashed">Add Dim</Button>
      </div>
      {value.length === 0 && (
        <Text style={{ color: '#595959', fontSize: 11 }}>ไม่มีกฎ Dimension — คลิก Add Dim เพื่อเพิ่ม</Text>
      )}
      {value.map((dim, idx) => (
        <Row key={idx} gutter={6} style={{ marginBottom: 6, alignItems: 'center' }}>
          <Col span={6}>
            <Input
              size="small" placeholder="calc_key (e.g. wd_A)"
              value={dim.calc_key}
              onChange={e => updateDim(idx, 'calc_key', e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </Col>
          <Col span={4}>
            <Select size="small" value={dim.tool_field} onChange={v => updateDim(idx, 'tool_field', v)} style={{ width: '100%' }}>
              {DIM_FIELDS.map(f => <Select.Option key={f} value={f}>{f}</Select.Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Input size="small" placeholder="label" value={dim.label} onChange={e => updateDim(idx, 'label', e.target.value)} />
          </Col>
          <Col span={3}>
            <InputNumber size="small" placeholder="-Tol" value={dim.tol_minus} onChange={v => updateDim(idx, 'tol_minus', v)} style={{ width: '100%' }} step={0.01} />
          </Col>
          <Col span={3}>
            <InputNumber size="small" placeholder="+Tol" value={dim.tol_plus} onChange={v => updateDim(idx, 'tol_plus', v)} style={{ width: '100%' }} step={0.01} />
          </Col>
          <Col span={2}>
            <InputNumber size="small" min={1} max={9} placeholder="Sort" value={dim.sort_priority} onChange={v => updateDim(idx, 'sort_priority', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={2}>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => removeDim(idx)} />
          </Col>
        </Row>
      ))}
      {value.length > 0 && (
        <Row gutter={6} style={{ marginTop: 4 }}>
          <Col span={6}><Text style={{ color: '#595959', fontSize: 10 }}>calc_key (nested: "rollerShoe.A")</Text></Col>
          <Col span={4}><Text style={{ color: '#595959', fontSize: 10 }}>tool_field</Text></Col>
          <Col span={4}><Text style={{ color: '#595959', fontSize: 10 }}>label</Text></Col>
          <Col span={3}><Text style={{ color: '#595959', fontSize: 10 }}>-Tol</Text></Col>
          <Col span={3}><Text style={{ color: '#595959', fontSize: 10 }}>+Tol</Text></Col>
          <Col span={2}><Text style={{ color: '#595959', fontSize: 10 }}>Sort</Text></Col>
        </Row>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
const RuleManagementModal = ({ visible, onClose }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);  // null = new rule
  const [form] = Form.useForm();

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_TOOLING_SELECT_RULES);
      setRules(res.data.rules || []);
    } catch {
      message.error('ไม่สามารถดึงข้อมูล Rules ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) fetchRules(); }, [visible, fetchRules]);

  // จัดกลุ่ม rules ตาม machine_name
  const grouped = rules.reduce((acc, rule) => {
    if (!acc[rule.machine_name]) acc[rule.machine_name] = [];
    acc[rule.machine_name].push(rule);
    return acc;
  }, {});

  const openAddDrawer = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ dims: [], result_fields: [], is_active: true });
    setDrawerOpen(true);
  };

  const openEditDrawer = (rule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      ...rule,
      dims: Array.isArray(rule.dims) ? rule.dims : JSON.parse(rule.dims || '[]'),
      result_fields: Array.isArray(rule.result_fields) ? rule.result_fields : JSON.parse(rule.result_fields || '[]'),
    });
    setDrawerOpen(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingRule) {
        await axios.put(`${server.MTC_TOOLING_SELECT_RULES}/${editingRule.id}`, values);
        message.success('อัปเดต Rule สำเร็จ');
      } else {
        await axios.post(server.MTC_TOOLING_SELECT_RULES, values);
        message.success('เพิ่ม Rule สำเร็จ');
      }
      setDrawerOpen(false);
      fetchRules();
    } catch {
      message.error('บันทึกไม่สำเร็จ');
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await axios.patch(`${server.MTC_TOOLING_SELECT_RULES}/${id}/toggle`);
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: res.data.is_active } : r));
    } catch { message.error('Toggle ไม่สำเร็จ'); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${server.MTC_TOOLING_SELECT_RULES}/${id}`);
      message.success('ลบ Rule สำเร็จ');
      fetchRules();
    } catch { message.error('ลบไม่สำเร็จ'); }
  };

  // คอลัมน์ตารางในแต่ละ machine group
  const getColumns = () => [
    {
      title: 'Category', dataIndex: 'tool_category', key: 'tool_category',
      render: t => <Tag color="geekblue" style={{ fontWeight: 600 }}>{t}</Tag>
    },
    {
      title: 'Table', dataIndex: 'target_tool_table', key: 'target_tool_table',
      render: t => <Text code style={{ fontSize: 11 }}>{t}</Text>
    },
    {
      title: 'Calc Key', dataIndex: 'calc_context', key: 'calc_context',
      render: t => t ? <Tag color="purple">{t}</Tag> : <Text type="secondary">legacy</Text>
    },
    {
      title: 'Dims',  key: 'dims',
      render: (_, r) => {
        const dims = Array.isArray(r.dims) ? r.dims : JSON.parse(r.dims || '[]');
        return (
          <Space wrap>
            {dims.map((d, i) => (
              <Tooltip key={i} title={`${d.calc_key} → ${d.tool_field} (±${d.tol_minus}/${d.tol_plus})`}>
                <Tag color="cyan" style={{ fontSize: 10 }}>{d.label || d.tool_field}</Tag>
              </Tooltip>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'Active', key: 'active', width: 70, align: 'center',
      render: (_, r) => (
        <Switch
          size="small"
          checked={r.is_active}
          onChange={() => handleToggle(r.id)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<StopOutlined />}
        />
      )
    },
    {
      title: '', key: 'actions', width: 80, align: 'center',
      render: (_, r) => (
        <Space>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditDrawer(r)} />
          <Popconfirm title="ลบ Rule นี้?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: '#722ed1' }} />
            <span style={{ fontWeight: 700 }}>Tooling Selection Rule Manager</span>
            <Badge count={rules.length} showZero style={{ backgroundColor: '#722ed1' }} />
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={1100}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openAddDrawer} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
            Add New Rule
          </Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchRules} loading={loading}>Refresh</Button>,
          <Button key="close" onClick={onClose}>Close</Button>,
        ]}
        styles={{ body: { padding: '16px', maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {Object.keys(grouped).sort().map(machineName => {
          const machineRules = grouped[machineName];
          const activeCount = machineRules.filter(r => r.is_active).length;
          return (
            <Collapse key={machineName} defaultActiveKey={[machineName]} style={{ marginBottom: 12 }}>
              <Panel
                key={machineName}
                header={
                  <Space>
                    <DatabaseOutlined />
                    <Text strong style={{ fontSize: 14 }}>{machineName}</Text>
                    <Tag color={activeCount === machineRules.length ? 'green' : 'orange'}>
                      {activeCount}/{machineRules.length} active
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ctx: {machineRules[0]?.calc_context || '-'}
                    </Text>
                  </Space>
                }
              >
                <Table
                  dataSource={machineRules}
                  columns={getColumns()}
                  rowKey="id"
                  size="small"
                  loading={loading}
                  pagination={false}
                  rowClassName={r => !r.is_active ? 'ant-table-row-disabled' : ''}
                />
              </Panel>
            </Collapse>
          );
        })}
        {Object.keys(grouped).length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#595959' }}>
            <InfoCircleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
            <br />
            <Text type="secondary">ยังไม่มีกฎใน Database — คลิก "Add New Rule" เพื่อเพิ่ม</Text>
          </div>
        )}
      </Modal>

      {/* ── Drawer: Add / Edit Rule ── */}
      <Drawer
        title={
          <Space>
            {editingRule ? <EditOutlined /> : <PlusOutlined />}
            {editingRule ? `แก้ไข Rule #${editingRule.id}` : 'เพิ่ม Rule ใหม่'}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)} icon={<CloseOutlined />}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
              Save Rule
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="machine_name" label="Machine Name" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                <Input placeholder="e.g. KS400B" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tool_category" label="Tool Category (Tooling Name)" rules={[{ required: true }]}>
                <Input placeholder="e.g. WORK DRIVER" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="target_tool_table" label="Tool Table" rules={[{ required: true }]}>
                <Select placeholder="เลือก Table">
                  {TOOL_TABLES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="calc_context" label={<Space><span>Calc Context</span><Tooltip title="ชื่อ Object ที่ใช้ resolve calc_key เช่น 'ks400b' หมายถึง ks400b_calc"><InfoCircleOutlined /></Tooltip></Space>}>
                <Select placeholder="เลือก Calc Context (optional)" allowClear>
                  {CALC_CONTEXTS.map(c => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="machine_ok_condition" label={<Space><span>Machine OK Flag</span><Tooltip title="ชื่อ flag ที่ใช้ตรวจสอบว่าเครื่องสามารถรับชิ้นงานได้ เช่น ks400bOK"><InfoCircleOutlined /></Tooltip></Space>}>
            <Select placeholder="เลือก OK Flag (optional)" allowClear>
              {OK_FLAGS.map(f => <Select.Option key={f} value={f}>{f}</Select.Option>)}
            </Select>
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>Dimension Matching</Divider>
          <Form.Item name="dims" rules={[{ required: false }]}>
            <DimsEditor />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>
            <Space>
              <span>Result Columns</span>
              <Tooltip title="กำหนดว่าจะแสดงคอลัมน์ไหนในผลลัพธ์"><InfoCircleOutlined /></Tooltip>
            </Space>
          </Divider>
          <Form.Item name="result_fields">
            <ResultFieldsEditor />
          </Form.Item>

          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
};

// ─── Sub-component: Result Fields Editor ───────────────────────────────────
const ResultFieldsEditor = ({ value = [], onChange }) => {
  const add = () => onChange([...value, { tool_field: 'dim_a', label: '' }]);
  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));
  const update = (idx, field, val) => {
    const next = [...value];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  return (
    <div style={{ border: '1px solid #303030', borderRadius: 6, padding: 8, background: '#141414' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#8c8c8c', fontSize: 12 }}>Result Display Columns</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={add} type="dashed">Add Column</Button>
      </div>
      {value.map((rf, idx) => (
        <Row key={idx} gutter={8} style={{ marginBottom: 6, alignItems: 'center' }}>
          <Col span={10}>
            <Select size="small" value={rf.tool_field} onChange={v => update(idx, 'tool_field', v)} style={{ width: '100%' }}>
              {DIM_FIELDS.map(f => <Select.Option key={f} value={f}>{f}</Select.Option>)}
            </Select>
          </Col>
          <Col span={10}>
            <Input size="small" placeholder="label (e.g. A)" value={rf.label} onChange={e => update(idx, 'label', e.target.value)} />
          </Col>
          <Col span={4}>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(idx)} />
          </Col>
        </Row>
      ))}
      {value.length === 0 && <Text style={{ color: '#595959', fontSize: 11 }}>ไม่มี — จะใช้ dim columns จาก matching rules โดยอัตโนมัติ</Text>}
    </div>
  );
};

export default RuleManagementModal;
