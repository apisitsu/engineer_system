import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Space, Button, Form, Input, Modal, App, Table,
  InputNumber, Row, Col, Popconfirm, Card, Layout, Select,
  Alert, Tag, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined,
  SearchOutlined, ReloadOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

const { Text, Title } = Typography;
const { Content } = Layout;

// Reusable OD/ID/W dimension group (Bf or Aft)
const DimCard = ({ label, prefix }) => (
  <Card title={label} size="small" style={{ marginBottom: 12 }}>
    <Row gutter={8}>
      {['od','id','w'].map(dim => (
        <Col span={8} key={dim}>
          <Form.Item name={`${dim}_${prefix}`} label={`${dim.toUpperCase()} ${prefix === 'bf' ? 'Bf' : 'Aft'}`}>
            <InputNumber style={{ width: '100%' }} precision={4} />
          </Form.Item>
          <Row gutter={4}>
            <Col span={12}>
              <Form.Item name={`${dim}_${prefix}_max`} label="Max">
                <InputNumber style={{ width: '100%' }} precision={4} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={`${dim}_${prefix}_min`} label="Min">
                <InputNumber style={{ width: '100%' }} precision={4} />
              </Form.Item>
            </Col>
          </Row>
        </Col>
      ))}
    </Row>
  </Card>
);

export const SpecProcessManager = ({ embedded = false }) => {
  const { message } = App.useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [selectedPartType, setSelectedPartType] = useState(null);
  const [form] = Form.useForm();
  const watchedCn = Form.useWatch('cn', form);
  const watchedType = Form.useWatch('type', form);
  const watchedYball = Form.useWatch('yball', form);
  const watchedOdAft = Form.useWatch('od_aft', form);
  const watchedWAft = Form.useWatch('w_aft', form);

  const [syncNewLoading, setSyncNewLoading] = useState(false);
  const [syncNewResult, setSyncNewResult] = useState(null);  // { synced, failed, errors[] }
  const [specCounts, setSpecCounts] = useState({ total: 0, counts: {} });

  const colors = theme?.colors || {};

  const handleCalculateSd = () => {
    if (watchedOdAft > 0 && watchedWAft > 0 && watchedOdAft > watchedWAft) {
      const sd = Math.sqrt(watchedOdAft * watchedOdAft - watchedWAft * watchedWAft);
      form.setFieldsValue({ sd: Number(sd.toFixed(4)) });
      message.info(`Calculated SD: ${sd.toFixed(4)}`);
    } else {
      message.warning('Cannot calculate SD: Ensure OD > W and both are > 0');
    }
  };

  const fetchSpecs = useCallback(async (page = 1, pageSize = 20, q = '', partType = null) => {
    setLoading(true);
    try {
      const params = { q, page, limit: pageSize };
      if (partType) params.partType = partType;
      const res = await axios.get(server.MTC_TOOLING_SPEC, { params });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      message.error('Failed to load specifications');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await axios.get(server.MTC_TOOLING_SPEC_COUNTS);
      setSpecCounts(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  useEffect(() => {
    fetchSpecs(pagination.current, pagination.pageSize, searchText, selectedPartType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSpecs, selectedPartType, pagination.current, pagination.pageSize]);

  const handleTableChange = (pag) => {
    setPagination(pag);
  };

  const handleSearch = (value) => {
    const q = typeof value === 'string' ? value : searchText;
    setPagination({ ...pagination, current: 1 });
    fetchSpecs(1, pagination.pageSize, q, selectedPartType);
  };

  const handlePartTypeSelect = (pt) => {
    if (selectedPartType === pt) {
      setSelectedPartType(null);
      setPagination({ ...pagination, current: 1 });
    } else {
      setSelectedPartType(pt);
      setPagination({ current: 1, pageSize: 20 });
    }
  };

  const openAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsFormOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (values.process) {
        values.process = values.process.replace('→', '->').replace('???', '->');
      }
      setSaving(true);
      if (editingRecord) {
        await axios.put(`${server.MTC_TOOLING_SPEC}/${editingRecord.cn}`, values);
        message.success('Specification updated');
      } else {
        await axios.post(server.MTC_TOOLING_SPEC, values);
        message.success('Specification created');
      }
      setIsFormOpen(false);
      fetchSpecs(pagination.current, pagination.pageSize, searchText, selectedPartType);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cn) => {
    try {
      await axios.delete(`${server.MTC_TOOLING_SPEC}/${cn}`);
      message.success('Specification deleted');
      fetchSpecs(pagination.current, pagination.pageSize, searchText, selectedPartType);
    } catch (err) {
      message.error('Delete failed');
    }
  };

  const runSyncNew = async () => {
    setSyncNewLoading(true);
    setSyncNewResult(null);
    try {
      const res = await axios.post(server.MTC_TOOLING_SPEC_SYNC_NEW);
      setSyncNewResult(res.data);
      if (res.data.synced > 0) fetchSpecs(1, pagination.pageSize, searchText, selectedPartType);
    } catch (err) {
      message.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncNewLoading(false);
    }
  };

  const getPartType = (cn) => {
    if (!cn) return null;
    const s = String(cn).replace(/\D/g, '');
    const cls = parseInt(s.slice(0, 2), 10);
    if (cls >= 11 && cls <= 19) return 'BODY';
    if (cls >= 21 && cls <= 29) return 'RACE';
    if (cls >= 31 && cls <= 39) return 'BALL';
    if (cls >= 41 && cls <= 49) return 'SPHERICAL';
    if (cls >= 51 && cls <= 59) return 'BODY';
    if (cls >= 61 && cls <= 69) return 'SLEEVE';
    if (cls === 95 || cls === 99) return 'MECHA'; // C95/C99 — same scope as SDS coverage mecha
    return null;
  };

  // MECHA (C95/C99) has no factory dim table — rows must be added manually.
  // SPHERICAL restored 2026-06-13 via eng_sph+eng_sph_design join (8,786 rows, 8,751 with dims).
  const PART_TYPE_COLOR = { BALL: '#1677ff', RACE: '#52c41a', BODY: '#fa8c16', SLEEVE: '#722ed1', SPHERICAL: '#f5222d', MECHA: '#13c2c2' };

  const isBodyCn = (cn) => ['BODY'].includes(getPartType(cn));

  const columns = [
    {
      title: 'C/N',
      dataIndex: 'cn',
      key: 'cn',
      width: 120,
      fixed: 'left',
      render: v => <Text strong>{v}</Text>,
      sorter: (a, b) => (a.cn || '').localeCompare(b.cn || ''),
    },
    {
      title: 'Part Type',
      key: 'part_type',
      width: 90,
      render: (_, r) => {
        const pt = getPartType(r.cn);
        return pt ? <Tag color={PART_TYPE_COLOR[pt]}>{pt}</Tag> : null;
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      sorter: (a, b) => (a.type || '').localeCompare(b.type || ''),
    },
    {
      title: 'Groove Y',
      dataIndex: 'groove_y',
      key: 'groove_y',
      width: 80,
      render: (v, r) => (r.type === 'ABR' && (v == null || v === '')) ? <Text type="warning">—</Text> : (v ?? ''),
      sorter: (a, b) => (a.groove_y || 0) - (b.groove_y || 0),
    },
    {
      title: 'Process',
      dataIndex: 'process',
      key: 'process',
      width: 100,
      render: v => (v || '').replace('→', '->').replace('???', '->'),
      sorter: (a, b) => (a.process || '').localeCompare(b.process || ''),
    },
    {
      title: 'Dimensions (Bf)',
      children: [
        { title: 'OD', dataIndex: 'od_bf', key: 'od_bf', width: 70, sorter: (a, b) => (a.od_bf || 0) - (b.od_bf || 0) },
        { title: 'ID', dataIndex: 'id_bf', key: 'id_bf', width: 70, sorter: (a, b) => (a.id_bf || 0) - (b.id_bf || 0) },
        { title: 'W', dataIndex: 'w_bf', key: 'w_bf', width: 70, sorter: (a, b) => (a.w_bf || 0) - (b.w_bf || 0) },
      ]
    },
    {
      title: 'Dimensions (Aft)',
      children: [
        { title: 'OD', dataIndex: 'od_aft', key: 'od_aft', width: 70, sorter: (a, b) => (a.od_aft || 0) - (b.od_aft || 0) },
        { title: 'ID', dataIndex: 'id_aft', key: 'id_aft', width: 70, sorter: (a, b) => (a.id_aft || 0) - (b.id_aft || 0) },
        { title: 'W', dataIndex: 'w_aft', key: 'w_aft', width: 70, sorter: (a, b) => (a.w_aft || 0) - (b.w_aft || 0) },
      ]
    },
    {
      title: 'Body Spec',
      children: [
        { title: 'Final ID', dataIndex: 'final_id', key: 'final_id', width: 80 },
        { title: 'Head W', dataIndex: 'head_width', key: 'head_width', width: 80 },
        { title: 'Thread L', dataIndex: 'thread_length', key: 'thread_length', width: 80 },
        { title: 'Shape', dataIndex: 'shape_code', key: 'shape_code', width: 65 },
        { title: 'Nipple', dataIndex: 'nipple', key: 'nipple', width: 65 },
        { title: 'Key Gr.', dataIndex: 'key_groove', key: 'key_groove', width: 65 },
      ]
    },
    {
      title: 'Body Blank',
      children: [
        { title: 'Head', dataIndex: 'blank_head', key: 'blank_head', width: 70 },
        { title: 'F Dim', dataIndex: 'blank_f_dim', key: 'blank_f_dim', width: 70 },
        { title: 'R2', dataIndex: 'blank_r2', key: 'blank_r2', width: 60 },
        { title: 'R3', dataIndex: 'blank_r3', key: 'blank_r3', width: 60 },
        { title: 'Shank Dia', dataIndex: 'female_shankdia', key: 'female_shankdia', width: 85 },
        { title: 'Shank', dataIndex: 'female_shank', key: 'female_shank', width: 70 },
        { title: 'ID Dim', dataIndex: 'female_id_dim', key: 'female_id_dim', width: 70 },
        { title: 'Flange D', dataIndex: 'female_flange_d', key: 'female_flange_d', width: 75 },
        { title: 'Flange H', dataIndex: 'female_flange_h', key: 'female_flange_h', width: 75 },
      ]
    },
    {
      title: 'Body Thread',
      children: [
        { title: 'Thread', dataIndex: 'thread_name', key: 'thread_name', width: 120 },
        { title: 'OD Max', dataIndex: 'thread_max_od', key: 'thread_max_od', width: 75 },
        { title: 'OD Min', dataIndex: 'thread_min_od', key: 'thread_min_od', width: 75 },
        { title: 'Pre-Thread', dataIndex: 'pre_thread', key: 'pre_thread', width: 85 },
      ]
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this spec?" onConfirm={() => handleDelete(record.cn)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const content = (
    <div style={{ padding: embedded ? 0 : '24px', overflowY: embedded ? undefined : 'auto', height: embedded ? undefined : 'calc(100vh - 64px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {!embedded && (
          <Space size={16}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(MTC_PATHS.TOOLING_SELECT)}
            />
            <Title level={4} style={{ margin: 0, color: colors.primary }}>
              Part Management
            </Title>
          </Space>
        )}
        <Space>
          <Input.Search
            placeholder="Search CN, Type, Process..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={handleSearch}
            enterButton
            style={{ width: 300 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchSpecs(pagination.current, pagination.pageSize, searchText, selectedPartType)} />
          <Popconfirm
            title="Sync New CNs from Factory"
            description="Inserts CNs not yet in spec_process (up to 500 CNs)"
            onConfirm={runSyncNew}
            okText="Sync now"
            cancelText="Cancel"
          >
            <Button icon={<DatabaseOutlined />} loading={syncNewLoading}>Sync New CNs</Button>
          </Popconfirm>
          <Button icon={<PlusOutlined />} type="primary" onClick={openAdd}>Add Spec</Button>
        </Space>
      </div>
      <Title level={5} style={{ marginBottom: 8 }}><SearchOutlined /> Item Counts</Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="none">
            <Text type="secondary" style={{ fontSize: 12 }}>Total</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary, lineHeight: 1.2 }}>
              {specCounts.total.toLocaleString()}
            </div>
          </Col>
          <Col flex="none"><Divider type="vertical" style={{ height: 48 }} /></Col>
          <Col flex="auto">
            <Space wrap>
              <Button
                size="small"
                type={selectedPartType === null ? 'primary' : 'default'}
                onClick={() => { setSelectedPartType(null); setData([]); setTotal(0); }}
              >
                All
              </Button>
              {Object.entries(PART_TYPE_COLOR).map(([pt, color]) => (
                <Button
                  key={pt}
                  size="small"
                  type={selectedPartType === pt ? 'primary' : 'default'}
                  style={selectedPartType === pt
                    ? { background: color, borderColor: color }
                    : { borderColor: color, color }}
                  onClick={() => handlePartTypeSelect(pt)}
                >
                  {pt}{' '}
                  <span style={{ fontSize: 11, opacity: 0.85 }}>({(specCounts.counts?.[pt] || 0).toLocaleString()})</span>
                </Button>
              ))}
            </Space>
          </Col>
          {selectedPartType && (
            <>
              <Col flex="none"><Divider type="vertical" style={{ height: 48 }} /></Col>
              <Col flex="none" style={{ textAlign: 'center', minWidth: 80 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{selectedPartType}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: PART_TYPE_COLOR[selectedPartType], lineHeight: 1.2 }}>
                  {(specCounts.counts?.[selectedPartType] || 0).toLocaleString()}
                </div>
              </Col>
            </>
          )}
        </Row>
      </Card>
      <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 8, overflow: 'hidden' }}>
        <Table
          dataSource={data.map(r => ({ ...r, key: r.cn }))}
          columns={columns}
          loading={loading}
          size="small"
          bordered
          scroll={{ x: 3200, y: 'calc(100vh - 250px)' }}
          pagination={{
            ...pagination,
            total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`
          }}
          onChange={handleTableChange}
        />
      </Card>

          {/* ── Sync New CNs — Result Modal ──────────────────────────────── */}
          <Modal
            title="Sync New CNs — Result"
            open={!!syncNewResult}
            onCancel={() => setSyncNewResult(null)}
            footer={<Button type="primary" onClick={() => setSyncNewResult(null)}>Close</Button>}
            width={560}
            destroyOnHidden
          >
            {syncNewResult && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  type={syncNewResult.failed === 0 ? 'success' : 'warning'}
                  showIcon
                  message={`Success ${syncNewResult.synced} / Failed ${syncNewResult.failed} of ${syncNewResult.total_found} new CNs`}
                />
                {syncNewResult.table_status?.length > 0 && (
                  <Card size="small" title="Factory Table Status">
                    <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {syncNewResult.table_status.map((t, i) => (
                        <div key={i}>
                          <Text type={t.ok ? 'success' : 'danger'}>
                            {t.ok ? '✓' : '✗'} {t.table}
                          </Text>
                          {t.ok ? ` (${t.count} rows)` : `: ${t.error}`}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
                {syncNewResult.errors?.length > 0 && (
                  <Card size="small" title="Insert Errors">
                    <div style={{ maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
                      {syncNewResult.errors.map((e, i) => (
                        <div key={i}><Text type="danger">{e.cn}</Text>: {e.error}</div>
                      ))}
                    </div>
                  </Card>
                )}
              </Space>
            )}
          </Modal>

          <Modal
            title={editingRecord ? 'Edit Specification' : 'Add New Specification'}
            open={isFormOpen}
            onOk={handleSave}
            onCancel={() => setIsFormOpen(false)}
            okText="Save"
            confirmLoading={saving}
            width={isBodyCn(watchedCn || editingRecord?.cn) ? 1000 : 800}
            destroyOnHidden
          >
            <Form form={form} layout="vertical" size="small">
              {/* ── CN + Part Type indicator ── */}
              <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
                <Col span={6}>
                  <Form.Item name="cn" label="C/N Number" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                    <Input disabled={!!editingRecord} placeholder="e.g. 314047" />
                  </Form.Item>
                </Col>
                <Col span={6} style={{ paddingTop: 24 }}>
                  {getPartType(watchedCn || editingRecord?.cn)
                    ? <Tag color={PART_TYPE_COLOR[getPartType(watchedCn || editingRecord?.cn)]}>
                        {getPartType(watchedCn || editingRecord?.cn)}
                      </Tag>
                    : <Tag color="default">—</Tag>
                  }
                </Col>
              </Row>

              {/* ── BALL (C3x) ── OD/ID/W + Type + YBall + SD + Process ── */}
              {(getPartType(watchedCn || editingRecord?.cn) === 'BALL' || !getPartType(watchedCn || editingRecord?.cn)) && (
                <>
                  <Row gutter={12}>
                    <Col span={6}>
                      <Form.Item name="type" label="Type">
                        <Select allowClear placeholder="Type">
                          <Select.Option value="NORMAL">NORMAL</Select.Option>
                          <Select.Option value="ABR">ABR</Select.Option>
                          <Select.Option value="OTHER">OTHER</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="process" label="Process">
                        <Select allowClear placeholder="Process">
                          <Select.Option value="OD->ID">OD→ID</Select.Option>
                          <Select.Option value="ID->OD">ID→OD</Select.Option>
                          <Select.Option value="OD Only">OD Only</Select.Option>
                          <Select.Option value="ID Only">ID Only</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="yball" label="Y-Ball" initialValue="N">
                        <Select>
                          <Select.Option value="N">N</Select.Option>
                          <Select.Option value="Y">Y</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        name="sd"
                        label={
                          <Space size={4}>
                            SD (Shoulder Dia.)
                            <Button
                              size="small"
                              type="link"
                              icon={<ReloadOutlined style={{ fontSize: 10 }} />}
                              onClick={handleCalculateSd}
                              style={{ height: 'auto', padding: 0 }}
                            >
                              Calc
                            </Button>
                          </Space>
                        }
                        rules={[
                          {
                            required: watchedType === 'ABR' || watchedYball === 'Y',
                            message: 'SD is required for ABR/Y-Ball parts',
                          },
                        ]}
                      >
                        <InputNumber style={{ width: '100%' }} precision={4} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="groove_y" label="Groove Y (ABR)" tooltip="Ball-insert groove width. Used by CPX SHOE V for ABR parts only.">
                        <InputNumber style={{ width: '100%' }} precision={4} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <DimCard label="Before Process (Bf)" prefix="bf" />
                  <DimCard label="After Process (Aft)" prefix="aft" />
                </>
              )}

              {/* ── RACE (C2x) ── OD/ID/W + Process + SD ── */}
              {getPartType(watchedCn || editingRecord?.cn) === 'RACE' && (
                <>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="process" label="Process">
                        <Select allowClear placeholder="Process">
                          <Select.Option value="OD->ID">OD→ID</Select.Option>
                          <Select.Option value="ID->OD">ID→OD</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="sd"
                        label={
                          <Space size={4}>
                            SD (Shoulder Dia.)
                            <Button
                              size="small"
                              type="link"
                              icon={<ReloadOutlined style={{ fontSize: 10 }} />}
                              onClick={handleCalculateSd}
                              style={{ height: 'auto', padding: 0 }}
                            >
                              Calc
                            </Button>
                          </Space>
                        }
                        rules={[
                          {
                            required: watchedType === 'ABR' || watchedYball === 'Y',
                            message: 'SD is required for ABR/Y-Ball parts',
                          },
                        ]}
                      >
                        <InputNumber style={{ width: '100%' }} precision={4} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <DimCard label="Before Process (Bf)" prefix="bf" />
                  <DimCard label="After Process (Aft)" prefix="aft" />
                </>
              )}

              {/* ── SPHERICAL (A4x) ── OD/ID/W + Process + SD (dims from eng_sph + eng_sph_design) ── */}
              {getPartType(watchedCn || editingRecord?.cn) === 'SPHERICAL' && (
                <>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="process" label="Process">
                        <Select allowClear placeholder="Process">
                          <Select.Option value="OD->ID">OD→ID</Select.Option>
                          <Select.Option value="ID->OD">ID→OD</Select.Option>
                          <Select.Option value="OD Only">OD Only</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="sd"
                        label={
                          <Space size={4}>
                            SD (Shoulder Dia.)
                            <Button
                              size="small"
                              type="link"
                              icon={<ReloadOutlined style={{ fontSize: 10 }} />}
                              onClick={handleCalculateSd}
                              style={{ height: 'auto', padding: 0 }}
                            >
                              Calc
                            </Button>
                          </Space>
                        }
                      >
                        <InputNumber style={{ width: '100%' }} precision={4} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <DimCard label="Before Process (Bf)" prefix="bf" />
                  <DimCard label="After Process (Aft)" prefix="aft" />
                </>
              )}

              {/* ── MECHA (C95/C99) ── manual entry (no factory dim table): Process + SD + OD/ID/W ── */}
              {getPartType(watchedCn || editingRecord?.cn) === 'MECHA' && (
                <>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="process" label="Process">
                        <Select allowClear placeholder="Process">
                          <Select.Option value="OD->ID">OD→ID</Select.Option>
                          <Select.Option value="ID->OD">ID→OD</Select.Option>
                          <Select.Option value="OD Only">OD Only</Select.Option>
                          <Select.Option value="ID Only">ID Only</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="sd"
                        label={
                          <Space size={4}>
                            SD (Shoulder Dia.)
                            <Button
                              size="small"
                              type="link"
                              icon={<ReloadOutlined style={{ fontSize: 10 }} />}
                              onClick={handleCalculateSd}
                              style={{ height: 'auto', padding: 0 }}
                            >
                              Calc
                            </Button>
                          </Space>
                        }
                      >
                        <InputNumber style={{ width: '100%' }} precision={4} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <DimCard label="Before Process (Bf)" prefix="bf" />
                  <DimCard label="After Process (Aft)" prefix="aft" />
                </>
              )}

              {/* ── SLEEVE (C6x) ── OD/ID/W + Process ── */}
              {getPartType(watchedCn || editingRecord?.cn) === 'SLEEVE' && (
                <>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="process" label="Process">
                        <Select allowClear placeholder="Process">
                          <Select.Option value="OD->ID">OD→ID</Select.Option>
                          <Select.Option value="ID->OD">ID→OD</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="sd"
                        label={
                          <Space size={4}>
                            SD (Shoulder Dia.)
                            <Button
                              size="small"
                              type="link"
                              icon={<ReloadOutlined style={{ fontSize: 10 }} />}
                              onClick={handleCalculateSd}
                              style={{ height: 'auto', padding: 0 }}
                            >
                              Calc
                            </Button>
                          </Space>
                        }
                        rules={[
                          {
                            required: watchedType === 'ABR' || watchedYball === 'Y',
                            message: 'SD is required for ABR/Y-Ball parts',
                          },
                        ]}
                      >
                        <InputNumber style={{ width: '100%' }} precision={4} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <DimCard label="Before Process (Bf)" prefix="bf" />
                  <DimCard label="After Process (Aft)" prefix="aft" />
                </>
              )}

              {/* ── BODY (C1x / C5x) ── Body-specific fields only ── */}
              {getPartType(watchedCn || editingRecord?.cn) === 'BODY' && (
                <>
                  <Row gutter={12} style={{ marginBottom: 8 }}>
                    <Col span={8}>
                      <Form.Item name="process" label="Process">
                        <Select allowClear placeholder="Process">
                          <Select.Option value="OD->ID">OD→ID</Select.Option>
                          <Select.Option value="ID->OD">ID→OD</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Card title="Body Dimensions" size="small" style={{ marginBottom: 12 }}>
                    <Row gutter={8}>
                      <Col span={6}><Form.Item name="final_id" label="Final ID"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={6}><Form.Item name="head_width" label="Head Width"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={6}><Form.Item name="thread_length" label="Thread Length"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={3}><Form.Item name="shape_code" label="Shape"><Input /></Form.Item></Col>
                      <Col span={3}><Form.Item name="nipple" label="Nipple"><Input /></Form.Item></Col>
                      <Col span={3}><Form.Item name="key_groove" label="Key Groove"><Input /></Form.Item></Col>
                    </Row>
                  </Card>
                  <Card title="Body Blank" size="small" style={{ marginBottom: 12 }}>
                    <Row gutter={8}>
                      {[
                        ['blank_head','Head'],['blank_f_dim','F Dim'],
                        ['blank_r2','R2'],['blank_r3','R3'],
                        ['female_shankdia','Shank Dia'],['female_shank','Shank'],
                        ['female_id_dim','ID Dim'],['female_flange_d','Flange D'],
                        ['female_flange_h','Flange H'],
                      ].map(([name, label]) => (
                        <Col span={6} key={name}>
                          <Form.Item name={name} label={label}>
                            <InputNumber style={{ width: '100%' }} precision={4} />
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                  <Card title="Body Thread" size="small" style={{ marginBottom: 12 }}>
                    <Row gutter={8}>
                      <Col span={8}><Form.Item name="thread_name" label="Thread Name"><Input placeholder="e.g. M12*1.25" /></Form.Item></Col>
                      <Col span={5}><Form.Item name="thread_max_od" label="OD Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={5}><Form.Item name="thread_min_od" label="OD Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={6}><Form.Item name="pre_thread" label="Pre-Thread"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Card>
                </>
              )}
            </Form>
          </Modal>
    </div>
  );

  if (embedded) return content;

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"4"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={colors.primary} />
        <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          {content}
        </Content>
      </Layout>
    </Layout>
  );
};

export default SpecProcessManager;
