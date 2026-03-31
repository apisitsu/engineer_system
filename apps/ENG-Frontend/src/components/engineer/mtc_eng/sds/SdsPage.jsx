import React, { useState, useEffect, useCallback } from 'react';
import {
  Input, Button, Table, Typography, Card, Row, Col,
  Statistic, Space, Spin, Layout, Modal, Form, Tag,
  Empty, Divider, Tooltip, message, Popconfirm
} from 'antd';
import {
  SearchOutlined,
  FilePdfOutlined,
  DashboardOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  AuditOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import ScrollbarStyle from '../../../common/scrollbar';

const { Content } = Layout;
const { Title, Text } = Typography;

const SdsPage = () => {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [counts, setCounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [countsLoading, setCountsLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  const [templateForm] = Form.useForm();
  const [mappingForm] = Form.useForm();

  const colors = theme?.colors || {};
  const shadows = theme?.shadows || {};

  const fetchCounts = useCallback(() => {
    setCountsLoading(true);
    axios.get(server.MTC_SDS_COUNTS)
      .then(res => {
        setCounts(res.data.counts || []);
        setTotal(res.data.total || 0);
      })
      .catch(err => message.error("Failed to fetch dashboard data"))
      .finally(() => setCountsLoading(false));
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await axios.post(server.MTC_SDS_SEARCH, { searchTerm: term });
      setResults(res.data.results || []);
    } catch (err) {
      message.error("Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openPdf = async (row) => {
    const hide = message.loading(`Generating PDF for ${row.cn}...`, 0);
    try {
      const res = await axios.get(server.MTC_SDS_PDF, {
        params: { cn: row.cn, process_code: row.process_code, machine: row.machine },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      hide();
    } catch (error) {
      hide();
      message.error("PDF Generation failed. Check backend logs.");
      console.error("PDF Error:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(server.MTC_SDS_TEMPLATES);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setTemplates([]);
    }
  };

  const fetchMappings = async (templateId) => {
    try {
      const res = await axios.get(`${server.MTC_SDS_MAPPING}/${templateId}`);
      setMappings(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setMappings([]);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    fetchMappings(template.id);
  };

  const handleAddTemplate = async (values) => {
    try {
      await axios.post(server.MTC_SDS_TEMPLATES, values);
      message.success("Template added");
      templateForm.resetFields();
      fetchTemplates();
    } catch (e) { message.error("Failed to add template"); }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await axios.delete(`${server.MTC_SDS_TEMPLATES}/${id}`);
      message.success("Template deleted");
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setMappings([]);
      }
      fetchTemplates();
    } catch (e) { message.error("Failed to delete template"); }
  };

  const handleAddMapping = async (values) => {
    if (!selectedTemplate) return;
    try {
      await axios.post(server.MTC_SDS_MAPPING, { ...values, template_id: selectedTemplate.id });
      message.success("Mapping added");
      mappingForm.resetFields();
      fetchMappings(selectedTemplate.id);
    } catch (e) { message.error("Failed to add mapping"); }
  };

  const handleDeleteMapping = async (id) => {
    try {
      await axios.delete(`${server.MTC_SDS_MAPPING}/${id}`);
      message.success("Mapping deleted");
      fetchMappings(selectedTemplate.id);
    } catch (e) { message.error("Failed to delete mapping"); }
  };

  const resultColumns = [
    { title: 'C/N', dataIndex: 'cn', key: 'cn', width: 140, render: (text) => <Text strong>{text}</Text> },
    { title: 'Part No', dataIndex: 'part_no', key: 'part_no' },
    { title: 'Process', dataIndex: 'process_name', key: 'process_name', render: (text, r) => <Space>{text} <Tag color="blue">{r.process_code}</Tag></Space> },
    { title: 'Machine', dataIndex: 'machine', key: 'machine', render: (text) => <Tag color="orange">{text}</Tag> },
    { title: 'Rev', dataIndex: 'setup_data_sheet_rev', key: 'rev', width: 70, align: 'center', render: (text, r) => <Tag color={r.isLatestRevision ? 'green' : 'default'}>{text}</Tag> },
    { title: 'Prepared', dataIndex: 'prepared_by', key: 'prepared_by', width: 100 },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, r) => (
        <Tooltip title="View PDF">
          <Button
            type="primary"
            shape="circle"
            icon={<FilePdfOutlined />}
            onClick={() => openPdf(r)}
            style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f' }}
          />
        </Tooltip>
      )
    }
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"5"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={colors.primary} />
        <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0, color: colors.primary }}>
              <DashboardOutlined /> Setup Data Sheet (SDS)
            </Title>
            <Button
              icon={<SettingOutlined />}
              onClick={() => { fetchTemplates(); setIsModalOpen(true); }}
            >
              Manage Templates
            </Button>
          </div>

          {/* Stats Dashboard */}
          {!searched && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} md={6}>
                <Card size="small" style={{ borderRadius: '8px', boxShadow: shadows.sm }}>
                  <Statistic
                    title="Total SDS Documents"
                    value={total}
                    prefix={<AuditOutlined />}
                    valueStyle={{ color: colors.primary }}
                    loading={countsLoading}
                  />
                </Card>
              </Col>
              {counts.slice(0, 3).map((item, idx) => (
                <Col xs={24} md={6} key={idx}>
                  <Card size="small" style={{ borderRadius: '8px', boxShadow: shadows.sm }}>
                    <Statistic
                      title={item.process_type}
                      value={item.count}
                      valueStyle={{ color: '#52c41a' }}
                      loading={countsLoading}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* Search Section */}
          <Card size="small" style={{ marginBottom: 16, borderRadius: '8px', boxShadow: shadows.sm }}>
            <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
              <Input
                placeholder="C/N Number"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                allowClear
              />
              <Button type="primary" onClick={handleSearch} loading={loading}>Search</Button>
              {searched && (
                <Button icon={<ReloadOutlined />} onClick={() => { setSearched(false); setSearchTerm(''); setResults([]); }} />
              )}
            </Space.Compact>
          </Card>

          <Spin spinning={loading}>
            {searched ? (
              <Card size="small" style={{ borderRadius: '8px', boxShadow: shadows.sm }}>
                <Table
                  dataSource={results}
                  columns={resultColumns}
                  rowKey={r => `${r.id}_${r.cn}_${r.process_code}`}
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ) : (
              !loading && (
                <div style={{ textAlign: 'center', marginTop: 60, opacity: 0.4 }}>
                  <FileExcelOutlined style={{ fontSize: 64, marginBottom: 16, display: 'block', margin: '0 auto' }} />
                  <Text>ป้อนคำค้นหาเพื่อเริ่มดึงข้อมูลเอกสาร Setup Data Sheet</Text>
                </div>
              )
            )}
          </Spin>

          {/* Template Management Modal */}
          <Modal
            title={<Space><SettingOutlined /> Manage SDS Templates & Mappings</Space>}
            open={isModalOpen}
            onCancel={() => setIsModalOpen(false)}
            width={1100}
            footer={null}
            bodyStyle={{ padding: '20px' }}
          >
            <Row gutter={24}>
              <Col span={10}>
                <Title level={5}>Excel Templates</Title>
                <Table
                  dataSource={templates}
                  size="small"
                  rowKey="id"
                  pagination={false}
                  scroll={{ y: 300 }}
                  rowClassName={(record) => selectedTemplate?.id === record.id ? 'ant-table-row-selected' : ''}
                  onRow={(record) => ({
                    onClick: () => handleSelectTemplate(record),
                    style: { cursor: 'pointer' }
                  })}
                  columns={[
                    { title: 'Template Name', dataIndex: 'template_name' },
                    { title: 'Excel File', dataIndex: 'excel_file_name', render: (v) => <Text type="secondary" style={{ fontSize: '11px' }}>{v}</Text> },
                    {
                      title: '',
                      key: 'action',
                      width: 50,
                      render: (_, r) => (
                        <Popconfirm title="Delete template?" onConfirm={(e) => { e.stopPropagation(); handleDeleteTemplate(r.id); }}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                        </Popconfirm>
                      )
                    }
                  ]}
                />
                <Divider style={{ margin: '12px 0' }} />
                <Form form={templateForm} layout="vertical" onFinish={handleAddTemplate}>
                  <Row gutter={8}>
                    <Col span={11}><Form.Item name="template_name" rules={[{ required: true }]}><Input placeholder="Name" size="small" /></Form.Item></Col>
                    <Col span={10}><Form.Item name="excel_file_name" rules={[{ required: true }]}><Input placeholder="File.xlsx" size="small" /></Form.Item></Col>
                    <Col span={3}><Button type="primary" htmlType="submit" icon={<PlusOutlined />} size="small" block /></Col>
                  </Row>
                </Form>
              </Col>

              <Col span={14}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    Mappings {selectedTemplate ? `for: ${selectedTemplate.template_name}` : ''}
                  </Title>
                </div>
                {selectedTemplate ? (
                  <>
                    <Table
                      dataSource={mappings}
                      size="small"
                      rowKey="id"
                      pagination={false}
                      scroll={{ y: 300 }}
                      columns={[
                        { title: 'Sheet', dataIndex: 'sheet_name', width: 100 },
                        { title: 'Cell', dataIndex: 'cell_address', width: 80 },
                        { title: 'Parameter Key', dataIndex: 'param_key' },
                        {
                          title: '',
                          key: 'action',
                          width: 50,
                          render: (_, r) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteMapping(r.id)} />
                        }
                      ]}
                    />
                    <Divider style={{ margin: '12px 0' }} />
                    <Form form={mappingForm} layout="inline" onFinish={handleAddMapping}>
                      <Form.Item name="sheet_name" style={{ width: 100 }}><Input placeholder="Sheet" size="small" /></Form.Item>
                      <Form.Item name="cell_address" style={{ width: 70 }}><Input placeholder="A1" size="small" /></Form.Item>
                      <Form.Item name="param_key" style={{ width: 150 }}><Input placeholder="Key" size="small" /></Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} size="small">Add</Button>
                    </Form>
                  </>
                ) : (
                  <Empty description="Select a template to manage mappings" style={{ marginTop: 40 }} />
                )}
              </Col>
            </Row>
          </Modal>

        </Content>
      </Layout>
      <style>{`
        .ant-table-row-selected td {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </Layout>
  );
}

export default SdsPage;
