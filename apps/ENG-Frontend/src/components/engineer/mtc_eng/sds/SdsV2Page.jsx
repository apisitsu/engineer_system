import React, { useState } from 'react';
import {
  Input, Button, Typography, Card, Row, Col,
  Table, Tag, Spin, Layout, App, Descriptions,
  Modal, Select,
} from 'antd';
import { SearchOutlined, FilePdfOutlined } from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';

const { Content } = Layout;
const { Title, Text } = Typography;

const PART_TYPE_COLOR = {
  BALL: 'blue',
  RACE: 'green',
  BODY: 'orange',
  SLEEVE: 'purple',
  SPHERICAL: 'red',
};

const toolCols = [
  { title: 'Rev', dataIndex: 'rev', width: 60 },
  { title: 'Tool DWG No', dataIndex: 'tool_dwg_no', width: 150 },
  { title: 'Tool Name', dataIndex: 'tool_name' },
];

const SdsV2Page = () => {
  const { message } = App.useApp();
  const { theme } = useTheme();
  const [cn, setCn] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // PDF modal state
  const [pdfModal, setPdfModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [filteredMachineTypes, setFilteredMachineTypes] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const handleSearch = async () => {
    if (!cn.trim()) return;
    setLoading(true);
    setData(null);
    try {
      const [searchRes, mtRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_SEARCH, { params: { cn: cn.trim() } }),
        allMachineTypes.length ? Promise.resolve(null) : axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES),
      ]);
      setData(searchRes.data);
      if (mtRes) setAllMachineTypes(mtRes.data.filter(m => m.is_active));
    } catch (err) {
      message.error(err.response?.data?.error || 'Can not find');
    } finally {
      setLoading(false);
    }
  };

  const openPdfModal = (processRow) => {
    setSelectedProcess(processRow);
    setSelectedMachine(null);
    // Extract machine_type_codes from tools of this process (tool_dwg_no[1..3])
    const toolsForProcess = (data?.process_plan || []).filter(t => t.process_code === processRow.process_code);
    const codes = [...new Set(toolsForProcess.map(t => t.tool_dwg_no?.substring(1, 4)).filter(Boolean))];
    const filtered = allMachineTypes.filter(m => codes.includes(m.machine_type_code));
    const list = filtered.length ? filtered : allMachineTypes;
    setFilteredMachineTypes(list);
    if (list.length === 1) setSelectedMachine(list[0].machine_type_name);
    setPdfModal(true);
  };

  const handleGeneratePdf = async () => {
    if (!selectedMachine) { message.warning('Please select machine type'); return; }
    setPdfLoading(true);
    try {
      const params = {
        cn: data.cn,
        machine_type_name: selectedMachine,
        process_code: selectedProcess?.process_code || '',
        _t: Date.now(),
        token: localStorage.getItem('token') || '',
      };
      
      // Construct the get URL natively so Chrome opens it as a standard PDF tab.
      // This completely avoids Blob URL 'cross-partition' blocks.
      const queryParams = new URLSearchParams(params).toString();
      const fullUrl = `${server.MTC_SDS_V2_PDF}?${queryParams}`;

      const a = document.createElement('a');
      a.href = fullUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPdfModal(false);
    } catch (err) {
      message.error(err.message || 'Failed to open PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const renderDimension = () => {
    if (!data?.dimension) return <Text type="secondary">No Dimension Data</Text>;
    const entries = Object.entries(data.dimension).filter(([k]) => k !== 'control_no' && k !== 'update_date');
    return (
      <Descriptions size="small" bordered column={4}>
        {entries.map(([key, val]) => (
          <Descriptions.Item key={key} label={key}>{val || '-'}</Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  const processInfoCols = [
    { title: 'Seq', dataIndex: 'process_seqno', width: 60, align: 'center' },
    { title: 'Rev', dataIndex: 'rev', width: 60 },
    { title: 'Process Code', dataIndex: 'process_code', width: 120 },
    { title: 'Process', dataIndex: 'process_eng' },
    { title: 'WC', dataIndex: 'wc', width: 80 },
    { title: 'CT', dataIndex: 'ct', width: 80 },
    { title: 'ST', dataIndex: 'st', width: 80 },
    { title: 'Batch', dataIndex: 'batch_size', width: 80 },
    {
      title: 'PDF',
      key: 'pdf',
      width: 70,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={() => openPdfModal(row)}
        />
      ),
    },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ padding: 24, overflowY: 'auto' }}>
          <Spin spinning={loading}>
            <Title level={4} style={{ color: theme.colors.text, marginBottom: 16 }}>
              SDS v2 — Test
            </Title>

            <Card style={{ marginBottom: 16, background: theme.colors.cardBackground }}>
              <Row gutter={12} align="middle">
                <Col>
                  <Input
                    placeholder="C/N Number"
                    value={cn}
                    onChange={e => setCn(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ width: 600 }}
                    allowClear
                  />
                </Col>
                <Col>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                    Search
                  </Button>
                </Col>
              </Row>
            </Card>

            {data && (
              <>
                {/* Header Info */}
                <Card
                  style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                  title={
                    <Row align="middle" gutter={12}>
                      <Col><Text strong style={{ color: theme.colors.text }}>{data.cn}</Text></Col>
                      <Col>
                        <Tag color={PART_TYPE_COLOR[data.part_type] || 'default'}>
                          {data.part_type}
                        </Tag>
                      </Col>
                      {data.part_info && (
                        <Col>
                          <Text type="secondary">
                            {data.part_info.class1_name} — {data.part_info.sub_class_name}
                          </Text>
                        </Col>
                      )}
                    </Row>
                  }
                >
                  <Descriptions size="small" bordered column={4}>
                    <Descriptions.Item label="PN">{data.parts_no || '-'}</Descriptions.Item>
                    <Descriptions.Item label="DWG Rev">{data.dwg_rev || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Material">{data.material?.material || '-'}</Descriptions.Item>
                    {data.production && <>
                      <Descriptions.Item label="Model">{data.production.model || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Customer">{data.production.customer || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Type">{data.production.type || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Approval Type">{data.production.approval_type || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Cust DWG No">{data.production.cust_dwg_no || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Cust DWG Rev">{data.production.cust_dwg_no_rev || '-'}</Descriptions.Item>
                      <Descriptions.Item label="SWG No">{data.production.sdwg_no || '-'}</Descriptions.Item>
                      <Descriptions.Item label="SWG Rev">{data.production.sdwg_no_rev || '-'}</Descriptions.Item>
                    </>}
                  </Descriptions>
                </Card>

                {/* Dimension */}
                <Card
                  title={<Text strong style={{ color: theme.colors.text }}>Dimension ({data.part_type})</Text>}
                  style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                >
                  {renderDimension()}
                </Card>

                {/* Process Plan */}
                <Card
                  title={<Text strong style={{ color: theme.colors.text }}>Process Plan</Text>}
                  style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                >
                  <Table
                    dataSource={data.process_info.map((r, i) => ({ ...r, key: i }))}
                    columns={processInfoCols}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                  />
                </Card>

                {/* Tooling */}
                <Card
                  title={<Text strong style={{ color: theme.colors.text }}>Tooling</Text>}
                  style={{ background: theme.colors.cardBackground }}
                >
                  {data.process_plan.length > 0 ? (() => {
                    const groups = data.process_plan.reduce((acc, r) => {
                      const key = r.process_code;
                      if (!acc[key]) acc[key] = { code: key, eng: r.process_eng, rows: [] };
                      acc[key].rows.push(r);
                      return acc;
                    }, {});
                    return Object.values(groups).map((g, gi) => (
                      <div key={g.code} style={{ marginBottom: gi < Object.values(groups).length - 1 ? 16 : 0 }}>
                        <Text strong style={{ color: theme.colors.text }}>
                          {g.code} — {g.eng}
                        </Text>
                        <Table
                          dataSource={g.rows.map((r, i) => ({ ...r, key: `${r.process_code}_${r.tool_dwg_no}_${i}` }))}
                          columns={toolCols}
                          pagination={false}
                          size="small"
                          style={{ marginTop: 8 }}
                          scroll={{ x: 'max-content' }}
                        />
                      </div>
                    ));
                  })() : (
                    <Text type="secondary">No Tooling Data</Text>
                  )}
                </Card>
              </>
            )}
          </Spin>
        </Content>
      </Layout>

      {/* PDF Generation Modal */}
      <Modal
        title={
          <span>
            <FilePdfOutlined style={{ marginRight: 8 }} />
            Generate SDS PDF — {selectedProcess?.process_code} ({selectedProcess?.process_eng})
          </span>
        }
        open={pdfModal}
        onCancel={() => setPdfModal(false)}
        onOk={handleGeneratePdf}
        okText="Generate PDF"
        okButtonProps={{ loading: pdfLoading, icon: <FilePdfOutlined /> }}
        destroyOnClose
      >
        <div style={{ marginBottom: 4 }}>
          <Text>Machine Type</Text>
          {filteredMachineTypes.length > 0 && filteredMachineTypes.length < allMachineTypes.length && (
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              (กรองจาก tool_dwg_no — {filteredMachineTypes.length} รายการ)
            </Text>
          )}
        </div>
        <Select
          showSearch
          placeholder="Select machine type"
          style={{ width: '100%' }}
          value={selectedMachine}
          onChange={setSelectedMachine}
          filterOption={(input, opt) =>
            opt.label.toLowerCase().includes(input.toLowerCase())
          }
          options={filteredMachineTypes.map(m => ({
            value: m.machine_type_name,
            label: `${m.machine_type_code} — ${m.machine_type_name || '(no name)'}`,
          }))}
        />
      </Modal>
    </Layout>
  );
};

export default SdsV2Page;
