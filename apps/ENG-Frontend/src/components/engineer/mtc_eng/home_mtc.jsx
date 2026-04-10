import React, { useState, useEffect, useMemo } from "react";
import { Layout, Spin, Button, Card, Row, Col, Progress, Divider } from "antd";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { server } from '../../../constance/constance';
import { MTC_PATHS, WORKFLOW_STATUS } from "../../../constance/mtc_constance";
import { useTheme } from '../../../theme';
import ScrollbarStyle from '../../common/scrollbar';

const { Content } = Layout;

const HomeMTCEng = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toolingData, setToolingData] = useState([]);
  const [dwgData, setDwgData] = useState([]);
  const [dwgStats, setDwgStats] = useState(null);

  const fetchMTCData = async () => {
    setLoading(true);
    try {
      const currentMonth = moment().format('MM-YYYY');
      const [dwgRes, dwgStatsRes, toolingStatsRes] = await Promise.all([
        axios.get(`${server.MTC_TOOL_REQUESTS}?limit=500`),
        axios.get(`${server.MTC_TOOL_REQUEST_DASHBOARD}`),
        axios.get(`${server.TOOLING_DASHBOARD_STATS_GET}?month=${currentMonth}`)
      ]);
      setToolingData(toolingStatsRes.data || {});
      setDwgData(dwgRes.data.data || []);
      setDwgStats(dwgStatsRes.data.data || null);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = useMemo(() => {
    // Tooling Inspection Stats (From Server)
    const totalToolingJobs = Number(toolingData.total) || 0;
    const toolingPending = Number(toolingData.pending) || 0;
    const toolingOnTime = Number(toolingData.onTime) || 0;
    const toolingDelay = Number(toolingData.delay) || 0;

    // DWG Request Stats (from General DWG Request - tr_request)
    // Use dashboard stats from API if available, otherwise calculate from dwgData
    const totalDwgJobs = dwgStats ? dwgStats.total : dwgData.length;
    const dwgPending = dwgStats ? (dwgStats.byStatus[WORKFLOW_STATUS.PENDING] || 0) + (dwgStats.byStatus['Draft'] || 0) : 
      dwgData.filter(item => item.status?.toLowerCase() === WORKFLOW_STATUS.PENDING.toLowerCase() || item.status?.toLowerCase() === 'draft').length;
    const dwgComplete = dwgStats ? (dwgStats.byStatus[WORKFLOW_STATUS.COMPLETED_INFORMED] || 0) : 
      dwgData.filter(item => item.status?.toLowerCase() === WORKFLOW_STATUS.COMPLETED_INFORMED.toLowerCase() || item.status?.toLowerCase() === WORKFLOW_STATUS.COMPLETE.toLowerCase()).length;
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
              {/* Tooling Inspection Report */}
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                    <AssessmentRoundedIcon sx={{ color: theme.colors.info, fontSize: 50 }} />
                    <a href={MTC_PATHS.TOOLING_INSPECT} style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>Tooling Inspection Report</a>
                  </h2>
                </div>
                <Divider style={{ margin: '0 0 16px 0' }} />
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={18}>
                    <Row padding={8} gutter={[16, 16]}>
                      <Col span={6}>
                        <Card size="small" title="Total Jobs"><h2 style={{ color: theme.colors.info }}>{dashboardStats.totalToolingJobs}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="On Time"><h2 style={{ color: theme.colors.success }}>{dashboardStats.toolingOnTime}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="Delay"><h2 style={{ color: theme.colors.error }}>{dashboardStats.toolingDelay}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="Pending"><h2 style={{ color: theme.colors.warning }}>{dashboardStats.toolingPending}</h2></Card>
                      </Col>
                    </Row>
                    <Row padding={8} gutter={[16, 16]} style={{ marginTop: 10 }}>
                      <Col span={24}>
                        <Card size="small" title="Performance">
                          <Progress percent={dashboardStats.toolingOnTimePercent} strokeColor={theme.colors.success} size="small" />
                        </Card>
                      </Col>
                    </Row>
                  </Col>
                  <Col span={6}>
                    <Card size="small" title="Status Overview">
                      On Time <Progress percent={dashboardStats.toolingOnTimePercent} strokeColor={theme.colors.success} size="small" />
                      Pending <Progress percent={dashboardStats.toolingPendingPercent} strokeColor={theme.colors.warning} size="small" />
                      Delay <Progress percent={dashboardStats.toolingDelayPercent} strokeColor={theme.colors.error} size="small" />
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* General DWG Request */}
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                    <AssessmentRoundedIcon sx={{ color: theme.colors.success, fontSize: 50 }} />
                    <a href={MTC_PATHS.TOOL_REQUEST} style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>General DWG Request</a>
                  </h2>
                  <Button 
                    type="primary" 
                    size="middle"
                    onClick={() => navigate(`${MTC_PATHS.TOOL_REQUEST}?action=create`)}
                  >
                    + Create New Request
                  </Button>
                </div>
                <Divider style={{ margin: '0 0 16px 0' }} />
                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col span={24}>
                    <Row padding={8} gutter={[16, 16]}>
                      <Col span={6}>
                        <Card size="small" title="Total Requests"><h2 style={{ color: theme.colors.info }}>{dashboardStats.totalDwgJobs}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="Complete"><h2 style={{ color: theme.colors.success }}>{dashboardStats.dwgComplete}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="In Progress"><h2 style={{ color: theme.colors.primary }}>{dashboardStats.dwgInProgress}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="Pending Approval"><h2 style={{ color: theme.colors.warning }}>{dashboardStats.dwgPending}</h2></Card>
                      </Col>
                    </Row>
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

export default HomeMTCEng;
