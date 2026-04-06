import React, { useState, useEffect, useMemo, useCallback } from "react";
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

  // Dashboard States
  const [dashboarddata, setDashboardData] = useState([]);
  const [timelineDashboard, setTimelineDashboard] = useState([]);

  // Filter & Pagination States
  const [selectedRange, setSelectedRange] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal States
  const [toolingReturn, setToolingReturn] = useState(false);
  const [dwgRequestOpen, setDwgRequestOpen] = useState(false);
  const [updateFormOpen, setUpdateFormOpen] = useState(false);

  // --- Handlers for Modals ---
  const handleOpenReturn = () => setToolingReturn(true);
  const handleOpenDwg = () => setDwgRequestOpen(true);
  const handleUpdateRecord = (record) => {
    setSelectedData(record);
    setUpdateFormOpen(true);
  };

  // --- Data Fetching Logic ---

  // 1. Fetch Table Data
  const fetchToolingInspectData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        search: searchText,
        status: filterType,
      });

      // ✅ 1. เพิ่มบล็อกนี้เข้าไป เพื่อให้ปุ่ม all และ pending ส่งค่าเดือนปัจจุบันไปให้ Backend กรอง
      if (filterType === 'all' || filterType === 'pending') {
        params.append('currentMonth', moment().format('MM-YYYY'));
      }

      // Append date range to API parameters if selected
      if (filterType === 'date' && selectedRange && selectedRange.length === 2) {
        const startDate = selectedRange[0].format('YYYY-MM-DD');
        const endDate = selectedRange[1].format('YYYY-MM-DD');
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

      const response = await axios.get(`${server.TOOLING_INSPECT_GETLIST}?${params.toString()}`);

      const resultData = response.data.data;
      setDataSource(resultData || []);
      setTotalRecords(response.data.pagination?.total || 0);

    } catch (error) {
      console.error("Fetch Inspect Error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchText, filterType, selectedRange]);

  // 2. Fetch Dashboard Data (Independent of Table Pagination)
  const fetchDashboardData = async (monthYear) => {
    try {

      console.log(`Fetching comprehensive data for month: ${monthYear}`);
      const response = await axios.get(`${server.TOOLING_DASHBOARD_STATS_GET}?month=${monthYear}`);
      console.log("Dashboard API Response:", response.data);
      setDashboardData(response.data);

    } catch (error) {
      console.error("Fetch Dashboard Error:", error);
      setDashboardData({});
    }
  };

  // --- Lifecycle Hooks ---

  // Initialize Timeline Dashboard Options
  useEffect(() => {
    const monthOptions = [];
    for (let i = 0; i <= 11; i++) {
      const monthDate = moment().subtract(i, 'months');
      monthOptions.push({
        label: monthDate.format('MMM-YYYY'),
        value: monthDate.format('MM-YYYY'),
      });
    }
    setTimelineDashboard(monthOptions);

    // Fetch initial dashboard data for current month
    const currentMonth = moment().format('MM-YYYY');
    fetchDashboardData(currentMonth);
  }, []);

  // Fetch table data when dependencies change
  useEffect(() => {
    fetchToolingInspectData();
  }, [fetchToolingInspectData]);

  // --- Interaction Handlers ---

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  const handleMonthChange = (value) => {
    // Fetch new dashboard data specifically for the selected month
    fetchDashboardData(value);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1); // Always reset to page 1 on new search
  };

  const handleFilterChange = (type) => {
    setFilterType(type);
    setCurrentPage(1); // Always reset to page 1 on filter change
    if (type !== 'date') {
      setSelectedRange(null);
    }
  };

  const handleRangeChange = (values) => {
    setSelectedRange(values);
    setCurrentPage(1); // Always reset to page 1 on date range change
  };

  const syncCSV = (data) => {
    console.log("Sync CSV Action executed");
    // Implementation for Sync CSV
  };

  // --- Table Columns ---
  const columns = useMemo(() => [
    {
      title: 'Receive Date', dataIndex: 'receive_date', key: 'receive_date',
      render: (text) => text ? moment(text, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-',
    },
    { title: 'Time', dataIndex: 'time', key: 'time', },
    { title: 'W/C', dataIndex: 'w_c', key: 'w_c', },
    { title: 'PO No.', dataIndex: 'po_no', key: 'po_no', },
    { title: 'Item Name', dataIndex: 'item_name', key: 'item_name', },
    { title: 'DWG No.', dataIndex: 'dwg_no', key: 'dwg_no', },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', },
    {
      title: 'Issue Date', dataIndex: 'issue_date', key: 'issue_date',
      render: (text) => text ? moment(text, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-',
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
  ], [theme.colors]);

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

              {/* Header Section */}
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

              {/* 2. Control Cards Section */}
              <Card style={{ marginTop: 16 }}>
                <DashboardCards
                  data={dashboarddata}
                  onOpenReturn={handleOpenReturn}
                  onOpenDwg={handleOpenDwg}
                />
              </Card>

              {/* 3. Filter Section */}
              <Card style={{ marginTop: 16 }} styles={{ padding: '16px' }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    {/* Changed from Input to Input.Search to prevent API spamming */}
                    <Input.Search
                      placeholder="Search PO, Item, W/C..."
                      allowClear
                      onSearch={handleSearch}
                      style={{ width: 300 }}
                      enterButton
                    />
                  </Col>

                  <Col xs={24} md={16} style={{ textAlign: 'right' }}>
                    <Space wrap>
                      <Button icon={<SyncOutlined />} onClick={syncCSV}>
                        Sync CSV
                      </Button>

                      <Radio.Group
                        defaultValue="pending"
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
                  {filterType === 'date' && selectedRange && (
                    <Col span={24}>
                      <div style={{ textAlign: 'right', fontWeight: 'normal', color: theme.colors.textSecondary, fontSize: '13px', marginTop: '4px' }}>
                        <span style={{ color: totalRecords > 0 ? theme.colors.success : theme.colors.error }}>
                          {totalRecords > 0 ? (
                            <><CheckCircleOutlined style={{ marginRight: '4px' }} /> Found {totalRecords} jobs in the selected period</>
                          ) : (
                            <><ExclamationCircleOutlined style={{ marginRight: '4px' }} /> No jobs found in the selected period</>
                          )}
                        </span>
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
                      <Text style={{ color: theme.colors.textTertiary, paddingRight: 8 }}>{totalRecords} Jobs</Text>
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
                  dataSource={dataSource}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  onChange={handleTableChange}
                  pagination={{
                    current: currentPage,
                    pageSize: pageSize,
                    total: totalRecords,
                    pageSizeOptions: ['5', '10', '15', '20', '25', '30'],
                    showSizeChanger: true,
                    position: ['bottomRight']
                  }}
                  scroll={{ x: 'max-content' }}
                />
              </Card>
            </div>

            {/* Modals */}
            <ToolingReturnForm
              open={toolingReturn}
              onCancel={() => setToolingReturn(false)}
            />
            <DWGRequestForm
              open={dwgRequestOpen}
              onCancel={() => setDwgRequestOpen(false)}
            />
            <UpdateFormModal
              open={updateFormOpen}
              initialData={selectedData}
              onCancel={() => setUpdateFormOpen(false)}
              onSuccess={fetchToolingInspectData}
            />
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default InspectionReport;