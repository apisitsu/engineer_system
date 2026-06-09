import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layout, Typography, Card, Tabs, App, Space,
  Table, Input, Button, Popconfirm, AutoComplete,
  Form, Select, Row, Col, Spin, Upload, Tag, Divider, Checkbox, Image, Modal,
  InputNumber,
} from 'antd';
import {
  SaveOutlined, SearchOutlined, UploadOutlined, DeleteOutlined, ReloadOutlined,
  SettingOutlined, DownOutlined, UpOutlined, EditOutlined, PlusOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import MachineCodes from './MachineCodes';
import MachineTypes from './MachineTypes';

const { Content } = Layout;
const { Title, Text } = Typography;

// ── Tab 1: Per-record Params ──────────────────────────────────────────────────

const PER_RECORD_KEYS = ['program_no', 'program_name', 'sds_rev', 'stamp_prepared', 'stamp_checked', 'stamp_approved'];
const REV_ROWS = [1, 2, 3, 4, 5];

// Kept (unused) — Per-record Params tab was removed for now; Program No/Name moved to Excel Config.
// eslint-disable-next-line no-unused-vars
const ParamsTab = ({ theme }) => {
  const { message } = App.useApp();
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [filteredMachineTypes, setFilteredMachineTypes] = useState([]);
  const [cn, setCn] = useState('');
  const [cnSearched, setCnSearched] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRevLog, setShowRevLog] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then(r => {
        const seen = new Set();
        setAllMachineTypes(r.data.filter(m => m.is_active && m.machine_type_name && !seen.has(m.machine_type_name) && seen.add(m.machine_type_name)));
      })
      .catch(() => { });
  }, []);

  const searchCn = async () => {
    if (!cn.trim()) { message.warning('Enter C/N'); return; }
    setLoading(true);
    setSelectedMachine(null);
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
      }
      setCnSearched(true);
      if (!filtered.length) message.info('No machine type found — Show all');
    } catch (err) {
      message.error(err.response?.data?.error || 'CN not found');
    } finally {
      setLoading(false);
    }
  };

  const handleMachineSelect = (v) => {
    setSelectedMachine(v);
    form.resetFields();
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
      const vals = form.getFieldsValue();
      const params = Object.entries(vals).map(([param_key, param_value]) => ({ param_key, param_value: param_value || null }));
      await axios.put(server.MTC_SDS_V2_ADMIN_PARAMETERS_BULK, { cn: cn.trim(), machine_type_name: selectedMachine, params });
      message.success('Saved');
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const machineOptions = (cnSearched ? filteredMachineTypes : allMachineTypes).map(m => ({
    value: m.machine_type_name,
    label: `${m.machine_type_code} — ${m.machine_group || m.machine_type_name || '(no name)'}`,
  }));

  return (
    <Spin spinning={loading}>
      <Row gutter={8} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Input placeholder="C/N Number" value={cn}
            onChange={e => { setCn(e.target.value); setCnSearched(false); setFilteredMachineTypes([]); setSelectedMachine(null); }}
            onPressEnter={searchCn} style={{ width: 200 }} allowClear />
        </Col>
        <Col>
          <Button icon={<SearchOutlined />} onClick={searchCn}>Search CN</Button>
        </Col>
        <Col>
          <Select showSearch placeholder={cnSearched ? `Machine Type (${(filteredMachineTypes.length || allMachineTypes.length)} Item)` : 'Machine Type'}
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
        </Row>

        <Divider orientation="left" plain>
          Revision Log{' '}
          <Button
            type="link"
            size="small"
            icon={showRevLog ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setShowRevLog(v => !v)}
            style={{ padding: '0 4px' }}
          >
            {showRevLog ? 'Hide' : 'Show'}
          </Button>
        </Divider>
        {showRevLog && REV_ROWS.map(n => (
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
  const [options, setOptions] = useState([]);
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

  const handleLookup = async (value) => {
    if (!value || !value.trim()) {
      setOptions([]);
      return;
    }
    setLookupLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_IMAGES_TOOLING_SEARCH, { params: { q: value.trim() } });
      const grouped = {};
      res.data.forEach(t => {
        const match = t.tool_dwg_no.match(/([A-Z]?\d{4}-\d{2})/i);
        const baseDwg = match ? match[1] : t.tool_dwg_no;
        if (!grouped[baseDwg]) {
          grouped[baseDwg] = {
            value: baseDwg,
            label: `${baseDwg} — ${t.tool_name || '(No Name)'}`,
            tool: { ...t, tool_dwg_no: baseDwg }
          };
        }
      });
      setOptions(Object.values(grouped));
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
      if (selectedTool?.tool_name) {
        fd.append('description', selectedTool.tool_name);
      }
      fd.append('image', fileList[0].originFileObj);
      await axios.post(server.MTC_SDS_V2_IMAGES_TOOLING, fd); // Let axios set the correct multipart boundary
      message.success('Uploaded');
      setDwgNo(''); setOptions([]); setFileList([]); setSelectedTool(null);
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

  const inferredMachineName = (tool_dwg_no) => {
    if (!tool_dwg_no) return '-';
    if (!allMachineTypes || allMachineTypes.length === 0) {
      // Temporary fallback until data loads
      const match = tool_dwg_no.match(/(\d{3})/);
      return <Text type="secondary">{match ? match[1] : tool_dwg_no}</Text>;
    }
    // 1. Try to find if any machine_type_code exists inside tool_dwg_no (case-insensitive)
    const mt = allMachineTypes.find(m => {
      const c = String(m.machine_type_code).trim().toLowerCase();
      return c && tool_dwg_no.toLowerCase().includes(c);
    });
    if (mt) return <Text>{mt.machine_group || mt.machine_type_name || mt.machine_type_code}</Text>;

    // 2. Fallback to legacy extraction
    let code = tool_dwg_no.substring(1, 4);
    if (/^\d/.test(tool_dwg_no)) {
      code = tool_dwg_no.substring(0, 3);
    }
    return <Text type="secondary">{code}</Text>;
  };

  const cols = [
    {
      title: 'Preview',
      key: 'preview',
      width: 100,
      render: (_, row) => (
        <Image
          width={80}
          height={60}
          style={{ objectFit: 'contain', border: '1px solid #eee', borderRadius: 4 }}
          src={`${server.MTC_SDS_V2_IMAGES_TOOLING}/${encodeURIComponent(row.tool_dwg_no)}?token=${localStorage.getItem('token')}`}
          fallback="/image_m.png"
        />
      ),
    },
    { title: 'Tool DWG No', dataIndex: 'tool_dwg_no', width: 180 },
    { title: 'Tool Name', dataIndex: 'tool_name', render: v => v || <Text type="secondary">-</Text> },
    { title: 'Machine Name', key: 'mt', width: 220, render: (_, row) => inferredMachineName(row.tool_dwg_no) },
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
            <AutoComplete
              value={dwgNo}
              options={options}
              onSelect={(val, opt) => {
                setDwgNo(val);
                setSelectedTool(opt.tool);
              }}
              onChange={(val) => {
                setDwgNo(val);
                setSelectedTool(null);
              }}
              onSearch={handleLookup}
              style={{ width: 280 }}
            >
              <Input.Search
                //placeholder="e.g. 4866-01 (Type to search)"
                loading={lookupLoading}
                enterButton={<SearchOutlined />}
                onSearch={handleLookup}
                allowClear
                onClear={() => { setDwgNo(''); setSelectedTool(null); setOptions([]); }}
              />
            </AutoComplete>
            {selectedTool && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{selectedTool.tool_name}</Text>
                <span style={{ marginLeft: 8 }}>{inferredMachineName(selectedTool.tool_dwg_no)}</span>
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

const CN_PREFIX_LABEL_MAP = Object.fromEntries(CN_PREFIX_OPTIONS.map(o => [o.value, o.label]));

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
      fd.append('cn_prefixes', JSON.stringify(vals.cn_prefixes));
      fd.append('process_codes', JSON.stringify(vals.process_codes || []));
      fd.append('image', fileList[0].originFileObj);
      await axios.post(server.MTC_SDS_V2_IMAGES_GRINDING, fd);
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
    {
      title: 'Preview',
      key: 'preview',
      width: 100,
      render: (_, row) => (
        <Image
          width={80}
          height={60}
          style={{ objectFit: 'contain', border: '1px solid #eee', borderRadius: 4 }}
          src={`${server.MTC_SDS_V2_IMAGES_GRINDING}/view/${row.id}?token=${localStorage.getItem('token')}`}
          fallback="/image_m.png"
        />
      ),
    },
    {
      title: 'CN Prefixes',
      dataIndex: 'cn_prefixes',
      render: (v) => (
        <Space size={2} wrap>
          {(Array.isArray(v) ? v : [v]).map(p => (
            <Tag key={p}>{CN_PREFIX_LABEL_MAP[p] || p}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Process Codes',
      dataIndex: 'process_codes',
      width: 180,
      render: v => (Array.isArray(v) && v.length > 0)
        ? <Space size={2} wrap>{v.map(c => <Tag key={c}>{c}</Tag>)}</Space>
        : <Tag>default</Tag>,
    },
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
          <Form.Item name="cn_prefixes" label="CN Prefix" rules={[{ required: true, message: 'Select at least one CN Prefix' }]}>
            <Select
              mode="multiple"
              options={CN_PREFIX_OPTIONS}
              style={{ minWidth: 220 }}
              maxTagCount="responsive"
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="process_codes" label="Process Code">
            <Select
              mode="tags"
              style={{ minWidth: 200 }}
              placeholder="e.g. 1011, IDG001"
              tokenSeparators={[',']}
              maxTagCount="responsive"
            />
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

// ── Tab: Excel Column Mapping (sds_excel_mapping) ────────────────────────────

const TOOL_SLOTS = Array.from({ length: 20 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);
const KNOWN_PARAM_KEYS = [
  // Part info
  'cn', 'parts_no', 'dwg_rev', 'part_type', 'category', 'material',
  // Process
  'process_code', 'process_name', 'process_eng', 'ct', 'machine_type_name',
  // Production
  'model', 'customer', 'cust_dwg_no',
  // SDS Header
  'program_no', 'program_name', 'sds_rev', 'grinding_area_label',
  'stamp_prepared', 'stamp_checked', 'stamp_approved',
  // Tooling slots
  ...TOOL_SLOTS.map(s => `tool_name_${s}`),
  ...TOOL_SLOTS.map(s => `tool_dwg_no_${s}`),
  ...TOOL_SLOTS.map(s => `tool_image_${s}`),
  'grinding_layout_image',
  // Revision log
  ...[1, 2, 3, 4, 5].flatMap(n => [`rev_${n}`, `ecn_no_${n}`, `date_${n}`, `description_${n}`, `remark_${n}`]),
];

const ExcelMappingManager = ({ theme }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MAPPINGS, { params: { machine_type_name: 'null' } });
      setRows(res.data);
    } catch (err) {
      message.error('Load failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingRow(null);
    form.resetFields();
    form.setFieldsValue({ sort_order: 0 });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    form.setFieldsValue({
      cell_address: row.cell_address,
      param_key: row.param_key,
      description: row.description || '',
      sort_order: row.sort_order ?? 0,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        machine_type_name: null,
        cell_address: vals.cell_address.trim().toUpperCase(),
        param_key: vals.param_key.trim(),
        description: vals.description?.trim() || null,
        sort_order: vals.sort_order ?? 0,
        is_active: true,
      };
      if (editingRow) {
        await axios.put(`${server.MTC_SDS_V2_ADMIN_MAPPINGS}/${editingRow.id}`, payload);
        message.success('Updated');
      } else {
        await axios.post(server.MTC_SDS_V2_ADMIN_MAPPINGS, payload);
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

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${server.MTC_SDS_V2_ADMIN_MAPPINGS}/${id}`);
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const columns = [
    {
      title: 'Cell Address',
      dataIndex: 'cell_address',
      width: 220,
      render: v => <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Param Key',
      dataIndex: 'param_key',
      width: 220,
      render: v => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: v => v || <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    { title: 'Order', dataIndex: 'sort_order', width: 70, align: 'center' },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm
            title="Delete this mapping?"
            onConfirm={() => handleDelete(row.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
        <Col><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button></Col>
        <Col flex="auto" />
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Mapping
          </Button>
        </Col>
      </Row>

      <Table
        loading={loading}
        dataSource={rows.map(r => ({ ...r, key: r.id }))}
        columns={columns}
        size="small"
        bordered
        pagination={{ pageSize: 30, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingRow ? 'Edit Mapping' : 'Add Mapping'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingRow ? 'Save' : 'Add'}
        confirmLoading={saving}
        width={540}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item
                name="cell_address"
                label="Cell Address"
                rules={[{ required: true, message: 'Required' }, {
                  pattern: /^[A-Za-z]{1,3}\d+$/,
                  message: 'Format: B5, AB12, etc.',
                }]}
              >
                <Input
                  //placeholder="เช่น B5, C7"
                  style={{ textTransform: 'uppercase' }}
                  onChange={e => form.setFieldValue('cell_address', e.target.value.toUpperCase())}
                />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="sort_order" label="Sort Order">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="param_key"
            label="Param Key"
            rules={[{ required: true, message: 'Required' }]}
          //extra="เลือกจากรายการหรือพิมพ์ค่าเอง"
          >
            <AutoComplete
              options={KNOWN_PARAM_KEYS.map(k => ({ value: k }))}
              filterOption={(inp, opt) => opt.value.toLowerCase().includes(inp.toLowerCase())}
            //placeholder="เช่น cn, parts_no, tool_name_T01"
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="Description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ── Tab: Machine Tool Config (sds_v2_machine_tool) ────────────────────────────

const TOOL_NUMBER_SLOTS = Array.from({ length: 20 }, (_, i) => `T${i + 1}`);

const MachineToolManager = ({ theme, visibleMachineNames }) => {
  const { message } = App.useApp();

  const [machineTypeOpts, setMachineTypeOpts] = useState([]);
  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then(r => {
        const seen = new Set();
        setMachineTypeOpts(r.data.filter(m => m.is_active && m.machine_type_name && !seen.has(m.machine_type_name) && seen.add(m.machine_type_name)));
      })
      .catch(() => { });
  }, []);

  // Combo list state
  const [combos, setCombos] = useState([]);
  const [combosLoading, setCombosLoading] = useState(false);
  const [filterMachine, setFilterMachine] = useState('__all__');

  // Reset filter when selected machine is hidden by Configure Visible
  useEffect(() => {
    if (filterMachine !== '__all__' && visibleMachineNames && !visibleMachineNames.has(filterMachine)) {
      setFilterMachine('__all__');
    }
  }, [visibleMachineNames, filterMachine]);

  // Slot editor state
  const [selectedCombo, setSelectedCombo] = useState(null); // { machine_type, process_code }
  const [slots, setSlots] = useState({}); // tool_number → tool_drawing_no
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // New combo modal
  const [newComboOpen, setNewComboOpen] = useState(false);
  const [newComboForm] = Form.useForm();

  const loadCombos = useCallback(async () => {
    setCombosLoading(true);
    try {
      const params = {};
      if (filterMachine && filterMachine !== '__all__') params.machine_type = filterMachine;
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TOOLS_COMBOS, { params });
      setCombos(res.data);
    } catch (err) {
      message.error('Load combos failed');
    } finally {
      setCombosLoading(false);
    }
  }, [filterMachine, message]);

  useEffect(() => { loadCombos(); }, [loadCombos]);

  const loadSlots = useCallback(async (machine_type, process_code) => {
    setEditorLoading(true);
    setSlots({});
    setDirty(false);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TOOLS, {
        params: { machine_type, process_code },
      });
      const map = {};
      res.data.forEach(r => { map[r.tool_number] = r.tool_drawing_no; });
      setSlots(map);
    } catch (err) {
      message.error('Load tools failed');
    } finally {
      setEditorLoading(false);
    }
  }, [message]);

  const selectCombo = (combo) => {
    setSelectedCombo(combo);
    loadSlots(combo.machine_type, combo.process_code);
  };

  const handleSlotChange = (toolNumber, val) => {
    setSlots(prev => ({ ...prev, [toolNumber]: val }));
    setDirty(true);
  };

  const saveSlots = async () => {
    if (!selectedCombo) return;
    setSaving(true);
    try {
      const rows = TOOL_NUMBER_SLOTS.map(tn => ({
        tool_number: tn,
        tool_drawing_no: slots[tn]?.trim() || '',
      }));
      await axios.put(server.MTC_SDS_V2_ADMIN_MACHINE_TOOLS_BULK, {
        machine_type: selectedCombo.machine_type,
        process_code: selectedCombo.process_code,
        rows,
      });
      message.success('Saved');
      setDirty(false);
      loadCombos();
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteCombo = async (machine_type, process_code) => {
    try {
      await axios.delete(server.MTC_SDS_V2_ADMIN_MACHINE_TOOLS_COMBO_DEL, {
        params: { machine_type, process_code },
      });
      message.success('Deleted');
      if (selectedCombo?.machine_type === machine_type && selectedCombo?.process_code === process_code) {
        setSelectedCombo(null);
        setSlots({});
        setDirty(false);
      }
      loadCombos();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const openNewCombo = () => {
    newComboForm.resetFields();
    setNewComboOpen(true);
  };

  const createNewCombo = async () => {
    try {
      const vals = await newComboForm.validateFields();
      setNewComboOpen(false);
      const combo = { machine_type: vals.machine_type, process_code: String(vals.process_code).trim() };
      setSelectedCombo(combo);
      setSlots({});
      setDirty(false);
      setEditorLoading(false);
    } catch (_) { }
  };

  const machineOptions = [
    { value: '__all__', label: 'All Machine Type' },
    ...machineTypeOpts
      .filter(m => !visibleMachineNames || visibleMachineNames.has(m.machine_type_name))
      .map(m => ({ value: m.machine_type_name, label: `${m.machine_type_code} — ${m.machine_group || m.machine_type_name}` })),
  ];

  const comboColumns = [
    { title: 'Machine Type Name', dataIndex: 'machine_type', width: 200,
      render: v => { const m = machineTypeOpts.find(o => o.machine_type_name === v); return m?.machine_group || v; } },
    {
      title: 'Process Code', dataIndex: 'process_code', width: 130,
      render: v => <Tag>{v}</Tag>
    },
    {
      title: 'Tools', dataIndex: 'tool_count', width: 70, align: 'center',
      render: v => <Tag color="blue">{v}</Tag>
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            type={selectedCombo?.machine_type === row.machine_type && selectedCombo?.process_code === row.process_code ? 'primary' : 'default'}
            onClick={() => selectCombo(row)}
          >
            Edit
          </Button>
          <Popconfirm
            title={`Delete tool of ${row.machine_type} / ${row.process_code}?`}
            onConfirm={() => deleteCombo(row.machine_type, row.process_code)}
            okText="Delete" okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filledCount = TOOL_NUMBER_SLOTS.filter(tn => slots[tn]?.trim()).length;

  return (
    <Row gutter={16}>
      {/* Left: Combo list */}
      <Col span={10}>
        <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewCombo}>
              New
            </Button>
          </Col>
        </Row>
        <>
            <Row gutter={8} align="middle" style={{ marginBottom: 10 }}>
              <Col flex="auto">
                <Select
                  showSearch
                  value={filterMachine}
                  onChange={v => setFilterMachine(v)}
                  options={machineOptions}
                  style={{ width: '100%' }}
                  placeholder="Filter by Machine"
                  filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
                />
              </Col>
              <Col><Button icon={<ReloadOutlined />} onClick={loadCombos} /></Col>
            </Row>
            <Table
              loading={combosLoading}
              dataSource={combos.map((r, i) => ({ ...r, key: `${r.machine_type}_${r.process_code}_${i}` }))}
              columns={comboColumns}
              size="small"
              bordered
              pagination={{ pageSize: 15, showSizeChanger: false }}
              rowClassName={row =>
                selectedCombo?.machine_type === row.machine_type && selectedCombo?.process_code === row.process_code
                  ? 'ant-table-row-selected' : ''
              }
            />
        </>
      </Col>

      {/* Right: Slot editor */}
      <Col span={14}>
        {!selectedCombo ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#bfbfbf' }}>
            {/* <Text type="secondary">เลือก Combo จากตารางซ้าย หรือกด New</Text> */}
          </div>
        ) : (
          <Spin spinning={editorLoading}>
            <Row align="middle" style={{ marginBottom: 10 }}>
              <Col flex="auto">
                <Space>
                  <Tag color="blue">{selectedCombo.machine_type}</Tag>
                  <Tag>{selectedCombo.process_code}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {filledCount} tool{filledCount !== 1 ? 's' : ''} Active
                  </Text>
                </Space>
              </Col>
              {dirty && <Col><Text type="warning" style={{ fontSize: 12 }}>Please Save</Text></Col>}
              <Col>
                <Button type="primary" icon={<SaveOutlined />} onClick={saveSlots} loading={saving} disabled={!dirty}>
                  Save
                </Button>
              </Col>
            </Row>

            <Table
              dataSource={TOOL_NUMBER_SLOTS.map(tn => ({ key: tn, tool_number: tn }))}
              size="small"
              bordered
              pagination={false}
              scroll={{ y: 520 }}
              columns={[
                {
                  title: 'Slot',
                  dataIndex: 'tool_number',
                  width: 60,
                  render: v => <Text code style={{ fontSize: 12 }}>{v}</Text>,
                },
                {
                  title: 'Tool Drawing No',
                  dataIndex: 'tool_number',
                  render: (tn) => (
                    <Input
                      size="small"
                      value={slots[tn] || ''}
                      onChange={e => handleSlotChange(tn, e.target.value)}
                      //placeholder="เช่น 4866-01"
                      style={{ fontFamily: 'monospace' }}
                      allowClear
                    />
                  ),
                },
              ]}
            />
          </Spin>
        )}
      </Col>

      {/* New combo modal */}
      <Modal
        title="Add New Combo"
        open={newComboOpen}
        onOk={createNewCombo}
        onCancel={() => setNewComboOpen(false)}
        okText="Start Editing"
        width={440}
        destroyOnHidden
      >
        <Form form={newComboForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="machine_type" label="Machine Type" rules={[{ required: true, message: 'Required' }]}>
            <Select
              options={machineTypeOpts.map(m => ({
                value: m.machine_type_name,
                label: `${m.machine_type_code} — ${m.machine_group || m.machine_type_name}`,
              }))}
              //placeholder="เลือก Machine Type"
              showSearch
              filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="process_code" label="Process Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. 1011, 1021, IDG001" />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};

// ── Tab 4: Machine Config (A16:I55 + AN50:AV55) ──────────────────────────────

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const EXCLUDED_ROWS = new Set([17, 27, 37, 47]);
const ROW_RANGE = Array.from({ length: 40 }, (_, i) => i + 16).filter(r => !EXCLUDED_ROWS.has(r));

const GW_COL_LETTERS = ['AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'];
const GW_ROW_RANGE = [50, 51, 52, 53, 54, 55];

// Header single-cell fields (moved here from the former Per-record Params tab).
// Stored as machine-level params (cn IS NULL) by default; CN-override aware.
// Cell addresses come from sds_excel_mapping (program_no→Z4, program_name→Z5).
const HEADER_CELL_FIELDS = [
  { key: 'program_no',   label: 'Program No',   cell: 'Z4' },
  { key: 'program_name', label: 'Program Name', cell: 'Z5' },
];

const MachineConfigTab = ({ theme, visibleMachineNames }) => {
  const { message } = App.useApp();
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(null);
  // Machine-default state (cn IS NULL)
  const [cellData, setCellData] = useState({});
  const [cellTypes, setCellTypes] = useState({});
  const [rowHeaders, setRowHeaders] = useState({});
  const [gwCellData, setGwCellData] = useState({});
  const [gwCellTypes, setGwCellTypes] = useState({});
  const [gwRowHeaders, setGwRowHeaders] = useState({});
  const [origKeys, setOrigKeys] = useState(new Set());
  // CN Override state
  const [cnInput, setCnInput] = useState('');
  const [selectedCn, setSelectedCn] = useState(null);
  const [cnOverrideData, setCnOverrideData] = useState({});
  const [cnGwOverrideData, setCnGwOverrideData] = useState({});
  const [cnRowIds, setCnRowIds] = useState({});
  // UI state
  const [listLoading, setListLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showMachineList, setShowMachineList] = useState(false); // table starts hidden

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES, {
        params: search ? { search } : {},
      });
      const seen = new Set();
      setAllMachineTypes(res.data.filter(m => m.is_active && m.machine_type_name && !seen.has(m.machine_type_name) && seen.add(m.machine_type_name)));
    } catch (err) {
      message.error(err.response?.data?.error || 'Load failed');
    } finally {
      setListLoading(false);
    }
  }, [search, message]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadConfig = useCallback(async (machineName) => {
    setSelectedMachine(machineName);
    setShowMachineList(false); // collapse list after picking a machine
    // Reset CN override mode when switching machines
    setSelectedCn(null);
    setCnInput('');
    setCnOverrideData({});
    setCnGwOverrideData({});
    setCnRowIds({});
    setConfigLoading(true);
    setCellData({});
    setCellTypes({});
    setRowHeaders({});
    setGwCellData({});
    setGwCellTypes({});
    setGwRowHeaders({});
    setOrigKeys(new Set());
    setDirty(false);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_PARAMETERS, {
        params: { cn: 'null', machine_type_name: machineName },
      });
      const map = {}, types = {}, headers = {}, keys = new Set();
      const gwMap = {}, gwTypes = {}, gwHeaders = {};
      res.data.forEach(r => {
        keys.add(r.param_key);
        const hdrMatch = r.param_key.match(/^row_(\d+)_is_header$/);
        if (hdrMatch) { headers[parseInt(hdrMatch[1])] = r.param_value === '1'; return; }
        const typeMatch = r.param_key.match(/^row_(\d+)_([A-I])_type$/i);
        if (typeMatch) { types[`row_${typeMatch[1]}_${typeMatch[2].toUpperCase()}`] = r.param_value || ''; return; }
        const gwHdrMatch = r.param_key.match(/^gw_row_(\d+)_is_header$/);
        if (gwHdrMatch) { gwHeaders[parseInt(gwHdrMatch[1])] = r.param_value === '1'; return; }
        const gwTypeMatch = r.param_key.match(/^gw_row_(\d+)_([A-Z]{1,3})_type$/i);
        if (gwTypeMatch) { gwTypes[`gw_row_${gwTypeMatch[1]}_${gwTypeMatch[2].toUpperCase()}`] = r.param_value || ''; return; }
        if (/^gw_row_\d+_[A-Z]{1,3}$/i.test(r.param_key)) { gwMap[r.param_key] = r.param_value || ''; return; }
        map[r.param_key] = r.param_value || '';
      });
      setCellData(map);
      setCellTypes(types);
      setRowHeaders(headers);
      setGwCellData(gwMap);
      setGwCellTypes(gwTypes);
      setGwRowHeaders(gwHeaders);
      setOrigKeys(keys);
    } catch (err) {
      message.error(err.response?.data?.error || 'Load failed');
    } finally {
      setConfigLoading(false);
    }
  }, [message]);

  const loadCnConfig = useCallback(async (cn) => {
    if (!selectedMachine) return;
    const trimmed = cn.trim().toUpperCase();
    setSelectedCn(trimmed);
    setConfigLoading(true);
    setCnOverrideData({});
    setCnGwOverrideData({});
    setCnRowIds({});
    setDirty(false);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_PARAMETERS, {
        params: { cn: trimmed, machine_type_name: selectedMachine },
      });
      const overrides = {}, gwOverrides = {}, ids = {};
      res.data.forEach(r => {
        ids[r.param_key] = r.id;
        // Only load cell value keys — is_header and _type are machine-level (read-only per CN)
        if (HEADER_CELL_FIELDS.some(f => f.key === r.param_key)) { overrides[r.param_key] = r.param_value || ''; return; }
        if (/^gw_row_\d+_[A-Z]{1,3}$/i.test(r.param_key)) { gwOverrides[r.param_key] = r.param_value || ''; return; }
        if (/^row_\d+_[A-I]$/i.test(r.param_key)) { overrides[r.param_key] = r.param_value || ''; }
      });
      setCnOverrideData(overrides);
      setCnGwOverrideData(gwOverrides);
      setCnRowIds(ids);
    } catch (err) {
      message.error('Load CN failed');
      setSelectedCn(null);
    } finally {
      setConfigLoading(false);
    }
  }, [selectedMachine, message]);

  const exitCnMode = () => {
    setSelectedCn(null);
    setCnInput('');
    setCnOverrideData({});
    setCnGwOverrideData({});
    setCnRowIds({});
    setDirty(false);
  };

  const markDirty = () => setDirty(true);

  const handleGwCellChange = (rowNum, c, val) => {
    if (selectedCn) {
      setCnGwOverrideData(prev => ({ ...prev, [`gw_row_${rowNum}_${c}`]: val }));
    } else {
      setGwCellData(prev => ({ ...prev, [`gw_row_${rowNum}_${c}`]: val }));
    }
    markDirty();
  };
  const handleGwTypeToggle = (rowNum, c) => {
    if (selectedCn) return; // type is machine-level only
    const key = `gw_row_${rowNum}_${c}`;
    setGwCellTypes(prev => ({ ...prev, [key]: prev[key] === 'value' ? '' : 'value' }));
    markDirty();
  };
  const handleGwHeaderToggle = (rowNum, checked) => {
    if (selectedCn) return; // header is machine-level only
    setGwRowHeaders(prev => ({ ...prev, [rowNum]: checked }));
    markDirty();
  };

  const handleCellChange = (rowNum, c, val) => {
    if (selectedCn) {
      setCnOverrideData(prev => ({ ...prev, [`row_${rowNum}_${c}`]: val }));
    } else {
      setCellData(prev => ({ ...prev, [`row_${rowNum}_${c}`]: val }));
    }
    markDirty();
  };
  const handleTypeToggle = (rowNum, c) => {
    if (selectedCn) return; // type is machine-level only
    const key = `row_${rowNum}_${c}`;
    setCellTypes(prev => ({ ...prev, [key]: prev[key] === 'value' ? '' : 'value' }));
    markDirty();
  };
  const handleHeaderToggle = (rowNum, checked) => {
    if (selectedCn) return; // header is machine-level only
    setRowHeaders(prev => ({ ...prev, [rowNum]: checked }));
    markDirty();
  };

  // Header single-cell fields (program_no/program_name) — machine default or CN override
  const handleHeaderFieldChange = (key, val) => {
    if (selectedCn) setCnOverrideData(prev => ({ ...prev, [key]: val }));
    else setCellData(prev => ({ ...prev, [key]: val }));
    markDirty();
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      if (selectedCn) {
        // ── CN Override save ──────────────────────────────────────────────────
        const upsertParams = [];
        const deleteIds = [];
        for (const rowNum of ROW_RANGE) {
          for (const c of COL_LETTERS) {
            const key = `row_${rowNum}_${c}`;
            const val = cnOverrideData[key] ?? '';
            if (val.trim()) {
              upsertParams.push({ param_key: key, param_value: val.trim() });
            } else if (cnRowIds[key]) {
              deleteIds.push(cnRowIds[key]);
            }
          }
        }
        for (const rowNum of GW_ROW_RANGE) {
          for (const c of GW_COL_LETTERS) {
            const key = `gw_row_${rowNum}_${c}`;
            const val = cnGwOverrideData[key] ?? '';
            if (val.trim()) {
              upsertParams.push({ param_key: key, param_value: val.trim() });
            } else if (cnRowIds[key]) {
              deleteIds.push(cnRowIds[key]);
            }
          }
        }
        for (const f of HEADER_CELL_FIELDS) {
          const val = (cnOverrideData[f.key] ?? '').toString();
          if (val.trim()) {
            upsertParams.push({ param_key: f.key, param_value: val.trim() });
          } else if (cnRowIds[f.key]) {
            deleteIds.push(cnRowIds[f.key]);
          }
        }
        if (upsertParams.length) {
          await axios.put(server.MTC_SDS_V2_ADMIN_PARAMETERS_BULK, {
            cn: selectedCn, machine_type_name: selectedMachine, params: upsertParams,
          });
        }
        await Promise.all(deleteIds.map(id =>
          axios.delete(`${server.MTC_SDS_V2_ADMIN_PARAMETERS}/${id}`)
        ));
        message.success(`Saved CN override for ${selectedCn}`);
        setDirty(false);
        await loadCnConfig(selectedCn); // refresh IDs
      } else {
        // ── Machine-default save ──────────────────────────────────────────────
        const params = [];
        for (const rowNum of ROW_RANGE) {
          for (const c of COL_LETTERS) {
            const key = `row_${rowNum}_${c}`;
            const val = cellData[key] || '';
            if (val || origKeys.has(key)) params.push({ param_key: key, param_value: val || null });
          }
        }
        for (const rowNum of ROW_RANGE) {
          for (const c of COL_LETTERS) {
            const cellKey = `row_${rowNum}_${c}`;
            const typeKey = `${cellKey}_type`;
            const typeVal = cellTypes[cellKey] || '';
            if (typeVal || origKeys.has(typeKey)) params.push({ param_key: typeKey, param_value: typeVal || null });
          }
        }
        for (const rowNum of ROW_RANGE) {
          const hdrKey = `row_${rowNum}_is_header`;
          const hdrVal = rowHeaders[rowNum] ? '1' : '';
          if (hdrVal || origKeys.has(hdrKey)) params.push({ param_key: hdrKey, param_value: hdrVal || null });
        }
        for (const rowNum of GW_ROW_RANGE) {
          for (const c of GW_COL_LETTERS) {
            const key = `gw_row_${rowNum}_${c}`;
            const val = gwCellData[key] || '';
            if (val || origKeys.has(key)) params.push({ param_key: key, param_value: val || null });
          }
        }
        for (const rowNum of GW_ROW_RANGE) {
          for (const c of GW_COL_LETTERS) {
            const cellKey = `gw_row_${rowNum}_${c}`;
            const typeKey = `${cellKey}_type`;
            const typeVal = gwCellTypes[cellKey] || '';
            if (typeVal || origKeys.has(typeKey)) params.push({ param_key: typeKey, param_value: typeVal || null });
          }
        }
        for (const rowNum of GW_ROW_RANGE) {
          const hdrKey = `gw_row_${rowNum}_is_header`;
          const hdrVal = gwRowHeaders[rowNum] ? '1' : '';
          if (hdrVal || origKeys.has(hdrKey)) params.push({ param_key: hdrKey, param_value: hdrVal || null });
        }
        for (const f of HEADER_CELL_FIELDS) {
          const val = cellData[f.key] || '';
          if (val || origKeys.has(f.key)) params.push({ param_key: f.key, param_value: val || null });
        }
        await axios.put(server.MTC_SDS_V2_ADMIN_PARAMETERS_BULK, {
          cn: null, machine_type_name: selectedMachine, params,
        });
        message.success('Saved');
        setDirty(false);
        setOrigKeys(new Set(params.filter(p => p.param_value).map(p => p.param_key)));
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const machineListCols = [
    { title: 'Machine Type Code', dataIndex: 'machine_type_code', width: 300 },
    { title: 'Machine Type Name', dataIndex: 'machine_type_name', render: (v, r) => r.machine_group || v },
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

  const gwConfigGridCols = [
    {
      title: 'Row', dataIndex: 'rowNum', width: 50, fixed: 'left',
      onCell: (record) => ({ style: { backgroundColor: gwRowHeaders[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: v => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Hdr', key: 'hdr', width: 44, fixed: 'left',
      onCell: (record) => ({ style: { backgroundColor: gwRowHeaders[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (_, record) => (
        <Checkbox
          checked={!!gwRowHeaders[record.rowNum]}
          disabled={!!selectedCn}
          onChange={e => handleGwHeaderToggle(record.rowNum, e.target.checked)}
        />
      ),
    },
    ...GW_COL_LETTERS.map(c => ({
      title: c, key: c, width: 130,
      onCell: (record) => ({ style: { backgroundColor: gwRowHeaders[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (_, record) => {
        const cellKey = `gw_row_${record.rowNum}_${c}`;
        const isValue = gwCellTypes[cellKey] === 'value';
        const hasOverride = !!selectedCn && cnGwOverrideData[cellKey] !== undefined;
        const displayValue = selectedCn
          ? (cnGwOverrideData[cellKey] ?? gwCellData[cellKey] ?? '')
          : (gwCellData[cellKey] || '');
        return (
          <Input
            size="small"
            value={displayValue}
            onChange={e => handleGwCellChange(record.rowNum, c, e.target.value)}
            style={{
              fontSize: 11,
              color: isValue ? '#ff4d4f' : undefined,
              backgroundColor: hasOverride ? '#e6f4ff' : (gwRowHeaders[record.rowNum] ? '#f5f5f5' : undefined),
              borderColor: hasOverride ? '#1677ff' : undefined,
            }}
            suffix={
              <span
                title={selectedCn ? 'Type set at machine level' : 'Toggle: Label / Value'}
                onClick={() => handleGwTypeToggle(record.rowNum, c)}
                style={{
                  cursor: selectedCn ? 'default' : 'pointer',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: isValue ? '#ff4d4f' : '#bfbfbf',
                  userSelect: 'none',
                  opacity: selectedCn ? 0.4 : 1,
                }}
              >V</span>
            }
          />
        );
      },
    })),
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
          disabled={!!selectedCn}
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
        const hasOverride = !!selectedCn && cnOverrideData[cellKey] !== undefined;
        const displayValue = selectedCn
          ? (cnOverrideData[cellKey] ?? cellData[cellKey] ?? '')
          : (cellData[cellKey] || '');
        return (
          <Input
            size="small"
            value={displayValue}
            onChange={e => handleCellChange(record.rowNum, c, e.target.value)}
            style={{
              fontSize: 11,
              color: isValue ? '#ff4d4f' : undefined,
              backgroundColor: hasOverride ? '#e6f4ff' : (rowHeaders[record.rowNum] ? '#f5f5f5' : undefined),
              borderColor: hasOverride ? '#1677ff' : undefined,
            }}
            suffix={
              <span
                title={selectedCn ? 'Type set at machine level' : 'Toggle: Label / Value'}
                onClick={() => handleTypeToggle(record.rowNum, c)}
                style={{
                  cursor: selectedCn ? 'default' : 'pointer',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: isValue ? '#ff4d4f' : '#bfbfbf',
                  userSelect: 'none',
                  opacity: selectedCn ? 0.4 : 1,
                }}
              >V</span>
            }
          />
        );
      },
    })),
  ];

  const displayedMachineTypes = visibleMachineNames
    ? allMachineTypes.filter(m => visibleMachineNames.has(m.machine_type_name))
    : allMachineTypes;

  const machineListBlock = (
    <>
      <Row gutter={8} align="middle" style={{ marginBottom: showMachineList ? 12 : 16 }}>
        <Col>
          <Button
            icon={showMachineList ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setShowMachineList(s => !s)}
          >
            {showMachineList ? 'Hide Machine List' : 'Show Machine List'}
          </Button>
        </Col>
        {selectedMachine && (
          <Col>
            <Text type="secondary">Selected: <Text strong>{selectedMachine}</Text></Text>
          </Col>
        )}
      </Row>
      {showMachineList && (
        <>
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
            dataSource={displayedMachineTypes.map(r => ({ ...r, key: r.id }))}
            columns={machineListCols}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            rowClassName={row => row.machine_type_name === selectedMachine ? 'ant-table-row-selected' : ''}
            style={{ marginBottom: 24 }}
          />
        </>
      )}
    </>
  );

  // CN Override toolbar — shared between both grid tabs
  const cnModeBar = selectedMachine && (
    <Row gutter={8} align="middle" style={{ marginBottom: 12, padding: '8px 12px', background: selectedCn ? '#e6f4ff' : '#fafafa', borderRadius: 6, border: '1px solid #d9d9d9' }}>
      {selectedCn ? (
        <>
          <Col>
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
              CN Override: {selectedCn}
            </Tag>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Edit any cell — blue cell = override, normal = uses machine default
            </Text>
          </Col>
          <Col flex="auto" />
          <Col>
            <Button size="small" onClick={exitCnMode}>
              ← Machine Default
            </Button>
          </Col>
        </>
      ) : (
        <>
          <Col>
            <Space.Compact>
              <Input
                placeholder="CN Override e.g. C25-0190"
                value={cnInput}
                onChange={e => setCnInput(e.target.value)}
                onPressEnter={() => cnInput.trim() && loadCnConfig(cnInput)}
                style={{ width: 220 }}
                allowClear
              />
              <Button
                onClick={() => cnInput.trim() && loadCnConfig(cnInput)}
                disabled={!cnInput.trim()}
              >
                Load CN
              </Button>
            </Space.Compact>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Leave blank = edit machine default (all CNs)
            </Text>
          </Col>
        </>
      )}
    </Row>
  );

  const saveBar = selectedMachine && (
    <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
      <Col>
        <Text strong>{selectedMachine}</Text>
        {selectedCn && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedCn}</Tag>}
      </Col>
      <Col flex="auto" />
      {dirty && <Col><Text type="warning" style={{ fontSize: 12 }}>Please Save</Text></Col>}
      <Col>
        <Button type="primary" icon={<SaveOutlined />} onClick={saveConfig} loading={saving} disabled={!dirty}>
          Save{selectedCn ? ' CN Override' : ''}
        </Button>
      </Col>
    </Row>
  );

  const cellGridContent = (
    <div>
      {machineListBlock}
      {selectedMachine && (
        <Spin spinning={configLoading}>
          {cnModeBar}
          {saveBar}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            {HEADER_CELL_FIELDS.map(f => {
              const hasOverride = !!selectedCn && cnOverrideData[f.key] !== undefined;
              const displayValue = selectedCn
                ? (cnOverrideData[f.key] ?? cellData[f.key] ?? '')
                : (cellData[f.key] || '');
              return (
                <Col key={f.key} span={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {f.label} <Tag color="default" style={{ marginInlineStart: 4 }}>{f.cell}</Tag>
                  </Text>
                  <Input
                    size="small"
                    value={displayValue}
                    placeholder={selectedCn ? 'CN override (blank = machine default)' : `${f.label} (machine default)`}
                    onChange={e => handleHeaderFieldChange(f.key, e.target.value)}
                    style={{
                      marginTop: 2,
                      backgroundColor: hasOverride ? '#e6f4ff' : undefined,
                      borderColor: hasOverride ? '#1677ff' : undefined,
                    }}
                  />
                </Col>
              );
            })}
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

  const gwConfigContent = (
    <div>
      {machineListBlock}
      {selectedMachine && (
        <Spin spinning={configLoading}>
          {cnModeBar}
          {saveBar}
          <Table
            className="sds-config-grid"
            dataSource={GW_ROW_RANGE.map(rowNum => ({ key: rowNum, rowNum }))}
            columns={gwConfigGridCols}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content', y: 300 }}
            bordered
            style={{ fontFamily: 'monospace' }}
            rowClassName={record => gwRowHeaders[record.rowNum] ? 'sds-hdr-row' : ''}
          />
        </Spin>
      )}
    </div>
  );

  return (
    <Tabs
      size="small"
      items={[
        {
          key: 'grid',
          label: 'Excel Parameter Config',
          children: cellGridContent,
        },
        {
          key: 'gw-config',
          label: 'Excel Grinding Wheel Config',
          children: gwConfigContent,
        },
        {
          key: 'mapping',
          label: 'Excel Column Mapping',
          children: <ExcelMappingManager theme={theme} />,
        },
        {
          key: 'machine-tool',
          label: 'Machine Tool Config',
          children: <MachineToolManager theme={theme} visibleMachineNames={visibleMachineNames} />,
        },
      ]}
    />
  );
};

// ── Tab 4: Audit (Data Integrity) ─────────────────────────────────────────────

const AUDIT_STATIC_PART_TYPES = [
  { key: 'ball',      label: 'Ball',      prefixes: ['C3'],       color: '#1677ff' },
  { key: 'race',      label: 'Race',      prefixes: ['C2'],       color: '#52c41a' },
  { key: 'body',      label: 'Body',      prefixes: ['C1', 'C5'], color: '#fa8c16' },
  { key: 'sleeve',    label: 'Sleeve',    prefixes: ['C6'],       color: '#722ed1' },
  { key: 'mecha',     label: 'Mecha',     prefixes: ['C9'],       color: '#f5222d' },
];

const loadSavedExpandedPcs = (catKey) => {
  if (!catKey) return new Set();
  try {
    const saved = localStorage.getItem(`sds_audit_pcs_${catKey}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
};

const AuditTab = ({ theme }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ itemCounts: [], noProcessPlan: [], missingTooling: [], totals: {} });
  const [activeCategory, setActiveCategory] = useState(() => localStorage.getItem('sds_audit_category') || null);
  const [expandedProcessCodes, setExpandedProcessCodes] = useState(() =>
    loadSavedExpandedPcs(localStorage.getItem('sds_audit_category') || null)
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_ADMIN_AUDIT);
      setData(res.data);
    } catch (err) {
      message.error('Load audit data failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  // Static categories with counts derived from itemCounts
  const categories = useMemo(() => {
    const staticCats = AUDIT_STATIC_PART_TYPES.map(cat => {
      const total = data.itemCounts
        .filter(r => cat.prefixes.some(p => r.sub_class?.startsWith(p)))
        .reduce((s, r) => s + Number(r.count || 0), 0);
      return { ...cat, total };
    });
    // Any other prefixes not covered by static categories
    const otherPrefixes = [...new Set(
      data.itemCounts
        .filter(r => r.sub_class && !AUDIT_STATIC_PART_TYPES.some(c => c.prefixes.some(p => r.sub_class.startsWith(p))))
        .map(r => r.sub_class.substring(0, 2))
    )];
    const otherCats = otherPrefixes.map(pfx => {
      const total = data.itemCounts.filter(r => r.sub_class?.startsWith(pfx)).reduce((s, r) => s + Number(r.count || 0), 0);
      return { key: pfx, label: pfx, prefixes: [pfx], total, color: '#595959' };
    });
    return [...staticCats, ...otherCats];
  }, [data]);

  const getCategoryPrefixes = useCallback((catKey) => {
    const cat = categories.find(c => c.key === catKey);
    return cat?.prefixes || [catKey];
  }, [categories]);

  const handleCategoryClick = (key) => {
    const next = activeCategory === key ? null : key;
    setActiveCategory(next);
    localStorage.setItem('sds_audit_category', next || '');
    setExpandedProcessCodes(loadSavedExpandedPcs(next));
  };

  const filteredMissingTooling = useMemo(() => {
    if (!activeCategory) return data.missingTooling;
    const prefixes = getCategoryPrefixes(activeCategory);
    return data.missingTooling.filter(r => prefixes.some(p => r.sub_class?.startsWith(p)));
  }, [data.missingTooling, activeCategory, getCategoryPrefixes]);

  // Group missingTooling by process_code for per-PC expandable sections
  const missingByProcessCode = useMemo(() => {
    const groups = {};
    filteredMissingTooling.forEach(row => {
      const pc = row.process_code || '(none)';
      if (!groups[pc]) groups[pc] = [];
      groups[pc].push(row);
    });
    return groups;
  }, [filteredMissingTooling]);

  const sortedProcessCodes = useMemo(() =>
    Object.keys(missingByProcessCode).sort(),
    [missingByProcessCode]
  );

  const toggleProcessCode = (pc) => {
    setExpandedProcessCodes(prev => {
      const next = new Set(prev);
      if (next.has(pc)) next.delete(pc);
      else next.add(pc);
      if (activeCategory) {
        localStorage.setItem(`sds_audit_pcs_${activeCategory}`, JSON.stringify([...next]));
      }
      return next;
    });
  };

  const missingCnCols = [
    { title: 'CN', dataIndex: 'control_no', key: 'control_no', sorter: (a, b) => a.control_no?.localeCompare(b.control_no) },
  ];

  const activeCat = categories.find(c => c.key === activeCategory);

  return (
    <div style={{ minHeight: 600 }}>
      <Title level={5} style={{ marginBottom: 8 }}><SearchOutlined /> Item Counts</Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="none">
            <Text type="secondary" style={{ fontSize: 12 }}>Grand Total (Enable)</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: theme.colors.primary, lineHeight: 1.2 }}>
              {data.totals?.grandTotal?.toLocaleString() || 0}
            </div>
          </Col>
          <Col flex="none"><Divider type="vertical" style={{ height: 48 }} /></Col>
          <Col flex="auto">
            <Space wrap>
              <Button
                size="small"
                type={activeCategory === null ? 'primary' : 'default'}
                onClick={() => {
                  setActiveCategory(null);
                  localStorage.setItem('sds_audit_category', '');
                  setExpandedProcessCodes(new Set());
                }}
              >
                All
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.key}
                  size="small"
                  type={activeCategory === cat.key ? 'primary' : 'default'}
                  style={activeCategory === cat.key
                    ? { background: cat.color, borderColor: cat.color }
                    : { borderColor: cat.color, color: cat.color }}
                  onClick={() => handleCategoryClick(cat.key)}
                >
                  {cat.label}{' '}
                  <span style={{ fontSize: 11, opacity: 0.85 }}>({cat.total.toLocaleString()})</span>
                </Button>
              ))}
            </Space>
          </Col>
          {activeCat && (
            <>
              <Col flex="none"><Divider type="vertical" style={{ height: 48 }} /></Col>
              <Col flex="none" style={{ textAlign: 'center', minWidth: 80 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{activeCat.label} ({activeCat.prefixes.join('/')}x)</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: activeCat.color, lineHeight: 1.2 }}>
                  {activeCat.total.toLocaleString()}
                </div>
              </Col>
            </>
          )}
        </Row>
      </Card>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={5}><ReloadOutlined /> Data Consistency Audit</Title></Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>Refresh All</Button>
        </Col>
      </Row>

      <div style={{ marginBottom: 12 }}>
        <Tag color="warning">Warning: Missing Tooling ({new Set(filteredMissingTooling.map(r => r.control_no)).size} CN)</Tag>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Process Plan exists but missing Tooling — Click Process Code to see items
      </Text>
      <Space wrap style={{ marginBottom: 16 }}>
        {expandedProcessCodes.size > 0 && (
          <Button
            size="small"
            danger
            onClick={() => {
              setExpandedProcessCodes(new Set());
              if (activeCategory) localStorage.setItem(`sds_audit_pcs_${activeCategory}`, '[]');
            }}
          >
            Collapse All
          </Button>
        )}
        {sortedProcessCodes.map(pc => {
          const isExpanded = expandedProcessCodes.has(pc);
          const cnCount = new Set(missingByProcessCode[pc].map(r => r.control_no)).size;
          return (
            <Button
              key={pc}
              size="small"
              type={isExpanded ? 'primary' : 'default'}
              onClick={() => toggleProcessCode(pc)}
            >
              {pc}
              <Tag
                color={isExpanded ? 'white' : 'default'}
                style={{ marginLeft: 4, color: isExpanded ? '#1677ff' : undefined }}
              >
                {cnCount}
              </Tag>
            </Button>
          );
        })}
      </Space>
      {sortedProcessCodes.filter(pc => expandedProcessCodes.has(pc)).map(pc => {
        const rows = missingByProcessCode[pc];
        const uniqCns = [...new Set(rows.map(r => r.control_no))].sort();
        return (
          <div key={pc} style={{ marginBottom: 16 }}>
            <Row align="middle" style={{ marginBottom: 6 }}>
              <Col>
                <Text strong>Process Code: </Text>
                <Tag color="blue">{pc}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>{uniqCns.length} CN</Text>
              </Col>
            </Row>
            <Table
              dataSource={uniqCns.map(cn => ({ control_no: cn, key: cn }))}
              columns={missingCnCols}
              size="small"
              loading={loading}
              bordered
              pagination={{ pageSize: 20, showSizeChanger: false }}
            />
          </div>
        );
      })}
    </div>
  );
};

// ── Tab: Configure Settings (Audit Process Codes + Visible Machines) ──────────

const ConfigureSettingsTab = ({ theme, visibleMachineNames, setVisibleMachineNames }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processMasterOpts, setProcessMasterOpts] = useState([]);
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [configDraft, setConfigDraft] = useState([]);
  const [subClassPatterns, setSubClassPatterns] = useState([]);
  const [visibleTempChecked, setVisibleTempChecked] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mtRes, pmRes, cfgRes, vmRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES),
        axios.get(server.MTC_SDS_V2_ADMIN_AUDIT_PROCESS_MASTER),
        axios.get(server.MTC_SDS_V2_ADMIN_AUDIT_CONFIG),
        axios.get(server.MTC_SDS_V2_ADMIN_VISIBLE_MACHINES),
      ]);
      const seen = new Set();
      const mts = mtRes.data.filter(m => m.is_active && m.machine_type_name && !seen.has(m.machine_type_name) && seen.add(m.machine_type_name));
      setAllMachineTypes(mts);
      setProcessMasterOpts(pmRes.data.map(row => ({
        value: row.process_code,
        label: `${row.process_code} — ${row.process_eng || ''}`,
      })));
      const cfg = cfgRes.data?.data || {};
      setConfigDraft([...(cfg.process_codes || [])].sort());
      setSubClassPatterns(cfg.sub_class_patterns || []);
      const visNames = vmRes.data?.visible_machines; // null = all visible
      setVisibleTempChecked(
        visNames
          ? mts.filter(m => visNames.includes(m.machine_type_name)).map(m => m.machine_type_name)
          : mts.map(m => m.machine_type_name)
      );
    } catch (err) {
      message.error('Load settings failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const allNames = allMachineTypes.map(m => m.machine_type_name);
      const isAll = visibleTempChecked.length === allNames.length && allNames.every(n => visibleTempChecked.includes(n));
      const next = isAll ? null : visibleTempChecked;
      await Promise.all([
        axios.put(server.MTC_SDS_V2_ADMIN_AUDIT_CONFIG, {
          process_codes: configDraft,
          sub_class_patterns: subClassPatterns,
        }),
        axios.put(server.MTC_SDS_V2_ADMIN_VISIBLE_MACHINES, { visible_machines: next }),
      ]);
      setVisibleMachineNames(next ? new Set(next) : null);
      message.success('Settings saved');
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Title level={5} style={{ margin: 0, color: theme.colors.text }}>
            <SettingOutlined /> Configure Settings
          </Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>Reload</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Divider orientation="left" plain style={{ marginTop: 0 }}>Audit Process Codes</Divider>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            Process codes checked for missing tooling in the audit.
          </Text>
          <Space style={{ marginBottom: 8 }}>
            <Button size="small" onClick={() => setConfigDraft(processMasterOpts.map(o => o.value).sort())}>
              Select All
            </Button>
            <Button size="small" onClick={() => setConfigDraft([])}>
              Deselect All
            </Button>
          </Space>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
            <Checkbox.Group
              value={configDraft}
              onChange={vals => setConfigDraft([...vals].sort())}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {processMasterOpts.map(o => (
                <Checkbox key={o.value} value={o.value}>
                  <Text style={{ fontSize: 13 }}>{o.label}</Text>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 11 }}>
            {configDraft.length} code{configDraft.length !== 1 ? 's' : ''} selected
          </Text>
        </Col>

        <Col xs={24} md={12}>
          <Divider orientation="left" plain style={{ marginTop: 0 }}>Visible Machines</Divider>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            Machines shown in Excel Config and Machine Tool Config tabs.
          </Text>
          <Space style={{ marginBottom: 8 }}>
            <Button size="small" onClick={() => setVisibleTempChecked(allMachineTypes.map(m => m.machine_type_name))}>
              Select All
            </Button>
            <Button size="small" onClick={() => setVisibleTempChecked([])}>
              Deselect All
            </Button>
          </Space>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
            <Checkbox.Group
              value={visibleTempChecked}
              onChange={setVisibleTempChecked}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {allMachineTypes.map(m => (
                <Checkbox key={m.id ?? m.machine_type_name} value={m.machine_type_name}>
                  <Text style={{ fontSize: 13 }}>
                    <Text type="secondary">{m.machine_type_code}</Text>
                    {' — '}
                    {m.machine_group || m.machine_type_name}
                  </Text>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 11 }}>
            {visibleTempChecked.length === allMachineTypes.length
              ? 'All machines visible'
              : `${visibleTempChecked.length} of ${allMachineTypes.length} machines visible`}
          </Text>
        </Col>
      </Row>
    </Spin>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const SdsV2AdminPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [visibleMachineNames, setVisibleMachineNames] = useState(null);

  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_VISIBLE_MACHINES)
      .then(r => {
        const names = r.data.visible_machines;
        setVisibleMachineNames(names ? new Set(names) : null);
      })
      .catch(() => {});
  }, []);

  const tabItems = [
    // Per-record Params tab removed — Program No (Z4) / Program Name (Z5) now live in Excel Config.
    { key: 'machine-config', label: 'Excel Config', children: <MachineConfigTab theme={theme} visibleMachineNames={visibleMachineNames} /> },
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
    { key: 'machine-codes', label: 'Machine Codes', children: <MachineCodes theme={theme} /> },
    { key: 'machine-types', label: 'Machine Types', children: <MachineTypes theme={theme} /> },
    { key: 'config', label: 'Configure Settings', children: <ConfigureSettingsTab theme={theme} visibleMachineNames={visibleMachineNames} setVisibleMachineNames={setVisibleMachineNames} /> },
    { key: 'audit', label: 'Data Integrity', children: <AuditTab theme={theme} /> },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ padding: 24, overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.SDS_V2)}>
              Back to Search
            </Button>
            <Title level={4} style={{ color: theme.colors.text, margin: 0 }}>
              Setup Data Sheet Management
            </Title>
          </div>
          <Card style={{ background: theme.colors.cardBackground }}>
            <Tabs items={tabItems} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SdsV2AdminPage;
