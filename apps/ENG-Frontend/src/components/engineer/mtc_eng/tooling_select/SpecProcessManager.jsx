import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Space, Button, Form, Input, Modal, App, Table,
  InputNumber, Row, Col, Tag, Popconfirm, Card, Layout, Select,
  Alert, Spin,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined,
  SearchOutlined, ReloadOutlined, ArrowLeftOutlined, DownOutlined, UpOutlined,
  SyncOutlined,
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

export const SpecProcessManager = () => {
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
  const [tableVisible, setTableVisible] = useState(false);
  const [form] = Form.useForm();

  const [syncNewLoading, setSyncNewLoading] = useState(false);
  const [syncNewResult, setSyncNewResult] = useState(null);  // { synced, failed, errors[] }

  const colors = theme?.colors || {};

  const fetchSpecs = useCallback(async (page = 1, pageSize = 20, q = '') => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_TOOLING_SPEC, {
        params: { q, page, limit: pageSize }
      });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      message.error('Failed to load specifications');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (tableVisible) fetchSpecs(pagination.current, pagination.pageSize, searchText);
  }, [fetchSpecs, tableVisible, pagination.current, pagination.pageSize]);

  const handleTableChange = (pag) => {
    setPagination(pag);
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchSpecs(1, pagination.pageSize, searchText);
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
      fetchSpecs(pagination.current, pagination.pageSize, searchText);
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
      fetchSpecs(pagination.current, pagination.pageSize, searchText);
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
      if (res.data.synced > 0) fetchSpecs(1, pagination.pageSize, searchText);
    } catch (err) {
      message.error(err.response?.data?.error || 'Sync ล้มเหลว');
    } finally {
      setSyncNewLoading(false);
    }
  };

  const columns = [
    { title: 'C/N', dataIndex: 'cn', key: 'cn', width: 120, fixed: 'left', render: v => <Text strong>{v}</Text> },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 100 },
    { title: 'Process', dataIndex: 'process', key: 'process', width: 100, render: v => (v || '').replace('→', '->').replace('???', '->') },
    { 
      title: 'Dimensions (Bf)', 
      children: [
        { title: 'OD', dataIndex: 'od_bf', key: 'od_bf', width: 70 },
        { title: 'ID', dataIndex: 'id_bf', key: 'id_bf', width: 70 },
        { title: 'W', dataIndex: 'w_bf', key: 'w_bf', width: 70 },
      ]
    },
    { 
      title: 'Dimensions (Aft)', 
      children: [
        { title: 'OD', dataIndex: 'od_aft', key: 'od_aft', width: 70 },
        { title: 'ID', dataIndex: 'id_aft', key: 'id_aft', width: 70 },
        { title: 'W', dataIndex: 'w_aft', key: 'w_aft', width: 70 },
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

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"4"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={colors.primary} />
        <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space size={16}>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate(MTC_PATHS.TOOLING_SELECT)}
              />
              <Title level={4} style={{ margin: 0, color: colors.primary }}>
                Part Specification Management (spec_process)
              </Title>
            </Space>
            <Space>
              <Input 
                placeholder="Search CN, Type, Process..." 
                value={searchText} 
                onChange={e => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                allowClear
              />
              <Button
                icon={tableVisible ? <UpOutlined /> : <DownOutlined />}
                onClick={() => setTableVisible(v => !v)}
              >
                {tableVisible ? 'Hide Table' : 'Show Table'}
              </Button>
              {tableVisible && (
                <Button icon={<ReloadOutlined />} onClick={() => fetchSpecs(pagination.current, pagination.pageSize, searchText)} />
              )}
              <Popconfirm
                title="Sync New CNs จาก Factory"
                description="จะ insert CN ที่ยังไม่มีใน spec_process (สูงสุด 500 CN)"
                onConfirm={runSyncNew}
                okText="Sync เลย"
                cancelText="Cancel"
              >
                <Button icon={<DatabaseOutlined />} loading={syncNewLoading}>Sync New CNs</Button>
              </Popconfirm>
              <Button icon={<PlusOutlined />} type="primary" onClick={openAdd}>Add Spec</Button>
            </Space>
          </div>

          {tableVisible && <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 8, overflow: 'hidden' }}>
            <Table
              dataSource={data.map(r => ({ ...r, key: r.cn }))}
              columns={columns}
              loading={loading}
              size="small"
              bordered
              scroll={{ x: 1200, y: 'calc(100vh - 250px)' }}
              pagination={{
                ...pagination,
                total,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} items`
              }}
              onChange={handleTableChange}
            />
          </Card>}

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
                  message={`สำเร็จ ${syncNewResult.synced} / ล้มเหลว ${syncNewResult.failed} จากทั้งหมด ${syncNewResult.total_found} CN ใหม่`}
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
            width={800}
            destroyOnHidden
          >
            <Form form={form} layout="vertical" size="small">
              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="cn" label="C/N Number" rules={[{ required: true }]}>
                    <Input disabled={!!editingRecord} placeholder="e.g. 1001-A" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="type" label="Type">
                    <Select allowClear placeholder="เลือก Type">
                      <Select.Option value="NORMAL">NORMAL</Select.Option>
                      <Select.Option value="ABR">ABR</Select.Option>
                      <Select.Option value="OTHER">OTHER</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="process" label="Process">
                    <Select allowClear placeholder="เลือก Process">
                      <Select.Option value="OD->ID">OD→ID</Select.Option>
                      <Select.Option value="ID->OD">ID→OD</Select.Option>
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
              </Row>

              <Card title="Before Process (Bf)" size="small" style={{ marginBottom: 12 }}>
                <Row gutter={8}>
                  <Col span={8}>
                    <Form.Item name="od_bf" label="OD Bf">
                      <InputNumber style={{ width: '100%' }} precision={4} />
                    </Form.Item>
                    <Row gutter={4}>
                      <Col span={12}><Form.Item name="od_bf_max" label="OD Bf Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="od_bf_min" label="OD Bf Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="id_bf" label="ID Bf">
                      <InputNumber style={{ width: '100%' }} precision={4} />
                    </Form.Item>
                    <Row gutter={4}>
                      <Col span={12}><Form.Item name="id_bf_max" label="ID Bf Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="id_bf_min" label="ID Bf Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="w_bf" label="W Bf">
                      <InputNumber style={{ width: '100%' }} precision={4} />
                    </Form.Item>
                    <Row gutter={4}>
                      <Col span={12}><Form.Item name="w_bf_max" label="W Bf Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="w_bf_min" label="W Bf Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Col>
                </Row>
              </Card>

              <Card title="After Process (Aft)" size="small" style={{ marginBottom: 12 }}>
                <Row gutter={8}>
                  <Col span={8}>
                    <Form.Item name="od_aft" label="OD Aft">
                      <InputNumber style={{ width: '100%' }} precision={4} />
                    </Form.Item>
                    <Row gutter={4}>
                      <Col span={12}><Form.Item name="od_aft_max" label="OD Aft Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="od_aft_min" label="OD Aft Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="id_aft" label="ID Aft">
                      <InputNumber style={{ width: '100%' }} precision={4} />
                    </Form.Item>
                    <Row gutter={4}>
                      <Col span={12}><Form.Item name="id_aft_max" label="ID Aft Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="id_aft_min" label="ID Aft Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="w_aft" label="W Aft">
                      <InputNumber style={{ width: '100%' }} precision={4} />
                    </Form.Item>
                    <Row gutter={4}>
                      <Col span={12}><Form.Item name="w_aft_max" label="W Aft Max"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                      <Col span={12}><Form.Item name="w_aft_min" label="W Aft Min"><InputNumber style={{ width: '100%' }} precision={4} /></Form.Item></Col>
                    </Row>
                  </Col>
                </Row>
              </Card>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="sd" label="SD (Before)">
                    <InputNumber style={{ width: '100%' }} precision={4} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sd_aft" label="SD (After)">
                    <InputNumber style={{ width: '100%' }} precision={4} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SpecProcessManager;

