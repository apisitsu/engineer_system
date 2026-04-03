import React, { useState, useEffect, useMemo } from "react";
import { Layout, Spin } from "antd";
import { Card, Row, Col, Progress, Divider } from 'antd';
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { server } from '../../../constance/constance';
import { useTheme } from '../../../theme';
import ScrollbarStyle from '../../common/scrollbar';

const { Content } = Layout;

<<<<<<< HEAD
const ToolingInspect = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);

  const fetchECRData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${server.ECR_REQUIRE_GETLIST}`);
      setDataSource(response.data.data);
=======
const HomeMTCEng = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [toolingData, setToolingData] = useState([]);
  const [dwgData, setDwgData] = useState([]);
  const [dwgStats, setDwgStats] = useState(null);

  const fetchMTCData = async () => {
    setLoading(true);
    try {
      const [toolingRes, dwgRes, dwgStatsRes] = await Promise.all([
        axios.get(`${server.TOOLING_INSPECT_GETLIST}`),
        axios.get(`${server.MTC_TOOL_REQUESTS}?limit=500`),  // Get more records
        axios.get(`${server.MTC_TOOL_REQUEST_DASHBOARD}`)  // Get dashboard stats
      ]);
      setToolingData(toolingRes.data.data || []);
      setDwgData(dwgRes.data.data || []);
      setDwgStats(dwgStatsRes.data.data || null);
>>>>>>> old-work-backup
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = useMemo(() => {
<<<<<<< HEAD
    const totalJobs = dataSource.length;

    const onTimeCount = dataSource.filter(item => {
      if (!item.due_date) return false;
      return moment().isSameOrBefore(moment(item.due_date), 'day') && item.process_status?.toLowerCase() !== 'pending';
    }).length;

    const delayCount = dataSource.filter(item => {
      if (!item.due_date) return false;
      return moment().isAfter(moment(item.due_date), 'day') && item.process_status?.toLowerCase() !== 'pending';
    }).length;

    const pendingCount = dataSource.filter(item => item.process_status?.toLowerCase() === 'pending').length;

    return {
      totalJobs,
      onTimeCount,
      delayCount,
      pendingCount,
      onTimePercent: totalJobs > 0 ? Number(((onTimeCount / totalJobs) * 100).toFixed(1)) : 0,
      delayPercent: totalJobs > 0 ? Number(((delayCount / totalJobs) * 100).toFixed(1)) : 0,
      pendingPercent: totalJobs > 0 ? Number(((pendingCount / totalJobs) * 100).toFixed(1)) : 0,
    };
  }, [dataSource]);

  useEffect(() => {
    fetchECRData();
=======
    // Tooling Inspection Stats
    const totalToolingJobs = toolingData.length;
    const toolingPending = toolingData.filter(item => !item.issue_date).length;
    const toolingOnTime = toolingData.filter(item => {
      if (!item.due_date) return false;
      return moment().isSameOrBefore(moment(item.due_date), 'day');
    }).length;
    const toolingDelay = totalToolingJobs - toolingOnTime - toolingPending;

    // DWG Request Stats (from General DWG Request - tr_request)
    // Use dashboard stats from API if available, otherwise calculate from dwgData
    const totalDwgJobs = dwgStats ? dwgStats.total : dwgData.length;
    const dwgPending = dwgStats ? (dwgStats.byStatus['Pending'] || 0) + (dwgStats.byStatus['Draft'] || 0) : 
      dwgData.filter(item => item.status?.toLowerCase() === 'pending' || item.status?.toLowerCase() === 'draft').length;
    const dwgComplete = dwgStats ? (dwgStats.byStatus['Completed & Informed'] || 0) : 
      dwgData.filter(item => item.status?.toLowerCase() === 'completed & informed' || item.status?.toLowerCase() === 'completed').length;
    const dwgInProgress = dwgStats ? (dwgStats.total - dwgPending - dwgComplete) : totalDwgJobs - dwgPending - dwgComplete;

    return {
      totalToolingJobs,
      toolingPending,
      toolingOnTime,
      toolingDelay,
      totalDwgJobs,
      dwgPending,
      dwgComplete,
      dwgInProgress,
      toolingOnTimePercent: totalToolingJobs > 0 ? Number(((toolingOnTime / totalToolingJobs) * 100).toFixed(1)) : 0,
      toolingPendingPercent: totalToolingJobs > 0 ? Number(((toolingPending / totalToolingJobs) * 100).toFixed(1)) : 0,
      toolingDelayPercent: totalToolingJobs > 0 ? Number(((toolingDelay / totalToolingJobs) * 100).toFixed(1)) : 0,
    };
  }, [toolingData, dwgData, dwgStats]);

  useEffect(() => {
    fetchMTCData();
>>>>>>> old-work-backup
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"1"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '15px'
          }}>
            <div style={{ padding: '24px', background: theme.colors.surface, borderRadius: '12px' }}>
<<<<<<< HEAD
=======
              {/* Tooling Inspection Report */}
>>>>>>> old-work-backup
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                  <h2><AssessmentRoundedIcon sx={{ color: theme.colors.info, fontSize: 50 }} />
                    <a href="/eng/mtc_eng/tooling" style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>Tooling Inspection Report</a>
                  </h2>
                </Divider>
<<<<<<< HEAD
                {/* ส่วนที่ 1: Row ของ Stats Cards (Total Jobs, On Time, etc.) */}
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={16}>
                    <Row padding={8} gutter={[16, 16]}>
                      <Col span={12}>
                        <Card size="small" title="Total Jobs"><h2 style={{ color: theme.colors.info }}>{dashboardStats.totalJobs}</h2></Card>
                        <Card size="small" title="Delay" style={{ marginTop: 10 }}><h2 style={{ color: theme.colors.error }}>{dashboardStats.delayCount}</h2></Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" title="On Time"><h2 style={{ color: theme.colors.success }}>{dashboardStats.onTimeCount}</h2></Card>
                        <Card size="small" title="Pending" style={{ marginTop: 10 }}><h2 style={{ color: theme.colors.warning }}>{dashboardStats.pendingCount}</h2></Card>
=======
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={16}>
                    <Row padding={8} gutter={[16, 16]}>
                      <Col span={8}>
                        <Card size="small" title="Total Jobs"><h2 style={{ color: theme.colors.info }}>{dashboardStats.totalToolingJobs}</h2></Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="On Time"><h2 style={{ color: theme.colors.success }}>{dashboardStats.toolingOnTime}</h2></Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="Delay"><h2 style={{ color: theme.colors.error }}>{dashboardStats.toolingDelay}</h2></Card>
                      </Col>
                    </Row>
                    <Row padding={8} gutter={[16, 16]} style={{ marginTop: 10 }}>
                      <Col span={12}>
                        <Card size="small" title="Pending"><h2 style={{ color: theme.colors.warning }}>{dashboardStats.toolingPending}</h2></Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" title="Performance">
                          <Progress percent={dashboardStats.toolingOnTimePercent} strokeColor={theme.colors.success} size="small" />
                        </Card>
>>>>>>> old-work-backup
                      </Col>
                    </Row>
                  </Col>
                  <Col span={8}>
<<<<<<< HEAD
                    <Card size="small" title="Performance Overview">
                      On Time <Progress percent={dashboardStats.onTimePercent} strokeColor={theme.colors.success} size="small" />
                      Pending <Progress percent={dashboardStats.pendingPercent} strokeColor={theme.colors.warning} size="small" />
                      Delay <Progress percent={dashboardStats.delayPercent} strokeColor={theme.colors.error} size="small" />
=======
                    <Card size="small" title="Status Overview">
                      On Time <Progress percent={dashboardStats.toolingOnTimePercent} strokeColor={theme.colors.success} size="small" />
                      Pending <Progress percent={dashboardStats.toolingPendingPercent} strokeColor={theme.colors.warning} size="small" />
                      Delay <Progress percent={dashboardStats.toolingDelayPercent} strokeColor={theme.colors.error} size="small" />
>>>>>>> old-work-backup
                    </Card>
                  </Col>
                </Row>
              </div>

<<<<<<< HEAD
              {/* Tool Request System */}
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                  <h2><AssessmentRoundedIcon sx={{ color: theme.colors.success, fontSize: 50 }} />
                    <a href="/eng/mtc_eng/tool-request" style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>Tool Drawing Request System</a>
                  </h2>
                </Divider>
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={24}>
                    <Card size="small" title="📝 Manage Tool & Drawing Requests">
                      <p style={{ margin: 0 }}>
=======
              {/* General DWG Request */}
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                  <h2><AssessmentRoundedIcon sx={{ color: theme.colors.success, fontSize: 50 }} />
                    <a href="/eng/mtc_eng/tool-request" style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>General DWG Request</a>
                  </h2>
                </Divider>
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={16}>
                    <Row padding={8} gutter={[16, 16]}>
                      <Col span={8}>
                        <Card size="small" title="Total Requests"><h2 style={{ color: theme.colors.info }}>{dashboardStats.totalDwgJobs}</h2></Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="Complete"><h2 style={{ color: theme.colors.success }}>{dashboardStats.dwgComplete}</h2></Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="In Progress"><h2 style={{ color: theme.colors.primary }}>{dashboardStats.dwgInProgress}</h2></Card>
                      </Col>
                    </Row>
                    <Row padding={8} gutter={[16, 16]} style={{ marginTop: 10 }}>
                      <Col span={24}>
                        <Card size="small" title="Pending Approval"><h2 style={{ color: theme.colors.warning }}>{dashboardStats.dwgPending}</h2></Card>
                      </Col>
                    </Row>
                  </Col>
                  <Col span={8}>
                    <Card size="small" title="📝 Manage Tool & Drawing Requests">
                      <p style={{ margin: 0, fontSize: '12px' }}>
>>>>>>> old-work-backup
                        Submit and track requests for tool drawings, fixtures, gauges, and 3D printing.
                        Monitor workflow progress from engineering check to completion.
                      </p>
                    </Card>
                  </Col>
                </Row>
              </div>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

<<<<<<< HEAD
export default ToolingInspect;
=======
export default HomeMTCEng;
>>>>>>> old-work-backup
