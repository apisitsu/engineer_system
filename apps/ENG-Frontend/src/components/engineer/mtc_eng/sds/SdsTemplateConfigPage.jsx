import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layout, Card, Row, Col, Button, Input, Select, Tabs, Table, Tag,
  Typography, Space, App, Spin, ColorPicker, Tooltip,
  InputNumber, Badge,
} from 'antd';
import {
  SaveOutlined, ReloadOutlined, EyeOutlined, ArrowLeftOutlined,
  BgColorsOutlined, ColumnWidthOutlined, FontSizeOutlined,
  TableOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// ── CSS config metadata ──────────────────────────────────────────────────────

const CSS_CONFIG_GROUPS = [
  {
    key: 'row_heights',
    label: 'Row Heights',
    icon: <ColumnWidthOutlined />,
    items: [
      { key: 'height-row-normal', label: 'Normal Row', default: '3.65mm', unit: 'mm', desc: 'Standard body row height (19.5pt × 53%)' },
      { key: 'height-row-sep',    label: 'Separator Row', default: '0.84mm', unit: 'mm', desc: 'Thin separator between tooling groups' },
      { key: 'height-row-img',    label: 'Image Row', default: '21.9mm', unit: 'mm', desc: 'Tool image row height (6 × normal)' },
    ],
  },
  {
    key: 'font_sizes',
    label: 'Font Sizes',
    icon: <FontSizeOutlined />,
    items: [
      { key: 'font-size-base',    label: 'Body Text', default: '5.3pt', unit: 'pt', desc: 'All body text (Excel sz=10 @ 53%)' },
      { key: 'font-size-title',   label: 'Title Bar', default: '7pt', unit: 'pt', desc: '"SETUP DATA SHEET" heading' },
      { key: 'font-size-section', label: 'Section Title', default: '9pt', unit: 'pt', desc: '"TOOLING & GRINDING CONDITION"' },
      { key: 'font-size-badge',   label: 'Tool Badge', default: '4.5pt', unit: 'pt', desc: 'T01, T02… tool ID labels' },
    ],
  },
  {
    key: 'panel_widths',
    label: 'Panel Widths (%)',
    icon: <ColumnWidthOutlined rotate={90} />,
    items: [
      { key: 'width-params-panel',   label: 'Params Panel', default: '26.13%', unit: '%', desc: 'Left panel — cols A-J (26.1 units)' },
      { key: 'width-tooling-panel',  label: 'Tooling Panel', default: '54.60%', unit: '%', desc: 'Center panel — cols K-AN (54.6 units)' },
      { key: 'width-grinding-panel', label: 'Grinding Panel', default: '19.27%', unit: '%', desc: 'Right panel — cols AO-AV (19.3 units)' },
    ],
  },
  {
    key: 'colors',
    label: 'Colors',
    icon: <BgColorsOutlined />,
    items: [
      { key: 'color-border-outer', label: 'Outer Border', default: '#000000', type: 'color', desc: 'Page border + section dividers' },
      { key: 'color-border-inner', label: 'Inner Border', default: '#aaaaaa', type: 'color', desc: 'Cell internal thin borders' },
      { key: 'color-badge-bg',     label: 'Badge Background', default: '#1a3a8c', type: 'color', desc: 'T01/T02 tool badge background (blue)' },
      { key: 'color-value-red',    label: 'Value Highlight', default: '#cc0000', type: 'color', desc: 'Red text for computed values' },
      { key: 'color-header-bg',    label: 'Header Background', default: '#e0e0e0', type: 'color', desc: 'Param section header row background' },
      { key: 'color-sep-bg',       label: 'Separator Background', default: '#f0f0f0', type: 'color', desc: 'Thin separator row background' },
    ],
  },
];

// Build lookup: key → item metadata
const CSS_META = {};
CSS_CONFIG_GROUPS.forEach(g => g.items.forEach(it => { CSS_META[it.key] = it; }));


// ── Main Component ────────────────────────────────────────────────────────────

const SdsTemplateConfigPage = () => {
  const { message } = App.useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // CSS config
  const [configValues, setConfigValues] = useState({});   // key → current string value
  const [dbValues, setDbValues] = useState({});           // key → value as saved in DB
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);

  // Preview — blank template (no CN/machine needed)
  const [previewKey, setPreviewKey] = useState(0);
  // For data filter only (not for preview)
  const [machineTypes, setMachineTypes] = useState([]);

  // Data tabs
  const [dataTab, setDataTab] = useState('params');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState(null);
  const [commonParams, setCommonParams] = useState([]);
  const [gwParams, setGwParams] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Load config from DB
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const r = await axios.get(server.MTC_SDS_V2_ADMIN_TEMPLATE_CONFIG);
      const vals = {};
      r.data.configs.forEach(c => { vals[c.config_key] = c.config_value; });
      setConfigValues(vals);
      setDbValues({ ...vals });
    } catch (err) {
      message.error('Failed to load template config');
    } finally {
      setLoadingConfig(false);
    }
  }, [message]);

  // Load machine types for filter + preview
  const loadMachineTypes = useCallback(async () => {
    try {
      const r = await axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES, { params: { nodedupe: 'true' } });
      setMachineTypes(r.data.filter(m => m.is_active && m.machine_type_name));
    } catch (_) {}
  }, []);

  // Load common params (machine-level) + GW params + mappings
  const loadCommonParams = useCallback(async (machine) => {
    setLoadingData(true);
    try {
      const params = machine ? { machine_type_name: machine } : {};
      const r = await axios.get(server.MTC_SDS_V2_ADMIN_TEMPLATE_CONFIG_PARAMS, { params });
      setCommonParams(r.data.params || []);
      setGwParams(r.data.gw_params || []);
      setMappings(r.data.mappings || []);
    } catch (err) {
      message.error('Failed to load common params');
    } finally {
      setLoadingData(false);
    }
  }, [message]);

  useEffect(() => {
    loadConfig();
    loadMachineTypes();
    loadCommonParams(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Change a single config value
  const handleChange = (key, value) => {
    setConfigValues(prev => ({ ...prev, [key]: value }));
  };

  // Check if a value differs from DB-saved
  const isModified = (key) => configValues[key] !== dbValues[key];
  const anyModified = Object.keys(configValues).some(k => isModified(k));

  // Save all modified values
  const handleSave = async () => {
    const toSave = Object.entries(configValues)
      .filter(([k]) => isModified(k))
      .map(([config_key, config_value]) => ({ config_key, config_value }));
    if (!toSave.length) { message.info('No changes to save'); return; }
    setSaving(true);
    try {
      await axios.put(server.MTC_SDS_V2_ADMIN_TEMPLATE_CONFIG, { configs: toSave });
      setDbValues({ ...configValues });
      message.success(`Saved ${toSave.length} config item(s)`);
    } catch (err) {
      message.error('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Reset a single key to its default value
  const handleResetKey = async (key) => {
    const defaultVal = CSS_META[key]?.default || '';
    // Update local state and save null (removes DB override)
    setConfigValues(prev => ({ ...prev, [key]: defaultVal }));
    try {
      await axios.put(server.MTC_SDS_V2_ADMIN_TEMPLATE_CONFIG, {
        configs: [{ config_key: key, config_value: null }],
      });
      setDbValues(prev => ({ ...prev, [key]: defaultVal }));
      message.success(`Reset ${key} to default`);
    } catch (_) {
      message.error('Reset failed');
    }
  };

  // Build blank preview URL with current (unsaved) CSS overrides
  const previewUrl = useMemo(() => {
    const overrides = {};
    Object.entries(configValues).forEach(([k, v]) => { if (v) overrides[k] = v; });
    const token = localStorage.getItem('token') || '';
    const p = new URLSearchParams({ cssOverrides: JSON.stringify(overrides), token });
    return `${server.MTC_SDS_V2_PDF_CHROME_BLANK}?${p.toString()}`;
  }, [configValues]);

  const handlePreview = () => setPreviewKey(k => k + 1);

  const handleMachineFilterChange = (val) => {
    setSelectedMachineFilter(val);
    loadCommonParams(val || null);
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderCssControl = (item) => {
    const val = configValues[item.key] ?? item.default;
    const modified = isModified(item.key);

    if (item.type === 'color') {
      return (
        <Row key={item.key} align="middle" style={{ marginBottom: 8 }}>
          <Col span={8}>
            <Text style={{ fontSize: 11 }}>{item.label}</Text>
            {modified && <Badge dot offset={[4, 0]} />}
          </Col>
          <Col span={8}>
            <Space>
              <ColorPicker
                value={val || item.default}
                onChange={(color) => handleChange(item.key, color.toHexString())}
                showText
                size="small"
              />
            </Space>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            {modified && (
              <Tooltip title={`Reset to ${item.default}`}>
                <Button size="small" type="link" onClick={() => handleResetKey(item.key)}>
                  Reset
                </Button>
              </Tooltip>
            )}
          </Col>
          {item.desc && (
            <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>{item.desc}</Text></Col>
          )}
        </Row>
      );
    }

    // Number with unit (mm, pt, %)
    const numVal = parseFloat(val) || parseFloat(item.default);
    return (
      <Row key={item.key} align="middle" style={{ marginBottom: 8 }} gutter={4}>
        <Col span={8}>
          <Text style={{ fontSize: 11 }}>{item.label}</Text>
          {modified && <Badge dot offset={[4, 0]} />}
        </Col>
        <Col span={10}>
          <Space.Compact size="small" style={{ width: '100%' }}>
            <InputNumber
              size="small"
              value={numVal}
              step={item.unit === 'mm' ? 0.1 : item.unit === '%' ? 0.5 : 0.1}
              precision={2}
              min={0}
              style={{ width: '100%' }}
              onChange={(n) => n != null && handleChange(item.key, `${n}${item.unit}`)}
            />
            <Input
              size="small"
              value={item.unit}
              readOnly
              style={{ width: 36, textAlign: 'center', background: '#fafafa', color: '#888', cursor: 'default' }}
            />
          </Space.Compact>
        </Col>
        <Col span={6} style={{ textAlign: 'right' }}>
          {modified && (
            <Tooltip title={`Reset to ${item.default}`}>
              <Button size="small" type="link" onClick={() => handleResetKey(item.key)}>Reset</Button>
            </Tooltip>
          )}
        </Col>
        {item.desc && (
          <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>{item.desc}</Text></Col>
        )}
      </Row>
    );
  };

  // ── Param table columns ───────────────────────────────────────────────────

  const paramCols = [
    { title: 'Machine', dataIndex: 'machine_type_name', key: 'machine', width: 120,
      render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Param Key', dataIndex: 'param_key', key: 'key', width: 200 },
    { title: 'Value', dataIndex: 'param_value', key: 'val',
      render: v => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text> },
  ];

  const mappingCols = [
    { title: 'Cell Address', dataIndex: 'cell_address', key: 'cell', width: 100,
      render: v => <Tag color="green">{v}</Tag> },
    { title: 'Param Key', dataIndex: 'param_key', key: 'key', width: 220 },
    { title: 'Machine Type', dataIndex: 'machine_type_name', key: 'machine',
      render: v => v ? <Tag color="blue">{v}</Tag> : <Tag>Shared</Tag> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout style={{ height: '100vh', background: theme === 'dark' ? '#141414' : '#f5f5f5' }}>
      <MenuTemplate />
      <Content style={{ padding: '16px', overflowY: 'auto' }}>

        {/* Header */}
        <Row align="middle" style={{ marginBottom: 16 }} gutter={8}>
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.SDS_V2_ADMIN)}>
              Back
            </Button>
          </Col>
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>
              <SettingOutlined /> SDS Template Configuration
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Customize Chrome PDF visual style — Excel config (sds_parameter, sds_machine_tool, images) is unchanged
            </Text>
          </Col>
          <Col>
            <Space>
              <Button onClick={loadConfig} icon={<ReloadOutlined />}>Reload</Button>
              <Button
                type="primary" icon={<SaveOutlined />}
                loading={saving} disabled={!anyModified}
                onClick={handleSave}
              >
                Save {anyModified ? `(${Object.keys(configValues).filter(k => isModified(k)).length})` : ''}
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Style Editor + Preview */}
        <Row gutter={12} style={{ marginBottom: 16 }}>

          {/* Left: CSS controls */}
          <Col span={8}>
            {loadingConfig ? <Spin /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CSS_CONFIG_GROUPS.map(group => (
                  <Card
                    key={group.key}
                    size="small"
                    title={<Space>{group.icon}<span>{group.label}</span></Space>}
                    style={{ fontSize: 11 }}
                  >
                    {group.items.map(item => renderCssControl(item))}
                  </Card>
                ))}
              </div>
            )}
          </Col>

          {/* Right: Blank Template Preview */}
          <Col span={16}>
            <Card
              title={<Space><EyeOutlined />Live Preview — Blank Template</Space>}
              size="small"
              style={{ height: '100%' }}
              extra={
                <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={handlePreview}>
                  Refresh
                </Button>
              }
            >
              <iframe
                key={previewKey}
                src={previewUrl}
                style={{
                  width: '100%',
                  height: 510,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  background: '#fff',
                }}
                title="SDS Blank Template Preview"
              />
              <Text type="secondary" style={{ fontSize: 10 }}>
                แสดง template โครงสร้างเปล่า (ไม่มีข้อมูล CN) — CSS สด จาก controls ด้านซ้าย กด Refresh เพื่ออัพเดท
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Data Config Tables */}
        <Card
          size="small"
          title={<Space><TableOutlined />Common Configuration Data</Space>}
          extra={
            <Select
              size="small" placeholder="Filter by machine" allowClear
              style={{ width: 200 }}
              value={selectedMachineFilter}
              onChange={handleMachineFilterChange}
              showSearch optionFilterProp="children"
            >
              {machineTypes.map(m => (
                <Option key={m.id} value={m.machine_type_name}>{m.machine_type_name}</Option>
              ))}
            </Select>
          }
        >
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
            These values are managed via SDS Admin → Parameters. Shown here as read-only reference.
            Excel config (sds_parameter, GW config, column mapping) is identical for both LibreOffice and Chrome PDF.
          </Text>
          <Tabs
            activeKey={dataTab}
            onChange={setDataTab}
            size="small"
            items={[
              {
                key: 'params',
                label: `Parameter Config (${commonParams.length})`,
                children: (
                  <Table
                    dataSource={commonParams}
                    columns={paramCols}
                    rowKey={(r) => `${r.machine_type_name ?? ''}_${r.param_key}`}
                    size="small" loading={loadingData}
                    pagination={{ pageSize: 15, size: 'small' }}
                    scroll={{ y: 320 }}
                  />
                ),
              },
              {
                key: 'gw',
                label: `GW Config (${gwParams.length})`,
                children: (
                  <Table
                    dataSource={gwParams}
                    columns={paramCols}
                    rowKey={(r) => `gw_${r.machine_type_name ?? ''}_${r.param_key}`}
                    size="small" loading={loadingData}
                    pagination={{ pageSize: 15, size: 'small' }}
                    scroll={{ y: 320 }}
                  />
                ),
              },
              {
                key: 'mapping',
                label: `Column Mapping (${mappings.length})`,
                children: (
                  <Table
                    dataSource={mappings}
                    columns={mappingCols}
                    rowKey="id"
                    size="small" loading={loadingData}
                    pagination={{ pageSize: 15, size: 'small' }}
                    scroll={{ y: 320 }}
                  />
                ),
              },
            ]}
          />
        </Card>

      </Content>
    </Layout>
  );
};

export default SdsTemplateConfigPage;
