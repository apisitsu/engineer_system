import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Typography, Card, Tabs, App,
  Table, Input, Button, Space, Popconfirm,
  Form, Select, Row, Col, Spin, Upload, Tag, Divider, Checkbox,
} from 'antd';
import {
  SaveOutlined, SearchOutlined, UploadOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';

const { Content } = Layout;
const { Title, Text } = Typography;

// ── Tab 1: Per-record Params ──────────────────────────────────────────────────

const PER_RECORD_KEYS = ['program_no', 'program_name', 'sds_rev', 'stamp_prepared', 'stamp_checked', 'stamp_approved'];
const REV_ROWS = [1, 2, 3, 4, 5];

const ParamsTab = ({ theme }) => {
  const { message } = App.useApp();
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [filteredMachineTypes, setFilteredMachineTypes] = useState([]);
  const [cn, setCn] = useState('');
  const [cnSearched, setCnSearched] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [grindingLabel, setGrindingLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then(r => setAllMachineTypes(r.data.filter(m => m.is_active)))
      .catch(() => { });
  }, []);

  const searchCn = async () => {
    if (!cn.trim()) { message.warning('Enter C/N'); return; }
    setLoading(true);
    setSelectedMachine(null);
    setSelectedMachineId(null);
    setGrindingLabel('');
    setFilteredMachineTypes([]);
    setCnSearched(false);
    form.resetFields();
    try {
      const res = await axios.get(server.MTC_SDS_V2_SEARCH, { params: { cn: cn.trim() } });
      const machineTypeCodes = [...new Set(
        (res.data.process_plan || [])
          .map(r => r.tool_dwg_no?.substring(1, 4))
          .filter(Boolean)
      )];
      const filtered = allMachineTypes.filter(m => machineTypeCodes.includes(m.machine_type_code));
      setFilteredMachineTypes(filtered.length ? filtered : allMachineTypes);
      if (filtered.length === 1) {
        setSelectedMachine(filtered[0].machine_type_name);
        setSelectedMachineId(filtered[0].id);
        setGrindingLabel(filtered[0].grinding_area_label || '');
      }
      setCnSearched(true);
      if (!filtered.length) message.info('ไม่พบ machine type ที่ match — แสดงทั้งหมด');
    } catch (err) {
      message.error(err.response?.data?.error || 'CN not found');
    } finally {
      setLoading(false);
    }
  };

  const handleMachineSelect = (v) => {
    setSelectedMachine(v);
    form.resetFields();
    const mt = (filteredMachineTypes.length ? filteredMachineTypes : allMachineTypes).find(m => m.machine_type_name === v);
    setSelectedMachineId(mt?.id || null);
    setGrindingLabel(mt?.grinding_area_label || '');
  };

  const loadParams = async () => {
    if (!cn.trim() || !selectedMachine) { message.warning('Select machine type'); return; }
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_PARAMETERS, {
        params: { cn: cn.trim(), machine_type_name: selectedMachine },
      });
      const map = {};
      res.data.forEach(r => { map[r.param_key] = r.param_value || ''; });
      form.setFieldsValue(map);
    } catch (err) {
      message.error(err.response?.data?.error || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const saveParams = async () => {
    if (!cn.trim() || !selectedMachine) { message.warning('Enter C/N and select machine type first'); return; }
    setSaving(true);
    try {
      const calls = [];
      // Per-CN params
      const vals = form.getFieldsValue();
      const params = Object.entries(vals).map(([param_key, param_value]) => ({ param_key, param_value: param_value || null }));
      calls.push(axios.put(server.MTC_SDS_V2_ADMIN_PARAMETERS_BULK, { cn: cn.trim(), machine_type_name: selectedMachine, params }));
      // Grinding area label (machine-type level)
      if (selectedMachineId) {
        calls.push(axios.put(`${server.MTC_SDS_V2_ADMIN_MACHINE_TYPES}/${selectedMachineId}`, { grinding_area_label: grindingLabel }));
      }
      await Promise.all(calls);
      message.success('Saved');
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const machineOptions = (cnSearched ? filteredMachineTypes : allMachineTypes).map(m => ({
    value: m.machine_type_name,
    label: `${m.machine_type_code} — ${m.machine_type_name || '(no name)'}`,
  }));

  return (
    <Spin spinning={loading}>
      <Row gutter={8} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Input placeholder="C/N Number" value={cn}
            onChange={e => { setCn(e.target.value); setCnSearched(false); setFilteredMachineTypes([]); setSelectedMachine(null); setSelectedMachineId(null); setGrindingLabel(''); }}
            onPressEnter={searchCn} style={{ width: 200 }} allowClear />
        </Col>
        <Col>
          <Button icon={<SearchOutlined />} onClick={searchCn}>Search CN</Button>
        </Col>
        <Col>
          <Select showSearch placeholder={cnSearched ? `Machine Type (${(filteredMachineTypes.length || allMachineTypes.length)} รายการ)` : 'Machine Type'}
            value={selectedMachine} onChange={handleMachineSelect}
            style={{ width: 300 }}
            filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
            options={machineOptions}
            disabled={!cnSearched} />
        </Col>
        <Col>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadParams} disabled={!selectedMachine}>Load</Button>
        </Col>
      </Row>

      <Form form={form} layout="vertical">
        <Divider orientation="left" plain>Header</Divider>
        <Row gutter={16}>
          {PER_RECORD_KEYS.map(k => (
            <Col key={k} span={8}>
              <Form.Item name={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}>
                <Input />
              </Form.Item>
            </Col>
          ))}
          <Col span={8}>
            <Form.Item
              label={<span>Grinding Area Label</span>}
            >
              <Input
                value={grindingLabel}
                onChange={e => setGrindingLabel(e.target.value)}
                disabled={!selectedMachine}
                placeholder="GRINDING AREA"
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Revision Log</Divider>
        {REV_ROWS.map(n => (
          <Row key={n} gutter={8} align="middle" style={{ marginBottom: 8 }}>
            <Col flex="none"><Text type="secondary" style={{ width: 24, display: 'inline-block' }}>#{n}</Text></Col>
            {['rev', 'ecn_no', 'date', 'description', 'remark'].map(field => (
              <Col key={field} flex={field === 'description' ? '2' : '1'}>
                <Form.Item name={`${field}_${n}`} label={field} style={{ marginBottom: 0 }}>
                  <Input size="small" placeholder={field} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        ))}

        <div style={{ marginTop: 16 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={saveParams} loading={saving}>
            Save All
          </Button>
        </div>
      </Form>
    </Spin>
  );
};

// ── Tab 3: Images ─────────────────────────────────────────────────────────────

const CN_PREFIX_OPTIONS = [
  // BALL
  { value: 'C31', label: 'C31 — BALL' },
  { value: 'C32', label: 'C32 — BALL' },
  { value: 'C33', label: 'C33 — BALL' },
  { value: 'C34', label: 'C34 — BALL' },
  { value: 'C35', label: 'C35 — BALL' },
  { value: 'C37', label: 'C37 — BALL' },
  { value: 'C38', label: 'C38 — BALL' },
  { value: 'C39', label: 'C39 — BALL' },
  // RACE
  { value: 'C21', label: 'C21 — RACE' },
  { value: 'C22', label: 'C22 — RACE' },
  { value: 'C23', label: 'C23 — RACE' },
  { value: 'C24', label: 'C24 — RACE' },
  { value: 'C25', label: 'C25 — RACE' },
  { value: 'C26', label: 'C26 — RACE' },
  { value: 'C27', label: 'C27 — RACE' },
  { value: 'C28', label: 'C28 — RACE' },
  { value: 'C29', label: 'C29 — RACE' },
  // BODY (C1x)
  { value: 'C11', label: 'C11 — BODY' },
  { value: 'C12', label: 'C12 — BODY' },
  { value: 'C13', label: 'C13 — BODY' },
  { value: 'C14', label: 'C14 — BODY' },
  { value: 'C15', label: 'C15 — BODY' },
  { value: 'C16', label: 'C16 — BODY' },
  { value: 'C17', label: 'C17 — BODY' },
  { value: 'C18', label: 'C18 — BODY' },
  { value: 'C19', label: 'C19 — BODY' },
  // BODY (C5x)
  { value: 'C51', label: 'C51 — BODY' },
  { value: 'C52', label: 'C52 — BODY' },
  { value: 'C53', label: 'C53 — BODY' },
  { value: 'C54', label: 'C54 — BODY' },
  { value: 'C55', label: 'C55 — BODY' },
  { value: 'C56', label: 'C56 — BODY' },
  { value: 'C57', label: 'C57 — BODY' },
  { value: 'C58', label: 'C58 — BODY' },
  { value: 'C59', label: 'C59 — BODY' },
  // SLEEVE
  { value: 'C61', label: 'C61 — SLEEVE' },
  { value: 'C62', label: 'C62 — SLEEVE' },
  { value: 'C63', label: 'C63 — SLEEVE' },
  { value: 'C64', label: 'C64 — SLEEVE' },
  { value: 'C69', label: 'C69 — SLEEVE' },
  // SPHERICAL
  { value: 'A41', label: 'A41 — SPHERICAL' },
  { value: 'A42', label: 'A42 — SPHERICAL' },
  { value: 'A43', label: 'A43 — SPHERICAL' },
  { value: 'A44', label: 'A44 — SPHERICAL' },
  { value: 'A48', label: 'A48 — SPHERICAL' },
  { value: 'A49', label: 'A49 — SPHERICAL' },
];

const ToolingImagesTab = ({ theme }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dwgNo, setDwgNo] = useState('');
  const [selectedTool, setSelectedTool] = useState(null); // { tool_dwg_no, tool_name, machine_type }
  const [lookupLoading, setLookupLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [allMachineTypes, setAllMachineTypes] = useState([]);

  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then(r => setAllMachineTypes(r.data))
      .catch(() => { });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_IMAGES_TOOLING);
      setRows(res.data);
    } catch (err) {
      message.error('Load failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const handleLookup = async () => {
    if (!dwgNo.trim()) return;
    setLookupLoading(true);
    setSelectedTool(null);
    try {
      const res = await axios.get(server.MTC_SDS_V2_IMAGES_TOOLING_SEARCH, { params: { q: dwgNo.trim() } });
      if (!res.data.length) { message.warning('ไม่พบ tool DWG No นี้ใน database'); return; }
      const tool = res.data[0];
      setSelectedTool(tool);
      setDwgNo(tool.tool_dwg_no);
    } catch (err) {
      message.error(err.response?.data?.error || 'Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!dwgNo.trim()) { message.warning('Enter Tool DWG No'); return; }
    if (!fileList.length) { message.warning('Select an image file'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('tool_dwg_no', dwgNo.trim());
      fd.append('image', fileList[0].originFileObj);
      await axios.post(server.MTC_SDS_V2_IMAGES_TOOLING, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Uploaded');
      setDwgNo(''); setFileList([]); setSelectedTool(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (tool_dwg_no) => {
    try {
      await axios.delete(`${server.MTC_SDS_V2_IMAGES_TOOLING}/${encodeURIComponent(tool_dwg_no)}`);
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const inferredMachineTag = (tool_dwg_no) => {
    const code = tool_dwg_no?.substring(1, 4);
    const mt = allMachineTypes.find(m => m.machine_type_code === code);
    return mt ? <Tag color="blue">{mt.machine_type_code} — {mt.machine_type_name || '(no name)'}</Tag> : <Tag>{code}</Tag>;
  };

  const cols = [
    { title: 'Tool DWG No', dataIndex: 'tool_dwg_no', width: 180 },
    { title: 'Tool Name', dataIndex: 'tool_name', render: v => v || <Text type="secondary">-</Text> },
    { title: 'Machine Type', key: 'mt', width: 180, render: (_, row) => inferredMachineTag(row.tool_dwg_no) },
    { title: 'File', dataIndex: 'file_name' },
    { title: 'Updated', dataIndex: 'updated_at', width: 160, render: v => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '',
      key: 'del',
      width: 80,
      render: (_, row) => (
        <Popconfirm title="Delete image?" onConfirm={() => handleDelete(row.tool_dwg_no)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16, background: theme.colors.cardBackground }} title="Upload Tooling Image">
        <Row gutter={8} align="bottom">
          <Col>
            <div style={{ marginBottom: 4 }}><Text>Tool DWG No</Text></div>
            <Input.Search
              value={dwgNo}
              onChange={e => { setDwgNo(e.target.value); setSelectedTool(null); }}
              onSearch={handleLookup}
              onPressEnter={handleLookup}
              placeholder="e.g. 4866-01"
              style={{ width: 260 }}
              loading={lookupLoading}
              enterButton={<SearchOutlined />}
              allowClear
              onClear={() => { setDwgNo(''); setSelectedTool(null); }}
            />
            {selectedTool && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{selectedTool.tool_name}</Text>
                <span style={{ marginLeft: 8 }}>{inferredMachineTag(selectedTool.tool_dwg_no)}</span>
              </div>
            )}
            {dwgNo && !selectedTool && !lookupLoading && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Enter or 🔍 Tool name</Text>
              </div>
            )}
          </Col>
          <Col>
            <div style={{ marginBottom: 4 }}><Text>Image File</Text></div>
            <Upload
              accept="image/*"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <Button icon={<UploadOutlined />}>Select</Button>
            </Upload>
          </Col>
          <Col>
            <Button type="primary" loading={uploading} onClick={handleUpload}>Upload</Button>
          </Col>
        </Row>
      </Card>

      <Table
        loading={loading}
        dataSource={rows.map(r => ({ ...r, key: r.id }))}
        columns={cols}
        size="small"
        pagination={{ pageSize: 50 }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

const GrindingImagesTab = ({ theme }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_IMAGES_GRINDING);
      setRows(res.data);
    } catch (err) {
      message.error('Load failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!fileList.length) { message.warning('Select an image file'); return; }
    try {
      const vals = await form.validateFields();
      setUploading(true);
      const fd = new FormData();
      fd.append('cn_prefix', vals.cn_prefix);
      if (vals.process_code) fd.append('process_code', vals.process_code);
      fd.append('image', fileList[0].originFileObj);
      await axios.post(server.MTC_SDS_V2_IMAGES_GRINDING, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Uploaded');
      form.resetFields(); setFileList([]);
      load();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${server.MTC_SDS_V2_IMAGES_GRINDING}/${id}`);
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const cols = [
    { title: 'CN Prefix', dataIndex: 'cn_prefix', width: 100 },
    { title: 'Process Code', dataIndex: 'process_code', width: 140, render: v => v || <Tag>default</Tag> },
    { title: 'File', dataIndex: 'file_name' },
    { title: 'Updated', dataIndex: 'updated_at', width: 160, render: v => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '',
      key: 'del',
      width: 80,
      render: (_, row) => (
        <Popconfirm title="Delete image?" onConfirm={() => handleDelete(row.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16, background: theme.colors.cardBackground }} title="Upload Grinding Layout Image">
        <Form form={form} layout="inline">
          <Form.Item name="cn_prefix" label="CN Prefix" rules={[{ required: true }]}>
            <Select options={CN_PREFIX_OPTIONS} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="process_code" label="Process Code">
            <Input placeholder="e.g. IDG001 (optional)" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Upload accept="image/*" maxCount={1} fileList={fileList} beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}>
              <Button icon={<UploadOutlined />}>Select</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={uploading} onClick={handleUpload}>Upload</Button>
          </Form.Item>
        </Form>
      </Card>

      <Table
        loading={loading}
        dataSource={rows.map(r => ({ ...r, key: r.id }))}
        columns={cols}
        size="small"
        pagination={{ pageSize: 50 }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

// ── Tab 4: Machine Config (A16:I55) ──────────────────────────────────────────

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const EXCLUDED_ROWS = new Set([17, 27, 37, 47]);
const ROW_RANGE = Array.from({ length: 40 }, (_, i) => i + 16).filter(r => !EXCLUDED_ROWS.has(r));

const MachineConfigTab = ({ theme }) => {
  const { message } = App.useApp();
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [cellData, setCellData] = useState({});  // row_N_X → text value
  const [cellTypes, setCellTypes] = useState({});  // row_N_X → 'value' | '' (label/unit)
  const [rowHeaders, setRowHeaders] = useState({});  // rowNum → true/false
  const [origKeys, setOrigKeys] = useState(new Set());
  const [listLoading, setListLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES, {
        params: search ? { search } : {},
      });
      setAllMachineTypes(res.data.filter(m => m.is_active));
    } catch (err) {
      message.error(err.response?.data?.error || 'Load failed');
    } finally {
      setListLoading(false);
    }
  }, [search, message]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadConfig = useCallback(async (machineName) => {
    setSelectedMachine(machineName);
    setConfigLoading(true);
    setCellData({});
    setCellTypes({});
    setRowHeaders({});
    setOrigKeys(new Set());
    setDirty(false);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_PARAMETERS, {
        params: { cn: 'null', machine_type_name: machineName },
      });
      const map = {}, types = {}, headers = {}, keys = new Set();
      res.data.forEach(r => {
        keys.add(r.param_key);
        // row_N_is_header
        const hdrMatch = r.param_key.match(/^row_(\d+)_is_header$/);
        if (hdrMatch) { headers[parseInt(hdrMatch[1])] = r.param_value === '1'; return; }
        // row_N_X_type
        const typeMatch = r.param_key.match(/^row_(\d+)_([A-I])_type$/i);
        if (typeMatch) { types[`row_${typeMatch[1]}_${typeMatch[2].toUpperCase()}`] = r.param_value || ''; return; }
        // row_N_X  (cell value)
        map[r.param_key] = r.param_value || '';
      });
      setCellData(map);
      setCellTypes(types);
      setRowHeaders(headers);
      setOrigKeys(keys);
    } catch (err) {
      message.error(err.response?.data?.error || 'Load failed');
    } finally {
      setConfigLoading(false);
    }
  }, [message]);

  const markDirty = () => setDirty(true);

  const handleCellChange = (rowNum, c, val) => {
    setCellData(prev => ({ ...prev, [`row_${rowNum}_${c}`]: val }));
    markDirty();
  };

  const handleTypeToggle = (rowNum, c) => {
    const key = `row_${rowNum}_${c}`;
    setCellTypes(prev => ({ ...prev, [key]: prev[key] === 'value' ? '' : 'value' }));
    markDirty();
  };

  const handleHeaderToggle = (rowNum, checked) => {
    setRowHeaders(prev => ({ ...prev, [rowNum]: checked }));
    markDirty();
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const params = [];
      // Cell values
      for (const rowNum of ROW_RANGE) {
        for (const c of COL_LETTERS) {
          const key = `row_${rowNum}_${c}`;
          const val = cellData[key] || '';
          if (val || origKeys.has(key)) params.push({ param_key: key, param_value: val || null });
        }
      }
      // Cell types
      for (const rowNum of ROW_RANGE) {
        for (const c of COL_LETTERS) {
          const cellKey = `row_${rowNum}_${c}`;
          const typeKey = `${cellKey}_type`;
          const typeVal = cellTypes[cellKey] || '';
          if (typeVal || origKeys.has(typeKey)) params.push({ param_key: typeKey, param_value: typeVal || null });
        }
      }
      // Row header flags
      for (const rowNum of ROW_RANGE) {
        const hdrKey = `row_${rowNum}_is_header`;
        const hdrVal = rowHeaders[rowNum] ? '1' : '';
        if (hdrVal || origKeys.has(hdrKey)) params.push({ param_key: hdrKey, param_value: hdrVal || null });
      }

      await axios.put(server.MTC_SDS_V2_ADMIN_PARAMETERS_BULK, {
        cn: null, machine_type_name: selectedMachine, params,
      });
      message.success(`Saved`);
      setDirty(false);
      setOrigKeys(new Set(params.filter(p => p.param_value).map(p => p.param_key)));
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const machineListCols = [
    { title: 'Code', dataIndex: 'machine_type_code', width: 90 },
    { title: 'Machine Name', dataIndex: 'machine_type_name' },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          type={selectedMachine === row.machine_type_name ? 'primary' : 'default'}
          onClick={() => loadConfig(row.machine_type_name)}
        >
          {selectedMachine === row.machine_type_name ? 'Loaded' : 'Load Config'}
        </Button>
      ),
    },
  ];

  const configGridCols = [
    {
      title: 'Row',
      dataIndex: 'rowNum',
      width: 50,
      fixed: 'left',
      onCell: (record) => ({ style: { backgroundColor: rowHeaders[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: v => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Hdr',
      key: 'hdr',
      width: 44,
      fixed: 'left',
      onCell: (record) => ({ style: { backgroundColor: rowHeaders[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (_, record) => (
        <Checkbox
          checked={!!rowHeaders[record.rowNum]}
          onChange={e => handleHeaderToggle(record.rowNum, e.target.checked)}
        />
      ),
    },
    ...COL_LETTERS.map(c => ({
      title: c,
      key: c,
      width: 130,
      onCell: (record) => ({ style: { backgroundColor: rowHeaders[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (_, record) => {
        const cellKey = `row_${record.rowNum}_${c}`;
        const isValue = cellTypes[cellKey] === 'value';
        return (
          <Input
            size="small"
            value={cellData[cellKey] || ''}
            onChange={e => handleCellChange(record.rowNum, c, e.target.value)}
            style={{ fontSize: 11, color: isValue ? '#ff4d4f' : undefined, backgroundColor: rowHeaders[record.rowNum] ? '#f5f5f5' : undefined }}
            suffix={
              <span
                title="Toggle: Label / Value"
                onClick={() => handleTypeToggle(record.rowNum, c)}
                style={{
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: isValue ? '#ff4d4f' : '#bfbfbf',
                  userSelect: 'none',
                }}
              >V</span>
            }
          />
        );
      },
    })),
  ];

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col>
          <Input.Search
            placeholder="Search code / name"
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            onSearch={loadList}
            style={{ width: 280 }}
            enterButton={<SearchOutlined />}
          />
        </Col>
        <Col><Button icon={<ReloadOutlined />} onClick={loadList}>Refresh</Button></Col>
      </Row>
      <Table
        loading={listLoading}
        dataSource={allMachineTypes.map(r => ({ ...r, key: r.id }))}
        columns={machineListCols}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false }}
        rowClassName={row => row.machine_type_name === selectedMachine ? 'ant-table-row-selected' : ''}
        style={{ marginBottom: 24 }}
      />

      {selectedMachine && (
        <Spin spinning={configLoading}>
          <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
            <Col><Text strong>{selectedMachine}</Text></Col>
            <Col flex="auto" />
            {dirty && <Col><Text type="warning" style={{ fontSize: 12 }}>มีการแก้ไขที่ยังไม่ได้ Save</Text></Col>}
            <Col>
              <Button type="primary" icon={<SaveOutlined />} onClick={saveConfig} loading={saving} disabled={!dirty}>
                Save
              </Button>
            </Col>
          </Row>
          <style>{`.sds-config-grid .sds-hdr-row td { background-color: #d9d9d9 !important; }`}</style>
          <Table
            className="sds-config-grid"
            dataSource={ROW_RANGE.map(rowNum => ({ key: rowNum, rowNum }))}
            columns={configGridCols}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content', y: 560 }}
            bordered
            style={{ fontFamily: 'monospace' }}
            rowClassName={record => rowHeaders[record.rowNum] ? 'sds-hdr-row' : ''}
          />
        </Spin>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const SdsV2AdminPage = () => {
  const { theme } = useTheme();

  const tabItems = [
    { key: 'params', label: 'Per-record Params', children: <ParamsTab theme={theme} /> },
    { key: 'machine-config', label: 'Machine Config', children: <MachineConfigTab theme={theme} /> },
    {
      key: 'images',
      label: 'Images',
      children: (
        <Tabs
          size="small"
          items={[
            { key: 'tooling', label: 'Tooling Images', children: <ToolingImagesTab theme={theme} /> },
            { key: 'grinding', label: 'Grinding Images', children: <GrindingImagesTab theme={theme} /> },
          ]}
        />
      ),
    },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ padding: 24, overflowY: 'auto' }}>
          <Title level={4} style={{ color: theme.colors.text, marginBottom: 16 }}>
            SDS v2 — Admin
          </Title>
          <Card style={{ background: theme.colors.cardBackground }}>
            <Tabs items={tabItems} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SdsV2AdminPage;
