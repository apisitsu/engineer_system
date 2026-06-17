import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layout, DatePicker, Spin, Typography, message } from "antd";
import { Card, Row, Col, Table, Input, Button, Select, Space, Radio, Tag } from 'antd';
import { SystemVersionBadge } from '../SystemVersionBadge';
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
  const [selectedMonth, setSelectedMonth] = useState(moment().format('MM-YYYY'));

  const fetchDashboardData = useCallback(async (monthYear) => {
    const month = monthYear || moment().format('MM-YYYY');
    try {
      const response = await axios.get(`${server.TOOLING_DASHBOARD_STATS_GET}?month=${month}`);
      setDashboardData(response.data);
      if (monthYear) setSelectedMonth(monthYear);
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
      if (filterType === 'pending') {
        params.append('currentMonth', moment().format('MM-YYYY'));
      }
      if (filterType === 'all') {
        params.append('currentYear', moment().format('YYYY'));
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
      fetchDashboardData(selectedMonth);
    } catch (e) {
      message.error('Failed to update data');
    } finally {
      setLoading(false);
    }
  }, [fetchToolingInspectData, fetchDashboardData, selectedMonth]);

  const handleUpdateRecord = useCallback((record) => {
    setSelectedData(record);
    setUpdateFormOpen(true);
  }, []);


  const handleBlacklist = useCallback(async (id) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Blacklist Item',
      text: 'ยืนยันการ Blacklist รายการนี้?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
    });
    if (isConfirmed) {
      try {
        await axios.post(`${server.TOOLING_INSPECT_API}/${id}/blacklist`, { reason: '' });
        message.success('Item blacklisted and deleted');
        fetchToolingInspectData();
        fetchDashboardData(selectedMonth);
      } catch (e) {
        message.error('Failed to blacklist');
      }
    }
  }, [fetchToolingInspectData, fetchDashboardData, selectedMonth]);

  const { displayData, duplicatePoNos } = useMemo(() => {
    const count = {};
    dataSource.forEach(r => { if (r.po_no) count[r.po_no] = (count[r.po_no] || 0) + 1; });
    const dupSet = new Set(Object.keys(count).filter(k => count[k] > 1));
    const sorted = [...dataSource].sort((a, b) => {
      const aDup = dupSet.has(a.po_no);
      const bDup = dupSet.has(b.po_no);
      if (aDup !== bDup) return aDup ? -1 : 1;
      if (aDup) return (a.po_no || '').localeCompare(b.po_no || '');
      return 0;
    });
    return { displayData: sorted, duplicatePoNos: dupSet };
  }, [dataSource]);

  const columns = useMemo(() => [
    { title: 'Receive Date', dataIndex: 'receive_date', key: 'receive_date', width: 115, sorter: (a, b) => (a.receive_date || '').localeCompare(b.receive_date || ''), render: (t) => t ? moment(t, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-' },
    { title: 'PO No.', dataIndex: 'po_no', key: 'po_no', width: 120, sorter: (a, b) => (a.po_no || '').localeCompare(b.po_no || '') },
    { title: 'Item Name', dataIndex: 'item_name', key: 'item_name', width: 160, sorter: (a, b) => (a.item_name || '').localeCompare(b.item_name || '') },
    { title: 'DWG No.', dataIndex: 'dwg_no', key: 'dwg_no', width: 110, sorter: (a, b) => (a.dwg_no || '').localeCompare(b.dwg_no || '') },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 65, align: 'center', sorter: (a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0) },
    { title: 'Issue Date', dataIndex: 'issue_date', key: 'issue_date', width: 105, sorter: (a, b) => (a.issue_date || '').localeCompare(b.issue_date || ''), render: (t) => t ? moment(t, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-' },
    { title: 'Diff.', dataIndex: 'diff', key: 'diff', width: 65, align: 'center', sorter: (a, b) => (Number(a.diff) || 0) - (Number(b.diff) || 0) },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 95, align: 'center', sorter: (a, b) => (a.status || '').localeCompare(b.status || ''), render: (t) => t ? <Tag color={t === 'On time' ? theme.colors.success : t === 'Delay' ? theme.colors.error : theme.colors.warning}>{t}</Tag> : '' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 130, sorter: (a, b) => (a.reason || '').localeCompare(b.reason || '') },
    { title: 'Measuring Tools', dataIndex: 'measuring_tools', key: 'measuring_tools', width: 140, sorter: (a, b) => (a.measuring_tools || '').localeCompare(b.measuring_tools || '') },
    { title: 'Judgement', dataIndex: 'judgement', key: 'judgement', width: 100, align: 'center', sorter: (a, b) => (a.judgement || '').localeCompare(b.judgement || ''), render: (t) => t ? <Tag color={t === 'Accept' ? theme.colors.success : theme.colors.error}>{t}</Tag> : '' },
    {
      title: 'Action', key: 'action', fixed: 'right', width: 110, render: (_, record) => (
        <Space size="small">
          <Button type="primary" size="small" onClick={() => handleUpdateRecord(record)}>Update</Button>
          <Button danger size="small" icon={<StopOutlined />} title="Blacklist" onClick={() => handleBlacklist(record.id)} />
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchToolingInspectData();
  }, [fetchToolingInspectData]);

  return (
    <Layout style={{ height: '100%' }}>
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
                    <Title level={2} style={{ marginBottom: 0 }}>Tooling Inspection<SystemVersionBadge system="tooling-inspect" /></Title>
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
                      <Radio.Group onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); if (e.target.value !== 'date') setSelectedDate(null); }} value={filterType}>
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
                        {!selectedDate && <Text type="secondary">Select Date</Text>}
                      </Space>
                    </Col>
                  )}
                  {filterType === 'date' && selectedDate && dateStats && (
                    <Col span={24}>
                      <Card size="small" style={{ background: theme.colors.blueLight || '#e6f7ff', border: `1px solid ${theme.colors.blue}` }}>
                        <Space size="large">
                          <span><AuditOutlined style={{ color: theme.colors.blue }} /> <Text strong>Activity Date {selectedDate.format('DD/MM/YYYY')}</Text></span>
                          <span><ClockCircleOutlined style={{ color: theme.colors.warning }} /> <Text type="secondary">Received: </Text><Text strong style={{ color: theme.colors.warning }}>{dateStats.received ?? 0}</Text> <Text type="secondary" style={{ fontSize: 11 }}>Items</Text></span>
                          <span><CheckCircleOutlined style={{ color: theme.colors.success }} /> <Text type="secondary">Issued: </Text><Text strong style={{ color: theme.colors.success }}>{dateStats.issued ?? 0}</Text> <Text type="secondary" style={{ fontSize: 11 }}>Items</Text></span>
                        </Space>
                      </Card>
                    </Col>
                  )}
                </Row>
              </Card>
              <Card
                title="Inspection List"
                extra={<Text type="secondary">{totalRecords > 0 ? <><Text strong>{totalRecords}</Text> Item{duplicatePoNos.size > 0 && <Text type="danger" style={{ marginLeft: 8 }}>· Duplicate {duplicatePoNos.size} PO</Text>}</> : 'No records'}</Text>}
                style={{ marginTop: 16 }}
              >
                <style>{`.dup-row td { color: #f5222d !important; font-weight: 600; }`}</style>
                <Table
                  dataSource={displayData}
                  columns={columns}
                  rowKey="id"
                  rowClassName={(r) => duplicatePoNos.has(r.po_no) ? 'dup-row' : ''}
                  pagination={{ current: currentPage, pageSize, total: totalRecords, onChange: (c, s) => { setCurrentPage(c); setPageSize(s); } }}
                  scroll={{ x: 'max-content' }}
                  size="small"
                />
              </Card>
            </div>
          </Content>
        </Spin>
      </Layout>
      <ToolingReturnForm open={toolingReturn} onCancel={() => setToolingReturn(false)} onSuccess={() => { setToolingReturn(false); fetchToolingInspectData(); fetchDashboardData(selectedMonth); }} />
      <DWGRequestForm open={dwgRequestOpen} onCancel={() => setDwgRequestOpen(false)} />
      <UpdateFormModal open={updateFormOpen} initialData={selectedData} onCancel={() => setUpdateFormOpen(false)} onSuccess={() => { fetchToolingInspectData(); fetchDashboardData(selectedMonth); }} />
    </Layout>
  );
}
export default InspectionReport;
