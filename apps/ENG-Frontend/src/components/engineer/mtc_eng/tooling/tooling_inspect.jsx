import React, { useState, useEffect, useMemo } from "react";
import { Layout, DatePicker, Spin, Typography } from "antd";
import { Card, Row, Col, Table, Input, Button, Select, Space, Radio, Tag } from 'antd';
import {
  SyncOutlined, ClockCircleOutlined, UnorderedListOutlined, CalendarOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, PlusCircleOutlined
} from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

import Dashboard from "./Dashboard";
import DashboardCards from "./DashboardCards";
import DWGRequestForm from "./tooling_dwg_require";
import ToolingReturnForm from "./tooling_inspect_form";
import UpdateFormModal from "./tooling_update_form";



const { Content } = Layout;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

function InspectionReport() {
  const { theme } = useTheme();

  // --- State Declarations ---
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [selectedData, setSelectedData] = useState(null);
  const [dashboarddata, setDashboardData] = useState([]);
  const [timelineDashboard, setTimelineDashboard] = useState([]);
  const [selectedRange, setSelectedRange] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState('all');

  // Modal States
  const [toolingReturn, setToolingReturn] = useState(false);
  const [dwgRequestOpen, setDwgRequestOpen] = useState(false);
  const [updateFormOpen, setUpdateFormOpen] = useState(false);

  // --- Handlers for Modals ---
  const handleOpenReturn = () => {
    setToolingReturn(true);
  };

  const handleOpenDwg = () => {
    setDwgRequestOpen(true);
  };

  const handleUpdateRecord = (record) => {
    setSelectedData(record);
    setUpdateFormOpen(true);
    // console.log("Update Record:", record);
    // console.log(updateFormOpen)
    // ใส่ Logic เปิด Modal Update ตรงนี้
  };

  const fetchToolingInspectData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${server.TOOLING_INSPECT_GETLIST}`);
      const result = response.data.data;
      setDataSource(result);

      generateMonthOptions(result);
    } catch (error) {
      console.error("Fetch Inspect Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Logic Functions ---
  const generateMonthOptions = (allData) => {
    const monthOptions = [];
    for (let i = 0; i <= 11; i++) {
      const monthDate = moment().subtract(i, 'months');
      monthOptions.push({
        label: monthDate.format('MMM-YYYY'),
        value: monthDate.format('MM-YYYY'),
      });
    }
    setTimelineDashboard(monthOptions);

    const currentMonth = moment().format('MM-YYYY');
    handleMonthChange(currentMonth, allData);
  };

  const handleMonthChange = (value, customData) => {
    const targetData = Array.isArray(customData) ? customData : dataSource;

    if (!Array.isArray(targetData)) {
      console.warn("Target data is not an array");
      return;
    }

    const filtered = targetData.filter(item => {
      if (!item.receive_date) return false;
      const itemDate = moment(item.receive_date, 'YYYY-MM-DD'); // เช็ค Format วันที่ให้ตรง DB
      const targetMonth = moment(value, 'MM-YYYY');
      return itemDate.isSame(targetMonth, 'month');
    });
    setDashboardData(filtered);
  };

  const syncCSV = (data) => {
    console.log("Sync CSV Action:", data);
    // ใส่ Logic Sync CSV ตรงนี้
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    if (type !== 'date') {
      setSelectedRange(null);
    }
  };

  const handleRangeChange = (values) => {
    setSelectedRange(values);
  };

  const finalDataSource = useMemo(() => {
    let data = dataSource || [];

    switch (filterType) {
      case 'pending': // งานค้างเดือนนี้
        data = data.filter(item => {
          if (!item.receive_date) return false;
          const currentMonth = moment();
          const itemDate = moment(item.receive_date, ["MM/DD/YYYY", "M/D/YYYY", "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"]);
          const isThisMonth = itemDate.isSame(currentMonth, 'month');
          const isPending = !item.issue_date;
          return isThisMonth && isPending;
        });
        break;

      case 'pendingAll': // งานค้างทั้งหมด
        data = data.filter(item => {
          if (!item.receive_date) return false;
          return !item.issue_date;
        });
        break;

      case 'date': // กรองตามช่วงเวลา
        if (selectedRange && selectedRange.length === 2) {
          const v0 = selectedRange[0].toDate ? selectedRange[0].toDate() : selectedRange[0];
          const v1 = selectedRange[1].toDate ? selectedRange[1].toDate() : selectedRange[1];

          const startDate = moment(v0).startOf('day');
          const endDate = moment(v1).endOf('day');

          data = data.filter(item => {
            if (!item.receive_date) return false;
            const itemDate = moment(item.receive_date, ["MM/DD/YYYY", "M/D/YYYY", "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"]);
            return itemDate.isValid() && itemDate.isBetween(startDate, endDate, 'day', '[]');
          });
        } else {
          data = [];
        }
        break;
      case 'all':
      default:
        break;
    }

    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      data = data.filter(item =>
        Object.keys(item).some(key =>
          item[key] !== null &&
          item[key] !== undefined &&
          String(item[key]).toLowerCase().includes(lowerSearch)
        )
      );
    }

    return data;

  }, [dataSource, filterType, selectedRange, searchText]);

  useEffect(() => {
    fetchToolingInspectData();
  }, []);

  const columns = [
    {
      title: 'Receive Date', dataIndex: 'receive_date', key: 'receive_date',
      render: (text) => text ? moment(text, ["YYYY-MM-DD", "MM/DD/YYYY", "YYYY-MM-DD HH:mm:ss"]).format('DD-MMM-YYYY') : '-'
    },
    { title: 'Time', dataIndex: 'time', key: 'time', },
    { title: 'W/C', dataIndex: 'w_c', key: 'w_c', },
    { title: 'PO No.', dataIndex: 'po_no', key: 'po_no', },
    { title: 'Item Name', dataIndex: 'item_name', key: 'item_name', },
    { title: 'DWG No.', dataIndex: 'dwg_no', key: 'dwg_no', },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', },
    {
      title: 'Issue Date', dataIndex: 'issue_date', key: 'issue_date',
      render: (text) => text ? moment(text, ["YYYY-MM-DD", "MM/DD/YYYY", "YYYY-MM-DD HH:mm:ss"]).format('DD-MMM-YYYY') : '-'
    },
    { title: 'Diff.', dataIndex: 'diff', key: 'diff', },
    {
      title: 'Status', dataIndex: 'status', key: 'status', align: 'center', render: (text) => {
        let colorTag = text === 'On time' ? theme.colors.success : text === 'Delay' ? theme.colors.error : theme.colors.warning;
        return text ? <Tag color={colorTag} style={{ margin: 0 }}>{text}</Tag> : ''
      }
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', },
    { title: 'Measuring Tools', dataIndex: 'measuring_tools', key: 'measuring_tools', },
    {
      title: 'Judgement', dataIndex: 'judgement', key: 'judgement', render: (text) => {
        let colorTag = text === 'Accept' ? theme.colors.success : text === 'Reject' ? theme.colors.error : theme.colors.warning;
        return text ? <Tag color={colorTag} style={{ margin: 0 }}>{text}</Tag> : ''
      }
    },
    { title: 'Remark', dataIndex: 'remark', key: 'remark', },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      render: (_, record) => (
        <Button type="primary" onClick={() => handleUpdateRecord(record)}>
          Update
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"2"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '15px'
          }}>
            <div style={{ padding: '24px', background: theme.colors.background }}>

              {/* Header ส่วนหัว */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'Left', alignItems: 'center' }}>
                  <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 60 }} />
                  <div style={{ padding: '16px 16px' }}>
                    <Title level={2} style={{ marginBottom: 0 }}>
                      Tooling Inspection Record System
                    </Title>
                    <Text type="secondary">Manage and track tooling inspection records</Text>
                  </div>
                </div>
                <Select
                  defaultValue={moment().format('MM-YYYY')}
                  style={{ width: 150 }}
                  onChange={handleMonthChange}
                >
                  {timelineDashboard.map((item) => (
                    <Option key={item.value} value={item.value}>
                      {item.label}
                    </Option>
                  ))}
                </Select>
              </div>

              {/* 1. Dashboard Chart Section */}
              <Dashboard data={dashboarddata} />

              {/* 2. Control Cards Section (Imported Component) */}
              <Card style={{ marginTop: 16 }}>
                <DashboardCards
                  onOpenReturn={handleOpenReturn}
                  onOpenDwg={handleOpenDwg}
                />
              </Card>

              {/* 3. Filter Section */}
              <Card style={{ marginTop: 16 }} styles={{ padding: '16px' }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    <Space.Compact style={{ width: 300 }}>
                      <Input
                        placeholder="Search PO, Item, W/C..."
                        allowClear
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                      <Button type="primary">Search</Button>
                    </Space.Compact>
                  </Col>

                  <Col xs={24} md={16} style={{ textAlign: 'right' }}>
                    <Space wrap>
                      <Button icon={<SyncOutlined />} onClick={syncCSV}>
                        Sync CSV
                      </Button>

                      <Radio.Group
                        defaultValue="all"
                        buttonStyle="solid"
                        onChange={(e) => handleFilterChange(e.target.value)}
                        style={{ fontWeight: 400 }}
                      >
                        <Radio.Button value="pending" style={{ fontWeight: 400 }}><ClockCircleOutlined />  Pending</Radio.Button>
                        <Radio.Button value="pendingAll" style={{ fontWeight: 400 }}><ClockCircleOutlined />  Pending All</Radio.Button>
                        <Radio.Button value="all" style={{ fontWeight: 400 }}><UnorderedListOutlined />  All Jobs</Radio.Button>
                        <Radio.Button value="date" style={{ fontWeight: 400 }}><CalendarOutlined />  By Date</Radio.Button>
                      </Radio.Group>
                    </Space>
                  </Col>

                  {/* Date Picker Area */}
                  {filterType === 'date' && (
                    <Col span={24}>
                      <Row justify="end">
                        <Col xs={24} md={8}>
                          <RangePicker
                            style={{ width: '100%' }}
                            placeholder={['Start Date', 'End Date']}
                            onChange={handleRangeChange}
                            value={selectedRange}
                          />
                        </Col>
                      </Row>
                    </Col>
                  )}

                  {/* Status Message */}
                  {selectedRange && (
                    <Col span={24}>
                      <div style={{ textAlign: 'right', fontWeight: 'normal', color: theme.colors.textSecondary, fontSize: '13px', marginTop: '4px' }}>
                        {!selectedRange && (
                          <span><ExclamationCircleOutlined style={{ color: theme.colors.warning, marginRight: '4px' }} /> Please select a date range to view data</span>
                        )}
                        {selectedRange && (
                          <span style={{ color: finalDataSource.length > 0 ? theme.colors.success : theme.colors.error }}>
                            {finalDataSource.length > 0 ? (
                              <><CheckCircleOutlined style={{ marginRight: '4px' }} /> Found {finalDataSource.length} jobs in the selected period</>
                            ) : (
                              <><ExclamationCircleOutlined style={{ marginRight: '4px' }} /> No jobs found in the selected period</>
                            )}
                          </span>
                        )}
                      </div>
                    </Col>
                  )}
                </Row>
              </Card>

              {/* 4. Table Section */}
              <Card
                title={
                  <div style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                    <Space wrap>
                      <Text style={{ fontSize: 16 }}>Inspection Job List</Text>
                      <Text style={{ color: theme.colors.textTertiary }}>
                        ({filterType === 'pending' ? 'Pending Current Month' : filterType === 'pendingAll' ? 'All Pending' : 'All'})
                      </Text>
                    </Space>
                    <Space wrap>
                      <Text style={{ color: theme.colors.textTertiary, paddingRight: 8 }}>{finalDataSource.length} Jobs</Text>
                      <Button type="primary" icon={<PlusCircleOutlined />} onClick={fetchToolingInspectData}>Refresh</Button>
                    </Space>
                  </div>
                }
                style={{ marginTop: 16 }}
                scroll={'auto'}
              >
                <ScrollbarStyle primary={theme.colors.primary} />
                <Table
                  className="kb-vscroll"
                  dataSource={finalDataSource}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    defaultPageSize: 5,
                    pageSizeOptions: ['5', '10', '15', '20', '25', '30'],
                    position: ['bottomRight']
                  }}
                  scroll={{ x: 'max-content' }}
                />
              </Card>
            </div>

            {/* Modals */}
            <ToolingReturnForm
              open={toolingReturn}
              onCancel={() => {
                setToolingReturn(false);
                // อาจจะ refresh table ตรงนี้ด้วยถ้าต้องการ
                // fetchToolingInspectData();
              }}
            />
            <DWGRequestForm
              open={dwgRequestOpen}
              onCancel={() => {
                setDwgRequestOpen(false);
              }}
            />
            <UpdateFormModal
              open={updateFormOpen}
              initialData={selectedData}
              onCancel={() => {
                setUpdateFormOpen(false);
              }}
              onSuccess={fetchToolingInspectData}
            />
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default InspectionReport;