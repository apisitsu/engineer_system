import React, { useEffect, useMemo } from 'react';
import { Row, Col, Card, Select, Spin, Typography, Progress, Empty } from 'antd';
import {
    FileTextOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    ThunderboltOutlined,
    RiseOutlined,
    TagOutlined,
    BarChartOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../theme';
import useEngRecordStore from '../../../../stores/engRecordStore';

const { Title, Text } = Typography;

// ─── Color palette for case types ──────────────────────────

const CASE_COLORS = {
    request_drawing: '#1677ff',
    judgment_spec: '#722ed1',
    change_dwg: '#fa8c16',
    dwg_problem: '#f5222d',
    special: '#13c2c2',
};

const CASE_LABELS = {
    request_drawing: 'Request Drawing',
    judgment_spec: 'Judgment Spec',
    change_dwg: 'Change DWG/Traveler',
    dwg_problem: 'DWG/Traveler Problem',
    special: 'Special',
};

function EngRecordDashboard() {
    const { theme } = useTheme();
    const {
        dashboard, dashboardYear, dashboardLoading,
        fetchDashboard, setDashboardYear,
    } = useEngRecordStore();

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const handleYearChange = (year) => {
        setDashboardYear(year);
        fetchDashboard(year);
    };

    const yearOptions = useMemo(() => {
        const years = dashboard?.available_years || [];
        if (years.length === 0) {
            const cur = new Date().getFullYear();
            return [cur, cur - 1].map(y => ({ value: y, label: String(y) }));
        }
        return years.map(y => ({ value: y, label: String(y) }));
    }, [dashboard]);

    const summary = dashboard?.summary || {};
    const monthly = dashboard?.monthly || [];

    // ─── KPI Cards Data ────────────────────────────────────

    const kpiCards = [
        {
            title: 'Total Requests',
            value: summary.total_records || 0,
            icon: <FileTextOutlined />,
            gradient: 'linear-gradient(135deg, #1677ff, #4096ff)',
            textColor: '#fff',
        },
        {
            title: 'Currently Waiting',
            value: summary.waiting_count || 0,
            icon: <ClockCircleOutlined />,
            gradient: 'linear-gradient(135deg, #fa8c16, #ffc53d)',
            textColor: '#fff',
        },
        {
            title: 'Finished Ratio',
            value: `${summary.finished_ratio || 0}%`,
            icon: <CheckCircleOutlined />,
            gradient: 'linear-gradient(135deg, #52c41a, #95de64)',
            textColor: '#fff',
            extra: summary.total_records > 0 ? (
                <Progress
                    percent={summary.finished_ratio || 0}
                    showInfo={false}
                    strokeColor="#fff"
                    trailColor="rgba(255,255,255,0.3)"
                    size="small"
                    style={{ marginTop: 8 }}
                />
            ) : null,
        },
        {
            title: 'Pass Due Items',
            value: summary.already_pass_due || 0,
            icon: <WarningOutlined />,
            gradient: summary.already_pass_due > 0
                ? 'linear-gradient(135deg, #f5222d, #ff7875)'
                : 'linear-gradient(135deg, #8c8c8c, #bfbfbf)',
            textColor: '#fff',
        },
        {
            title: 'Avg. Resolution',
            value: summary.avg_finish_days ? `${summary.avg_finish_days}d` : '—',
            icon: <ThunderboltOutlined />,
            gradient: 'linear-gradient(135deg, #722ed1, #b37feb)',
            textColor: '#fff',
        },
        {
            title: 'Max Wait Time',
            value: summary.max_waiting_days ? `${summary.max_waiting_days}d` : '—',
            icon: <RiseOutlined />,
            gradient: summary.max_waiting_days > 30
                ? 'linear-gradient(135deg, #cf1322, #ff4d4f)'
                : 'linear-gradient(135deg, #13c2c2, #5cdbd3)',
            textColor: '#fff',
        },
        {
            title: 'Blue Tag (≤1 Day)',
            value: summary.blue_tag_0_1_day || 0,
            icon: <TagOutlined />,
            gradient: 'linear-gradient(135deg, #2f54eb, #597ef7)',
            textColor: '#fff',
        },
        {
            title: 'On Due Waiting',
            value: summary.waiting_on_due || 0,
            icon: <BarChartOutlined />,
            gradient: 'linear-gradient(135deg, #eb2f96, #ff85c0)',
            textColor: '#fff',
        },
    ];

    return (
        <Spin spinning={dashboardLoading}>
            {/* ─── Header ───────────────────────────────────── */}
            <div className="engr-page-header">
                <div>
                    <Title level={3} style={{ color: theme.colors.textPrimary, margin: 0 }}>
                        Rod End Request Record
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary }}>
                        Engineering record dashboard — {dashboardYear}
                    </Text>
                </div>
                <div className="engr-page-header-actions">
                    <Select
                        className="engr-year-select"
                        value={dashboardYear}
                        onChange={handleYearChange}
                        options={yearOptions}
                        style={{ width: 100 }}
                    />
                </div>
            </div>

            {/* ─── KPI Cards ────────────────────────────────── */}
            <Row gutter={[16, 16]}>
                {kpiCards.map((card, idx) => (
                    <Col xs={12} sm={12} md={6} lg={6} key={idx}>
                        <Card
                            className="engr-dashboard-card"
                            style={{
                                background: card.gradient,
                                border: 'none',
                            }}
                            styles={{ body: { padding: '20px' } }}
                        >
                            <div className="engr-card-icon" style={{ color: card.textColor }}>
                                {card.icon}
                            </div>
                            <div className="engr-card-value" style={{ color: card.textColor }}>
                                {card.value}
                            </div>
                            <div className="engr-card-label" style={{ color: card.textColor }}>
                                {card.title}
                            </div>
                            {card.extra}
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* ─── Case Breakdown ───────────────────────────── */}
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} md={12}>
                    <Card
                        className="engr-chart-container"
                        style={{
                            background: theme.colors.card,
                            border: `1px solid ${theme.colors.border}`,
                        }}
                    >
                        <Title level={5} style={{ color: theme.colors.textPrimary, marginBottom: 20 }}>
                            Case Type Breakdown
                        </Title>
                        {summary.case_breakdown ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {Object.entries(summary.case_breakdown).map(([key, count]) => {
                                    const total = summary.total_records || 1;
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={key}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: 4,
                                            }}>
                                                <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
                                                    {CASE_LABELS[key]}
                                                </Text>
                                                <Text strong style={{ color: CASE_COLORS[key] }}>
                                                    {count} ({pct}%)
                                                </Text>
                                            </div>
                                            <Progress
                                                percent={pct}
                                                showInfo={false}
                                                strokeColor={CASE_COLORS[key]}
                                                trailColor={theme.colors.border}
                                                size="small"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Empty description="No data" />
                        )}
                    </Card>
                </Col>

                {/* ─── Monthly Trend ────────────────────────── */}
                <Col xs={24} md={12}>
                    <Card
                        className="engr-chart-container"
                        style={{
                            background: theme.colors.card,
                            border: `1px solid ${theme.colors.border}`,
                        }}
                    >
                        <Title level={5} style={{ color: theme.colors.textPrimary, marginBottom: 20 }}>
                            Monthly Trend
                        </Title>
                        {monthly.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {monthly.map((m) => {
                                    const maxTotal = Math.max(...monthly.map(x => parseInt(x.total) || 0), 1);
                                    const barWidth = Math.max(((parseInt(m.total) || 0) / maxTotal) * 100, 2);
                                    return (
                                        <div key={m.month_num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Text style={{
                                                color: theme.colors.textSecondary,
                                                fontSize: 12,
                                                width: 30,
                                                textAlign: 'right',
                                            }}>
                                                {m.month_name}
                                            </Text>
                                            <div style={{
                                                flex: 1,
                                                background: theme.colors.border,
                                                borderRadius: 4,
                                                height: 24,
                                                overflow: 'hidden',
                                                position: 'relative',
                                            }}>
                                                <div style={{
                                                    width: `${barWidth}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg, #1677ff, #4096ff)',
                                                    borderRadius: 4,
                                                    transition: 'width 0.6s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    paddingLeft: 8,
                                                }}>
                                                    {parseInt(m.total) > 0 && (
                                                        <Text style={{
                                                            color: '#fff',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}>
                                                            {m.total}
                                                        </Text>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ width: 60, textAlign: 'right' }}>
                                                <Text style={{
                                                    color: theme.colors.textSecondary,
                                                    fontSize: 11,
                                                }}>
                                                    {m.finished}/{m.total}
                                                </Text>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Empty description="No data for this year" />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* ─── Monthly Detail Table ─────────────────────── */}
            <Row style={{ marginTop: 24 }}>
                <Col span={24}>
                    <Card
                        className="engr-chart-container"
                        style={{
                            background: theme.colors.card,
                            border: `1px solid ${theme.colors.border}`,
                        }}
                    >
                        <Title level={5} style={{ color: theme.colors.textPrimary, marginBottom: 16 }}>
                            Monthly Summary
                        </Title>
                        {monthly.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 12,
                                }}>
                                    <thead>
                                        <tr style={{ borderBottom: `2px solid ${theme.colors.border}` }}>
                                            {['Month', 'Q\'ty (Lot)', 'Req DWG', 'Judge Spec', 'Change', 'Problem', 'Special', 'Waiting', 'Finished', 'Wait On Due', 'Wait Pass Due', 'Alr Pass Due', 'Fin On Due', 'Avg Fin (d)', 'Max Fin (d)', 'Max Wait (d)', 'Blue 0-1d', 'Blue <1wk'].map(h => (
                                                <th key={h} style={{
                                                    padding: '8px 4px',
                                                    textAlign: h === 'Month' ? 'left' : 'center',
                                                    color: theme.colors.textSecondary,
                                                    fontWeight: 600,
                                                    fontSize: 10,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.3,
                                                }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthly.map(m => (
                                            <tr key={m.month_num} style={{
                                                borderBottom: `1px solid ${theme.colors.border}`,
                                            }}>
                                                <td style={{ padding: '6px 4px', color: theme.colors.textPrimary, fontWeight: 600 }}>{m.month_name}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textPrimary, fontWeight: 700 }}>{m.total}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.request_drawing }}>{m.request_drawing || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.judgment_spec }}>{m.judgment_spec || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.change_dwg }}>{m.change_dwg || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.dwg_problem }}>{m.dwg_problem || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.special }}>{m.special || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#fa8c16' }}>{m.waiting || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#52c41a' }}>{m.finished || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.waiting_on_due || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#f5222d' }}>{m.waiting_pass_due || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#f5222d' }}>{m.already_pass_due || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#52c41a' }}>{m.finish_on_due || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.avg_finish_days ?? '—'}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.max_finish_days ?? '—'}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.max_waiting_days ?? '—'}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#1677ff' }}>{m.blue_tag_0_1_day || 0}</td>
                                                <td style={{ padding: '6px 4px', textAlign: 'center', color: '#1677ff' }}>{m.blue_tag_lt_1_week || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty description="No data" />
                        )}
                    </Card>
                </Col>
            </Row>
        </Spin>
    );
}

export default EngRecordDashboard;
