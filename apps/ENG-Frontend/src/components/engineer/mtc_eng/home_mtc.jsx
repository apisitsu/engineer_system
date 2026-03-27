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

const ToolingInspect = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);

  const fetchECRData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${server.ECR_REQUIRE_GETLIST}`);
      setDataSource(response.data.data);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = useMemo(() => {
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
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                  <h2><AssessmentRoundedIcon sx={{ color: theme.colors.info, fontSize: 50 }} />
                    <a href="/eng/mtc_eng/tooling" style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>Tooling Inspection Report</a>
                  </h2>
                </Divider>
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
                      </Col>
                    </Row>
                  </Col>
                  <Col span={8}>
                    <Card size="small" title="Performance Overview">
                      On Time <Progress percent={dashboardStats.onTimePercent} strokeColor={theme.colors.success} size="small" />
                      Pending <Progress percent={dashboardStats.pendingPercent} strokeColor={theme.colors.warning} size="small" />
                      Delay <Progress percent={dashboardStats.delayPercent} strokeColor={theme.colors.error} size="small" />
                    </Card>
                  </Col>
                </Row>
              </div>

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

export default ToolingInspect;
