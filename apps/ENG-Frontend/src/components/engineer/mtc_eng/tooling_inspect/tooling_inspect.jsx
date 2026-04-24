import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layout, DatePicker, Spin, Typography, message } from "antd";
import { Card, Row, Col, Table, Input, Button, Select, Space, Radio, Tag } from 'antd';
import {
  SyncOutlined, StopOutlined, AuditOutlined, CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import Swal from 'sweetalert2';
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
const { Title, Text } = Typography;
const { Option } = Select;

function InspectionReport() {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [selectedData, setSelectedData] = useState(null);
  const [dashboarddata, setDashboardData] = useState([]);
  const [timelineDashboard, setTimelineDashboard] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [dateStats, setDateStats] = useState(null);
  const [toolingReturn, setToolingReturn] = useState(false);
  const [dwgRequestOpen, setDwgRequestOpen] = useState(false);
  const [updateFormOpen, setUpdateFormOpen] = useState(false);

  const fetchDashboardData = useCallback(async (monthYear) => {
    try {
      const response = await axios.get(`${server.TOOLING_DASHBOARD_STATS_GET}?month=${monthYear}`);
      setDashboardData(response.data);
    } catch (error) {
      console.error("Fetch Dashboard Error:", error);
      setDashboardData({});
    }
  }, []);

  const fetchToolingInspectData = useCallback(async () => {
    if (filterType === 'date' && !selectedDate) {
      setDataSource([]);
      setTotalRecords(0);
      setDateStats(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        search: searchText,
        status: filterType,
      });
      if (filterType === 'all' || filterType === 'pending') {
        params.append('currentMonth', moment().format('MM-YYYY'));
      }
      if (filterType === 'date' && selectedDate) {
        params.append('startDate', selectedDate.format('YYYY-MM-DD'));
        params.append('endDate', selectedDate.format('YYYY-MM-DD'));
      }
      const response = await axios.get(`${server.TOOLING_INSPECT_GETLIST}?${params.toString()}`);
      setDataSource(response.data.data || []);
      setTotalRecords(response.data.pagination?.total || 0);
      if (filterType === 'date') setDateStats(response.data.dateActivity || null);
      else setDateStats(null);
    } catch (error) {
      console.error("Fetch Inspect Error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchText, filterType, selectedDate]);

  const handleSyncCSV = useCallback(async () => {
    setLoading(true);
    try {
      await axios.post(server.TOOLING_SYNC_CSV);
      message.success('Data updated successfully');
      fetchToolingInspectData();
    } catch (e) {
      message.error('Failed to update data');
    } finally {
      setLoading(false);
    }
  }, [fetchToolingInspectData]);

  const handleUpdateRecord = useCallback((record) => {
    setSelectedData(record);
    setUpdateFormOpen(true);
  }, []);


  const handleBlacklist = useCallback(async (id) => {
    const { value: reason } = await Swal.fire({
      title: 'Blacklist Item',
      input: 'text',
      inputLabel: 'Reason',
      inputPlaceholder: 'Enter reason for blacklisting',
      showCancelButton: true,
      inputValidator: (value) => !value && 'You need to write a reason!'
    });
    if (reason) {
      try {
        await axios.post(`${server.TOOLING_INSPECT_GETLIST}/${id}/blacklist`, { reason });
        message.success('Item blacklisted and deleted');
        fetchToolingInspectData();
      } catch (e) {
        message.error('Failed to blacklist');
      }
    }
  }, [fetchToolingInspectData]);

  const columns = useMemo(() => [
    { title: 'Receive Date', dataIndex: 'receive_date', key: 'receive_date', render: (t) => t ? moment(t, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-' },
    { title: 'Time', dataIndex: 'time', key: 'time' },
    { title: 'W/C', dataIndex: 'w_c', key: 'w_c' },
    { title: 'PO No.', dataIndex: 'po_no', key: 'po_no' },
    { title: 'Item Name', dataIndex: 'item_name', key: 'item_name' },
    { title: 'DWG No.', dataIndex: 'dwg_no', key: 'dwg_no' },
    { title: 'Qty', dataIndex: 'qty', key: 'qty' },
    { title: 'Issue Date', dataIndex: 'issue_date', key: 'issue_date', render: (t) => t ? moment(t, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-' },
    { title: 'Diff.', dataIndex: 'diff', key: 'diff' },
    { title: 'Status', dataIndex: 'status', key: 'status', align: 'center', render: (t) => t ? <Tag color={t === 'On time' ? theme.colors.success : t === 'Delay' ? theme.colors.error : theme.colors.warning}>{t}</Tag> : '' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason' },
    { title: 'Measuring Tools', dataIndex: 'measuring_tools', key: 'measuring_tools' },
    { title: 'Judgement', dataIndex: 'judgement', key: 'judgement', render: (t) => t ? <Tag color={t === 'Accept' ? theme.colors.success : theme.colors.error}>{t}</Tag> : '' },
    { title: 'Remark', dataIndex: 'remark', key: 'remark' },
    {
      title: 'Action', key: 'action', fixed: 'right', render: (_, record) => (
        <Space size="small">
          <Button type="primary" size="small" onClick={() => handleUpdateRecord(record)}>Update</Button>
          <Button danger size="small" icon={<StopOutlined />} onClick={() => handleBlacklist(record.id)}>Blacklist</Button>
        </Space>
      )
    }
  ], [theme.colors, handleUpdateRecord, handleBlacklist]);

  useEffect(() => {
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
      label: moment().subtract(i, 'months').format('MMM-YYYY'),
      value: moment().subtract(i, 'months').format('MM-YYYY'),
    }));
    setTimelineDashboard(monthOptions);
    fetchDashboardData(moment().format('MM-YYYY'));
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchToolingInspectData();
  }, [fetchToolingInspectData]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"tooling-inspect"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '15px' }}>
            <div style={{ padding: '24px', background: theme.colors.background }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 60 }} />
                  <div style={{ padding: '16px' }}>
                    <Title level={2} style={{ marginBottom: 0 }}>Tooling Inspection Record System</Title>
                    <Text type="secondary">Manage and track tooling inspection records</Text>
                  </div>
                </div>
                <Select defaultValue={moment().format('MM-YYYY')} style={{ width: 150 }} onChange={fetchDashboardData}>
                  {timelineDashboard.map(item => <Option key={item.value} value={item.value}>{item.label}</Option>)}
                </Select>
              </div>
              <Dashboard data={dashboarddata} />
              <Card style={{ marginTop: 16 }}>
                <DashboardCards data={dashboarddata} onOpenReturn={() => setToolingReturn(true)} onOpenDwg={() => setDwgRequestOpen(true)} />
              </Card>
              <Card style={{ marginTop: 16 }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    <Input.Search placeholder="Search PO, Item..." onSearch={(v) => { setSearchText(v); setCurrentPage(1); }} style={{ width: 300 }} enterButton />
                  </Col>
                  <Col xs={24} md={16} style={{ textAlign: 'right' }}>
                    <Space wrap>
                      <Button icon={<SyncOutlined />} onClick={handleSyncCSV}>Update data</Button>
                      <Radio.Group onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); if(e.target.value !== 'date') setSelectedDate(null); }} value={filterType}>
                        <Radio.Button value="pending">Pending</Radio.Button>
                        <Radio.Button value="pendingAll">Pending All</Radio.Button>
                        <Radio.Button value="all">All Jobs</Radio.Button>
                        <Radio.Button value="date">By Date</Radio.Button>
                      </Radio.Group>
                    </Space>
                  </Col>
                  {filterType === 'date' && (
                    <Col span={24}>
                      <Space align="center">
                        <DatePicker style={{ width: 220 }} onChange={(d) => { setSelectedDate(d); setCurrentPage(1); }} value={selectedDate} />
                        {!selectedDate && <Text type="secondary">เลือกวันที่เพื่อดูรายการ</Text>}
                      </Space>
                    </Col>
                  )}
                  {filterType === 'date' && selectedDate && dateStats && (
                    <Col span={24}>
                      <Card size="small" style={{ background: theme.colors.blueLight || '#e6f7ff', border: `1px solid ${theme.colors.blue}` }}>
                        <Space size="large">
                          <span><AuditOutlined style={{ color: theme.colors.blue }} /> <Text strong>Activity วันที่ {selectedDate.format('DD/MM/YYYY')}</Text></span>
                          <span><ClockCircleOutlined style={{ color: theme.colors.warning }} /> <Text type="secondary">Received: </Text><Text strong style={{ color: theme.colors.warning }}>{dateStats.received ?? 0}</Text> <Text type="secondary" style={{ fontSize: 11 }}>รายการ</Text></span>
                          <span><CheckCircleOutlined style={{ color: theme.colors.success }} /> <Text type="secondary">Issued: </Text><Text strong style={{ color: theme.colors.success }}>{dateStats.issued ?? 0}</Text> <Text type="secondary" style={{ fontSize: 11 }}>รายการ</Text></span>
                        </Space>
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card>
              <Card title="Inspection List" style={{ marginTop: 16 }}>
                <Table dataSource={dataSource} columns={columns} rowKey="id" pagination={{ current: currentPage, pageSize, total: totalRecords, onChange: (c, s) => { setCurrentPage(c); setPageSize(s); } }} scroll={{ x: 'max-content' }} />
              </Card>
            </div>
          </Content>
        </Spin>
      </Layout>
      <ToolingReturnForm open={toolingReturn} onCancel={() => setToolingReturn(false)} onSuccess={() => { setToolingReturn(false); fetchToolingInspectData(); }} />
      <DWGRequestForm open={dwgRequestOpen} onCancel={() => setDwgRequestOpen(false)} />
      <UpdateFormModal open={updateFormOpen} initialData={selectedData} onCancel={() => setUpdateFormOpen(false)} onSuccess={fetchToolingInspectData} />
    </Layout>
  );
}
export default InspectionReport;
