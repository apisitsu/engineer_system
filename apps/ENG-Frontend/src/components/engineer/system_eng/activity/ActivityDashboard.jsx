import React, { useState, useEffect, useCallback } from 'react';
import {
    Layout, Card, Row, Col, Statistic, Table, DatePicker, Select, Spin,
    Typography, Tag, Space, Tooltip, Tabs, Badge, Empty, Progress
} from 'antd';
import {
    EyeOutlined, UserOutlined, TeamOutlined, ClockCircleOutlined,
    BarChartOutlined, AppstoreOutlined, FileSearchOutlined,
    ReloadOutlined, DesktopOutlined, GlobalOutlined
} from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ── Module name mapping for display ──────────────────────────────────────────
const MODULE_LABELS = {
    home: 'Home',
    mtc_eng: 'MTC Engineer',
    kanban: 'Kanban Board',
    process_eng: 'Process Engineer',
    newprod_eng: 'New Product Engineer',
    materials_eng: 'Materials Engineer',
    system_eng: 'System Engineer',
    overall_eng: 'Overall Engineer',
    pdf_merger_tool: 'PDF Merger',
    'html-to-pdf': 'HTML to PDF',
    dwg_check: 'DWG Check',
    fea_simulation: 'FEA Simulation',
    template_tool: 'Template Tool',
    calculators: 'Calculators',
    bushing_configurator: 'Bushing Configurator',
    '3d_pdf': '3D PDF',
    'pdf-hub': 'PDF Hub',
    user: 'User Settings',
    'user-guide': 'User Guide',
    general: 'General',
    root: 'Root',
};

function getModuleLabel(mod) {
    return MODULE_LABELS[mod] || mod?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
}

// ── Module color mapping ─────────────────────────────────────────────────────
const MODULE_COLORS = {
    mtc_eng: '#1890ff',
    kanban: '#52c41a',
    process_eng: '#fa8c16',
    newprod_eng: '#722ed1',
    system_eng: '#eb2f96',
    materials_eng: '#13c2c2',
    overall_eng: '#2f54eb',
    home: '#8c8c8c',
    'pdf-hub': '#f5222d',
};

function getModuleColor(mod) {
    return MODULE_COLORS[mod] || '#595959';
}

function ActivityDashboard() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [modules, setModules] = useState([]);
    const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 30, total: 0 });
    const [filters, setFilters] = useState({
        dateRange: [dayjs().subtract(7, 'day'), dayjs()],
        module: null,
        empno: null,
    });
    const [activeTab, setActiveTab] = useState('overview');

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // ── Fetch Stats ──────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        try {
            const [from, to] = filters.dateRange || [];
            const params = {};
            if (from) params.dateFrom = from.format('YYYY-MM-DD');
            if (to) params.dateTo = to.format('YYYY-MM-DD');

            const res = await axios.get(`${server.ACTIVITY_STATS}`, { headers, params });
            if (res.data?.result === 'true') {
                setStats(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, [filters.dateRange]);

    // ── Fetch Logs ───────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async (page = 1) => {
        try {
            const [from, to] = filters.dateRange || [];
            const params = { page, limit: logsPagination.limit };
            if (from) params.dateFrom = from.format('YYYY-MM-DD');
            if (to) params.dateTo = to.format('YYYY-MM-DD');
            if (filters.module) params.module = filters.module;
            if (filters.empno) params.empno = filters.empno;

            const res = await axios.get(`${server.ACTIVITY_LOGS}`, { headers, params });
            if (res.data?.result === 'true') {
                setLogs(res.data.data);
                setLogsPagination(prev => ({ ...prev, ...res.data.pagination }));
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }, [filters, logsPagination.limit]);

    // ── Fetch Sessions ───────────────────────────────────────────────────────
    const fetchSessions = useCallback(async () => {
        try {
            const res = await axios.get(`${server.ACTIVITY_SESSIONS}`, {
                headers,
                params: { limit: 50 }
            });
            if (res.data?.result === 'true') {
                setSessions(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    }, []);

    // ── Fetch Modules ────────────────────────────────────────────────────────
    const fetchModules = useCallback(async () => {
        try {
            const res = await axios.get(`${server.ACTIVITY_MODULES}`, { headers });
            if (res.data?.result === 'true') {
                setModules(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch modules:', err);
        }
    }, []);

    // ── Initial Load ─────────────────────────────────────────────────────────
    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            await Promise.all([fetchStats(), fetchLogs(1), fetchSessions(), fetchModules()]);
            setLoading(false);
        };
        loadAll();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Refresh on filter change ─────────────────────────────────────────────
    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchLogs(1), fetchSessions()]);
        setLoading(false);
    };

    // ── Style helpers ────────────────────────────────────────────────────────
    const cardStyle = {
        borderRadius: '12px',
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.cardBg || theme.colors.surface || '#fff',
    };

    const statCardStyle = (color) => ({
        ...cardStyle,
        background: `linear-gradient(135deg, ${color}12, ${color}06)`,
        borderColor: `${color}30`,
    });

    // ── Stat Cards ───────────────────────────────────────────────────────────
    const renderStatCards = () => {
        if (!stats) return null;

        const items = [
            {
                title: 'Total Page Views',
                value: stats.totalViews,
                icon: <EyeOutlined />,
                color: '#1890ff',
                suffix: 'views'
            },
            {
                title: 'Unique Users',
                value: stats.uniqueUsers,
                icon: <TeamOutlined />,
                color: '#52c41a',
            },
            {
                title: 'Active Sessions',
                value: stats.activeSessions,
                icon: <DesktopOutlined />,
                color: '#722ed1',
                suffix: 'online'
            },
            {
                title: "Today's Sessions",
                value: stats.todaySessions,
                icon: <ClockCircleOutlined />,
                color: '#fa8c16',
            },
        ];

        return (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {items.map((item, i) => (
                    <Col xs={12} sm={12} md={6} key={i}>
                        <Card style={statCardStyle(item.color)} bodyStyle={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '12px',
                                    background: `${item.color}20`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 22, color: item.color,
                                }}>
                                    {item.icon}
                                </div>
                                <div>
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                        {item.title}
                                    </Text>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
                                        {item.value?.toLocaleString() ?? '-'}
                                        {item.suffix && (
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginLeft: 4 }}>
                                                {item.suffix}
                                            </Text>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    };

    // ── Module Usage Chart (simple bar) ──────────────────────────────────────
    const renderModuleUsage = () => {
        if (!stats?.byModule?.length) return <Empty description="No data" />;

        const maxViews = Math.max(...stats.byModule.map(m => parseInt(m.views)));

        return (
            <div>
                {stats.byModule.map((mod, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Space>
                                <Tag color={getModuleColor(mod.module)} style={{ borderRadius: 6 }}>
                                    {getModuleLabel(mod.module)}
                                </Tag>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                                    {mod.unique_users} users
                                </Text>
                            </Space>
                            <Text strong style={{ color: theme.colors.textPrimary }}>
                                {parseInt(mod.views).toLocaleString()}
                            </Text>
                        </div>
                        <Progress
                            percent={Math.round((parseInt(mod.views) / maxViews) * 100)}
                            showInfo={false}
                            strokeColor={getModuleColor(mod.module)}
                            trailColor={`${theme.colors.border}`}
                            size="small"
                        />
                    </div>
                ))}
            </div>
        );
    };

    // ── Top Users ────────────────────────────────────────────────────────────
    const renderTopUsers = () => {
        if (!stats?.topUsers?.length) return <Empty description="No data" />;

        return (
            <div>
                {stats.topUsers.slice(0, 10).map((user, i) => (
                    <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', marginBottom: 4,
                        borderRadius: 8,
                        background: i < 3 ? `${theme.colors.primary}08` : 'transparent',
                    }}>
                        <Space>
                            <Badge count={i + 1} style={{
                                backgroundColor: i < 3 ? theme.colors.primary : theme.colors.textSecondary,
                                fontSize: 10, minWidth: 20, height: 20, lineHeight: '20px',
                            }} />
                            <div>
                                <Text strong style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
                                    {user.user_name || user.empno}
                                </Text>
                                <br />
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                                    {user.department} · {user.modules_used} modules
                                </Text>
                            </div>
                        </Space>
                        <Tag color="blue">{parseInt(user.views).toLocaleString()} views</Tag>
                    </div>
                ))}
            </div>
        );
    };

    // ── Top Pages ────────────────────────────────────────────────────────────
    const renderTopPages = () => {
        if (!stats?.topPages?.length) return <Empty description="No data" />;

        const columns = [
            {
                title: 'Path',
                dataIndex: 'path',
                key: 'path',
                ellipsis: true,
                render: (text, record) => (
                    <Tooltip title={text}>
                        <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>
                            {record.page_title || text}
                        </Text>
                        <br />
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{text}</Text>
                    </Tooltip>
                ),
            },
            {
                title: 'Views',
                dataIndex: 'views',
                key: 'views',
                width: 80,
                align: 'right',
                render: v => <Text strong>{parseInt(v).toLocaleString()}</Text>,
                sorter: (a, b) => a.views - b.views,
            },
            {
                title: 'Users',
                dataIndex: 'unique_users',
                key: 'unique_users',
                width: 70,
                align: 'right',
                render: v => <Tag color="green">{v}</Tag>,
            },
        ];

        return (
            <Table
                dataSource={stats.topPages}
                columns={columns}
                rowKey="path"
                size="small"
                pagination={false}
                style={{ marginTop: 8 }}
            />
        );
    };

    // ── Daily Trend (simple text-based) ──────────────────────────────────────
    const renderDailyTrend = () => {
        if (!stats?.byDay?.length) return <Empty description="No data" />;

        const maxViews = Math.max(...stats.byDay.map(d => parseInt(d.views)));

        return (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {stats.byDay.map((day, i) => {
                    const views = parseInt(day.views);
                    const pct = maxViews ? Math.round((views / maxViews) * 100) : 0;
                    return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <Text style={{ width: 80, fontSize: 12, color: theme.colors.textSecondary, flexShrink: 0 }}>
                                {dayjs(day.date).format('MM/DD (ddd)')}
                            </Text>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    height: 20, borderRadius: 4,
                                    background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primary}80)`,
                                    width: `${pct}%`,
                                    minWidth: pct > 0 ? 4 : 0,
                                    transition: 'width 0.3s ease',
                                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                    paddingRight: 6,
                                }}>
                                    {pct > 25 && (
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>
                                            {views}
                                        </Text>
                                    )}
                                </div>
                            </div>
                            {pct <= 25 && (
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, width: 40, textAlign: 'right' }}>
                                    {views}
                                </Text>
                            )}
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, width: 50, textAlign: 'right' }}>
                                {day.unique_users} users
                            </Text>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ── Activity Logs Table ──────────────────────────────────────────────────
    const logColumns = [
        {
            title: 'Time',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: t => (
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                    {dayjs(t).format('MM/DD HH:mm:ss')}
                </Text>
            ),
        },
        {
            title: 'User',
            dataIndex: 'user_name',
            key: 'user_name',
            width: 120,
            render: (name, record) => (
                <Tooltip title={`Employee: ${record.empno}`}>
                    <Text style={{ fontSize: 12 }}>{name || record.empno}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department',
            width: 80,
            render: d => d ? <Tag>{d}</Tag> : '-',
        },
        {
            title: 'Module',
            dataIndex: 'module',
            key: 'module',
            width: 120,
            render: m => <Tag color={getModuleColor(m)} style={{ borderRadius: 6 }}>{getModuleLabel(m)}</Tag>,
        },
        {
            title: 'Path',
            dataIndex: 'path',
            key: 'path',
            ellipsis: true,
            render: (text, record) => (
                <Tooltip title={text}>
                    <Text style={{ fontSize: 12 }}>{record.page_title || text}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'IP',
            dataIndex: 'ip_address',
            key: 'ip_address',
            width: 120,
            render: ip => <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{ip || '-'}</Text>,
        },
    ];

    // ── Sessions Table ───────────────────────────────────────────────────────
    const sessionColumns = [
        {
            title: 'User',
            dataIndex: 'user_name',
            key: 'user_name',
            width: 120,
            render: (name, record) => (
                <Text style={{ fontSize: 12 }}>{name || record.empno}</Text>
            ),
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department',
            width: 80,
            render: d => d ? <Tag>{d}</Tag> : '-',
        },
        {
            title: 'Login',
            dataIndex: 'login_at',
            key: 'login_at',
            width: 150,
            render: t => dayjs(t).format('MM/DD HH:mm'),
        },
        {
            title: 'Last Active',
            dataIndex: 'last_active_at',
            key: 'last_active_at',
            width: 150,
            render: t => t ? (
                <Tooltip title={dayjs(t).format('YYYY-MM-DD HH:mm:ss')}>
                    {dayjs(t).fromNow ? dayjs(t).format('MM/DD HH:mm') : dayjs(t).format('MM/DD HH:mm')}
                </Tooltip>
            ) : '-',
        },
        {
            title: 'Status',
            key: 'status',
            width: 100,
            render: (_, record) => {
                if (record.logout_at) {
                    return <Tag color="default">Ended</Tag>;
                }
                const lastActive = dayjs(record.last_active_at);
                const minutesAgo = dayjs().diff(lastActive, 'minute');
                if (minutesAgo <= 30) {
                    return <Tag color="green">● Active</Tag>;
                }
                return <Tag color="orange">Idle</Tag>;
            },
        },
        {
            title: 'Pages',
            dataIndex: 'total_pages_visited',
            key: 'total_pages_visited',
            width: 70,
            align: 'right',
            render: v => <Text strong>{v}</Text>,
        },
        {
            title: 'IP',
            dataIndex: 'ip_address',
            key: 'ip_address',
            width: 120,
            render: ip => <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{ip || '-'}</Text>,
        },
    ];

    // ── Tab Items ────────────────────────────────────────────────────────────
    const tabItems = [
        {
            key: 'overview',
            label: (
                <span><BarChartOutlined /> Overview</span>
            ),
            children: (
                <>
                    {renderStatCards()}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                            <Card title="📊 Module Usage" style={cardStyle} bodyStyle={{ padding: '16px', maxHeight: 400, overflowY: 'auto' }}>
                                {renderModuleUsage()}
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card title="👥 Top Users" style={cardStyle} bodyStyle={{ padding: '16px', maxHeight: 400, overflowY: 'auto' }}>
                                {renderTopUsers()}
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card title="📈 Daily Trend" style={cardStyle} bodyStyle={{ padding: '16px' }}>
                                {renderDailyTrend()}
                            </Card>
                        </Col>
                        <Col xs={24} md={12}>
                            <Card title="🔥 Top Pages" style={cardStyle} bodyStyle={{ padding: '8px 0' }}>
                                {renderTopPages()}
                            </Card>
                        </Col>
                    </Row>
                </>
            ),
        },
        {
            key: 'logs',
            label: (
                <span><FileSearchOutlined /> Activity Logs</span>
            ),
            children: (
                <Card style={cardStyle} bodyStyle={{ padding: '16px' }}>
                    <Space style={{ marginBottom: 16 }} wrap>
                        <Select
                            placeholder="Filter by module"
                            allowClear
                            style={{ width: 180 }}
                            value={filters.module}
                            onChange={v => setFilters(f => ({ ...f, module: v }))}
                            options={modules.map(m => ({
                                label: getModuleLabel(m.module),
                                value: m.module,
                            }))}
                        />
                        <Select
                            placeholder="Filter by user"
                            allowClear
                            showSearch
                            style={{ width: 180 }}
                            value={filters.empno}
                            onChange={v => setFilters(f => ({ ...f, empno: v }))}
                            options={stats?.topUsers?.map(u => ({
                                label: `${u.user_name || u.empno} (${u.empno})`,
                                value: u.empno,
                            })) || []}
                        />
                        <Tooltip title="Refresh">
                            <ReloadOutlined
                                style={{ fontSize: 18, cursor: 'pointer', color: theme.colors.primary }}
                                onClick={() => fetchLogs(1)}
                            />
                        </Tooltip>
                    </Space>
                    <Table
                        dataSource={logs}
                        columns={logColumns}
                        rowKey="id"
                        size="small"
                        loading={loading}
                        pagination={{
                            current: logsPagination.page,
                            pageSize: logsPagination.limit,
                            total: logsPagination.total,
                            showSizeChanger: true,
                            showTotal: (total) => `${total} records`,
                            onChange: (page, pageSize) => {
                                setLogsPagination(p => ({ ...p, limit: pageSize }));
                                fetchLogs(page);
                            },
                        }}
                    />
                </Card>
            ),
        },
        {
            key: 'sessions',
            label: (
                <span>
                    <DesktopOutlined /> Sessions
                    {stats?.activeSessions > 0 && (
                        <Badge count={stats.activeSessions} style={{ marginLeft: 8 }} size="small" />
                    )}
                </span>
            ),
            children: (
                <Card style={cardStyle} bodyStyle={{ padding: '16px' }}>
                    <Space style={{ marginBottom: 16 }}>
                        <Tooltip title="Refresh">
                            <ReloadOutlined
                                style={{ fontSize: 18, cursor: 'pointer', color: theme.colors.primary }}
                                onClick={fetchSessions}
                            />
                        </Tooltip>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                            Shows latest 50 sessions
                        </Text>
                    </Space>
                    <Table
                        dataSource={sessions}
                        columns={sessionColumns}
                        rowKey="id"
                        size="small"
                        loading={loading}
                        pagination={false}
                    />
                </Card>
            ),
        },
    ];

    return (
        <Layout style={{ minHeight: 100, display: 'flex' }}>
            <MenuTemplate type="System" defaultSelectedKeys="5" />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Spin spinning={loading} tip="Loading...">
                    <ScrollbarStyle primary={theme.colors.primary} />
                    <Content
                        className="kb-vscroll"
                        style={{
                            height: 'calc(100vh - 64px)',
                            overflowY: 'auto',
                            padding: '24px',
                        }}
                    >
                        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', flexWrap: 'wrap', gap: 16,
                                marginBottom: 24,
                            }}>
                                <div>
                                    <Title level={2} style={{ color: theme.colors.textPrimary, marginBottom: 4 }}>
                                        <GlobalOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                                        Activity Dashboard
                                    </Title>
                                    <Text style={{ color: theme.colors.textSecondary }}>
                                        ดูสถิติการเข้าใช้งานระบบ · กิจกรรมของผู้ใช้ · Session ที่ใช้งานอยู่
                                    </Text>
                                </div>

                                <Space>
                                    <RangePicker
                                        value={filters.dateRange}
                                        onChange={(dates) => setFilters(f => ({ ...f, dateRange: dates }))}
                                        style={{ borderRadius: 8 }}
                                    />
                                    <Tooltip title="Refresh All">
                                        <ReloadOutlined
                                            style={{
                                                fontSize: 20, cursor: 'pointer',
                                                color: theme.colors.primary,
                                                padding: '8px', borderRadius: '8px',
                                                border: `1px solid ${theme.colors.border}`,
                                            }}
                                            spin={loading}
                                            onClick={handleRefresh}
                                        />
                                    </Tooltip>
                                </Space>
                            </div>

                            {/* Tabs */}
                            <Tabs
                                activeKey={activeTab}
                                onChange={setActiveTab}
                                items={tabItems}
                                style={{ marginBottom: 24 }}
                            />
                        </div>
                    </Content>
                </Spin>
            </Layout>
        </Layout>
    );
}

export default ActivityDashboard;
