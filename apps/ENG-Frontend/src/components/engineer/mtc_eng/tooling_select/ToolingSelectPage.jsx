import React, { useState } from 'react';
import {
  Input, Button, Typography, Card, Space, Spin, Alert,
  Collapse, Table, Tag, Row, Col, Layout, Badge,
  Select, Form, Drawer, message, Popconfirm,
  Modal, Radio, InputNumber, AutoComplete
} from 'antd';
import {
  SearchOutlined,
  ToolOutlined,
  SettingOutlined,
  BlockOutlined,
  SwapOutlined,
  NodeIndexOutlined,
  BgColorsOutlined,
  AuditOutlined,
  DatabaseOutlined,
  SaveOutlined,
  CloseOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import ScrollbarStyle from '../../../common/scrollbar';

const { Content } = Layout;
const { Title, Text } = Typography;

// Generic Table Component
const isEmpty = (v) => v === null || v === undefined || v === '' || v === '-';

const ToolingTable = ({ title, dataSource, columns, headers, targets, icon }) => {
  if (!dataSource || dataSource.length === 0) return null;

  // กรองเฉพาะ column ที่มีข้อมูลอย่างน้อย 1 row หรือมีการตั้ง Target ไว้
  const visibleIndices = columns
    .map((colKey, i) => ({ colKey, i }))
    .filter(({ colKey, i }) => dataSource.some(row => !isEmpty(row[colKey])) || !isEmpty(targets[i]));

  const tableColumns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (_, __, index) => {
        const rank = index + 1;
        let color = 'default';
        if (rank === 1) color = '#ffc107';
        else if (rank === 2) color = '#adb5bd';
        else if (rank === 3) color = '#cd7f32';
        return rank <= 3 ? <Badge count={rank} style={{ backgroundColor: color }} /> : rank;
      }
    },
    {
      title: 'No',
      dataIndex: 'no',
      key: 'no',
      width: 120,
      render: (text) => <Text strong>{text}</Text>
    },
    ...visibleIndices.map(({ colKey, i }) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: '600' }}>{headers[i]}</div>
          {targets[i] !== undefined && targets[i] !== null && targets[i] !== '' && targets[i] !== '-' && (
            <div style={{
              fontSize: '10px',
              marginTop: '4px',
              padding: '2px 4px',
              backgroundColor: '#e6f7ff',
              color: '#1890ff',
              borderRadius: '4px',
              border: '1px solid #91d5ff'
            }}>
              Req: {targets[i]}
            </div>
          )}
        </div>
      ),
      dataIndex: colKey,
      key: colKey,
      align: 'center',
      render: (text) => text || '-'
    }))
  ];

  return (
    <Card
      size="small"
      title={<Space>{icon} <Text strong>{title}</Text></Space>}
      extra={<Badge count={dataSource.length} showZero color="#8c8c8c" />}
      style={{ marginBottom: 16, borderRadius: '8px', overflow: 'hidden' }}
      styles={{ body: { padding: 0 } }}
    >
      <Table
        dataSource={dataSource.map((item, idx) => ({ ...item, key: idx }))}
        columns={tableColumns}
        pagination={false}
        size="small"
        bordered
      />
    </Card>
  );
};

const ToolingSelectPage = () => {
  const { theme } = useTheme();
  const [cnInput, setCnInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ── Tool List state ──────────────────────────────────────────────────────
  const [isToolListOpen, setIsToolListOpen] = useState(false);
  const [invKey, setInvKey] = useState(null);
  const [invData, setInvData] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invEditingKey, setInvEditingKey] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [invToolingName, setInvToolingName] = useState(null);
  const [invForm] = Form.useForm();

  // ── Formula Setting state ────────────────────────────────────────────────
  const [isFormulaSettingOpen, setIsFormulaSettingOpen] = useState(false);
  const [formulaAllData, setFormulaAllData] = useState([]);
  const [formulaSettingLoading, setFormulaSettingLoading] = useState(false);
  const [formulaEdits, setFormulaEdits] = useState({});
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [formulaMachine, setFormulaMachine] = useState(null);
  const [formulaToolingName, setFormulaToolingName] = useState(null);
  const [isTfAddOpen, setIsTfAddOpen] = useState(false);
  const [tfAddLoading, setTfAddLoading] = useState(false);
  const [tfAddForm] = Form.useForm();

  // ── Add Tool state ───────────────────────────────────────────────────────
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [addMode, setAddMode] = useState('existing');
  const [tablesList, setTablesList] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [addSelectedTable, setAddSelectedTable] = useState(null);
  const [addDimCols, setAddDimCols] = useState([]);
  const [addToolingNameOptions, setAddToolingNameOptions] = useState([]);
  const [addToolForm] = Form.useForm();
  const [newMachineForm] = Form.useForm();
  const [addToolLoading, setAddToolLoading] = useState(false);
  const [createTableLoading, setCreateTableLoading] = useState(false);

  const toolingTables = [
    // tfMachine = machine_name ใน tooling_formula table
    { key: 'tsg300znc', label: 'TSG-300ZNC', table: 'tooling_tsg300', mf: r => !String(r.machine || '').toUpperCase().includes('W'), formulaMachine: 'CALC_COMMON', formulaFilter: 'TSG-300ZNC', tfMachine: 'TSG-300ZNC' },
    { key: 'tsg300w', label: 'TSG300W', table: 'tooling_tsg300', mf: r => String(r.machine || '').toUpperCase().includes('W'), formulaMachine: 'CALC_COMMON', formulaFilter: 'TSG300W', tfMachine: 'TSG300W' },
    { key: 'ksb22g', label: 'KS-B22G', table: 'tooling_ksb22g', formulaMachine: 'CALC_COMMON', formulaFilter: 'KS-B22G', tfMachine: 'KS-B22G' },
    { key: 'ksb80', label: 'KS-B80', table: 'tooling_ksb80', formulaMachine: 'CALC_COMMON', formulaFilter: 'KS-B80', tfMachine: 'KS-B80' },
    { key: 'ks03a', label: 'KS-03A', table: 'tooling_ks03a', formulaMachine: 'KS03A', formulaFilter: null, tfMachine: 'KS-03A' },
    { key: 'ksb22rd', label: 'KS-B22RD', table: 'tooling_ks03a', formulaMachine: 'KS03A', formulaFilter: null, tfMachine: 'KS-B22RD' },
    { key: 'ks400b', label: 'KS400B', table: 'tooling_ks400b', formulaMachine: 'KS400B', formulaFilter: null, tfMachine: 'KS400B' },
    { key: 'ks500rd', label: 'KS500RD', table: 'tooling_ks500rd', formulaMachine: 'KS500RD', formulaFilter: null, tfMachine: 'KS500RD' },
    { key: 'ks400b5', label: 'KS400B5', table: 'tooling_ks400b5', formulaMachine: 'KS400B5', formulaFilter: null, tfMachine: 'KS-400B5' },
    { key: 'ks400b6', label: 'KS400B6', table: 'tooling_ks400b6', formulaMachine: 'KS400B6', formulaFilter: null, tfMachine: 'KS400B6' },
  ];
  const invTableConfig = toolingTables.find(t => t.key === invKey);

  const fetchToolList = async (key) => {
    const cfg = toolingTables.find(t => t.key === key);
    if (!cfg) {
      setInvData([]);
      setInvToolingName(null);
      return;
    }
    setInvLoading(true);
    setInvToolingName(null);
    try {
      const res = await axios.get(`${server.MTC_TOOLING_INVENTORY}/${cfg.table}`);
      setInvData(res.data.data || []);
    } catch {
      message.error('Failed to fetch inventory data');
    } finally {
      setInvLoading(false);
    }
  };

  const invIsEditing = (record) => record.id === invEditingKey;

  const invEdit = (record) => { invForm.setFieldsValue({ ...record }); setInvEditingKey(record.id); };
  const invCancel = () => setInvEditingKey('');

  const invSave = async (id) => {
    try {
      if (!invTableConfig) return;
      const row = await invForm.validateFields();
      await axios.put(`${server.MTC_TOOLING_INVENTORY}/${invTableConfig.table}/${id}`, row);
      message.success('Updated');
      setInvEditingKey('');
      fetchToolList(invKey);
    } catch { }
  };

  const invFiltered = !invToolingName ? [] : invData.filter(item => {
    if (invTableConfig?.mf && !invTableConfig.mf(item)) return false;
    if (item.tooling_name !== invToolingName) return false;
    if (invSearch && !Object.values(item).some(val => String(val).toLowerCase().includes(invSearch.toLowerCase()))) return false;
    return true;
  });

  const getInvColumns = () => {
    if (invData.length === 0) return [];
    const dynamicCols = Object.keys(invData[0])
      .filter(key => !['id', 'created_at', 'updated_at', 'tooling_name', 'machine'].includes(key))
      .filter(key => {
        if (!key.startsWith('dim_')) return true;
        return invFiltered.some(row => !isEmpty(row[key]));
      })
      .map(key => ({
        title: key.startsWith('dim_') ? key.slice(4).toUpperCase() : key.replace(/_/g, ' ').toUpperCase(),
        dataIndex: key,
        key,
        editable: true,
        render: (text) => {
          if (key === 'tooling_no') return <Typography.Text strong>{text}</Typography.Text>;
          if (key === 'machine') return <Tag color="blue">{text}</Tag>;
          return text;
        }
      }));
    return [...dynamicCols, {
      title: 'Action', dataIndex: 'operation', fixed: 'right', width: 100,
      render: (_, record) => invIsEditing(record) ? (
        <Space>
          <Typography.Link onClick={() => invSave(record.id)}><SaveOutlined /> Save</Typography.Link>
          <Popconfirm title="Cancel?" onConfirm={invCancel}><Button type="link" danger size="small" style={{ padding: 0 }}><CloseOutlined /></Button></Popconfirm>
        </Space>
      ) : (
        <Button type="text" size="small" disabled={invEditingKey !== ''} onClick={() => invEdit(record)} icon={<EditOutlined style={{ color: colors.primary }} />} />
      )
    }];
  };

  const invMergedColumns = getInvColumns().map(col => {
    if (!col.editable) return col;
    return {
      ...col,
      onCell: (record) => ({
        record, dataIndex: col.dataIndex, title: col.title, editing: invIsEditing(record),
      }),
    };
  });

  const InvEditableCell = ({ editing, dataIndex, title, record, children, ...restProps }) => (
    <td {...restProps}>
      {editing ? (
        <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true, message: `${title}?` }]}>
          <Input size="small" />
        </Form.Item>
      ) : children}
    </td>
  );

  // invFiltered is declared above

  const invToolingNames = [...new Set(
    invData
      .filter(r => !invTableConfig?.mf || invTableConfig.mf(r))
      .map(r => r.tooling_name)
      .filter(Boolean)
  )].sort();

  // ── Add Tool helpers ─────────────────────────────────────────────────────
  const fetchTables = async () => {
    setTablesLoading(true);
    try {
      const res = await axios.get(server.MTC_TOOLING_TABLES);
      const tables = res.data.tables || [];
      setTablesList(tables);
      return tables;
    } catch { message.error('Failed to fetch tables'); return []; }
    finally { setTablesLoading(false); }
  };

  const onAddTableSelect = async (tableName) => {
    setAddSelectedTable(tableName);
    const tbl = tablesList.find(t => t.table_name === tableName);
    setAddDimCols(Array.isArray(tbl?.data_cols) ? tbl.data_cols : []);
    addToolForm.setFieldsValue({ tooling_name: undefined, tooling_no: undefined });
    try {
      const res = await axios.get(`${server.MTC_TOOLING_NAMES}/${tableName}`);
      setAddToolingNameOptions(res.data.names || []);
    } catch { setAddToolingNameOptions([]); }
  };

  const handleCreateTable = async () => {
    try {
      const vals = await newMachineForm.validateFields(['machineName', 'dimCount']);
      setCreateTableLoading(true);
      const res = await axios.post(server.MTC_TOOLING_CREATE_TABLE, vals);
      message.success(`Table "${res.data.tableName}" created! (${res.data.dimCount} dims)`);
      await fetchTables();
      newMachineForm.resetFields();
      setAddMode('existing');
    } catch (err) {
      if (err?.response) message.error(err.response.data.error || 'Failed to create table');
    } finally { setCreateTableLoading(false); }
  };

  const handleAddToolSubmit = async () => {
    if (!addSelectedTable) { message.warning('Select a machine table first'); return; }
    try {
      const vals = await addToolForm.validateFields();
      setAddToolLoading(true);
      await axios.post(`${server.MTC_TOOLING_INVENTORY}/${addSelectedTable}`, vals);
      message.success('Tool record added!');
      addToolForm.resetFields(['tooling_no', ...addDimCols]);
      if (isToolListOpen && invTableConfig.table === addSelectedTable) fetchToolList(invKey);
    } catch (err) {
      if (err?.response) message.error(err.response.data.error || 'Failed to add tool');
    } finally { setAddToolLoading(false); }
  };

  // ── Formula Setting helpers ──────────────────────────────────────────────

  const openFormulaSettings = async () => {
    const cfg = toolingTables.find(t => t.key === invKey);
    if (!cfg?.tfMachine || !invToolingName) {
      message.warning('กรุณาเลือก Machine และ Tool Name ก่อน');
      return;
    }
    setFormulaEdits({});
    setFormulaAllData([]);
    setIsTfAddOpen(false);
    setFormulaMachine(cfg.tfMachine);
    setFormulaToolingName(invToolingName);
    setIsFormulaSettingOpen(true);
    setFormulaSettingLoading(true);
    try {
      const res = await axios.get(`${server.MTC_TOOLING_FORMULA}/${cfg.tfMachine}`, {
        params: { tooling_name: invToolingName },
      });
      setFormulaAllData(res.data.formulas || []);
    } catch {
      message.error('Failed to load formula settings');
    } finally {
      setFormulaSettingLoading(false);
    }
  };

  const saveFormulaSettings = async () => {
    const edits = Object.entries(formulaEdits);
    if (!edits.length) { message.info('No changes'); return; }
    setFormulaSaving(true);
    try {
      await Promise.all(edits.map(([id, changes]) =>
        axios.put(`${server.MTC_TOOLING_FORMULA}/${id}`, changes)
      ));
      message.success('Saved');
      setFormulaEdits({});
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setFormulaSaving(false);
    }
  };

  const addToolingFormula = async () => {
    const cfg = toolingTables.find(t => t.key === invKey);
    if (!cfg) return;
    try {
      const vals = await tfAddForm.validateFields();
      setTfAddLoading(true);
      const res = await axios.post(server.MTC_TOOLING_FORMULA, {
        machine_name: cfg.tfMachine,
        tooling_name: invToolingName,
        ...vals,
      });
      setFormulaAllData(prev => [...prev, res.data.formula]);
      tfAddForm.resetFields();
      setIsTfAddOpen(false);
      message.success('Added');
    } catch (err) {
      if (err?.response) message.error(err.response.data?.error || 'Failed to add');
    } finally {
      setTfAddLoading(false);
    }
  };

  const deleteToolingFormula = async (id) => {
    try {
      await axios.delete(`${server.MTC_TOOLING_FORMULA}/${id}`);
      setFormulaAllData(prev => prev.filter(f => f.id !== id));
      setFormulaEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      message.success('Deleted');
    } catch {
      message.error('Delete failed');
    }
  };

  const openAddTool = async () => {
    setAddMode('existing');
    setAddSelectedTable(null);
    setAddDimCols([]);
    addToolForm.resetFields();
    newMachineForm.resetFields();
    setIsAddToolOpen(true);
    await fetchTables();
  };

  const colors = theme?.colors || {};
  const shadows = theme?.shadows || {};

  const handleSearch = async () => {
    const cn = cnInput.trim();
    if (!cn) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.post(server.MTC_TOOLING_SELECT_SEARCH, { cnNumber: cn });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Can not find C/N');
    } finally {
      setLoading(false);
    }
  };

  const buildResults = (res) => {
    if (!res) return [];
    const c = res.calc;
    const mData = [];

    // TSG-300ZNC & TSG300W — แสดงทั้งคู่เสมอถ้ามีข้อมูล TSG
    const zncChutes = res.chutes?.filter(item => !String(item.machine).toUpperCase().includes('W')) || [];
    const wChutes = res.chutes?.filter(item => String(item.machine).toUpperCase().includes('W')) || [];
    const hasTsg = zncChutes.length || res.carriersZNC?.length || wChutes.length || res.carriersW?.length;
    if (hasTsg) {
      const zncFound = (zncChutes.length ? 1 : 0) + (res.carriersZNC?.length ? 1 : 0);
      mData.push({
        name: 'TSG-300ZNC', group: 'FACE', found: zncFound, required: 2, tools: [
          { title: 'CHUTE', content: <ToolingTable title="CHUTE" dataSource={zncChutes} columns={['valA', 'valB', 'valC', 'valD']} headers={['A', 'B', 'C', 'D']} targets={[c?.chuteA, c?.chuteB, c?.chuteC, c?.chuteD]} icon={<SwapOutlined />} /> },
          { title: 'CARRIER', content: <ToolingTable title="CARRIER" dataSource={res.carriersZNC} columns={['valA', 'valB', 'valC', 'valD']} headers={['A', 'B', 'C', 'D']} targets={[c?.carrierA, c?.carrierB, c?.carrierC, '']} icon={<SettingOutlined />} /> },
        ]
      });
      const wFound = res.carriersW?.length ? 1 : 0;
      mData.push({
        name: 'TSG300W', group: 'FACE', found: wFound, required: 1, tools: [
          { title: 'CHUTE', content: <ToolingTable title="CHUTE" dataSource={wChutes} columns={['valA', 'valB', 'valC', 'valD']} headers={['A', 'B', 'C', 'D']} targets={[c?.chuteA, c?.chuteB, c?.chuteC, c?.chuteD]} icon={<SwapOutlined />} /> },
          { title: 'CARRIER', content: <ToolingTable title="CARRIER" dataSource={res.carriersW} columns={['valA', 'valB']} headers={['A', 'E']} targets={[c?.carrierA, '']} icon={<SettingOutlined />} /> },
        ]
      });
    }

    // KS400B
    const ks = res.ks400b?.calc;
    if (ks && !ks.error) {
      const found = (res.ks400b.workDrivers?.length ? 1 : 0) + (res.ks400b.loadingChutes?.length ? 1 : 0) + (res.ks400b.supportBlocks?.length ? 1 : 0) + (res.ks400b.plugsA?.length ? 1 : 0) + (res.ks400b.plugsB?.length ? 1 : 0);
      mData.push({
        name: 'KS400B', group: 'OD', found, required: 5, tools: [
          { title: 'WORK DRIVER', content: <ToolingTable title="WORK DRIVER" dataSource={res.ks400b.workDrivers} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6']} headers={['A', 'B', 'C', 'D', 'E', 'F']} targets={[ks.wd_A, ks.wd_B, ks.wd_C, ks.wd_D, ks.wd_E, ks.wd_F]} icon={<ToolOutlined />} /> },
          { title: 'LOADING CHUTE', content: <ToolingTable title="LOADING CHUTE" dataSource={res.ks400b.loadingChutes} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6']} headers={['A', 'B', 'C', 'D', 'E', 'F']} targets={[ks.lc_A, ks.lc_B, ks.lc_C, ks.lc_D, ks.lc_E, ks.lc_F]} icon={<SwapOutlined />} /> },
          { title: 'SUPPORT BLOCK', content: <ToolingTable title="SUPPORT BLOCK" dataSource={res.ks400b.supportBlocks} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[ks.sb_A, ks.sb_B, ks.sb_C, ks.sb_D, ks.sb_E]} icon={<BlockOutlined />} /> },
          { title: 'PLUG A', content: <ToolingTable title="PLUG A" dataSource={res.ks400b.plugsA} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[ks.pa_A, ks.pa_B, ks.pa_C, ks.pa_D, ks.pa_E]} icon={<NodeIndexOutlined />} /> },
          { title: 'PLUG B', content: <ToolingTable title="PLUG B" dataSource={res.ks400b.plugsB} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[ks.pb_A, ks.pb_B, ks.pb_C, ks.pb_D, ks.pb_E]} icon={<NodeIndexOutlined />} /> },
        ]
      });
    }

    // KS400B5
    const b5 = res.ks400b5?.calc;
    if (b5 && !b5.error) {
      const found = Object.keys(res.ks400b5).filter(k => k !== 'calc' && res.ks400b5[k]?.length).length;
      mData.push({
        name: 'KS400B5', group: 'OD', found, required: 10, tools: [
          { title: '1. WORK CLAMP', content: <ToolingTable title="1. WORK CLAMP" dataSource={res.ks400b5.workClamps} columns={['type', 'val1', 'val2', 'val3', 'val4', 'val5']} headers={['Type', 'A', 'B', 'C', 'D', 'E']} targets={[b5.workClamp?.Type, b5.workClamp?.A, b5.workClamp?.B, b5.workClamp?.C, b5.workClamp?.D, b5.workClamp?.E]} icon={<ToolOutlined />} /> },
          { title: '2. SHAFT', content: <ToolingTable title="2. SHAFT" dataSource={res.ks400b5.shafts} columns={['type', 'val1', 'val2', 'val3']} headers={['Type', 'A', 'B', 'C']} targets={[b5.shaft?.Type, b5.shaft?.A, b5.shaft?.B, b5.shaft?.C]} icon={<SettingOutlined />} /> },
          { title: '3. WORK CHUTE', content: <ToolingTable title="3. WORK CHUTE" dataSource={res.ks400b5.workChutes} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b5.workChute?.A, b5.workChute?.B, b5.workChute?.C, b5.workChute?.D]} icon={<SwapOutlined />} /> },
          { title: '4. WORK LOADER', content: <ToolingTable title="4. WORK LOADER" dataSource={res.ks400b5.workLoaders} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6', 'val7']} headers={['A', 'B', 'C', 'D', 'E', 'F', 'G']} targets={[b5.workLoader?.A, b5.workLoader?.B, b5.workLoader?.C, b5.workLoader?.D, b5.workLoader?.E, b5.workLoader?.F, b5.workLoader?.G]} icon={<BgColorsOutlined />} /> },
          { title: '5. WORK CHUCK', content: <ToolingTable title="5. WORK CHUCK" dataSource={res.ks400b5.workChucks} columns={['val1']} headers={['A']} targets={[b5.workChuck?.A]} icon={<BlockOutlined />} /> },
          { title: '6. WORK HOLDER', content: <ToolingTable title="6. WORK HOLDER" dataSource={res.ks400b5.workHolders} columns={['val1', 'val2']} headers={['A', 'B']} targets={[b5.workHolder?.A, b5.workHolder?.B]} icon={<ToolOutlined />} /> },
          { title: '7. CHUCK JAW', content: <ToolingTable title="7. CHUCK JAW" dataSource={res.ks400b5.chuckJaws} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b5.chuckJaw?.A, b5.chuckJaw?.B, b5.chuckJaw?.C, b5.chuckJaw?.D]} icon={<ToolOutlined />} /> },
          { title: '8. WORK CHUTE GUIDE', content: <ToolingTable title="8. WORK CHUTE GUIDE" dataSource={res.ks400b5.workChuteGuides} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b5.workChuteGuide?.A, b5.workChuteGuide?.B, b5.workChuteGuide?.C, b5.workChuteGuide?.D, b5.workChuteGuide?.E]} icon={<NodeIndexOutlined />} /> },
          { title: '9. STOPPER', content: <ToolingTable title="9. STOPPER" dataSource={res.ks400b5.stoppers} columns={['val1', 'val2']} headers={['A', 'B']} targets={[b5.stopper?.A, b5.stopper?.B]} icon={<BlockOutlined />} /> },
          { title: '10. MASTER RING', content: <ToolingTable title="10. MASTER RING" dataSource={res.ks400b5.masterRings} columns={['val1', 'val2', 'val3']} headers={['A', 'B', 'C']} targets={[b5.masterRingForJaw?.A, b5.masterRingForJaw?.B, b5.masterRingForJaw?.C]} icon={<AuditOutlined />} /> },
        ]
      });
    }

    // KS400B6
    const b6 = res.ks400b6?.calc;
    if (b6 && !b6.error) {
      const found = Object.keys(res.ks400b6).filter(k => k !== 'calc' && res.ks400b6[k]?.length).length;
      mData.push({
        name: 'KS400B6', group: 'OD', found, required: 9, tools: [
          { title: '1. WORK DRIVER', content: <ToolingTable title="1. WORK DRIVER" dataSource={res.ks400b6.workDrivers} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b6.workDriver?.A, b6.workDriver?.B, b6.workDriver?.C, b6.workDriver?.D, b6.workDriver?.E]} icon={<ToolOutlined />} /> },
          { title: '2. LOADING CHUTE', content: <ToolingTable title="2. LOADING CHUTE" dataSource={res.ks400b6.loadingChutes} columns={['val1', 'val2', 'val3', 'val4', 'val6']} headers={['A', 'B', 'C', 'D', 'F']} targets={[b6.loadingChute?.A, b6.loadingChute?.B, b6.loadingChute?.C, b6.loadingChute?.D, b6.loadingChute?.F]} icon={<SwapOutlined />} /> },
          { title: '3. PLUG', content: <ToolingTable title="3. PLUG" dataSource={res.ks400b6.plugs} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b6.plug?.A, b6.plug?.B, b6.plug?.C, b6.plug?.D]} icon={<NodeIndexOutlined />} /> },
          { title: '4. WORK GUIDE', content: <ToolingTable title="4. WORK GUIDE" dataSource={res.ks400b6.workGuides} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b6.workGuide?.A, b6.workGuide?.B, b6.workGuide?.C, b6.workGuide?.D, b6.workGuide?.E]} icon={<SettingOutlined />} /> },
          { title: '5. WORK PUSHER', content: <ToolingTable title="5. WORK PUSHER" dataSource={res.ks400b6.workPushers} columns={['val1', 'val2', 'val3']} headers={['A', 'B', 'C']} targets={[b6.workPusher?.A, b6.workPusher?.B, b6.workPusher?.C]} icon={<ToolOutlined />} /> },
          { title: '6. STOCKER CHUTE', content: <ToolingTable title="6. STOCKER CHUTE" dataSource={res.ks400b6.stockerChutes} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[b6.stockerChute?.A, b6.stockerChute?.B, b6.stockerChute?.C, b6.stockerChute?.D, b6.stockerChute?.E]} icon={<BlockOutlined />} /> },
          { title: '7. FRONT SHOE', content: <ToolingTable title="7. FRONT SHOE" dataSource={res.ks400b6.frontShoes} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b6.frontShoe?.A, b6.frontShoe?.B, b6.frontShoe?.C, b6.frontShoe?.D]} icon={<ToolOutlined />} /> },
          { title: '8. REAR SHOE', content: <ToolingTable title="8. REAR SHOE" dataSource={res.ks400b6.rearShoes} columns={['val1', 'val2', 'val3', 'val4']} headers={['A', 'B', 'C', 'D']} targets={[b6.rearShoe?.A, b6.rearShoe?.B, b6.rearShoe?.C, b6.rearShoe?.D]} icon={<ToolOutlined />} /> },
          { title: '9. PILOT PIN', content: <ToolingTable title="9. PILOT PIN" dataSource={res.ks400b6.pilotPins} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6']} headers={['A', 'B', 'C', 'D', 'E', 'F']} targets={[b6.pilotPin?.A, b6.pilotPin?.B, b6.pilotPin?.C, b6.pilotPin?.D, b6.pilotPin?.E, b6.pilotPin?.F]} icon={<NodeIndexOutlined />} /> },
        ]
      });
    }

    // KS500RD
    const ks5 = res.ks500rd?.calc;
    if (ks5 && !ks5.error) {
      const found = (res.ks500rd.workDrivers?.length ? 1 : 0) + (res.ks500rd.loadingPintles?.length ? 1 : 0) + (res.ks500rd.frontShoes?.length ? 1 : 0);
      mData.push({
        name: 'KS500RD', group: 'OD', found, required: 3, tools: [
          { title: 'WORK DRIVER', content: <ToolingTable title="WORK DRIVER" dataSource={res.ks500rd.workDrivers} columns={['val1', 'val2']} headers={['A', 'B']} targets={[ks5.wd?.A, ks5.wd?.B]} icon={<ToolOutlined />} /> },
          { title: 'LOADING PINTLE', content: <ToolingTable title="LOADING PINTLE" dataSource={res.ks500rd.loadingPintles} columns={['val1', 'val2', 'val3', 'val4', 'val5', 'val6', 'val7', 'val8']} headers={['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']} targets={[ks5.lp?.A, ks5.lp?.B, ks5.lp?.C, ks5.lp?.D, ks5.lp?.E, ks5.lp?.F, ks5.lp?.G, ks5.lp?.H]} icon={<SettingOutlined />} /> },
          { title: 'FRONT SHOE', content: <ToolingTable title="FRONT SHOE" dataSource={res.ks500rd.frontShoes} columns={['val1', 'val2', 'val3']} headers={['-', '-', '-']} targets={['', '', '']} icon={<ToolOutlined />} /> },
        ]
      });
    }

    // KS-03A & KS-B22RD — แสดงแค่เครื่องเดียวตาม idAft (>= 12 = KS-B22RD, < 12 = KS-03A)
    const ks3 = res.ks03a?.calc;
    if (ks3 && !ks3.error) {
      const found = Object.keys(res.ks03a).filter(k => k !== 'calc' && res.ks03a[k]?.length).length;
      const machineName = (res.part?.idAft ?? 0) >= 12.0 ? 'KS-B22RD' : 'KS-03A';
      const ks3Tools = [
        { title: 'FRONT PLATE', content: <ToolingTable title="FRONT PLATE" dataSource={res.ks03a.frontPlates} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.fp?.A, ks3.fp?.B, ks3.fp?.C, ks3.fp?.Type]} icon={<ToolOutlined />} /> },
        { title: 'CHUTE COVER', content: <ToolingTable title="CHUTE COVER" dataSource={res.ks03a.chuteCovers} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.chute?.A, ks3.chute?.B, ks3.chute?.C, ks3.chute?.Type]} icon={<SwapOutlined />} /> },
        { title: 'PRESSURE ROTOR', content: <ToolingTable title="PRESSURE ROTOR" dataSource={res.ks03a.pressureRotors} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.pr?.A, '', '', ks3.pr?.Type]} icon={<SettingOutlined />} /> },
        { title: 'PLUG GAUGE', content: <ToolingTable title="PLUG GAUGE" dataSource={res.ks03a.plugGauges} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.pg?.A, ks3.pg?.B, ks3.pg?.C, ks3.pg?.Type]} icon={<NodeIndexOutlined />} /> },
        { title: 'SETTING GAUGE', content: <ToolingTable title="SETTING GAUGE" dataSource={res.ks03a.settingGauges} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'M', 'Type']} targets={[ks3.sg?.A, ks3.sg?.B, ks3.sg?.C, ks3.sg?.M, ks3.sg?.Type]} icon={<AuditOutlined />} /> },
        { title: 'MASTER RING GAUGE', content: <ToolingTable title="MASTER RING GAUGE" dataSource={res.ks03a.masterRings} columns={['val1', 'val2', 'val3', 'val5']} headers={['A', 'B', 'C', 'Type']} targets={[ks3.mr?.A, ks3.mr?.B, ks3.mr?.C, '']} icon={<AuditOutlined />} /> },
        { title: 'CPX SHOE', content: <ToolingTable title="CPX SHOE" dataSource={res.ks03a.cpxShoes} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'D', 'C', 'V / M', 'Type']} targets={[ks3.cpxShoe?.A, ks3.cpxShoe?.D, ks3.cpxShoe?.C, ks3.cpxShoe?.V, ks3.cpxShoe?.Type]} icon={<ToolOutlined />} /> },
        { title: 'LOADER', content: <ToolingTable title="LOADER" dataSource={res.ks03a.loader} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'B', 'C', 'D', 'E']} targets={[`${ks3.ld?.A_min}-${ks3.ld?.A_max}`, ks3.ld?.B, ks3.ld?.C, ks3.ld?.D, ks3.ld?.E]} icon={<SwapOutlined />} /> },
        { title: 'ROLLER SHOE', content: <ToolingTable title="ROLLER SHOE" dataSource={res.ks03a.rollerShoes} columns={['val1', 'val2', 'val3', 'val4', 'val5']} headers={['A', 'C', 'D', 'B', 'Type']} targets={[ks3.rollerShoe?.A, ks3.rollerShoe?.C, ks3.rollerShoe?.D, ks3.rollerShoe?.B, ks3.rollerShoe?.Type]} icon={<ToolOutlined />} /> },
      ];
      mData.push({ name: machineName, group: 'ID', found, required: 9, tools: ks3Tools });
    }

    // KS-B22G / KS-B80
    if (res.jaws?.length || res.bps?.length) {
      const found = (res.jaws?.length ? 1 : 0) + (res.bps?.length ? 1 : 0);
      mData.push({
        name: 'KS-B22G / KS-B80', group: 'ID', found, required: 2, tools: [
          { title: 'JAW', content: <ToolingTable title="JAW" dataSource={res.jaws} columns={['val1', 'val2', 'val3', 'valD', 'valE']} headers={['A', 'B', 'C', 'D', 'E']} targets={[c.A, c.B, c.C, c.D_Limit, '']} icon={<ToolOutlined />} /> },
          { title: 'BACK PLATE', content: <ToolingTable title="BACK PLATE" dataSource={res.bps} columns={['val1', 'val2']} headers={['A', 'B']} targets={[c.AA, c.BB]} icon={<BlockOutlined />} /> },
        ]
      });
    }

    return mData;
  };

  const mData = buildResults(result);

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"4"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={colors.primary} />
        <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0, color: colors.primary }}>
              Tooling Selection System
            </Title>
            <Space>
              <Button
                icon={<DatabaseOutlined />}
                onClick={() => { setIsToolListOpen(true); fetchToolList(invKey); }}
              >
                Tool List
              </Button>
            </Space>
          </div>

          {/* Search Section */}
          <Card size="small" style={{ marginBottom: 16, borderRadius: '8px', boxShadow: shadows.sm }}>
            <Space.Compact style={{ width: '100%', maxWidth: 500 }}>
              <Input
                placeholder="C/N Number"
                value={cnInput}
                onChange={e => setCnInput(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                allowClear
              />
              <Button
                type="primary"
                onClick={handleSearch}
                loading={loading}
                style={{ background: colors.primary, borderColor: colors.primary }}
                disabled={!cnInput.trim()}
              >
                Search
              </Button>
            </Space.Compact>
          </Card>

          {error && (
            <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
          )}

          <Spin spinning={loading} tip="Searching...">
            {result ? (
              <>
                <Card size="small" style={{ marginBottom: 16, borderLeft: `4px solid ${colors.primary}`, borderRadius: '8px', boxShadow: shadows.sm }}>
                  <Row gutter={[24, 16]}>
                    <Col span={24}>
                      <Title level={5} style={{ margin: 0 }}>
                        C/N: <Tag color="blue" style={{ fontSize: '16px', padding: '4px 12px' }}>{result.cn}</Tag>
                        <Tag color="green">{(result.part.process || '').replace('→', '-').replace('—', '-')}</Tag>
                        <Tag color="purple">{result.part.type}</Tag>
                        <Tag color={result.part.yBall === 'Y' ? 'gold' : 'default'}>Y-Ball: {result.part.yBall}</Tag>
                      </Title>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}><Text type="secondary">OD (Outside Diameter)</Text></div>
                      <Space>
                        <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.odBf}</Text>
                        <SwapOutlined style={{ color: colors.primary }} />
                        <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.odAft}</Text>
                      </Space>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}><Text type="secondary">ID (Inside Diameter)</Text></div>
                      <Space>
                        <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.idBf}</Text>
                        <SwapOutlined style={{ color: colors.primary }} />
                        <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.idAft}</Text>
                      </Space>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 8 }}><Text type="secondary">W (Thickness)</Text></div>
                      <Space>
                        <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.wBf}</Text>
                        <SwapOutlined style={{ color: colors.primary }} />
                        <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.wAft}</Text>
                      </Space>
                    </Col>
                    {(result.part.sd > 0 || result.part.sdAft > 0) && (
                      <Col xs={24} md={8}>
                        <div style={{ marginBottom: 8 }}><Text type="secondary">SD (Ball Diameter)</Text></div>
                        <Space>
                          <Badge count="Bf" style={{ backgroundColor: '#8c8c8c' }} /><Text strong>{result.part.sd || '-'}</Text>
                          <SwapOutlined style={{ color: colors.primary }} />
                          <Badge count="Aft" style={{ backgroundColor: colors.primary }} /><Text strong style={{ color: colors.primary, fontSize: '16px' }}>{result.part.sdAft || '-'}</Text>
                        </Space>
                      </Col>
                    )}
                  </Row>
                </Card>

                <Collapse
                  items={mData.map(m => ({
                    key: m.name,
                    label: (
                      <Space>
                        <Text strong>{m.name}</Text>
                        <Tag color={m.group === 'FACE' ? 'blue' : m.group === 'OD' ? 'green' : 'purple'}>{m.group}</Tag>
                        {m.found < m.required && (
                          <Tag color="orange">{m.found}/{m.required} found</Tag>
                        )}
                      </Space>
                    ),
                    children: (
                      <div>
                        {m.tools.map(t => (
                          <div key={t.title}>{t.content}</div>
                        ))}
                      </div>
                    )
                  }))}
                  style={{ marginBottom: 16 }}
                />
              </>
            ) : (
              !loading && (
                <div style={{ textAlign: 'center', marginTop: 80, opacity: 0.5 }}>
                  <ToolOutlined style={{ fontSize: 64, marginBottom: 16, display: 'block', margin: '0 auto', color: colors.primary }} />
                  <Title level={5} type="secondary">Tooling Selection System</Title>
                  <Text type="secondary">C/N Number</Text>
                </div>
              )
            )}
          </Spin>
        </Content>
      </Layout>
      <Drawer
        title={
          <Space>
            <DatabaseOutlined />
            <span>Tool List</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddTool}>
            Add Tool
          </Button>
        }
        placement="right"
        width="85%"
        open={isToolListOpen}
        onClose={() => { setIsToolListOpen(false); setInvEditingKey(''); }}
        styles={{ body: { padding: '16px' } }}
      >
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space wrap>
            <Select
              value={invKey}
              style={{ width: 160 }}
              onChange={(val) => { setInvKey(val); fetchToolList(val); setInvEditingKey(''); setInvToolingName(null); }}
              placeholder="Machine"
              allowClear
            >
              {toolingTables.map(t => <Select.Option key={t.key} value={t.key}>{t.label}</Select.Option>)}
            </Select>
            <Select
              placeholder="Tool Name (All)"
              value={invToolingName}
              style={{ width: 180 }}
              allowClear
              onChange={v => { setInvToolingName(v || null); setInvEditingKey(''); }}
            >
              {invToolingNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
            </Select>
            <Button onClick={() => fetchToolList(invKey)}>Reload</Button>
            {invKey && invToolingName && (
              <Button
                icon={<SettingOutlined />}
                onClick={openFormulaSettings}
              >
                Formula Setting
              </Button>
            )}
          </Space>
          <Input
            placeholder="Search..."
            prefix={<SearchOutlined />}
            value={invSearch}
            onChange={e => setInvSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
        <Form form={invForm}>
          <Table
            components={{ body: { cell: InvEditableCell } }}
            bordered
            size="small"
            dataSource={invFiltered.map((r, i) => ({ ...r, key: r.id ?? i }))}
            columns={invMergedColumns}
            loading={invLoading}
            pagination={{ pageSize: 15, onChange: invCancel }}
            scroll={{ x: 'max-content' }}
            rowClassName="editable-row"
          />
        </Form>
      </Drawer>

      {/* ── Add Tool Modal ─────────────────────────────────────────────── */}
      <Modal
        title={<Space><PlusOutlined /><span>Add Tool Record</span></Space>}
        open={isAddToolOpen}
        onCancel={() => setIsAddToolOpen(false)}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Radio.Group
          value={addMode}
          onChange={e => setAddMode(e.target.value)}
          style={{ marginBottom: 20 }}
          buttonStyle="solid"
        >
          <Radio.Button value="existing">Existing Machine</Radio.Button>
          <Radio.Button value="new">New Machine</Radio.Button>
        </Radio.Group>

        {addMode === 'new' && (
          <Form form={newMachineForm} layout="vertical">
            <Form.Item
              label="Machine Name"
              name="machineName"
              rules={[{ required: true, message: 'Enter machine name' }]}
              extra="Will become table name: tooling_<machine_name>"
            >
              <Input placeholder="e.g. KSX100" />
            </Form.Item>
            <Form.Item label="Number of Dimensions" name="dimCount" initialValue={6}>
              <InputNumber min={1} max={26} style={{ width: 120 }} />
            </Form.Item>
            <Button
              type="primary"
              loading={createTableLoading}
              onClick={handleCreateTable}
              icon={<PlusOutlined />}
            >
              Create Table
            </Button>
          </Form>
        )}

        {addMode === 'existing' && (
          <Form form={addToolForm} layout="vertical">
            <Form.Item
              label="Machine / Table"
              required
            >
              <Select
                placeholder="Select machine table"
                loading={tablesLoading}
                onChange={onAddTableSelect}
                showSearch
                filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
              >
                {tablesList.map(t => (
                  <Select.Option key={t.table_name} value={t.table_name}>
                    {t.table_name.replace('tooling_', '').toUpperCase()}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {addSelectedTable && (
              <>
                <Form.Item
                  label="Tooling Name (Type)"
                  name="tooling_name"
                  rules={[{ required: true, message: 'Enter tooling name' }]}
                >
                  <AutoComplete
                    options={addToolingNameOptions.map(n => ({ value: n }))}
                    placeholder="e.g. JAW, BACK PLATE, CARRIER..."
                    filterOption={(input, opt) =>
                      opt.value.toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="Tooling No."
                  name="tooling_no"
                  rules={[{ required: true, message: 'Enter tooling no.' }]}
                >
                  <Input placeholder="e.g. TSG-JAW-001" />
                </Form.Item>
                <Row gutter={12}>
                  {addDimCols.map(col => (
                    <Col key={col} xs={12} sm={8}>
                      <Form.Item label={`Dim ${col.slice(4).toUpperCase()}`} name={col}>
                        <Input placeholder={col.slice(4).toUpperCase()} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Button
                  type="primary"
                  loading={addToolLoading}
                  onClick={handleAddToolSubmit}
                  icon={<PlusOutlined />}
                  block
                >
                  Add Tool
                </Button>
              </>
            )}
          </Form>
        )}
      </Modal>
      {/* ── Formula Setting Modal ──────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>Formula Setting</span>
            <Tag color="blue">{formulaMachine}</Tag>
            <Tag color="green">{formulaToolingName}</Tag>
          </Space>
        }
        open={isFormulaSettingOpen}
        onCancel={() => setIsFormulaSettingOpen(false)}
        width={940}
        destroyOnHidden
        footer={[
          <Button key="add" icon={<PlusOutlined />} onClick={() => { setIsTfAddOpen(v => !v); tfAddForm.resetFields(); }}>
            Add Formula
          </Button>,
          <Button key="close" onClick={() => setIsFormulaSettingOpen(false)}>
            Close
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={formulaSaving}
            disabled={!Object.keys(formulaEdits).length}
            onClick={saveFormulaSettings}
          >
            Save Changes ({Object.keys(formulaEdits).length})
          </Button>,
        ]}
      >
        {isTfAddOpen && (
          <Card
            size="small"
            style={{ marginBottom: 12, background: '#fafafa', borderStyle: 'dashed' }}
            title={<Text type="secondary" style={{ fontSize: 12 }}>New Formula — {formulaMachine} / {formulaToolingName}</Text>}
          >
            <Form form={tfAddForm} layout="inline" size="small">
              <Form.Item name="parameter_name" label="Param" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="A, B, C..." style={{ width: 80 }} />
              </Form.Item>
              <Form.Item name="formula_type" label="Type" initialValue="expression">
                <Select style={{ width: 110 }}>
                  <Select.Option value="expression">expression</Select.Option>
                  <Select.Option value="condition">condition</Select.Option>
                  <Select.Option value="limit">limit</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="formula_value" label="Formula" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. part.odAft + 0.2" style={{ width: 240, fontFamily: 'monospace', fontSize: 12 }} />
              </Form.Item>
              <Form.Item name="rounding_rule" label="Round" initialValue="none">
                <Select style={{ width: 80 }}>
                  <Select.Option value="none">none</Select.Option>
                  <Select.Option value="ceil">ceil</Select.Option>
                  <Select.Option value="floor">floor</Select.Option>
                  <Select.Option value="round">round</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="rounding_precision" label="Prec" initialValue={2}>
                <InputNumber min={0} max={6} style={{ width: 60 }} />
              </Form.Item>
              <Form.Item name="remark" label="Remark">
                <Input placeholder="optional" style={{ width: 140 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} loading={tfAddLoading} onClick={addToolingFormula}>
                  Add
                </Button>
              </Form.Item>
            </Form>
          </Card>
        )}

        <Spin spinning={formulaSettingLoading}>
          {!formulaSettingLoading && formulaAllData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <SettingOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
              ไม่พบ formula config สำหรับ <strong>{formulaMachine}</strong> / <strong>{formulaToolingName}</strong>
            </div>
          ) : (
            <Table
              dataSource={formulaAllData.map(r => ({ ...r, key: r.id }))}
              size="small"
              pagination={false}
              bordered
              scroll={{ y: 420 }}
              columns={[
                {
                  title: 'Param',
                  dataIndex: 'parameter_name',
                  width: 70,
                  render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
                },
                {
                  title: 'Type',
                  dataIndex: 'formula_type',
                  width: 110,
                  render: (v, record) => (
                    <Select
                      size="small"
                      style={{ width: 100 }}
                      value={formulaEdits[record.id]?.formula_type ?? v}
                      onChange={val => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], formula_type: val } }))}
                    >
                      <Select.Option value="expression">expression</Select.Option>
                      <Select.Option value="condition">condition</Select.Option>
                      <Select.Option value="limit">limit</Select.Option>
                    </Select>
                  ),
                },
                {
                  title: 'Formula',
                  dataIndex: 'formula_value',
                  render: (v, record) => (
                    <Input.TextArea
                      size="small"
                      rows={2}
                      style={{ fontFamily: 'monospace', fontSize: 11 }}
                      value={formulaEdits[record.id]?.formula_value ?? v}
                      onChange={e => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], formula_value: e.target.value } }))}
                    />
                  ),
                },
                {
                  title: 'Round',
                  dataIndex: 'rounding_rule',
                  width: 90,
                  render: (v, record) => (
                    <Select
                      size="small"
                      style={{ width: 80 }}
                      value={formulaEdits[record.id]?.rounding_rule ?? v}
                      onChange={val => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], rounding_rule: val } }))}
                    >
                      <Select.Option value="none">none</Select.Option>
                      <Select.Option value="ceil">ceil</Select.Option>
                      <Select.Option value="floor">floor</Select.Option>
                      <Select.Option value="round">round</Select.Option>
                    </Select>
                  ),
                },
                {
                  title: 'Prec',
                  dataIndex: 'rounding_precision',
                  width: 65,
                  render: (v, record) => (
                    <InputNumber
                      size="small"
                      min={0} max={6}
                      style={{ width: 55 }}
                      value={formulaEdits[record.id]?.rounding_precision ?? v}
                      onChange={val => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], rounding_precision: val } }))}
                    />
                  ),
                },
                {
                  title: 'Remark',
                  dataIndex: 'remark',
                  width: 140,
                  render: (v, record) => (
                    <Input
                      size="small"
                      value={formulaEdits[record.id]?.remark ?? (v || '')}
                      onChange={e => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], remark: e.target.value } }))}
                    />
                  ),
                },
                {
                  title: '',
                  dataIndex: 'action',
                  width: 40,
                  render: (_, record) => (
                    <Popconfirm title="ลบ formula นี้?" onConfirm={() => deleteToolingFormula(record.id)} okText="ลบ" cancelText="ยกเลิก">
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Modal>
    </Layout>
  );
};

export default ToolingSelectPage;
