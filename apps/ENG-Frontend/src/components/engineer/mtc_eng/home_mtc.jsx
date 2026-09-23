import React, { useState, useEffect, useMemo } from "react";
import { Layout, Spin, Button, Card, Row, Col, Progress, Divider, Tag } from "antd";
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

// 'body' and 'mecha' both surface as "Mecha" (mecha = C95/C99 mechanical parts) —
// mirrors partTypeLabel in SdsCoverageDashboard.jsx, kept in sync with the backend
// cnPartType taxonomy in sdsV2ReportController.js.
const sdsPartTypeLabel = (t) => {
  const k = String(t || '').toLowerCase();
  return (k === 'body' || k === 'mecha') ? 'Mecha' : (t.charAt(0).toUpperCase() + t.slice(1));
};
const SDS_PART_TYPE_TAG_COLOR = {
  ball: 'blue', race: 'green', mecha: 'magenta', body: 'orange', sleeve: 'purple', spherical: 'red',
};

const HomeMTCEng = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toolingData, setToolingData] = useState([]);
  const [dwgData, setDwgData] = useState([]);
  const [dwgStats, setDwgStats] = useState(null);
  const [sdsKpi, setSdsKpi] = useState(null);
  const [sdsBuilding, setSdsBuilding] = useState(false);
  const [sdsPartTypes, setSdsPartTypes] = useState([]);
  const [sdsByPartType, setSdsByPartType] = useState({});

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

  // Fetched independently from the two stats above — a cold coverage build takes
  // minutes (per-CN Tooling Select fallback), so it must never hold up the rest of
  // the home page's loading spinner. A 202 means the server just kicked a background
  // build (see sdsV2ReportController); show a "building" note instead of polling —
  // the full SDS Coverage Report page already owns the poll-until-ready flow.
  const fetchSdsCoverage = async () => {
    try {
      const res = await axios.get(`${server.MTC_SDS_V2_REPORT_COVERAGE}`);
      if (res.status === 202 || res.data?.building) {
        setSdsBuilding(true);
        return;
      }
      setSdsKpi(res.data?.kpi || null);
      // scope.part_types (report config), in config order — which part classes the
      // coverage report is currently scoped to (admin-editable via the Scope modal).
      setSdsPartTypes(res.data?.partTypes || []);
      // Per-type row count (kpi.byPartType[pt].total — same primary number the full
      // report's part-type cards lead with), keyed by part_type for the scope tags.
      const byType = {};
      for (const pt of res.data?.byPartType || []) byType[pt.part_type] = pt.total;
      setSdsByPartType(byType);
      setSdsBuilding(false);
    } catch (error) {
      console.error("Fetch SDS Coverage Error:", error);
    }
  };

  const dashboardStats = useMemo(() => {
    // Tooling Inspection Stats (From Server)
    const totalToolingJobs = Number(toolingData.total) || 0;
    const toolingPending = Number(toolingData.pending) || 0;
    const toolingOnTime = Number(toolingData.onTime) || 0;
    const toolingDelay = Number(toolingData.delay) || 0;

    // DWG Request Stats (from General DWG Request - tr_request)
    const totalDwgJobs = dwgStats ? dwgStats.total : dwgData.length;
    const dwgPending = dwgStats ? (dwgStats.byStatus[WORKFLOW_STATUS.PENDING] || 0) + (dwgStats.byStatus['Draft'] || 0) : 
      dwgData.filter(item => item.status?.toLowerCase() === WORKFLOW_STATUS.PENDING.toLowerCase() || item.status?.toLowerCase() === 'draft').length;
    const dwgComplete = dwgStats ? (dwgStats.byStatus[WORKFLOW_STATUS.COMPLETED_INFORMED] || 0) : 
      dwgData.filter(item => item.status?.toLowerCase() === WORKFLOW_STATUS.COMPLETED_INFORMED.toLowerCase() || item.status?.toLowerCase() === WORKFLOW_STATUS.COMPLETE.toLowerCase()).length;
    const dwgInProgress = dwgStats ? (dwgStats.total - dwgPending - dwgComplete) : totalDwgJobs - dwgPending - dwgComplete;

    // Performance Stats for DWG
    const dwgOnTime = dwgStats?.performance?.['On time'] || 0;
    const dwgDelay = dwgStats?.performance?.['Delay'] || 0;
    const dwgTotalFinished = dwgOnTime + dwgDelay;

    return {
      totalToolingJobs,
      toolingPending,
      toolingOnTime,
      toolingDelay,
      totalDwgJobs,
      dwgPending,
      dwgComplete,
      dwgInProgress,
      dwgOnTime,
      dwgDelay,
      toolingOnTimePercent: totalToolingJobs > 0 ? Number(((toolingOnTime / totalToolingJobs) * 100).toFixed(1)) : 0,
      toolingPendingPercent: totalToolingJobs > 0 ? Number(((toolingPending / totalToolingJobs) * 100).toFixed(1)) : 0,
      toolingDelayPercent: totalToolingJobs > 0 ? Number(((toolingDelay / totalToolingJobs) * 100).toFixed(1)) : 0,
      dwgOnTimePercent: dwgTotalFinished > 0 ? Number(((dwgOnTime / dwgTotalFinished) * 100).toFixed(1)) : 0,
      dwgInProgressPercent: totalDwgJobs > 0 ? Number(((dwgInProgress / totalDwgJobs) * 100).toFixed(1)) : 0,
      dwgPendingPercent: totalDwgJobs > 0 ? Number(((dwgPending / totalDwgJobs) * 100).toFixed(1)) : 0,

      // SDS Coverage Report stats (from GET /api/sds/v2/report/coverage → kpi)
      sdsTotal: Number(sdsKpi?.total) || 0,
      sdsComplete: Number(sdsKpi?.complete) || 0,
      sdsPending: Number(sdsKpi?.pending) || 0,
      sdsMissing: Number(sdsKpi?.missing) || 0,
      sdsCompletePercent: Number(sdsKpi?.completePct) || 0,
      sdsPendingPercent: sdsKpi?.total > 0 ? Number(((sdsKpi.pending / sdsKpi.total) * 100).toFixed(1)) : 0,
      sdsMissingPercent: sdsKpi?.total > 0 ? Number(((sdsKpi.missing / sdsKpi.total) * 100).toFixed(1)) : 0,
    };
  }, [toolingData, dwgData, dwgStats, sdsKpi]);

  useEffect(() => {
    fetchMTCData();
    fetchSdsCoverage();
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
                    <Button
                      type="primary"
                      size="small"
                      style={{ marginLeft: '16px', backgroundColor: theme.colors.info, borderColor: theme.colors.info }}
                      onClick={() => navigate(MTC_PATHS.TOOLING_RESULT_DASHBOARD)}
                    >
                      Full Report
                    </Button>
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
                    <Button
                      type="primary"
                      size="small"
                      style={{ marginLeft: '16px', backgroundColor: theme.colors.success, borderColor: theme.colors.success }}
                      onClick={() => navigate(MTC_PATHS.GENERAL_DWG_REPORT)}
                    >
                      Full Report
                    </Button>
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
                  <Col span={18}>
                    <Row padding={8} gutter={[16, 16]}>
                      <Col span={6}>
                        <Card size="small" title="Total Requests"><h2 style={{ color: theme.colors.info }}>{dashboardStats.totalDwgJobs}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="On Time"><h2 style={{ color: theme.colors.success }}>{dashboardStats.dwgOnTime}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="Delay"><h2 style={{ color: theme.colors.error }}>{dashboardStats.dwgDelay}</h2></Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small" title="In Progress"><h2 style={{ color: theme.colors.primary }}>{dashboardStats.dwgInProgress}</h2></Card>
                      </Col>
                    </Row>
                    <Row padding={8} gutter={[16, 16]} style={{ marginTop: 10 }}>
                      <Col span={24}>
                        <Card size="small" title="Performance (Completed Only)">
                          <Progress percent={dashboardStats.dwgOnTimePercent} strokeColor={theme.colors.success} size="small" />
                        </Card>
                      </Col>
                    </Row>
                  </Col>
                  <Col span={6}>
                    <Card size="small" title="Status Overview">
                      On Time <Progress percent={dashboardStats.dwgOnTimePercent} strokeColor={theme.colors.success} size="small" />
                      In Progress <Progress percent={dashboardStats.dwgInProgressPercent} strokeColor={theme.colors.primary} size="small" />
                      Pending Approval <Progress percent={dashboardStats.dwgPendingPercent} strokeColor={theme.colors.warning} size="small" />
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* SDS Coverage Report */}
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                    <AssessmentRoundedIcon sx={{ color: theme.colors.secondary, fontSize: 50 }} />
                    <a href={MTC_PATHS.SDS_COVERAGE_REPORT} style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>SDS Coverage Report</a>
                    <Button
                      type="primary"
                      size="small"
                      style={{ marginLeft: '16px', backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary }}
                      onClick={() => navigate(MTC_PATHS.SDS_COVERAGE_REPORT)}
                    >
                      Full Report
                    </Button>
                  </h2>
                  {sdsPartTypes.length > 0 && (
                    <div>
                      <span style={{ color: theme.colors.textSecondary, marginRight: '8px' }}>Active scope:</span>
                      {sdsPartTypes.map((pt) => (
                        <Tag key={pt} color={SDS_PART_TYPE_TAG_COLOR[pt] || 'default'}>
                          {sdsPartTypeLabel(pt)} {Number(sdsByPartType[pt] || 0).toLocaleString()}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
                <Divider style={{ margin: '0 0 16px 0' }} />
                {sdsBuilding && !sdsKpi ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: theme.colors.textSecondary }}>
                    Building report for the first time — this can take a few minutes. Open the report page to watch progress.
                  </div>
                ) : (
                  <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                    <Col span={18}>
                      <Row padding={8} gutter={[16, 16]}>
                        <Col span={6}>
                          <Card size="small" title="Total"><h2 style={{ color: theme.colors.info }}>{dashboardStats.sdsTotal}</h2></Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small" title="Complete"><h2 style={{ color: theme.colors.success }}>{dashboardStats.sdsComplete}</h2></Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small" title="Pending"><h2 style={{ color: theme.colors.warning }}>{dashboardStats.sdsPending}</h2></Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small" title="Missing"><h2 style={{ color: theme.colors.error }}>{dashboardStats.sdsMissing}</h2></Card>
                        </Col>
                      </Row>
                      <Row padding={8} gutter={[16, 16]} style={{ marginTop: 10 }}>
                        <Col span={24}>
                          <Card size="small" title="Performance (PDF Ready & Signed)">
                            <Progress percent={dashboardStats.sdsCompletePercent} strokeColor={theme.colors.success} size="small" />
                          </Card>
                        </Col>
                      </Row>
                    </Col>
                    <Col span={6}>
                      <Card size="small" title="Status Overview">
                        Complete <Progress percent={dashboardStats.sdsCompletePercent} strokeColor={theme.colors.success} size="small" />
                        Pending <Progress percent={dashboardStats.sdsPendingPercent} strokeColor={theme.colors.warning} size="small" />
                        Missing <Progress percent={dashboardStats.sdsMissingPercent} strokeColor={theme.colors.error} size="small" />
                      </Card>
                    </Col>
                  </Row>
                )}
              </div>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default HomeMTCEng;
