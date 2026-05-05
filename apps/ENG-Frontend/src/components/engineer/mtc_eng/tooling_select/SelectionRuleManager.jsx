import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Space, Button, Form, Input, Modal, App, Tag,
  InputNumber, Divider, Alert, Collapse, Tooltip,
  Badge, Row, Col, Table, Drawer,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  QuestionCircleOutlined, CheckCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Text, Paragraph } = Typography;

// ── Sub-editors ───────────────────────────────────────────────────────────────

const DimsEditor = ({ value = [], onChange }) => {
  const add = () => onChange([...value, { calc_key: '', tool_field: '', tol_plus: 0.1, tol_minus: 0.1, label: '', sort_priority: 1 }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(value.map((d, idx) => idx === i ? { ...d, [field]: val } : d));

  return (
    <div>
      {value.map((dim, i) => (
        <div
          key={i}
          style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: '#fafafa' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Dimension {i + 1}</Text>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(i)} />
          </div>
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item label="Calc Key" style={{ marginBottom: 4 }}>
                <Input size="small" placeholder="e.g. size_A" value={dim.calc_key} onChange={e => update(i, 'calc_key', e.target.value)} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Tool Column" style={{ marginBottom: 4 }}>
                <Input size="small" placeholder="e.g. dim_a" value={dim.tool_field} onChange={e => update(i, 'tool_field', e.target.value)} />
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
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={add} block>Add Dimension</Button>
    </div>
  );
};

const ResultFieldsEditor = ({ value = [], onChange }) => {
  const add = () => onChange([...value, { tool_field: '', label: '' }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i, field, val) => onChange(value.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  return (
    <div>
      {value.map((rf, i) => (
        <Row key={i} gutter={8} style={{ marginBottom: 6 }} align="middle">
          <Col span={10}><Input size="small" placeholder="tool_field (e.g. dim_a)" value={rf.tool_field} onChange={e => update(i, 'tool_field', e.target.value)} /></Col>
          <Col span={10}><Input size="small" placeholder="Label (e.g. Size A)" value={rf.label} onChange={e => update(i, 'label', e.target.value)} /></Col>
          <Col span={4}><Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(i)} /></Col>
        </Row>
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={add}>Add Column</Button>
    </div>
  );
};

// ── Main Drawer Content ───────────────────────────────────────────────────────

export const SelectionRuleDrawer = ({ open, onClose }) => {
  const { message, modal } = App.useApp();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [dimsValue, setDimsValue] = useState([]);
  const [resultFieldsValue, setResultFieldsValue] = useState([]);
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

  useEffect(() => { if (open) fetchRules(); }, [open, fetchRules]);

  const openAdd = () => {
    setEditingRecord(null);
    setDimsValue([]);
    setResultFieldsValue([]);
    form.resetFields();
    setIsFormOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setDimsValue(Array.isArray(record.dims) ? record.dims : []);
    setResultFieldsValue(Array.isArray(record.result_fields) ? record.result_fields : []);
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

  const columns = [
    { title: 'Category', dataIndex: 'tool_category', key: 'category', render: v => <Tag color="cyan">{v}</Tag> },
    { title: 'Table', dataIndex: 'target_tool_table', key: 'table', render: v => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Calc Context', dataIndex: 'calc_context', key: 'ctx', render: v => v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">-</Text> },
    { title: 'Dims', dataIndex: 'dims', key: 'dims', width: 60, render: v => Array.isArray(v) && v.length > 0 ? <Badge count={v.length} color="#52c41a" /> : <Text type="secondary" style={{ fontSize: 11 }}>Legacy</Text> },
    {
      title: '', key: 'action', width: 80,
      render: (_, record) => (
        <Space size={4}>
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
    children: <Table dataSource={machineRules.map(r => ({ ...r, key: r.id }))} columns={columns} size="small" pagination={false} bordered />,
  }));

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
      <Alert
        type="info"
        showIcon={false}
        style={{ marginBottom: 12 }}
        message={
          <Paragraph style={{ marginBottom: 0, fontSize: 12 }}>
            <InfoCircleOutlined style={{ marginRight: 6 }} />
            Rule เชื่อม <strong>Formula output</strong> → ค้นหาจาก <strong>Inventory Table</strong>{' '}
            ต้องตั้งครบ 3 ขั้นตอนสำหรับ machine ใหม่:
            {' '}<Tag color="green"><CheckCircleOutlined /> Add Tool</Tag>
            <Tag color="green"><CheckCircleOutlined /> Formula Setting</Tag>
            <Tag color="blue"><ApartmentOutlined /> Selection Rule (ที่นี่)</Tag>
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
        title={editingRecord ? 'Edit Rule' : 'Add Selection Rule'}
        open={isFormOpen}
        onOk={handleSave}
        onCancel={() => setIsFormOpen(false)}
        okText="Save"
        okButtonProps={{ loading: saving }}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="machine_name" label="Machine Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. KSX100" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tool_category" label="Tool Category" rules={[{ required: true }]}>
                <Input placeholder="e.g. JAW" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="target_tool_table" label="Inventory Table" rules={[{ required: true }]} extra="เช่น tooling_ksx100">
                <Input placeholder="tooling_ksx100" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 12 }}>Formula Linkage</Divider>
          <Alert
            type="info" showIcon={false} style={{ marginBottom: 10 }}
            message={<Text style={{ fontSize: 12 }}><strong>calc_context</strong>: key ใน FormulaService output เช่น <Text code>ks400b</Text> | <strong>machine_ok_condition</strong>: flag เช่น <Text code>ks400bOK</Text></Text>}
          />
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="calc_context" label="Calc Context">
                <Input placeholder="e.g. ks400b" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="machine_ok_condition" label="Machine OK Condition">
                <Input placeholder="e.g. ks400bOK (optional)" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 12 }}>Dimension Matching (dims)</Divider>
          <Alert
            type="warning" showIcon={false} style={{ marginBottom: 10 }}
            message={<Text style={{ fontSize: 12 }}>เชื่อม <strong>Calc Key</strong> (ค่าจาก Formula) → <strong>Tool Column</strong> (column ใน inventory table) ด้วย tolerance range</Text>}
          />
          <DimsEditor value={dimsValue} onChange={setDimsValue} />

          <Divider orientation="left" style={{ fontSize: 12 }}>Result Columns</Divider>
          <ResultFieldsEditor value={resultFieldsValue} onChange={setResultFieldsValue} />
        </Form>
      </Modal>
    </Drawer>
  );
};

export default SelectionRuleDrawer;
