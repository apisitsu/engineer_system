import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layout, Typography, Card, Tabs, App, Space,
  Table, Input, Button, Popconfirm, AutoComplete,
  Form, Select, Row, Col, Spin, Upload, Tag, Divider, Checkbox, Image, Modal,
  InputNumber,
} from 'antd';
import {
  SaveOutlined, SearchOutlined, UploadOutlined, DeleteOutlined, ReloadOutlined,
  SettingOutlined, DownOutlined, UpOutlined, EditOutlined, PlusOutlined,
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
    label: `${m.machine_type_code} — ${m.machine_type_name || '(no name)'}`,
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
    if (mt) return <Text>{mt.machine_type_name || mt.machine_type_code}</Text>;

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
                  message: 'Format: B5, AB12 ฯลฯ',
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
      .map(m => ({ value: m.machine_type_name, label: `${m.machine_type_code} — ${m.machine_type_name}` })),
  ];

  const comboColumns = [
    { title: 'Machine Type Name', dataIndex: 'machine_type', width: 200 },
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
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewCombo}>
              New
            </Button>
          </Col>
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
        title="เพิ่ม Combo ใหม่"
        open={newComboOpen}
        onOk={createNewCombo}
        onCancel={() => setNewComboOpen(false)}
        okText="เริ่มแก้ไข"
        width={440}
        destroyOnHidden
      >
        <Form form={newComboForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="machine_type" label="Machine Type" rules={[{ required: true, message: 'Required' }]}>
            <Select
              options={machineTypeOpts.map(m => ({
                value: m.machine_type_name,
                label: `${m.machine_type_code} — ${m.machine_type_name}`,
              }))}
              //placeholder="เลือก Machine Type"
              showSearch
              filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="process_code" label="Process Code" rules={[{ required: true, message: 'Required' }]}>
            {/* <Input placeholder="เช่น 1011, 1021, IDG001" /> */}
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

const MachineConfigTab = ({ theme }) => {
  const { message } = App.useApp();
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [fullMachineTypes, setFullMachineTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [cellData, setCellData] = useState({});  // row_N_X → text value
  const [cellTypes, setCellTypes] = useState({});  // row_N_X → 'value' | '' (label/unit)
  const [rowHeaders, setRowHeaders] = useState({});  // rowNum → true/false
  const [gwCellData, setGwCellData] = useState({});    // gw_row_N_COL → text value (AN:AV)
  const [gwCellTypes, setGwCellTypes] = useState({});  // gw_row_N_COL → 'value' | ''
  const [gwRowHeaders, setGwRowHeaders] = useState({});// rowNum → true/false
  const [origKeys, setOrigKeys] = useState(new Set());
  const [listLoading, setListLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [visibleMachineNames, setVisibleMachineNames] = useState(() => {
    try {
      const saved = localStorage.getItem('sds_admin_visible_machines');
      return saved ? new Set(JSON.parse(saved)) : null;
    } catch { return null; }
  });
  const [tempChecked, setTempChecked] = useState([]);

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

  // Load the complete unfiltered list once — used by Configure Visible modal so the
  // isAll check is never fooled by an active search filter.
  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then(res => {
        const seen = new Set();
        setFullMachineTypes(res.data.filter(m => m.is_active && m.machine_type_name && !seen.has(m.machine_type_name) && seen.add(m.machine_type_name)));
      })
      .catch(() => {});
  }, []);

  const loadConfig = useCallback(async (machineName) => {
    setSelectedMachine(machineName);
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
        // row_N_is_header
        const hdrMatch = r.param_key.match(/^row_(\d+)_is_header$/);
        if (hdrMatch) { headers[parseInt(hdrMatch[1])] = r.param_value === '1'; return; }
        // row_N_X_type
        const typeMatch = r.param_key.match(/^row_(\d+)_([A-I])_type$/i);
        if (typeMatch) { types[`row_${typeMatch[1]}_${typeMatch[2].toUpperCase()}`] = r.param_value || ''; return; }
        // gw_row_N_is_header
        const gwHdrMatch = r.param_key.match(/^gw_row_(\d+)_is_header$/);
        if (gwHdrMatch) { gwHeaders[parseInt(gwHdrMatch[1])] = r.param_value === '1'; return; }
        // gw_row_N_COL_type
        const gwTypeMatch = r.param_key.match(/^gw_row_(\d+)_([A-Z]{1,3})_type$/i);
        if (gwTypeMatch) { gwTypes[`gw_row_${gwTypeMatch[1]}_${gwTypeMatch[2].toUpperCase()}`] = r.param_value || ''; return; }
        // gw_row_N_COL (cell value)
        if (/^gw_row_\d+_[A-Z]{1,3}$/i.test(r.param_key)) { gwMap[r.param_key] = r.param_value || ''; return; }
        // row_N_X  (cell value)
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

  const markDirty = () => setDirty(true);

  const handleGwCellChange = (rowNum, c, val) => {
    setGwCellData(prev => ({ ...prev, [`gw_row_${rowNum}_${c}`]: val }));
    markDirty();
  };
  const handleGwTypeToggle = (rowNum, c) => {
    const key = `gw_row_${rowNum}_${c}`;
    setGwCellTypes(prev => ({ ...prev, [key]: prev[key] === 'value' ? '' : 'value' }));
    markDirty();
  };
  const handleGwHeaderToggle = (rowNum, checked) => {
    setGwRowHeaders(prev => ({ ...prev, [rowNum]: checked }));
    markDirty();
  };

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
      // GW cell values (AN50:AV55)
      for (const rowNum of GW_ROW_RANGE) {
        for (const c of GW_COL_LETTERS) {
          const key = `gw_row_${rowNum}_${c}`;
          const val = gwCellData[key] || '';
          if (val || origKeys.has(key)) params.push({ param_key: key, param_value: val || null });
        }
      }
      // GW cell types
      for (const rowNum of GW_ROW_RANGE) {
        for (const c of GW_COL_LETTERS) {
          const cellKey = `gw_row_${rowNum}_${c}`;
          const typeKey = `${cellKey}_type`;
          const typeVal = gwCellTypes[cellKey] || '';
          if (typeVal || origKeys.has(typeKey)) params.push({ param_key: typeKey, param_value: typeVal || null });
        }
      }
      // GW row header flags
      for (const rowNum of GW_ROW_RANGE) {
        const hdrKey = `gw_row_${rowNum}_is_header`;
        const hdrVal = gwRowHeaders[rowNum] ? '1' : '';
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
    { title: 'Machine Type Code', dataIndex: 'machine_type_code', width: 300 },
    { title: 'Machine Type Name', dataIndex: 'machine_type_name' },
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
        return (
          <Input
            size="small"
            value={gwCellData[cellKey] || ''}
            onChange={e => handleGwCellChange(record.rowNum, c, e.target.value)}
            style={{ fontSize: 11, color: isValue ? '#ff4d4f' : undefined, backgroundColor: gwRowHeaders[record.rowNum] ? '#f5f5f5' : undefined }}
            suffix={
              <span
                title="Toggle: Label / Value"
                onClick={() => handleGwTypeToggle(record.rowNum, c)}
                style={{ cursor: 'pointer', fontSize: 10, fontWeight: 'bold', color: isValue ? '#ff4d4f' : '#bfbfbf', userSelect: 'none' }}
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

  const displayedMachineTypes = visibleMachineNames
    ? allMachineTypes.filter(m => visibleMachineNames.has(m.machine_type_name))
    : allMachineTypes;

  const openConfigModal = () => {
    const list = fullMachineTypes.length ? fullMachineTypes : allMachineTypes;
    setTempChecked(
      visibleMachineNames
        ? list.filter(m => visibleMachineNames.has(m.machine_type_name)).map(m => m.machine_type_name)
        : list.map(m => m.machine_type_name)
    );
    setConfigModalOpen(true);
  };

  const applyConfig = () => {
    // Use fullMachineTypes so isAll is never fooled by an active search filter
    const list = fullMachineTypes.length ? fullMachineTypes : allMachineTypes;
    const allNames = list.map(m => m.machine_type_name);
    const isAll = tempChecked.length === allNames.length && allNames.every(n => tempChecked.includes(n));
    const next = isAll ? null : new Set(tempChecked);
    setVisibleMachineNames(next);
    try {
      if (next) localStorage.setItem('sds_admin_visible_machines', JSON.stringify([...next]));
      else localStorage.removeItem('sds_admin_visible_machines');
    } catch { }
    setConfigModalOpen(false);
  };

  const machineListBlock = (
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
  );

  const cellGridContent = (
    <div>
      {machineListBlock}
      {selectedMachine && (
        <Spin spinning={configLoading}>
          <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
            <Col><Text strong>{selectedMachine}</Text></Col>
            <Col flex="auto" />
            {dirty && <Col><Text type="warning" style={{ fontSize: 12 }}>Please Save</Text></Col>}
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

  const gwConfigContent = (
    <div>
      {machineListBlock}
      {selectedMachine && (
        <Spin spinning={configLoading}>
          <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
            <Col><Text strong>{selectedMachine}</Text></Col>
            <Col flex="auto" />
            {dirty && <Col><Text type="warning" style={{ fontSize: 12 }}>Please Save</Text></Col>}
            <Col>
              <Button type="primary" icon={<SaveOutlined />} onClick={saveConfig} loading={saving} disabled={!dirty}>
                Save
              </Button>
            </Col>
          </Row>
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

  const configVisibleBtn = (
    <Button icon={<SettingOutlined />} size="small" onClick={openConfigModal}>
      Configure Visible
      {visibleMachineNames && (
        <Tag color="blue" style={{ marginLeft: 4 }}>{visibleMachineNames.size}</Tag>
      )}
    </Button>
  );

  return (
    <>
      <Tabs
        size="small"
        tabBarExtraContent={configVisibleBtn}
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
      <Modal
        title="Machine Name"
        open={configModalOpen}
        onOk={applyConfig}
        onCancel={() => setConfigModalOpen(false)}
        okText="Apply"
        cancelText="Cancel"
        width={480}
      >
        <Space style={{ marginBottom: 12 }}>
          <Button size="small" onClick={() => setTempChecked((fullMachineTypes.length ? fullMachineTypes : allMachineTypes).map(m => m.machine_type_name))}>
            Select All
          </Button>
          <Button size="small" onClick={() => setTempChecked([])}>
            Deselect All
          </Button>
        </Space>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Checkbox.Group
            value={tempChecked}
            onChange={setTempChecked}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {(fullMachineTypes.length ? fullMachineTypes : allMachineTypes).map(m => (
              <Checkbox key={m.id ?? m.machine_type_name} value={m.machine_type_name}>
                <Text style={{ fontSize: 13 }}>
                  <Text type="secondary">{m.machine_type_code}</Text>
                  {' — '}
                  {m.machine_type_name}
                </Text>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>
      </Modal>
    </>
  );
};

// ── Tab 4: Audit (Data Integrity) ─────────────────────────────────────────────

const AuditTab = ({ theme }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ itemCounts: [], noProcessPlan: [], missingTooling: [], totals: {} });
  const [activeCategory, setActiveCategory] = useState(null);
  const [showNoPlan, setShowNoPlan] = useState(false);
  const [expandedProcessCodes, setExpandedProcessCodes] = useState(new Set());

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

  // Build dynamic category list from itemCounts
  const categories = useMemo(() => {
    const cats = [];
    const ballTotal = data.totals?.ballTotal || 0;
    const raceTotal = data.totals?.raceTotal || 0;
    if (data.itemCounts.some(r => r.sub_class?.startsWith('C3')))
      cats.push({ key: 'ball', label: 'Ball', prefix: 'C3', total: ballTotal, color: '#1677ff' });
    if (data.itemCounts.some(r => r.sub_class?.startsWith('C2')))
      cats.push({ key: 'race', label: 'Race', prefix: 'C2', total: raceTotal, color: '#52c41a' });
    // Any other sub_class prefixes beyond C2/C3
    const otherPrefixes = [...new Set(
      data.itemCounts
        .filter(r => r.sub_class && !r.sub_class.startsWith('C2') && !r.sub_class.startsWith('C3'))
        .map(r => r.sub_class.substring(0, 2))
    )];
    otherPrefixes.forEach(prefix => {
      const total = data.itemCounts.filter(r => r.sub_class?.startsWith(prefix)).reduce((s, r) => s + r.count, 0);
      cats.push({ key: prefix, label: prefix, prefix, total, color: '#722ed1' });
    });
    return cats;
  }, [data]);

  const getCategoryPrefix = useCallback((catKey) => {
    const cat = categories.find(c => c.key === catKey);
    return cat?.prefix || catKey;
  }, [categories]);

  const handleCategoryClick = (key) => {
    setActiveCategory(prev => prev === key ? null : key);
    setShowNoPlan(false);
    setExpandedProcessCodes(new Set());
  };

  const filteredNoPlan = useMemo(() => {
    if (!activeCategory) return data.noProcessPlan;
    const prefix = getCategoryPrefix(activeCategory);
    return data.noProcessPlan.filter(r => r.sub_class?.startsWith(prefix));
  }, [data.noProcessPlan, activeCategory, getCategoryPrefix]);

  const filteredMissingTooling = useMemo(() => {
    if (!activeCategory) return data.missingTooling;
    const prefix = getCategoryPrefix(activeCategory);
    return data.missingTooling.filter(r => r.sub_class?.startsWith(prefix));
  }, [data.missingTooling, activeCategory, getCategoryPrefix]);

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
      return next;
    });
  };

  const noPlanCols = [
    { title: 'CN', dataIndex: 'control_no', key: 'control_no', sorter: (a, b) => a.control_no?.localeCompare(b.control_no) },
  ];

  const missingCnCols = [
    { title: 'CN', dataIndex: 'control_no', key: 'control_no', sorter: (a, b) => a.control_no?.localeCompare(b.control_no) },
  ];

  const activeCat = categories.find(c => c.key === activeCategory);

  return (
    <div style={{ minHeight: 600 }}>
      <Row gutter={24}>
        <Col span={6}>
          <Title level={5}><SearchOutlined /> Item Counts</Title>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Text type="secondary">Grand Total (Enable)</Text>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: theme.colors.primary, lineHeight: 1.2, margin: '4px 0 8px' }}>
              {data.totals?.grandTotal?.toLocaleString() || 0}
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <Space wrap>
              <Button
                size="small"
                type={activeCategory === null ? 'primary' : 'default'}
                onClick={() => { setActiveCategory(null); setShowNoPlan(false); setExpandedProcessCodes(new Set()); }}
              >
                All
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.key}
                  type={activeCategory === cat.key ? 'primary' : 'default'}
                  onClick={() => handleCategoryClick(cat.key)}
                  size="small"
                >
                  {cat.label}
                </Button>
              ))}
            </Space>
            {activeCat && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: activeCat.color }}>
                  {activeCat.total.toLocaleString()}
                </div>
                <Text type="secondary">{activeCat.label} ({activeCat.prefix}x)</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col span={18}>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col><Title level={5}><ReloadOutlined /> Data Consistency Audit</Title></Col>
            <Col><Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>Refresh All</Button></Col>
          </Row>

          <Tabs
            type="card"
            size="small"
            items={[
              {
                key: 'no-plan',
                label: <Tag color="error">Critical: No Process Plan ({filteredNoPlan.length})</Tag>,
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                      Incomplete Routing (Process Plan) from LPB — Can't generate SDS
                    </Text>
                    <Button
                      size="small"
                      type={showNoPlan ? 'primary' : 'default'}
                      onClick={() => setShowNoPlan(v => !v)}
                      style={{ marginBottom: 12 }}
                    >
                      {showNoPlan ? 'Hide List' : `Show List (${filteredNoPlan.length} CN)`}
                    </Button>
                    {showNoPlan && (
                      <Table
                        dataSource={filteredNoPlan}
                        columns={noPlanCols}
                        size="small"
                        loading={loading}
                        bordered
                        rowKey="control_no"
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                      />
                    )}
                  </>
                ),
              },
              {
                key: 'missing-tool',
                label: <Tag color="warning">Warning: Missing Tooling ({new Set(filteredMissingTooling.map(r => r.control_no)).size} CN)</Tag>,
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                      Process Plan exists but missing Tooling — Click Process Code to see items
                    </Text>
                    <Space wrap style={{ marginBottom: 16 }}>
                      {expandedProcessCodes.size > 0 && (
                        <Button
                          size="small"
                          danger
                          onClick={() => setExpandedProcessCodes(new Set())}
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
                  </>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const SdsV2AdminPage = () => {
  const { theme } = useTheme();

  const tabItems = [
    { key: 'params', label: 'Per-record Params', children: <ParamsTab theme={theme} /> },
    { key: 'machine-config', label: 'Machine Parameter Config', children: <MachineConfigTab theme={theme} /> },
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
    { key: 'audit', label: 'Data Integrity', children: <AuditTab theme={theme} /> },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ padding: 24, overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <Title level={4} style={{ color: theme.colors.text, marginBottom: 16 }}>
            Setup Data Sheet Management
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
