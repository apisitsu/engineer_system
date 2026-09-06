import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Layout, Card, Row, Col, Table, DatePicker, Select, Spin,
    Typography, Tag, Space, Tooltip, Tabs, Badge, Empty, Progress, Button,
    Input, Avatar, Drawer, Timeline, Switch, Radio
} from 'antd';
import {
    EyeOutlined, TeamOutlined, ClockCircleOutlined,
    BarChartOutlined, FileSearchOutlined,
    ReloadOutlined, DesktopOutlined, GlobalOutlined,
    SearchOutlined, CheckCircleFilled,
    ExclamationCircleFilled, MinusCircleFilled,
    AppstoreOutlined, UnorderedListOutlined,
    CompassOutlined, HistoryOutlined, LaptopOutlined,
    SyncOutlined
} from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
    return MODULE_LABELS[mod] || mod?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'General';
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

// ── Avatar Color Generator ───────────────────────────────────────────────────
const stringToColor = (str) => {
    if (!str) return '#1890ff';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
        '#13c2c2', '#2f54eb', '#faad14', '#108ee9', '#00b96b'
    ];
    return colors[Math.abs(hash) % colors.length];
};

function ActivityDashboard() {
    const { theme } = useTheme();
    const isDark = theme.mode === 'dark';

    // State
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('presence'); // presence, overview, logs, raw_sessions
    
    // Live Presence Data
    const [presenceUsers, setPresenceUsers] = useState([]);
    const [presenceSummary, setPresenceSummary] = useState({
        totalUsers: 0,
        onlineCount: 0,
        idleCount: 0,
        offlineCount: 0,
        totalActiveTabs: 0
    });
    const [presenceFilter, setPresenceFilter] = useState({
        search: '',
        status: 'ALL', // ALL, online, idle, offline
        department: 'ALL',
        viewMode: 'grid' // grid, table
    });

    // Auto-Refresh
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshCountdown, setRefreshCountdown] = useState(30);
    const timerRef = useRef(null);

    // Selected User Drawer (Timeline & Profile)
    const [selectedUser, setSelectedUser] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [userTimelineData, setUserTimelineData] = useState(null);

    // Stats & Overview Data
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

    const [showAllModules, setShowAllModules] = useState(false);
    const [showAllUsers, setShowAllUsers] = useState(false);
    const [showAllPages, setShowAllPages] = useState(false);

    const token = localStorage.getItem('token');
    const headers = React.useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    // ── Fetch Users Presence ──────────────────────────────────────────────────
    const fetchUsersPresence = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const params = {};
            if (presenceFilter.department && presenceFilter.department !== 'ALL') {
                params.department = presenceFilter.department;
            }
            if (presenceFilter.status && presenceFilter.status !== 'ALL') {
                params.status = presenceFilter.status;
            }
            if (presenceFilter.search && presenceFilter.search.trim()) {
                params.search = presenceFilter.search.trim();
            }

            const res = await axios.get(
                server.ACTIVITY_USERS_PRESENCE || `${server.API_URL}api/activity/users-presence`,
                { headers, params }
            );

            if (res.data?.result === 'true') {
                setPresenceUsers(res.data.data || []);
                if (res.data.summary) {
                    setPresenceSummary(res.data.summary);
                }
            }
        } catch (err) {
            console.error('Failed to fetch user presence:', err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [headers, presenceFilter.department, presenceFilter.status, presenceFilter.search]);

    // ── Fetch User Timeline ───────────────────────────────────────────────────
    const fetchUserTimeline = useCallback(async (empno) => {
        setDrawerLoading(true);
        try {
            const res = await axios.get(
                server.ACTIVITY_USER_TIMELINE || `${server.API_URL}api/activity/user-timeline`,
                { headers, params: { empno } }
            );
            if (res.data?.result === 'true') {
                setUserTimelineData(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch user timeline:', err);
        } finally {
            setDrawerLoading(false);
        }
    }, [headers]);

    const handleOpenUserDrawer = (user) => {
        setSelectedUser(user);
        setDrawerOpen(true);
        fetchUserTimeline(user.empno);
    };

    // ── Fetch Stats ──────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        try {
            const [from, to] = filters.dateRange || [];
            const params = {};
            if (from) params.dateFrom = from.format('YYYY-MM-DD');
            if (to) params.dateTo = to.format('YYYY-MM-DD');

            const res = await axios.get(server.ACTIVITY_STATS, { headers, params });
            if (res.data?.result === 'true') {
                setStats(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }, [filters.dateRange, headers]);

    // ── Fetch Logs ───────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async (page = 1) => {
        try {
            const [from, to] = filters.dateRange || [];
            const params = { page, limit: logsPagination.limit };
            if (from) params.dateFrom = from.format('YYYY-MM-DD');
            if (to) params.dateTo = to.format('YYYY-MM-DD');
            if (filters.module) params.module = filters.module;
            if (filters.empno) params.empno = filters.empno;

            const res = await axios.get(server.ACTIVITY_LOGS, { headers, params });
            if (res.data?.result === 'true') {
                setLogs(res.data.data);
                setLogsPagination(prev => ({ ...prev, ...res.data.pagination }));
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }, [filters, headers, logsPagination.limit]);

    // ── Fetch Sessions ───────────────────────────────────────────────────────
    const fetchSessions = useCallback(async () => {
        try {
            const res = await axios.get(server.ACTIVITY_SESSIONS, {
                headers,
                params: { limit: 50 }
            });
            if (res.data?.result === 'true') {
                setSessions(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    }, [headers]);

    // ── Fetch Modules ────────────────────────────────────────────────────────
    const fetchModules = useCallback(async () => {
        try {
            const res = await axios.get(server.ACTIVITY_MODULES, { headers });
            if (res.data?.result === 'true') {
                setModules(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch modules:', err);
        }
    }, [headers]);

    // ── Initial Load ─────────────────────────────────────────────────────────
    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            await Promise.all([
                fetchUsersPresence(),
                fetchStats(),
                fetchLogs(1),
                fetchSessions(),
                fetchModules()
            ]);
            setLoading(false);
        };
        loadAll();
    }, [fetchUsersPresence, fetchStats, fetchLogs, fetchSessions, fetchModules]);

    // ── Auto-Refresh Timer (every 30 seconds for live presence) ──────────────
    useEffect(() => {
        if (!autoRefresh) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            setRefreshCountdown(prev => {
                if (prev <= 1) {
                    fetchUsersPresence(true);
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [autoRefresh, fetchUsersPresence]);

    // Manual Refresh All
    const handleRefreshAll = async () => {
        setLoading(true);
        await Promise.all([
            fetchUsersPresence(),
            fetchStats(),
            fetchLogs(1),
            fetchSessions()
        ]);
        setRefreshCountdown(30);
        setLoading(false);
    };

    // ── Dynamic Styles ───────────────────────────────────────────────────────
    const cardBaseStyle = {
        borderRadius: '14px',
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.cardBg || theme.colors.surface || '#fff',
        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.04)',
    };

    const statCardStyle = (color, bgGradient) => ({
        ...cardBaseStyle,
        background: bgGradient || `linear-gradient(135deg, ${color}12, ${color}05)`,
        borderColor: `${color}35`,
        transition: 'all 0.3s ease',
    });

    // ── Status Badges & Tags ─────────────────────────────────────────────────
    const renderStatusBadge = (status, activeTabs = 0) => {
        if (status === 'online') {
            return (
                <Tag color="success" style={{
                    borderRadius: '20px',
                    padding: '2px 10px',
                    fontWeight: 600,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#52c41a',
                        display: 'inline-block',
                        boxShadow: '0 0 8px #52c41a'
                    }} />
                    Online {activeTabs > 1 && `(${activeTabs} แท็บ)`}
                </Tag>
            );
        }
        if (status === 'idle') {
            return (
                <Tag color="warning" style={{
                    borderRadius: '20px',
                    padding: '2px 10px',
                    fontWeight: 600,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#faad14',
                        display: 'inline-block'
                    }} />
                    Idle (พักหน้าจอ)
                </Tag>
            );
        }
        return (
            <Tag style={{
                borderRadius: '20px',
                padding: '2px 10px',
                fontWeight: 500,
                fontSize: 12,
                color: theme.colors.textSecondary,
                backgroundColor: isDark ? '#262626' : '#f5f5f5',
                borderColor: theme.colors.border
            }}>
                Offline
            </Tag>
        );
    };

    // ── Render Presence KPI Cards ────────────────────────────────────────────
    const renderPresenceKPIs = () => {
        const kpis = [
            {
                title: '🟢 Online ตอนนี้',
                value: presenceSummary.onlineCount,
                subtitle: 'กำลังใช้งานระบบอยู่จริง',
                color: '#52c41a',
                icon: <CheckCircleFilled />
            },
            {
                title: '🟡 พักหน้าจอ (Idle)',
                value: presenceSummary.idleCount,
                subtitle: 'ไม่มีกิจกรรม 15–60 นาที',
                color: '#faad14',
                icon: <ExclamationCircleFilled />
            },
            {
                title: '⚪ ออฟไลน์ (Offline)',
                value: presenceSummary.offlineCount,
                subtitle: 'ออกจากระบบ / ไม่ได้เปิด',
                color: '#8c8c8c',
                icon: <MinusCircleFilled />
            },
            {
                title: '👥 ผู้ใช้ทั้งหมดในระบบ',
                value: presenceSummary.totalUsers,
                subtitle: `เปิดรวม ${presenceSummary.totalActiveTabs} แท็บทั่วระบบ`,
                color: theme.colors.primary,
                icon: <TeamOutlined />
            },
        ];

        return (
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                {kpis.map((k, idx) => (
                    <Col xs={12} sm={12} md={6} key={idx}>
                        <Card
                            style={statCardStyle(k.color)}
                            bodyStyle={{ padding: '16px 20px' }}
                            hoverable
                            onClick={() => {
                                if (idx === 0) setPresenceFilter(f => ({ ...f, status: 'online' }));
                                else if (idx === 1) setPresenceFilter(f => ({ ...f, status: 'idle' }));
                                else if (idx === 2) setPresenceFilter(f => ({ ...f, status: 'offline' }));
                                else setPresenceFilter(f => ({ ...f, status: 'ALL' }));
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: '12px',
                                    backgroundColor: `${k.color}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 22,
                                    color: k.color
                                }}>
                                    {k.icon}
                                </div>
                                <div>
                                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, fontWeight: 500 }}>
                                        {k.title}
                                    </Text>
                                    <div style={{ fontSize: 26, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
                                        {k.value}
                                    </div>
                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                        {k.subtitle}
                                    </Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    };

    // ── Render Presence User Cards (Grid View) ───────────────────────────────
    const renderUserPresenceCards = () => {
        if (!presenceUsers?.length) {
            return (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="ไม่พบข้อมูลผู้ใช้งานตามเงื่อนไขที่เลือก"
                    style={{ margin: '40px 0' }}
                />
            );
        }

        return (
            <Row gutter={[16, 16]}>
                {presenceUsers.map((u) => {
                    const avatarBg = stringToColor(u.empno);
                    const isOnline = u.status === 'online';
                    const isIdle = u.status === 'idle';

                    return (
                        <Col xs={24} sm={12} md={8} lg={6} key={u.empno}>
                            <Card
                                style={{
                                    ...cardBaseStyle,
                                    border: isOnline
                                        ? `1.5px solid #52c41a`
                                        : isIdle
                                        ? `1.5px solid #faad14`
                                        : `1px solid ${theme.colors.border}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.25s ease'
                                }}
                                bodyStyle={{ padding: '16px' }}
                                hoverable
                            >
                                {/* Top: Status indicator & Department */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Space size={6}>
                                        <Tag color={u.department === 'ENG' ? 'blue' : u.department === 'AD' ? 'purple' : 'cyan'} style={{ borderRadius: 6, fontWeight: 600 }}>
                                            {u.department || 'GENERAL'}
                                        </Tag>
                                        {u.role && (
                                            <Tag style={{ borderRadius: 6, fontSize: 10 }}>{u.role}</Tag>
                                        )}
                                    </Space>
                                    {renderStatusBadge(u.status, u.activeTabs)}
                                </div>

                                {/* User Header (Avatar + Name) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <div style={{ position: 'relative' }}>
                                        <Avatar
                                            size={48}
                                            src={u.profileImg || null}
                                            style={{
                                                backgroundColor: u.profileImg ? 'transparent' : avatarBg,
                                                fontSize: 18,
                                                fontWeight: 700,
                                                border: `2px solid ${isOnline ? '#52c41a' : isIdle ? '#faad14' : theme.colors.border}`
                                            }}
                                        >
                                            {!u.profileImg && (u.nickname || u.userName?.[0] || u.empno?.[0] || 'U')}
                                        </Avatar>
                                        {isOnline && (
                                            <span style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                right: 0,
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                backgroundColor: '#52c41a',
                                                border: '2px solid #fff'
                                            }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Tooltip title={`${u.userName} (${u.empno})`}>
                                            <Text strong style={{
                                                fontSize: 14,
                                                color: theme.colors.textPrimary,
                                                display: 'block',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {u.userName}
                                            </Text>
                                        </Tooltip>
                                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                            {u.nickname ? `"${u.nickname}"` : ''} · <span style={{ fontFamily: 'monospace' }}>{u.empno}</span>
                                        </Text>
                                    </div>
                                </div>

                                {/* Current Activity or Last Visited Page */}
                                <div style={{
                                    backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    marginBottom: 12,
                                    border: `1px solid ${theme.colors.border}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <CompassOutlined style={{ color: isOnline ? '#52c41a' : theme.colors.primary, fontSize: 13 }} />
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: 600 }}>
                                            {isOnline ? 'กำลังเปิดใช้งานหน้าที่:' : 'หน้าล่าสุดที่เปิด:'}
                                        </Text>
                                    </div>
                                    {u.currentPage?.title ? (
                                        <Tooltip title={`Path: ${u.currentPage.path || '-'}`}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Tag
                                                    color={getModuleColor(u.currentPage.module)}
                                                    style={{
                                                        borderRadius: 6,
                                                        maxWidth: '100%',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        fontWeight: 500,
                                                        fontSize: 11
                                                    }}
                                                >
                                                    {u.currentPage.title}
                                                </Tag>
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                            ยังไม่มีประวัติการเปิดหน้าเว็บ
                                        </Text>
                                    )}
                                </div>

                                {/* Bottom Info: Last Login & Last Active */}
                                <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                        <span>เข้าสู่ระบบล่าสุด:</span>
                                        <Text style={{ fontSize: 11, color: theme.colors.textPrimary, fontWeight: 500 }}>
                                            {u.lastLoginAt ? dayjs(u.lastLoginAt).format('DD/MM HH:mm') : '-'}
                                        </Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>กิจกรรมล่าสุด:</span>
                                        <Text style={{ fontSize: 11, color: isOnline ? '#52c41a' : theme.colors.textSecondary }}>
                                            {u.lastActiveAt ? dayjs(u.lastActiveAt).fromNow() : '-'}
                                        </Text>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <Button
                                    type="default"
                                    block
                                    size="small"
                                    icon={<HistoryOutlined />}
                                    onClick={() => handleOpenUserDrawer(u)}
                                    style={{
                                        borderRadius: '8px',
                                        fontSize: 12,
                                        borderColor: theme.colors.border
                                    }}
                                >
                                    ดูประวัติกิจกรรม
                                </Button>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        );
    };

    // ── Render Presence Table (Table View) ───────────────────────────────────
    const renderPresenceTable = () => {
        const columns = [
            {
                title: 'ผู้ใช้งาน (User)',
                key: 'user',
                width: 220,
                render: (_, u) => {
                    const avatarBg = stringToColor(u.empno);
                    return (
                        <Space>
                            <Avatar
                                size={36}
                                src={u.profileImg || null}
                                style={{ backgroundColor: u.profileImg ? 'transparent' : avatarBg, fontSize: 14, fontWeight: 600 }}
                            >
                                {!u.profileImg && (u.nickname || u.userName?.[0] || u.empno?.[0] || 'U')}
                            </Avatar>
                            <div>
                                <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                    {u.userName}
                                </Text>
                                <br />
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                    {u.nickname ? `"${u.nickname}" · ` : ''}
                                    <span style={{ fontFamily: 'monospace' }}>{u.empno}</span>
                                </Text>
                            </div>
                        </Space>
                    );
                },
            },
            {
                title: 'แผนก',
                dataIndex: 'department',
                key: 'department',
                width: 90,
                render: d => <Tag color={d === 'ENG' ? 'blue' : d === 'AD' ? 'purple' : 'default'} style={{ borderRadius: 6 }}>{d || '-'}</Tag>,
            },
            {
                title: 'สถานะ (Status)',
                dataIndex: 'status',
                key: 'status',
                width: 140,
                render: (st, r) => renderStatusBadge(st, r.activeTabs),
            },
            {
                title: 'หน้าที่กำลังเปิดอยู่ (Current / Last Page)',
                key: 'currentPage',
                ellipsis: true,
                render: (_, r) => {
                    const title = r.currentPage?.title;
                    const path = r.currentPage?.path;
                    const mod = r.currentPage?.module;
                    if (!title) return <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>-</Text>;
                    return (
                        <Tooltip title={`URL: ${path || '-'}`}>
                            <Space size={6}>
                                <Tag color={getModuleColor(mod)} style={{ borderRadius: 6, fontWeight: 500 }}>
                                    {title}
                                </Tag>
                                {r.currentPage?.time && (
                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                        ({dayjs(r.currentPage.time).fromNow()})
                                    </Text>
                                )}
                            </Space>
                        </Tooltip>
                    );
                },
            },
            {
                title: 'เข้าสู่ระบบล่าสุด (Last Login)',
                dataIndex: 'lastLoginAt',
                key: 'lastLoginAt',
                width: 150,
                render: t => t ? (
                    <Tooltip title={dayjs(t).format('YYYY-MM-DD HH:mm:ss')}>
                        <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>
                            {dayjs(t).format('DD/MM/YYYY HH:mm')}
                        </Text>
                    </Tooltip>
                ) : <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>ไม่เคยเข้าสู่ระบบ</Text>,
            },
            {
                title: 'กิจกรรมล่าสุด (Last Active)',
                dataIndex: 'lastActiveAt',
                key: 'lastActiveAt',
                width: 130,
                render: (t, r) => t ? (
                    <Tooltip title={dayjs(t).format('YYYY-MM-DD HH:mm:ss')}>
                        <Text style={{ fontSize: 12, color: r.status === 'online' ? '#52c41a' : theme.colors.textSecondary, fontWeight: r.status === 'online' ? 600 : 400 }}>
                            {dayjs(t).fromNow()}
                        </Text>
                    </Tooltip>
                ) : '-',
            },
            {
                title: 'IP Address',
                dataIndex: 'ipAddress',
                key: 'ipAddress',
                width: 120,
                render: ip => <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'monospace' }}>{ip || '-'}</Text>,
            },
            {
                title: 'จัดการ',
                key: 'action',
                width: 90,
                align: 'center',
                render: (_, r) => (
                    <Button
                        type="link"
                        size="small"
                        icon={<HistoryOutlined />}
                        onClick={() => handleOpenUserDrawer(r)}
                    >
                        ประวัติ
                    </Button>
                ),
            },
        ];

        return (
            <Table
                dataSource={presenceUsers}
                columns={columns}
                rowKey="empno"
                size="small"
                loading={loading}
                pagination={{
                    pageSize: 20,
                    showTotal: (total) => `พนักงานทั้งหมด ${total} คน`,
                    showSizeChanger: true,
                }}
                style={{ borderRadius: 10, overflow: 'hidden' }}
            />
        );
    };

    // ── Render Presence Tab Container ─────────────────────────────────────────
    const renderPresenceTab = () => {
        // Collect departments for filter
        const departments = ['ALL', 'ENG', 'AD', 'QA', 'SYSTEM_ENG', 'USER'];

        return (
            <div>
                {/* 1. KPI Cards */}
                {renderPresenceKPIs()}

                {/* 2. Filter & Controls Bar */}
                <Card style={{ ...cardBaseStyle, marginBottom: 16 }} bodyStyle={{ padding: '14px 18px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12
                    }}>
                        {/* Left: Search & Filter */}
                        <Space wrap size={10}>
                            <Input
                                placeholder="ค้นหาชื่อ, ชื่อเล่น, หรือรหัสพนักงาน..."
                                prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                                allowClear
                                value={presenceFilter.search}
                                onChange={e => setPresenceFilter(f => ({ ...f, search: e.target.value }))}
                                style={{ width: 260, borderRadius: 8 }}
                            />

                            <Select
                                value={presenceFilter.status}
                                onChange={val => setPresenceFilter(f => ({ ...f, status: val }))}
                                style={{ width: 140 }}
                                options={[
                                    { label: 'สถานะ: ทั้งหมด', value: 'ALL' },
                                    { label: '🟢 Online', value: 'online' },
                                    { label: '🟡 Idle', value: 'idle' },
                                    { label: '⚪ Offline', value: 'offline' },
                                ]}
                            />

                            <Select
                                value={presenceFilter.department}
                                onChange={val => setPresenceFilter(f => ({ ...f, department: val }))}
                                style={{ width: 140 }}
                                options={departments.map(d => ({
                                    label: d === 'ALL' ? 'แผนก: ทั้งหมด' : `แผนก: ${d}`,
                                    value: d
                                }))}
                            />
                        </Space>

                        {/* Right: View switcher & Auto refresh indicator */}
                        <Space size={14}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Switch
                                    checked={autoRefresh}
                                    onChange={setAutoRefresh}
                                    size="small"
                                />
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                    Live Sync {autoRefresh ? `(${refreshCountdown}s)` : '(Off)'}
                                </Text>
                            </div>

                            <Radio.Group
                                value={presenceFilter.viewMode}
                                onChange={e => setPresenceFilter(f => ({ ...f, viewMode: e.target.value }))}
                                size="small"
                                buttonStyle="solid"
                            >
                                <Radio.Button value="grid"><AppstoreOutlined /> การ์ด</Radio.Button>
                                <Radio.Button value="table"><UnorderedListOutlined /> ตาราง</Radio.Button>
                            </Radio.Group>

                            <Tooltip title="รีเฟรชข้อมูลทันที">
                                <Button
                                    icon={<SyncOutlined spin={loading} />}
                                    size="small"
                                    onClick={() => fetchUsersPresence(false)}
                                    style={{ borderRadius: 6 }}
                                />
                            </Tooltip>
                        </Space>
                    </div>
                </Card>

                {/* 3. Main Presence Display (Grid or Table) */}
                <Card style={cardBaseStyle} bodyStyle={{ padding: '16px' }}>
                    {presenceFilter.viewMode === 'grid'
                        ? renderUserPresenceCards()
                        : renderPresenceTable()
                    }
                </Card>
            </div>
        );
    };

    // ── Render User Timeline Drawer ──────────────────────────────────────────
    const renderUserDrawer = () => {
        if (!selectedUser) return null;
        const avatarBg = stringToColor(selectedUser.empno);
        const isOnline = selectedUser.status === 'online';
        const isIdle = selectedUser.status === 'idle';

        return (
            <Drawer
                title={
                    <Space size={12}>
                        <Avatar
                            size={40}
                            src={selectedUser.profileImg || null}
                            style={{
                                backgroundColor: selectedUser.profileImg ? 'transparent' : avatarBg,
                                fontSize: 16,
                                fontWeight: 700,
                                border: `2px solid ${isOnline ? '#52c41a' : isIdle ? '#faad14' : theme.colors.border}`
                            }}
                        >
                            {!selectedUser.profileImg && (selectedUser.nickname || selectedUser.userName?.[0] || 'U')}
                        </Avatar>
                        <div>
                            <Text strong style={{ fontSize: 16, color: theme.colors.textPrimary }}>
                                {selectedUser.userName}
                            </Text>
                            <br />
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                {selectedUser.nickname ? `"${selectedUser.nickname}" · ` : ''}
                                <span style={{ fontFamily: 'monospace' }}>{selectedUser.empno}</span>
                            </Text>
                        </div>
                    </Space>
                }
                placement="right"
                width={500}
                onClose={() => setDrawerOpen(false)}
                open={drawerOpen}
                destroyOnHidden={true}
            >
                <Spin spinning={drawerLoading}>
                    {/* User Summary Plate */}
                    <Card style={{ ...cardBaseStyle, marginBottom: 20, background: isDark ? '#141414' : '#fafafa' }} bodyStyle={{ padding: '16px' }}>
                        <Row gutter={[12, 12]}>
                            <Col span={12}>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>สถานะปัจจุบัน</Text>
                                <div>{renderStatusBadge(selectedUser.status, selectedUser.activeTabs)}</div>
                            </Col>
                            <Col span={12}>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>แผนก / ตำแหน่ง</Text>
                                <div>
                                    <Tag color="blue">{selectedUser.department || '-'}</Tag>
                                    <Text style={{ fontSize: 12 }}>{selectedUser.role || '-'}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>เข้าสู่ระบบล่าสุด</Text>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>
                                    {selectedUser.lastLoginAt ? dayjs(selectedUser.lastLoginAt).format('DD/MM/YYYY HH:mm:ss') : '-'}
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>กิจกรรมล่าสุด</Text>
                                <div style={{ fontSize: 12, fontWeight: 600, color: isOnline ? '#52c41a' : theme.colors.textPrimary }}>
                                    {selectedUser.lastActiveAt ? dayjs(selectedUser.lastActiveAt).fromNow() : '-'}
                                </div>
                            </Col>
                            {selectedUser.currentPage?.title && (
                                <Col span={24}>
                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>หน้าที่กำลังเปิดใช้งาน</Text>
                                    <div style={{ marginTop: 2 }}>
                                        <Tag color={getModuleColor(selectedUser.currentPage.module)} style={{ fontWeight: 600 }}>
                                            {selectedUser.currentPage.title}
                                        </Tag>
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, display: 'block', marginTop: 2, fontFamily: 'monospace' }}>
                                            {selectedUser.currentPage.path}
                                        </Text>
                                    </div>
                                </Col>
                            )}
                        </Row>
                    </Card>

                    {/* Timeline of today's activities */}
                    <Title level={5} style={{ marginBottom: 16 }}>
                        <CompassOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                        เส้นทางกิจกรรมวันนี้ (Today's Journey)
                    </Title>

                    {userTimelineData?.todayActivities?.length ? (
                        <div style={{ maxHeight: 350, overflowY: 'auto', paddingRight: 8 }}>
                            <Timeline
                                items={userTimelineData.todayActivities.map((act, i) => ({
                                    color: i === 0 && isOnline ? 'green' : 'blue',
                                    children: (
                                        <div style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Tag color={getModuleColor(act.module)} style={{ borderRadius: 6, fontSize: 11 }}>
                                                    {act.friendly_title || act.page_title}
                                                </Tag>
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                                    {dayjs(act.created_at).format('HH:mm:ss')}
                                                </Text>
                                            </div>
                                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'monospace' }}>
                                                {act.path}
                                            </Text>
                                        </div>
                                    ),
                                }))}
                            />
                        </div>
                    ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีบันทึกกิจกรรมในวันนี้" style={{ margin: '20px 0' }} />
                    )}

                    {/* Recent Sessions History */}
                    <Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
                        <LaptopOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                        ประวัติการเข้าสู่ระบบล่าสุด (Recent Sessions)
                    </Title>

                    {userTimelineData?.recentSessions?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {userTimelineData.recentSessions.map((s, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
                                        border: `1px solid ${theme.colors.border}`,
                                        fontSize: 12
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Text strong style={{ color: theme.colors.textPrimary }}>
                                            {dayjs(s.login_at).format('DD/MM/YYYY HH:mm')}
                                        </Text>
                                        <Tag color={s.logout_at ? 'default' : 'green'}>
                                            {s.logout_at ? 'ออกจากระบบแล้ว' : 'Active'}
                                        </Tag>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.colors.textSecondary, fontSize: 11 }}>
                                        <span>เปิดทั้งหมด: {s.total_pages_visited || 0} หน้า</span>
                                        <span>IP: {s.ip_address || '-'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>ไม่มีประวัติ Session เก่า</Text>
                    )}
                </Spin>
            </Drawer>
        );
    };

    // ── Render Overview Tab ──────────────────────────────────────────────────
    const renderOverviewTab = () => {
        if (!stats) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

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
                suffix: 'users'
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
                suffix: 'sessions'
            },
        ];

        const maxViews = stats.byModule?.length ? Math.max(...stats.byModule.map(m => parseInt(m.views, 10))) : 1;
        const displayModules = showAllModules ? stats.byModule : stats.byModule?.slice(0, 8);
        const displayUsers = showAllUsers ? stats.topUsers : stats.topUsers?.slice(0, 8);
        const maxDaily = stats.byDay?.length ? Math.max(...stats.byDay.map(d => parseInt(d.views, 10))) : 1;

        return (
            <div>
                {/* Stats row */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {items.map((item, i) => (
                        <Col xs={12} sm={12} md={6} key={i}>
                            <Card style={statCardStyle(item.color)} bodyStyle={{ padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 46, height: 46, borderRadius: '12px',
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
                                        <div style={{ fontSize: 26, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
                                            {item.value?.toLocaleString() ?? '-'}
                                            {item.suffix && (
                                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginLeft: 4 }}>
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

                {/* Modules & Users */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Card title="📊 Module Usage Distribution" style={cardBaseStyle} bodyStyle={{ padding: '16px' }}>
                            {displayModules?.length ? displayModules.map((mod, i) => (
                                <div key={i} style={{ marginBottom: 14 }}>
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
                                            {parseInt(mod.views, 10).toLocaleString()} views
                                        </Text>
                                    </div>
                                    <Progress
                                        percent={Math.round((parseInt(mod.views, 10) / maxViews) * 100)}
                                        showInfo={false}
                                        strokeColor={getModuleColor(mod.module)}
                                        trailColor={isDark ? '#262626' : '#f0f0f0'}
                                        size="small"
                                    />
                                </div>
                            )) : <Empty description="No module data" />}
                            {stats.byModule?.length > 8 && (
                                <div style={{ textAlign: 'center', marginTop: 10 }}>
                                    <Button type="link" size="small" onClick={() => setShowAllModules(!showAllModules)}>
                                        {showAllModules ? 'แสดงน้อยลง' : `แสดงทั้งหมด (${stats.byModule.length})`}
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card title="🏆 Top Active Users" style={cardBaseStyle} bodyStyle={{ padding: '16px' }}>
                            {displayUsers?.length ? displayUsers.map((u, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '8px 12px', marginBottom: 6,
                                    borderRadius: 8,
                                    background: i < 3 ? `${theme.colors.primary}12` : 'transparent',
                                }}>
                                    <Space size={10}>
                                        <Badge count={i + 1} style={{
                                            backgroundColor: i === 0 ? '#faad14' : i === 1 ? '#bfbfbf' : i === 2 ? '#b87333' : theme.colors.textSecondary,
                                            fontSize: 10, minWidth: 20, height: 20, lineHeight: '20px',
                                        }} />
                                        <div>
                                            <Text strong style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
                                                {u.user_name || u.empno}
                                            </Text>
                                            <br />
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                                                {u.department} · {u.modules_used} modules
                                            </Text>
                                        </div>
                                    </Space>
                                    <Tag color="blue">{parseInt(u.views, 10).toLocaleString()} views</Tag>
                                </div>
                            )) : <Empty description="No user data" />}
                            {stats.topUsers?.length > 8 && (
                                <div style={{ textAlign: 'center', marginTop: 10 }}>
                                    <Button type="link" size="small" onClick={() => setShowAllUsers(!showAllUsers)}>
                                        {showAllUsers ? 'แสดงน้อยลง' : `แสดงทั้งหมด (${stats.topUsers.length})`}
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </Col>

                    {/* Daily Trend & Top Pages */}
                    <Col xs={24} md={12}>
                        <Card title="📈 Daily Activity Trend" style={cardBaseStyle} bodyStyle={{ padding: '16px' }}>
                            {stats.byDay?.length ? (
                                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    {stats.byDay.map((day, i) => {
                                        const views = parseInt(day.views, 10);
                                        const pct = maxDaily ? Math.round((views / maxDaily) * 100) : 0;
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                <Text style={{ width: 85, fontSize: 12, color: theme.colors.textSecondary }}>
                                                    {dayjs(day.date).format('MM/DD (ddd)')}
                                                </Text>
                                                <div style={{ flex: 1 }}>
                                                    <Progress
                                                        percent={pct}
                                                        showInfo={false}
                                                        strokeColor={`linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primary}80)`}
                                                        trailColor={isDark ? '#262626' : '#f0f0f0'}
                                                        size="small"
                                                    />
                                                </div>
                                                <Text strong style={{ width: 45, textAlign: 'right', fontSize: 11 }}>
                                                    {views}
                                                </Text>
                                                <Text style={{ width: 55, textAlign: 'right', fontSize: 11, color: theme.colors.textSecondary }}>
                                                    {day.unique_users} users
                                                </Text>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <Empty description="No trend data" />}
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card title="🔥 Most Visited Pages" style={cardBaseStyle} bodyStyle={{ padding: '8px 12px' }}>
                            {stats.topPages?.length ? (
                                <Table
                                    dataSource={showAllPages ? stats.topPages : stats.topPages.slice(0, 8)}
                                    rowKey="path"
                                    size="small"
                                    pagination={false}
                                    columns={[
                                        {
                                            title: 'Page / Path',
                                            dataIndex: 'path',
                                            key: 'path',
                                            ellipsis: true,
                                            render: (p, r) => (
                                                <Tooltip title={p}>
                                                    <Text strong style={{ fontSize: 12, color: theme.colors.textPrimary }}>
                                                        {r.page_title || p}
                                                    </Text>
                                                    <br />
                                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{p}</Text>
                                                </Tooltip>
                                            ),
                                        },
                                        {
                                            title: 'Views',
                                            dataIndex: 'views',
                                            key: 'views',
                                            width: 75,
                                            align: 'right',
                                            render: v => <Text strong>{parseInt(v, 10).toLocaleString()}</Text>,
                                        },
                                        {
                                            title: 'Users',
                                            dataIndex: 'unique_users',
                                            key: 'unique_users',
                                            width: 65,
                                            align: 'right',
                                            render: v => <Tag color="green">{v}</Tag>,
                                        },
                                    ]}
                                />
                            ) : <Empty description="No page data" />}
                            {stats.topPages?.length > 8 && (
                                <div style={{ textAlign: 'center', marginTop: 10, paddingBottom: 6 }}>
                                    <Button type="link" size="small" onClick={() => setShowAllPages(!showAllPages)}>
                                        {showAllPages ? 'แสดงน้อยลง' : `แสดงทั้งหมด (${stats.topPages.length})`}
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    };

    // ── Render Logs Tab ──────────────────────────────────────────────────────
    const renderLogsTab = () => {
        const logColumns = [
            {
                title: 'เวลา (Time)',
                dataIndex: 'created_at',
                key: 'created_at',
                width: 140,
                render: t => (
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                        {dayjs(t).format('DD/MM HH:mm:ss')}
                    </Text>
                ),
            },
            {
                title: 'ผู้ใช้งาน',
                dataIndex: 'user_name',
                key: 'user_name',
                width: 140,
                render: (name, record) => (
                    <div>
                        <Text strong style={{ fontSize: 12 }}>{name || record.empno}</Text>
                        <br />
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{record.empno}</Text>
                    </div>
                ),
            },
            {
                title: 'แผนก',
                dataIndex: 'department',
                key: 'department',
                width: 80,
                render: d => d ? <Tag>{d}</Tag> : '-',
            },
            {
                title: 'โมดูล',
                dataIndex: 'module',
                key: 'module',
                width: 130,
                render: m => <Tag color={getModuleColor(m)} style={{ borderRadius: 6 }}>{getModuleLabel(m)}</Tag>,
            },
            {
                title: 'หน้าเว็บ (Page & Path)',
                dataIndex: 'path',
                key: 'path',
                ellipsis: true,
                render: (text, record) => (
                    <Tooltip title={`URL: ${text}`}>
                        <Text strong style={{ fontSize: 12 }}>{record.page_title || text}</Text>
                        <br />
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'monospace' }}>{text}</Text>
                    </Tooltip>
                ),
            },
            {
                title: 'IP Address',
                dataIndex: 'ip_address',
                key: 'ip_address',
                width: 120,
                render: ip => <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'monospace' }}>{ip || '-'}</Text>,
            },
        ];

        return (
            <Card style={cardBaseStyle} bodyStyle={{ padding: '16px' }}>
                <Space style={{ marginBottom: 16 }} wrap>
                    <Select
                        placeholder="กรองตามโมดูล"
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
                        placeholder="กรองตามผู้ใช้งาน"
                        allowClear
                        showSearch
                        style={{ width: 220 }}
                        value={filters.empno}
                        onChange={v => setFilters(f => ({ ...f, empno: v }))}
                        options={presenceUsers.map(u => ({
                            label: `${u.userName} (${u.empno})`,
                            value: u.empno,
                        }))}
                    />
                    <Tooltip title="Refresh Logs">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => fetchLogs(1)}
                            style={{ borderRadius: 8 }}
                        >
                            รีเฟรช
                        </Button>
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
                        showTotal: (total) => `บันทึกทั้งหมด ${total} รายการ`,
                        onChange: (page, pageSize) => {
                            setLogsPagination(p => ({ ...p, limit: pageSize }));
                            fetchLogs(page);
                        },
                    }}
                />
            </Card>
        );
    };

    // ── Render Technical Raw Sessions Tab ────────────────────────────────────
    const renderRawSessionsTab = () => {
        const sessionColumns = [
            {
                title: 'User',
                dataIndex: 'user_name',
                key: 'user_name',
                width: 130,
                render: (name, record) => (
                    <div>
                        <Text strong style={{ fontSize: 12 }}>{name || record.empno}</Text>
                        <br />
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{record.empno}</Text>
                    </div>
                ),
            },
            {
                title: 'Dept',
                dataIndex: 'department',
                key: 'department',
                width: 70,
                render: d => d ? <Tag>{d}</Tag> : '-',
            },
            {
                title: 'Login Time',
                dataIndex: 'login_at',
                key: 'login_at',
                width: 140,
                render: t => dayjs(t).format('DD/MM HH:mm:ss'),
            },
            {
                title: 'Last Active',
                dataIndex: 'last_active_at',
                key: 'last_active_at',
                width: 140,
                render: t => t ? (
                    <Tooltip title={dayjs(t).format('YYYY-MM-DD HH:mm:ss')}>
                        <Text style={{ fontSize: 12 }}>{dayjs(t).fromNow()}</Text>
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
                    const minutesAgo = dayjs().diff(dayjs(record.last_active_at), 'minute');
                    if (minutesAgo <= 15) {
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
                render: v => <Text strong>{v || 0}</Text>,
            },
            {
                title: 'Session ID',
                dataIndex: 'session_id',
                key: 'session_id',
                ellipsis: true,
                render: id => <Text style={{ fontSize: 11, fontFamily: 'monospace', color: theme.colors.textSecondary }}>{id}</Text>,
            },
            {
                title: 'IP Address',
                dataIndex: 'ip_address',
                key: 'ip_address',
                width: 120,
                render: ip => <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontFamily: 'monospace' }}>{ip || '-'}</Text>,
            },
        ];

        return (
            <Card style={cardBaseStyle} bodyStyle={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                        แสดงบันทึกการเชื่อมต่อระดับ Browser Tab ล่าสุด 50 รายการ (สำหรับงานตรวจสอบเทคนิค)
                    </Text>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={fetchSessions}
                        style={{ borderRadius: 6 }}
                    >
                        รีเฟรช Sessions
                    </Button>
                </div>
                <Table
                    dataSource={sessions}
                    columns={sessionColumns}
                    rowKey="id"
                    size="small"
                    loading={loading}
                    pagination={false}
                />
            </Card>
        );
    };

    // ── Main Tabs Configuration ──────────────────────────────────────────────
    const tabItems = [
        {
            key: 'presence',
            label: (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                    <TeamOutlined /> สถานะผู้ใช้งานทั้งหมด (Live Presence)
                    {presenceSummary.onlineCount > 0 && (
                        <Badge
                            count={presenceSummary.onlineCount}
                            style={{ marginLeft: 8, backgroundColor: '#52c41a' }}
                            size="small"
                        />
                    )}
                </span>
            ),
            children: renderPresenceTab(),
        },
        {
            key: 'overview',
            label: (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                    <BarChartOutlined /> ภาพรวมสถิติระบบ (Overview)
                </span>
            ),
            children: renderOverviewTab(),
        },
        {
            key: 'logs',
            label: (
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                    <FileSearchOutlined /> บันทึกกิจกรรมละเอียด (Activity Logs)
                </span>
            ),
            children: renderLogsTab(),
        },
        {
            key: 'raw_sessions',
            label: (
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                    <DesktopOutlined /> Raw Sessions
                </span>
            ),
            children: renderRawSessionsTab(),
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex' }}>
            <MenuTemplate type="System" defaultSelectedKeys="5" />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Spin spinning={loading && !presenceUsers.length} tip="กำลังโหลดข้อมูล...">
                    <ScrollbarStyle primary={theme.colors.primary} />
                    <Content
                        className="kb-vscroll"
                        style={{
                            height: 'calc(100vh - 64px)',
                            overflowY: 'auto',
                            padding: '24px',
                        }}
                    >
                        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
                            {/* Dashboard Banner Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: 16,
                                marginBottom: 20,
                            }}>
                                <div>
                                    <Title level={2} style={{ color: theme.colors.textPrimary, marginBottom: 4 }}>
                                        <GlobalOutlined style={{ marginRight: 10, color: theme.colors.primary }} />
                                        Activity & Live User Presence
                                    </Title>
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                                        ติดตามสถานะการใช้งานระบบแบบ Real-Time · รายชื่อพนักงานทุกคน · หน้าเว็บที่กำลังเปิดใช้งาน · ประวัติการเข้าสู่ระบบ
                                    </Text>
                                </div>

                                <Space wrap>
                                    <RangePicker
                                        value={filters.dateRange}
                                        onChange={(dates) => setFilters(f => ({ ...f, dateRange: dates }))}
                                        style={{ borderRadius: 8 }}
                                    />
                                    <Tooltip title="รีเฟรชข้อมูลทั้งหมด">
                                        <Button
                                            type="primary"
                                            icon={<ReloadOutlined spin={loading} />}
                                            onClick={handleRefreshAll}
                                            style={{
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}
                                        >
                                            รีเฟรชทั้งหมด
                                        </Button>
                                    </Tooltip>
                                </Space>
                            </div>

                            {/* Main Tabs */}
                            <Tabs
                                activeKey={activeTab}
                                onChange={setActiveTab}
                                items={tabItems}
                                size="large"
                                style={{ marginBottom: 24 }}
                            />

                            {/* User Activity Drawer */}
                            {renderUserDrawer()}
                        </div>
                    </Content>
                </Spin>
            </Layout>
        </Layout>
    );
}

export default ActivityDashboard;
