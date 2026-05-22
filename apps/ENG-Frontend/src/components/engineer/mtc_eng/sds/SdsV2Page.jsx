import React, { useState, useMemo } from 'react';
import {
  Input, Button, Typography, Card, Row, Col,
  Table, Tag, Spin, Layout, App, Descriptions,
  Modal, Select, Space,
} from 'antd';
import { SearchOutlined, FilePdfOutlined, SettingOutlined, WarningOutlined } from '@ant-design/icons';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { useNavigate } from 'react-router-dom';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { useAuthStore } from '../../../../stores/authStore';
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

const getMatchNo = (match) => {
  if (!match) return null;
  const raw = match.tooling_no ?? match.No ?? match.no ?? match.part_no ?? null;
  return raw != null ? String(raw).trim() : null;
};

// Extract "xxxx-xx" prefix (first two dash-segments) e.g. "4556-01-0058" → "4556-01"
const dwgPrefix = (no) => {
  if (!no) return null;
  const p = no.split('-');
  return p.length >= 2 ? `${p[0]}-${p[1]}` : no;
};

const SdsV2Page = () => {
  const { message } = App.useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const userRole = useAuthStore(state => state.userRole);
  const userDepartment = useAuthStore(state => state.userDepartment);
  const isAdmin = userRole === 'AD' || userDepartment === 'AD';
  const [cn, setCn] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [tsData, setTsData] = useState(null);

  // PDF modal state
  const [pdfModal, setPdfModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [machineToolsConfig, setMachineToolsConfig] = useState([]);
  const [filteredMachineTypes, setFilteredMachineTypes] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const handleSearch = async () => {
    if (!cn.trim()) return;
    const cnVal = cn.trim();
    setLoading(true);
    setData(null);
    setTsData(null);
    try {
      const [searchRes, mtRes, tsRes, mtConfigRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_SEARCH, { params: { cn: cnVal } }),
        allMachineTypes.length ? Promise.resolve(null) : axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES),
        axios.post(server.TSV2_SEARCH, { cn: cnVal }).catch(() => null),
        axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TOOLS).catch(() => null),
      ]);
      setData(searchRes.data);
      if (mtRes) setAllMachineTypes(mtRes.data.filter(m => m.is_active && m.machine_type_name));
      if (tsRes?.data?.success) setTsData(tsRes.data);
      if (mtConfigRes?.data) setMachineToolsConfig(Array.isArray(mtConfigRes.data) ? mtConfigRes.data : []);
    } catch (err) {
      message.error(err.response?.data?.error || 'Can not find');
    } finally {
      setLoading(false);
    }
  };

  const openPdfModal = (processRow) => {
    setSelectedProcess(processRow);
    setSelectedMachine(null);
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
          <Descriptions.Item key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>{val || '-'}</Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  const toolingByCode = useMemo(() => {
    if (!data) return {};
    return data.process_plan.reduce((acc, r) => {
      if (!acc[r.process_code]) acc[r.process_code] = [];
      acc[r.process_code].push(r);
      return acc;
    }, {});
  }, [data]);

  const processInfoCols = [
    { title: 'Seq', dataIndex: 'process_seqno', width: 60, align: 'center' },
    { title: 'Rev', dataIndex: 'rev', width: 60 },
    { title: 'Process Code', dataIndex: 'process_code', width: 120 },
    { title: 'Process', dataIndex: 'process_eng' },
    { title: 'WC', dataIndex: 'wc', width: 80 },
    { title: 'CT', dataIndex: 'ct', width: 80 },
    { title: 'ST', dataIndex: 'st', width: 80 },
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

  const buildExpandedContent = (processRow) => {
    const processTools = toolingByCode[processRow.process_code] || [];
    const sdsNosSet = new Set(processTools.map(t => t.tool_dwg_no?.trim()).filter(Boolean));
    const processToolPrefixes = new Set(processTools.map(t => t.tool_dwg_no?.trim()?.substring(1, 4)).filter(Boolean));
    const processMachineNames = new Set(
      allMachineTypes.filter(m => processToolPrefixes.has(m.machine_type_code)).map(m => m.machine_type_name)
    );

    // prefix → full DWG no map for SDS tools (first match wins)
    const sdsPrefixToNo = {};
    sdsNosSet.forEach(no => {
      const p = dwgPrefix(no);
      if (p && !sdsPrefixToNo[p]) sdsPrefixToNo[p] = no;
    });

    const matchMap = {};
    const extraRows = [];

    if (tsData?.results) {
      for (const result of tsData.results) {
        if (!result.matches?.length) continue;
        const isRelevant = processMachineNames.has(result.machine) ||
          result.matches.some(m => {
            const no = getMatchNo(m);
            return no && processToolPrefixes.has(no.substring(1, 4));
          });
        if (!isRelevant) continue;

        let assignedNo = null;
        for (const match of result.matches) {
          const no = getMatchNo(match);
          if (!no) continue;
          // 1) exact match
          if (sdsNosSet.has(no)) { assignedNo = no; break; }
          // 2) prefix fallback: "4556-01-0048-01" → "4556-01" → "4556-01-0058"
          const p = dwgPrefix(no);
          if (p && sdsPrefixToNo[p]) { assignedNo = sdsPrefixToNo[p]; break; }
        }
        const m1 = getMatchNo(result.matches[0]);
        const m2 = getMatchNo(result.matches[1]);

        if (assignedNo && !matchMap[assignedNo]) {
          matchMap[assignedNo] = { m1, m2 };
        } else if (!assignedNo && m1) {
          extraRows.push({
            key: `ts_extra_${result.machine}_${result.tooling}`,
            tool_dwg_no: null,
            tool_name: `${result.machine} · ${result.tooling}`,
            rev: null,
            _tsM1: m1,
            _tsM2: m2,
            _isExtra: true,
          });
        }
      }
    }

    const dataSource = [
      ...processTools.map((t, i) => ({ ...t, key: `${t.process_code}_${t.tool_dwg_no}_${i}` })),
      ...extraRows,
    ];

    const columns = [
      { title: 'Rev', dataIndex: 'rev', width: 60 },
      { title: 'Tool DWG No', dataIndex: 'tool_dwg_no', width: 150 },
      {
        title: 'Tool Name',
        dataIndex: 'tool_name',
        render: (v, r) => r._isExtra
          ? <Text type="secondary" style={{ fontStyle: 'italic' }}>{v}</Text>
          : v,
      },
      ...(tsData ? [
        {
          title: 'T-Select #1',
          key: 'ts1',
          width: 150,
          align: 'center',
          render: (_, r) => {
            const key = r.tool_dwg_no?.trim();
            const m = r._isExtra ? r._tsM1 : matchMap[key]?.m1;
            if (!m) return <span style={{ color: '#bbb' }}>-</span>;
            const isSame = !r._isExtra && m === key;
            return <Tag color={isSame ? 'default' : 'blue'}>{m}</Tag>;
          },
        },
        {
          title: 'T-Select #2',
          key: 'ts2',
          width: 150,
          align: 'center',
          render: (_, r) => {
            const key = r.tool_dwg_no?.trim();
            const m = r._isExtra ? r._tsM2 : matchMap[key]?.m2;
            return m ? <Tag color="geekblue">{m}</Tag> : <span style={{ color: '#bbb' }}>-</span>;
          },
        },
      ] : []),
    ];

    // Validate Tool DWG Nos against Machine Tool Config
    const configForProcess = machineToolsConfig.filter(
      c => String(c.process_code) === String(processRow.process_code)
    );

    const sdsPrefixSet = new Set([...sdsNosSet].map(dwgPrefix).filter(Boolean));

    // Compare SDS process plan tools against sds_machine_tool config (per machine type)
    // machineStatus: { [machine]: missingCount }  — 0 = complete, >0 = missing
    const machineStatus = {};
    if (configForProcess.length > 0) {
      const grouped = {};
      configForProcess.forEach(c => {
        const machine = c.machine_type?.trim();
        const dwgNo = c.tool_drawing_no?.trim();
        if (!machine || !dwgNo) return;
        if (!grouped[machine]) grouped[machine] = [];
        grouped[machine].push(dwgNo);
      });
      Object.entries(grouped).forEach(([machineType, configuredNos]) => {
        machineStatus[machineType] = configuredNos.filter(no => !sdsPrefixSet.has(dwgPrefix(no))).length;
      });
    }

    return (
      <>
        {Object.keys(machineStatus).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {Object.entries(machineStatus).map(([machine, missing]) => missing > 0
              ? (
                <Tag key={machine} icon={<WarningOutlined />} color="warning" style={{ marginBottom: 4 }}>
                  {machine}: ขาด {missing} รายการ
                </Tag>
              ) : (
                <Tag key={machine} color="success" style={{ marginBottom: 4 }}>
                  {machine}: ครบ
                </Tag>
              )
            )}
          </div>
        )}
        <Table
          dataSource={dataSource}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </>
    );
  };

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="5" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '15px' }}>
          <div style={{ padding: '24px', background: theme.colors.background }}>
            <Spin spinning={loading}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 60 }} />
                  <div style={{ padding: '16px' }}>
                    <Title level={2} style={{ marginBottom: 0 }}>
                      Setup Data Sheet
                    </Title>
                    <Text type="secondary">Manage and view machine setup data sheets</Text>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    icon={<SettingOutlined />}
                    size="large"
                    onClick={() => navigate('/eng/mtc_eng/sds-v2/admin')}
                  >
                    Machine Template
                  </Button>
                )}
              </div>

              {/* Search Section */}
              <Card style={{ marginTop: 16, marginBottom: 16 }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    <Space.Compact style={{ width: 300 }}>
                      <Input
                        placeholder="C/N Number"
                        value={cn}
                        onChange={e => setCn(e.target.value)}
                        onPressEnter={handleSearch}
                        prefix={<SearchOutlined />}
                        allowClear
                      />
                      <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                        Search
                      </Button>
                    </Space.Compact>
                  </Col>
                </Row>
              </Card>

              {data && (
                <>
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

                  <Card
                    title={<Text strong style={{ color: theme.colors.text }}>Dimension ({data.part_type})</Text>}
                    style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                  >
                    {renderDimension()}
                  </Card>

                  <Card
                    title={<Text strong style={{ color: theme.colors.text }}>Process Info</Text>}
                    style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                  >
                    <Table
                      dataSource={data.process_info.map((r, i) => ({ ...r, key: i }))}
                      columns={processInfoCols}
                      pagination={false}
                      size="small"
                      scroll={{ x: 'max-content' }}
                      expandable={{
                        rowExpandable: (row) => (toolingByCode[row.process_code]?.length > 0),
                        expandedRowRender: buildExpandedContent,
                      }}
                    />
                  </Card>
                </>
              )}
            </Spin>
          </div>
        </Content>
      </Layout>

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
        destroyOnHidden
      >
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
            label: m.machine_type_name,
          }))}
        />
      </Modal>
    </Layout>
  );
};

export default SdsV2Page;
