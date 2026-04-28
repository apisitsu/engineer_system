import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Typography, Card, Table, Space, Button,
  Form, Input, Select, Modal, App, Tag, Collapse, Alert
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, PlayCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';

const { Content } = Layout;
const { Title, Text } = Typography;

const FORMULA_VARS = [
  { key: 'odBf', desc: 'OD Before (nom)' }, { key: 'odAft', desc: 'OD After (nom)' },
  { key: 'odBfTolPlus', desc: 'OD Bf tol+' }, { key: 'odBfTolMinus', desc: 'OD Bf tol-' },
  { key: 'odAftTolPlus', desc: 'OD Aft tol+' }, { key: 'odAftTolMinus', desc: 'OD Aft tol-' },
  { key: 'idBf', desc: 'ID Before (nom)' }, { key: 'idAft', desc: 'ID After (nom)' },
  { key: 'idBfTolPlus', desc: 'ID Bf tol+' }, { key: 'idBfTolMinus', desc: 'ID Bf tol-' },
  { key: 'idAftTolPlus', desc: 'ID Aft tol+' }, { key: 'idAftTolMinus', desc: 'ID Aft tol-' },
  { key: 'wBf', desc: 'Width Before' }, { key: 'wAft', desc: 'Width After' },
  { key: 'wBfTolPlus', desc: 'W Bf tol+' }, { key: 'wBfTolMinus', desc: 'W Bf tol-' },
  { key: 'wAftTolPlus', desc: 'W Aft tol+' }, { key: 'wAftTolMinus', desc: 'W Aft tol-' },
  { key: 'sd', desc: 'SD (Ball Diam Bf)' }, { key: 'sdAft', desc: 'SD After' },
  { key: 'isYBall', desc: '1 if Y-Ball' }, { key: 'isBallInner', desc: '1 if Ball Inner' },
  { key: 'isABR', desc: '1 if ABR type' }, { key: 'isInner', desc: '1 if Inner' },
  { key: 'isIDtoOD', desc: '1 if ID-OD process' },
];

const FormulaManagerContent = () => {
  const { message, modal } = App.useApp();
  const { theme } = useTheme();
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    axios.get(server.MTC_FORMULAS)
      .then(r => {
        const names = r.data.machines || [];
        setMachines(names);
        if (names.length > 0) setSelectedMachine(prev => prev || names[0]);
      })
      .catch(() => message.error('Failed to load machine types'));
  }, [message]);

  const fetchFormulas = useCallback(async (machine) => {
    setLoading(true);
    try {
      const res = await axios.get(`${server.MTC_FORMULAS}/${machine}`);
      setFormulas(res.data.formulas || []);
    } catch (err) {
      message.error('Failed to fetch formulas');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (selectedMachine) fetchFormulas(selectedMachine);
  }, [selectedMachine, fetchFormulas]);

  const columns = [
    { title: 'Category', dataIndex: 'tool_category', key: 'tool_category', render: (cat) => <span>{cat || '-'}</span> },
    { title: 'Machine', dataIndex: 'tooling_type', key: 'tooling_type', render: (v) => v ? <Tag color="cyan">{v}</Tag> : <Text type="secondary">-</Text> },
    { title: 'Parameter', dataIndex: 'param_key', key: 'param_key', render: (key) => <Text strong>{key || ''}</Text> },
    { title: 'Formula', dataIndex: 'formula', key: 'formula', render: (f) => <Text code>{f || ''}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => {
            setEditingRecord(record);
            form.setFieldsValue(record);
            setIsModalOpen(true);
          }} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => {
             modal.confirm({
                title: 'Are you sure?',
                onOk: async () => {
                  try {
                    await axios.delete(`${server.MTC_FORMULAS}/${record.id}`);
                    fetchFormulas(selectedMachine);
                  } catch (err) {
                    message.error(err.response?.data?.error || 'Delete failed');
                  }
                }
             });
          }} />
        </Space>
      ),
    },
  ];

  const handleTestFormula = async () => {
    const formula = form.getFieldValue('formula');
    if (!formula) { message.warning('กรอก formula ก่อน'); return; }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${server.MTC_FORMULAS}/test`, {
        formula,
        context: {
          odBf: 30, odAft: 29.5,
          odBfTolPlus: 0.05, odBfTolMinus: -0.05,
          odAftTolPlus: 0.05, odAftTolMinus: -0.05,
          idBf: 20, idAft: 19.8,
          idBfTolPlus: 0.05, idBfTolMinus: -0.05,
          idAftTolPlus: 0.05, idAftTolMinus: -0.05,
          wBf: 12, wAft: 11.5,
          wBfTolPlus: 0.05, wBfTolMinus: -0.05,
          wAftTolPlus: 0.05, wAftTolMinus: -0.05,
          sd: 10, sdAft: 9.8,
          isYBall: 0, isBallInner: 0, isABR: 0, isInner: 0, isIDtoOD: 0,
        },
      });
      if (res.data?.valid) setTestResult({ ok: true, value: res.data.result });
      else setTestResult({ ok: false, value: res.data?.error || 'Invalid formula' });
    } catch (err) {
      setTestResult({ ok: false, value: err.response?.data?.error || 'Request failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingRecord?.id) {
        await axios.put(`${server.MTC_FORMULAS}/${editingRecord.id}`, values);
        message.success('Updated');
      } else {
        await axios.post(server.MTC_FORMULAS, { ...values, machine_name: selectedMachine });
        message.success('Created');
      }
      setIsModalOpen(false);
      fetchFormulas(selectedMachine);
    } catch (err) {
      if (err?.errorFields) return; // validation error, stay open
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout style={{ backgroundColor: theme.colors.background }}>
      <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <Title level={4}><CalculatorOutlined /> MTC Formula Manager</Title>
          <Space>
            <Select value={selectedMachine} onChange={setSelectedMachine} style={{ width: 150 }}>
              {machines.map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingRecord(null);
              form.resetFields();
              setIsModalOpen(true);
            }}>Add</Button>
          </Space>
        </div>
        <Card variant="borderless">
          <Table dataSource={formulas} columns={columns} loading={loading} rowKey="id" />
        </Card>
      </Content>

      <Modal
        title={editingRecord ? 'Edit Formula' : 'Add Formula'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => { setIsModalOpen(false); setTestResult(null); }}
        okText="Save"
        okButtonProps={{ loading: saving }}
        width={640}
        destroyOnClose
      >
        <Collapse ghost size="small" style={{ marginBottom: 12, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          <Collapse.Panel
            header={<span style={{ fontSize: 12 }}><InfoCircleOutlined /> ตัวแปรที่ใช้ได้ในสูตร (คลิกเพื่อแทรก)</span>}
            key="vars"
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {FORMULA_VARS.map(v => (
                <Tag
                  key={v.key}
                  style={{ cursor: 'pointer', marginBottom: 2 }}
                  title={v.desc}
                  onClick={() => {
                    const cur = form.getFieldValue('formula') || '';
                    form.setFieldValue('formula', cur + (cur && !cur.endsWith(' ') ? ' ' : '') + v.key);
                  }}
                >
                  {v.key}
                </Tag>
              ))}
            </div>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
              ตัวเลขทศนิยม: ใช้ round(x * 10^2) / 10^2 แทน round(x, 2) | ตรรกะ: and / or | เงื่อนไข: isYBall ? val1 : val2
            </Text>
          </Collapse.Panel>
        </Collapse>

        <Form form={form} layout="vertical">
          <Form.Item name="tool_category" label="Category">
            <Input placeholder="e.g. GRINDING" />
          </Form.Item>
          <Form.Item name="tooling_type" label="Machine" extra="สำหรับ CALC_COMMON: ระบุ physical machine ที่ formula นี้ใช้ เช่น KS-B22G, KS-B80, TSG-300ZNC, TSG300W">
            <Input placeholder="e.g. KS-B22G, KS-B80, TSG-300ZNC, TSG300W" />
          </Form.Item>
          <Form.Item name="param_key" label="Parameter" rules={[{ required: true }]}>
            <Input placeholder="e.g. speed_rpm" />
          </Form.Item>
          <Form.Item
            name="formula"
            label={
              <Space>
                <span>Formula</span>
                <Button size="small" type="link" icon={<PlayCircleOutlined />} loading={testLoading} onClick={handleTestFormula} style={{ padding: '0 4px' }}>
                  Test (sample data)
                </Button>
              </Space>
            }
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} placeholder="e.g. odAft * 3.14 / 2" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          {testResult && (
            <Alert
              message={testResult.ok ? `ผลลัพธ์: ${testResult.value}` : `Error: ${testResult.value}`}
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 8 }}
              closable
              onClose={() => setTestResult(null)}
            />
          )}
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

const FormulaManager = () => (
  <App>
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="admin-formula" defaultOpenKeys="admin-config" />
      <FormulaManagerContent />
    </Layout>
  </App>
);
export default FormulaManager;
