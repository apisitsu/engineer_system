import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Button, Input, Select, Card, Row, Col, Space, Empty, DatePicker, Spin, Tag, Avatar, Tooltip, Progress, Dropdown, Modal, message, Tabs, Badge, Collapse, List, Typography } from 'antd';
import {
    PlusOutlined,
    ProjectOutlined,
    SearchOutlined,
    SyncOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    ClockCircleOutlined,
    UserOutlined,
    MoreOutlined,
    SortAscendingOutlined,
    CalendarOutlined,
    DeleteOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    DashboardOutlined,
    AppstoreOutlined,
    EyeOutlined,
    BugOutlined,
    ToolOutlined,
    TeamOutlined,
    RiseOutlined,
    FundProjectionScreenOutlined,
    FileTextOutlined,
    AlertOutlined,
    LockOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from '../../../../theme';
import { useAuthStore } from '../../../../stores/authStore';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import moment from 'moment';
import ProjectForm from './ProjectForm';
import ScrollbarStyle from '../../../common/scrollbar';


const { Content } = Layout;
const { Option } = Select;
const { Text, Title } = Typography;
const { Panel } = Collapse;

const PROJECT_GROUPS = ['MGR', 'COORD', 'NPE', 'MAT', 'PROC', 'MTC', 'SYS', 'General'];

// Status Config
const STATUS_CONFIG = {
    1: { label: 'Created', color: 'default', icon: <ProjectOutlined />, hex: '#8c8c8c' },
    2: { label: 'Assigned', color: 'processing', icon: <SyncOutlined />, hex: '#1890ff' },
    3: { label: 'In Progress', color: 'cyan', icon: <SyncOutlined />, hex: '#13c2c2' },
    4: { label: 'Check', color: 'warning', icon: <WarningOutlined />, hex: '#faad14' },
    5: { label: 'Done', color: 'success', icon: <CheckCircleOutlined />, hex: '#52c41a' }
};

const PRIORITY_CONFIG = {
    1: { label: 'Low', color: 'success' },
    2: { label: 'Medium', color: 'warning' },
    3: { label: 'High', color: 'error' }
};

const GROUP_COLORS = {
    'MGR': '#722ed1',
    'COORD': '#eb2f96',
    'NPE': '#fa8c16',
    'MAT': '#13c2c2',
    'PROC': '#1890ff',
    'MTC': '#52c41a',
    'SYS': '#2f54eb',
    'General': '#8c8c8c'
};

const ProjectDashboard = () => {
    const { theme } = useTheme();
    const navigate = useNavigate();

    // User Context
    const empNo = useAuthStore((state) => state.empNo);
    const userInfo = useAuthStore((state) => state.userInfo);
    const currentUserId = empNo || userInfo?.user_empid || userInfo?.id;
    const canAssignProjects = ['0', '1', '2', '3'].includes(String(useAuthStore((state) => state.userAuth)));
    const isAD = userInfo?.u_department === 'AD';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [projects, setProjects] = useState([]);
    const [filteredProjects, setFilteredProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dashboardStats, setDashboardStats] = useState({});
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Filter States
    const [searchText, setSearchText] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [monthFilter, setMonthFilter] = useState(null);
    const [monthType, setMonthType] = useState('create');
    const [sortBy, setSortBy] = useState('create_desc');

    // Form Modal State
    const [isProjectFormVisible, setIsProjectFormVisible] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

    // Problem filter state
    const [problemGroupFilter, setProblemGroupFilter] = useState(null);

    // Admin Simulation State
    const [simActive, setSimActive] = useState(false);
    const [simUser, setSimUser] = useState(null);  // Selected user object
    const [allUsers, setAllUsers] = useState([]);

    const userHeaders = useMemo(() => {
        const headers = {
            user: JSON.stringify({
                id: currentUserId,
                u_department: userInfo?.u_department,
                u_role: userInfo?.u_role,
                u_group: userInfo?.u_group
            })
        };
        // Include simulation header for AD users — send simulated user's FULL info including their ID
        if (isAD && simActive && simUser) {
            headers['x-simulate-user'] = JSON.stringify({
                id: simUser.user_empid,
                u_department: simUser.u_department,
                u_role: simUser.u_role,
                u_group: simUser.u_group
            });
        }
        return headers;
    }, [currentUserId, userInfo, isAD, simActive, simUser]);

    useEffect(() => {
        fetchProjects();
        fetchDashboardStats();
        fetchDetailData();
        if (isAD) fetchAllUsers();
    }, []);

    useEffect(() => {
        applyFiltersAndSort();
    }, [projects, searchText, selectedGroup, selectedStatus, monthFilter, monthType, sortBy]);

    // Re-fetch data when simulation changes
    useEffect(() => {
        fetchProjects();
        fetchDashboardStats();
        fetchDetailData();
    }, [simActive, simUser]);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${server.SYSTEM_GET_PROJECT}`, { headers: userHeaders });
            setProjects(data.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching projects:', error);
            setLoading(false);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const { data } = await axios.get(`${server.SYSTEM_GET_DASHBOARD_DATA}`, { headers: userHeaders });
            setDashboardStats(data.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchDetailData = async () => {
        try {
            setDetailLoading(true);
            const { data } = await axios.get(`${server.SYSTEM_GET_DASHBOARD_DETAIL}`, { headers: userHeaders });
            setDetailData(data.data);
            setDetailLoading(false);
        } catch (error) {
            console.error('Error fetching detail data:', error);
            setDetailLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const { data } = await axios.get(`${server.GET_ALL_USERS}`);
            setAllUsers(data.data || data || []);
        } catch (error) {
            console.error('Error fetching users for simulation:', error);
        }
    };

    const applyFiltersAndSort = () => {
        let filtered = [...projects];

        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(lowerSearch) ||
                (p.owner_name && p.owner_name.toLowerCase().includes(lowerSearch))
            );
        }

        if (selectedGroup) {
            if (selectedGroup === 'General') {
                filtered = filtered.filter(p => !p.project_group || p.project_group === 'General');
            } else {
                filtered = filtered.filter(p => p.project_group === selectedGroup);
            }
        }

        if (selectedStatus) {
            filtered = filtered.filter(p => p.status === selectedStatus);
        }

        if (monthFilter) {
            filtered = filtered.filter(p => {
                const dateToCheck = monthType === 'create' ? p.create_date : p.due_date;
                return dateToCheck && moment(dateToCheck).format('YYYY-MM') === monthFilter;
            });
        }

        filtered.sort((a, b) => {
            if (sortBy === 'create_desc') return new Date(b.create_date || 0) - new Date(a.create_date || 0);
            if (sortBy === 'create_asc') return new Date(a.create_date || 0) - new Date(b.create_date || 0);
            if (sortBy === 'due_asc') {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            }
            if (sortBy === 'due_desc') return new Date(b.due_date || 0) - new Date(a.due_date || 0);
            if (sortBy === 'priority_desc') return (b.priority || 0) - (a.priority || 0);
            return 0;
        });

        setFilteredProjects(filtered);
    };

    const handleProjectClick = (projectId) => {
        navigate(`/eng/system_eng/todo_project?project=${projectId}`);
    };

    const handleEditProject = (project, e) => {
        e.stopPropagation();
        setEditingProject(project);
        setIsProjectFormVisible(true);
    };

    const handleCreateProject = () => {
        setEditingProject(null);
        setIsProjectFormVisible(true);
    };

    const handleProjectFormCancel = () => {
        setEditingProject(null);
        setIsProjectFormVisible(false);
    };

    const handleProjectFormSuccess = () => {
        setEditingProject(null);
        setIsProjectFormVisible(false);
        fetchProjects();
        fetchDashboardStats();
        fetchDetailData();
    };

    const handleDeleteProject = (project, e) => {
        if (e) e.stopPropagation();

        Modal.confirm({
            title: 'Are you sure you want to delete this project?',
            icon: <ExclamationCircleOutlined />,
            content: `Project: ${project.name}`,
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    await axios.delete(`${server.SYSTEM_DELETE_PROJECT}/${project.id}`);
                    message.success('Project deleted successfully');
                    fetchProjects();
                    fetchDashboardStats();
                    fetchDetailData();
                } catch (error) {
                    console.error('Error deleting project:', error);
                    message.error('Failed to delete project');
                }
            },
        });
    };

    const clearFilters = () => {
        setSearchText('');
        setSelectedGroup(null);
        setSelectedStatus(null);
        setMonthFilter(null);
        setSortBy('create_desc');
    };

    const getProgressPercent = (status) => {
        if (status === 5) return 100;
        if (status === 4) return 90;
        if (status === 3) return 50;
        if (status === 2) return 20;
        return 0;
    };

    // ==================== STYLES ====================
    const glassCardStyle = {
        background: theme.colors.surface,
        borderRadius: 16,
        border: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        overflow: 'hidden'
    };

    const miniStatCardStyle = {
        background: `linear-gradient(135deg, ${theme.colors.surface} 0%, ${theme.colors.background} 100%)`,
        borderRadius: 14,
        border: `1px solid ${theme.colors.border || 'rgba(0,0,0,0.06)'}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        height: '100%',
        transition: 'all 0.3s ease',
    };

    // ==================== DASHBOARD TAB ====================
    const renderDashboardTab = () => {
        const totalProjects = dashboardStats.total_projects || 0;
        const activeProjects = dashboardStats.active_projects || 0;
        const completedProjects = dashboardStats.completed_projects || 0;
        const totalTasks = dashboardStats.total_tasks || 0;
        const activeTasks = dashboardStats.active_tasks || 0;
        const completedTasks = dashboardStats.completed_tasks || 0;
        const overdueTasks = dashboardStats.overdue_tasks || 0;
        const pendingReview = dashboardStats.pending_review || 0;

        const projectCompletionRate = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;
        const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Status distribution for visual chart
        const statusDistribution = detailData?.status_distribution || [];
        const totalStatusTasks = statusDistribution.reduce((sum, s) => sum + s.count, 0);

        // Filtered problems
        const problemsByProject = detailData?.problems_by_project || [];
        const filteredProblems = problemGroupFilter
            ? problemsByProject.filter(p => p.project_group === problemGroupFilter)
            : problemsByProject;

        const totalProblemsCount = problemsByProject.reduce((sum, p) => p.tasks.length + sum, 0);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* ===== TOP SUMMARY CARDS ===== */}
                <Row gutter={[16, 16]}>
                    {/* Project Summary */}
                    <Col xs={24} sm={12} md={6}>
                        <Card style={miniStatCardStyle} styles={{ body: { padding: '20px' } }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 14px rgba(102,126,234,0.4)'
                                }}>
                                    <FundProjectionScreenOutlined style={{ fontSize: 22, color: '#fff' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
                                        {totalProjects}
                                    </div>
                                    <div style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: 500 }}>
                                        Total Projects
                                    </div>
                                </div>
                            </div>
                            <Progress
                                percent={projectCompletionRate}
                                size="small"
                                strokeColor={{ '0%': '#667eea', '100%': '#764ba2' }}
                                style={{ marginTop: 12 }}
                                format={() => `${projectCompletionRate}% Done`}
                            />
                        </Card>
                    </Col>

                    {/* Active Projects */}
                    <Col xs={24} sm={12} md={6}>
                        <Card style={miniStatCardStyle} styles={{ body: { padding: '20px' } }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14,
                                    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 14px rgba(67,233,123,0.4)'
                                }}>
                                    <RiseOutlined style={{ fontSize: 22, color: '#fff' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
                                        {activeProjects}
                                    </div>
                                    <div style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: 500 }}>
                                        Active Projects
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.colors.textSecondary }}>
                                <span><Badge color="#faad14" text={`${pendingReview} Review`} /></span>
                                <span><Badge color="#52c41a" text={`${completedProjects} Done`} /></span>
                            </div>
                        </Card>
                    </Col>

                    {/* Total Tasks */}
                    <Col xs={24} sm={12} md={6}>
                        <Card style={miniStatCardStyle} styles={{ body: { padding: '20px' } }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14,
                                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 14px rgba(250,112,154,0.4)'
                                }}>
                                    <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
                                        {totalTasks}
                                    </div>
                                    <div style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: 500 }}>
                                        Total Tasks
                                    </div>
                                </div>
                            </div>
                            <Progress
                                percent={taskCompletionRate}
                                size="small"
                                strokeColor={{ '0%': '#fa709a', '100%': '#fee140' }}
                                style={{ marginTop: 12 }}
                                format={() => `${taskCompletionRate}% Done`}
                            />
                        </Card>
                    </Col>

                    {/* Overdue / Issues */}
                    <Col xs={24} sm={12} md={6}>
                        <Card style={miniStatCardStyle} styles={{ body: { padding: '20px' } }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14,
                                    background: overdueTasks > 0
                                        ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)'
                                        : 'linear-gradient(135deg, #95de64 0%, #73d13d 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: overdueTasks > 0
                                        ? '0 4px 14px rgba(255,77,79,0.4)'
                                        : '0 4px 14px rgba(115,209,61,0.4)'
                                }}>
                                    <AlertOutlined style={{ fontSize: 22, color: '#fff' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: overdueTasks > 0 ? '#ff4d4f' : theme.colors.textPrimary, lineHeight: 1.1 }}>
                                        {overdueTasks}
                                    </div>
                                    <div style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: 500 }}>
                                        Overdue Tasks
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.colors.textSecondary }}>
                                <span><Badge color="#fa709a" text={`${totalProblemsCount} Issues`} /></span>
                                <span><Badge color="#1890ff" text={`${activeTasks} Active`} /></span>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* ===== MIDDLE SECTION: Status + Group Stats ===== */}
                <Row gutter={[16, 16]}>
                    {/* Task Status Distribution */}
                    <Col xs={24} lg={10}>
                        <Card
                            title={<span style={{ fontWeight: 600, color: theme.colors.textPrimary }}>
                                <SyncOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                                Task Status Distribution
                            </span>}
                            style={glassCardStyle}
                            styles={{ body: { padding: '16px 20px' } }}
                        >
                            {statusDistribution.length === 0 ? (
                                <Empty description="No task data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {statusDistribution.map(item => {
                                        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG[1];
                                        const pct = totalStatusTasks > 0 ? Math.round((item.count / totalStatusTasks) * 100) : 0;
                                        return (
                                            <div key={item.status}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Space size={6}>
                                                        <Tag color={config.color} style={{ borderRadius: 10, margin: 0 }}>
                                                            {config.label}
                                                        </Tag>
                                                    </Space>
                                                    <Text style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>
                                                        {item.count} <Text type="secondary" style={{ fontWeight: 400 }}>({pct}%)</Text>
                                                    </Text>
                                                </div>
                                                <Progress
                                                    percent={pct}
                                                    showInfo={false}
                                                    size="small"
                                                    strokeColor={config.hex}
                                                    trailColor={theme.colors.border || '#f0f0f0'}
                                                />
                                            </div>
                                        );
                                    })}
                                    <div style={{
                                        marginTop: 8, padding: '10px 14px',
                                        background: theme.colors.background,
                                        borderRadius: 10, display: 'flex', justifyContent: 'space-between',
                                        fontSize: 13
                                    }}>
                                        <Text strong>Total Tasks</Text>
                                        <Text strong>{totalStatusTasks}</Text>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </Col>

                    {/* Group Stats */}
                    <Col xs={24} lg={14}>
                        <Card
                            title={<span style={{ fontWeight: 600, color: theme.colors.textPrimary }}>
                                <TeamOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                                Statistics by Group
                            </span>}
                            style={glassCardStyle}
                            styles={{ body: { padding: '12px 16px' } }}
                        >
                            {!detailData?.group_stats || detailData.group_stats.length === 0 ? (
                                <Empty description="No group data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {/* Header */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '100px 1fr 70px 70px 70px 70px',
                                        padding: '8px 12px',
                                        background: theme.colors.background,
                                        borderRadius: 10,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: theme.colors.textSecondary,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        <span>Group</span>
                                        <span>Progress</span>
                                        <span style={{ textAlign: 'center' }}>Projects</span>
                                        <span style={{ textAlign: 'center' }}>Tasks</span>
                                        <span style={{ textAlign: 'center' }}>Done</span>
                                        <span style={{ textAlign: 'center' }}>Issues</span>
                                    </div>
                                    {detailData.group_stats.map(group => {
                                        const groupColor = GROUP_COLORS[group.group_name] || '#8c8c8c';
                                        const taskPct = group.total_tasks > 0 ? Math.round((group.completed_tasks / group.total_tasks) * 100) : 0;
                                        return (
                                            <div key={group.group_name} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '100px 1fr 70px 70px 70px 70px',
                                                padding: '10px 12px',
                                                borderRadius: 10,
                                                background: theme.colors.surface,
                                                border: `1px solid ${theme.colors.border || 'rgba(0,0,0,0.04)'}`,
                                                alignItems: 'center',
                                                transition: 'all 0.2s ease',
                                            }}>
                                                <Tag color={groupColor} style={{ borderRadius: 10, fontWeight: 600, margin: 0, width: 'fit-content' }}>
                                                    {group.group_name}
                                                </Tag>
                                                <Progress
                                                    percent={taskPct}
                                                    size="small"
                                                    strokeColor={groupColor}
                                                    format={() => `${taskPct}%`}
                                                    style={{ margin: '0 12px' }}
                                                />
                                                <div style={{ textAlign: 'center', fontWeight: 600, color: theme.colors.textPrimary }}>
                                                    {group.total_projects}
                                                </div>
                                                <div style={{ textAlign: 'center', fontWeight: 600, color: theme.colors.textPrimary }}>
                                                    {group.total_tasks}
                                                </div>
                                                <div style={{ textAlign: 'center', fontWeight: 600, color: '#52c41a' }}>
                                                    {group.completed_tasks}
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    {group.tasks_with_problems > 0 ? (
                                                        <Badge count={group.tasks_with_problems} style={{ backgroundColor: '#ff4d4f' }} />
                                                    ) : (
                                                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* ===== BOTTOM SECTION: Problems & Solutions ===== */}
                <Card
                    title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <span style={{ fontWeight: 600, color: theme.colors.textPrimary }}>
                            <BugOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                            Issues & Solutions Log
                            <Badge count={totalProblemsCount} style={{ marginLeft: 10, backgroundColor: '#ff4d4f' }} />
                        </span>
                        <Select
                            placeholder="Filter by Group"
                            value={problemGroupFilter}
                            onChange={setProblemGroupFilter}
                            allowClear
                            style={{ width: 160 }}
                            size="small"
                        >
                            {PROJECT_GROUPS.map(g => (
                                <Option key={g} value={g}>
                                    <Space size={6}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: GROUP_COLORS[g] || '#8c8c8c' }} />
                                        {g}
                                    </Space>
                                </Option>
                            ))}
                        </Select>
                    </div>}
                    style={glassCardStyle}
                    styles={{ body: { padding: '12px 16px', maxHeight: 500, overflowY: 'auto' } }}
                >
                    {filteredProblems.length === 0 ? (
                        <div style={{
                            padding: 40, textAlign: 'center',
                            background: theme.colors.background,
                            borderRadius: 12,
                        }}>
                            <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }} />
                            <div style={{ fontSize: 15, fontWeight: 600, color: theme.colors.textPrimary }}>
                                No Issues Found
                            </div>
                            <div style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 }}>
                                All tasks are running smoothly without recorded problems
                            </div>
                        </div>
                    ) : (
                        <Collapse
                            accordion
                            bordered={false}
                            style={{ background: 'transparent' }}
                            expandIconPosition="end"
                        >
                            {filteredProblems.map(projectGroup => (
                                <Panel
                                    key={projectGroup.project_id}
                                    header={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Tag color={GROUP_COLORS[projectGroup.project_group] || '#8c8c8c'} style={{ borderRadius: 10, margin: 0 }}>
                                                {projectGroup.project_group}
                                            </Tag>
                                            <span style={{ fontWeight: 600, color: theme.colors.textPrimary, fontSize: 14 }}>
                                                {projectGroup.project_name}
                                            </span>
                                            <Badge
                                                count={projectGroup.tasks.length}
                                                style={{ backgroundColor: '#faad14' }}
                                            />
                                        </div>
                                    }
                                    style={{
                                        marginBottom: 8,
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        background: theme.colors.surface,
                                        border: `1px solid ${theme.colors.border || 'rgba(0,0,0,0.06)'}`
                                    }}
                                >
                                    <List
                                        dataSource={projectGroup.tasks}
                                        renderItem={task => (
                                            <List.Item style={{
                                                padding: '12px 0',
                                                borderBottom: `1px solid ${theme.colors.border || 'rgba(0,0,0,0.04)'}`,
                                            }}>
                                                <div style={{ width: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <Space size={8}>
                                                            <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                                {task.task_name}
                                                            </Text>
                                                            <Tag
                                                                color={STATUS_CONFIG[task.task_status]?.color || 'default'}
                                                                style={{ borderRadius: 10, fontSize: 11, margin: 0 }}
                                                            >
                                                                {STATUS_CONFIG[task.task_status]?.label || 'Unknown'}
                                                            </Tag>
                                                        </Space>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                                            {task.assignee_name && <><UserOutlined style={{ marginRight: 4 }} />{task.assignee_name}</>}
                                                        </Text>
                                                    </div>
                                                    {task.problem && (
                                                        <div style={{
                                                            padding: '8px 12px',
                                                            background: '#fff2f0',
                                                            borderRadius: 8,
                                                            borderLeft: '3px solid #ff4d4f',
                                                            marginBottom: task.solution ? 6 : 0,
                                                            fontSize: 12.5,
                                                        }}>
                                                            <Text type="danger" style={{ fontWeight: 600, fontSize: 11, display: 'block', marginBottom: 2 }}>
                                                                <BugOutlined style={{ marginRight: 4 }} /> Problem
                                                            </Text>
                                                            <Text style={{ color: '#434343', whiteSpace: 'pre-wrap' }}>{task.problem}</Text>
                                                        </div>
                                                    )}
                                                    {task.solution && (
                                                        <div style={{
                                                            padding: '8px 12px',
                                                            background: '#f6ffed',
                                                            borderRadius: 8,
                                                            borderLeft: '3px solid #52c41a',
                                                            fontSize: 12.5,
                                                        }}>
                                                            <Text style={{ fontWeight: 600, fontSize: 11, display: 'block', marginBottom: 2, color: '#389e0d' }}>
                                                                <ToolOutlined style={{ marginRight: 4 }} /> Solution
                                                            </Text>
                                                            <Text style={{ color: '#434343', whiteSpace: 'pre-wrap' }}>{task.solution}</Text>
                                                        </div>
                                                    )}
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                </Panel>
                            ))}
                        </Collapse>
                    )}
                </Card>
            </div>
        );
    };

    // ==================== PROJECTS TAB ====================
    const renderProjectsTab = () => {
        return (
            <>
                {/* Filters Bar */}
                <Card
                    style={{
                        marginBottom: 16,
                        background: theme.colors.surface,
                        borderRadius: 12,
                        border: 'none',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        overflowX: 'hidden'
                    }}
                    styles={{ body: { padding: '12px 16px' } }}
                >
                    <Row gutter={[12, 12]} align="middle">
                        <Col xs={24} md={6}>
                            <Input
                                placeholder="Search projects..."
                                prefix={<SearchOutlined style={{ color: theme.colors.textTertiary }} />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                                style={{ borderRadius: 8 }}
                            />
                        </Col>
                        <Col xs={12} md={3}>
                            <Select
                                placeholder="Group"
                                value={selectedGroup}
                                onChange={setSelectedGroup}
                                style={{ width: '100%' }}
                                allowClear
                                menuItemSelectedIcon={<CheckCircleOutlined />}
                            >
                                {PROJECT_GROUPS.map(group => (
                                    <Option key={group} value={group}>{group}</Option>
                                ))}
                            </Select>
                        </Col>
                        <Col xs={12} md={3}>
                            <Select
                                placeholder="Status"
                                value={selectedStatus}
                                onChange={setSelectedStatus}
                                style={{ width: '100%' }}
                                allowClear
                            >
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <Option key={key} value={parseInt(key)}>
                                        <Space>
                                            <span style={{ color: config.label === 'Done' ? '#52c41a' : '#1890ff' }}>●</span>
                                            {config.label}
                                        </Space>
                                    </Option>
                                ))}
                            </Select>
                        </Col>
                        <Col xs={12} md={4}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Select
                                    value={monthType}
                                    onChange={setMonthType}
                                    style={{ width: 90 }}
                                >
                                    <Option value="create">Created</Option>
                                    <Option value="due">Due</Option>
                                </Select>
                                <DatePicker.MonthPicker
                                    placeholder="Month"
                                    value={monthFilter ? moment(monthFilter, 'YYYY-MM') : null}
                                    onChange={(date) => setMonthFilter(date ? date.format('YYYY-MM') : null)}
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </Col>
                        <Col xs={12} md={4}>
                            <Select
                                placeholder="Sort By"
                                value={sortBy}
                                onChange={setSortBy}
                                style={{ width: '100%' }}
                                prefix={<SortAscendingOutlined />}
                            >
                                <Option value="create_desc">Newest First</Option>
                                <Option value="create_asc">Oldest First</Option>
                                <Option value="due_asc">Due Soonest</Option>
                                <Option value="priority_desc">High Priority</Option>
                            </Select>
                        </Col>
                        <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                            <Button onClick={clearFilters} type="text" style={{ color: theme.colors.textSecondary }}>
                                Reset Filters
                            </Button>
                        </Col>
                    </Row>
                </Card>

                <div style={{
                    width: '100%',
                    paddingBottom: 0
                }}>
                    <Spin spinning={loading}>
                        {filteredProjects.length === 0 ? (
                            <div style={{
                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                height: 300,
                                background: theme.colors.surface,
                                borderRadius: 12
                            }}>
                                <Empty description="No projects match your filters" />
                            </div>
                        ) : (
                            <Row gutter={[16, 16]} style={{ marginBottom: 16, }}>
                                {filteredProjects.map(project => {
                                    const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG[1];
                                    const priorityConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG[2];
                                    const isOverdue = project.due_date && moment(project.due_date).isBefore(moment(), 'day') && project.status !== 5;
                                    const totalTasks = project.total_tasks;
                                    const completedTasks = project.completed_tasks;
                                    let progress = 0;
                                    let progressText = "";

                                    if (totalTasks !== undefined) {
                                        if (totalTasks > 0) {
                                            progress = Math.round((completedTasks / totalTasks) * 100);
                                            progressText = `${progress}% (${completedTasks}/${totalTasks})`;
                                        } else {
                                            progress = project.status === 5 ? 100 : 0;
                                            progressText = `${progress}% (0/0)`;
                                        }
                                    } else {
                                        progress = getProgressPercent(project.status);
                                        progressText = `${progress}%`;
                                    }

                                    return (
                                        <Col xs={24} sm={12} lg={8} xl={6} key={project.id}>
                                            <Card
                                                hoverable
                                                onClick={() => handleProjectClick(project.id)}
                                                style={{
                                                    background: theme.colors.surface,
                                                    borderRadius: 12,
                                                    border: 'none',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                                    height: '100%',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                                styles={{
                                                    body: { padding: '20px' }
                                                }}
                                            >
                                                {/* Decorative top bar based on priority */}
                                                <div style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                                                    background: priorityConfig.color === 'error' ? '#ff4d4f' :
                                                        priorityConfig.color === 'warning' ? '#faad14' : '#52c41a'
                                                }} />

                                                {/* Header: Group & Actions */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <Tag color="geekblue" style={{ borderRadius: 12, margin: 0 }}>
                                                        {project.project_group || 'General'}
                                                    </Tag>
                                                    {project.is_private === 1 && (
                                                        <Tag color="orange" style={{ borderRadius: 12, margin: 0 }}>
                                                            <LockOutlined style={{ marginRight: 4 }} />Private
                                                        </Tag>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        {project.owner_name && (
                                                            <Tooltip title={`Owner: ${project.owner_name}`}>
                                                                <Avatar size={24} style={{ backgroundColor: '#f56a00', fontSize: 12 }}>
                                                                    {project.owner_name.charAt(0)}
                                                                </Avatar>
                                                            </Tooltip>
                                                        )}
                                                        <Dropdown
                                                            menu={{
                                                                items: (() => {
                                                                    const isOwner = project.owner_id === currentUserId;
                                                                    const isPrivate = project.is_private === 1;
                                                                    const canEdit = isAD || isOwner || !isPrivate;

                                                                    const menuItems = [];

                                                                    if (canEdit) {
                                                                        menuItems.push({
                                                                            key: 'edit',
                                                                            label: 'Edit Project',
                                                                            icon: <EditOutlined />,
                                                                            onClick: (e) => {
                                                                                e.domEvent.stopPropagation();
                                                                                handleEditProject(project, e.domEvent);
                                                                            }
                                                                        });
                                                                    } else {
                                                                        menuItems.push({
                                                                            key: 'request_edit',
                                                                            label: 'Request Edit (Owner Only)',
                                                                            icon: <LockOutlined />,
                                                                            disabled: true,
                                                                            onClick: (e) => {
                                                                                e.domEvent.stopPropagation();
                                                                                message.info('Private project — please contact the owner to request edit access.');
                                                                            }
                                                                        });
                                                                    }

                                                                    if (isAD || isOwner) {
                                                                        menuItems.push({
                                                                            key: 'delete',
                                                                            label: 'Delete Project',
                                                                            icon: <DeleteOutlined />,
                                                                            danger: true,
                                                                            onClick: (e) => {
                                                                                e.domEvent.stopPropagation();
                                                                                handleDeleteProject(project, e.domEvent);
                                                                            }
                                                                        });
                                                                    }

                                                                    return menuItems;
                                                                })()
                                                            }}
                                                            trigger={['click']}
                                                        >
                                                            <Button
                                                                type="text"
                                                                icon={<MoreOutlined style={{ fontSize: 18, color: theme.colors.textSecondary }} />}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ padding: 4, height: 28, width: 28 }}
                                                            />
                                                        </Dropdown>
                                                    </div>
                                                </div>

                                                {/* Title */}
                                                <h3 style={{
                                                    margin: '0 0 12px 0',
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    color: theme.colors.textPrimary,
                                                    lineHeight: 1.4,
                                                    height: 44,
                                                    overflow: 'hidden',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical'
                                                }}>
                                                    {project.name}
                                                </h3>

                                                {/* Status & Priority Badges */}
                                                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                                    <Tag
                                                        icon={statusConfig.icon}
                                                        color={statusConfig.color}
                                                        style={{ borderRadius: 12, padding: '2px 10px', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        {statusConfig.label}
                                                    </Tag>
                                                    {project.priority === 3 && (
                                                        <Tag color="red" style={{ borderRadius: 12 }}>High Priority</Tag>
                                                    )}
                                                </div>

                                                {/* Date Info */}
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    fontSize: 13, color: isOverdue ? '#ff4d4f' : theme.colors.textSecondary,
                                                    marginBottom: 16,
                                                    background: isOverdue ? '#fff1f0' : '#f5f5f5',
                                                    padding: '6px 12px',
                                                    borderRadius: 8
                                                }}>
                                                    {isOverdue ? <WarningOutlined /> : <ClockCircleOutlined />}
                                                    <span>
                                                        {project.due_date ? (
                                                            <>Due {moment(project.due_date).format('MMM D')} ({moment(project.due_date).fromNow()})</>
                                                        ) : 'No due date'}
                                                    </span>
                                                </div>

                                                {/* Footer: Progress */}
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: theme.colors.textTertiary }}>
                                                        <span>Progress</span>
                                                        <span>{progressText}</span>
                                                    </div>
                                                    <Progress
                                                        percent={progress}
                                                        showInfo={false}
                                                        size="small"
                                                        strokeColor={statusConfig.color === 'success' ? '#52c41a' : '#1890ff'}
                                                    />
                                                </div>
                                            </Card>
                                        </Col>
                                    );
                                })}
                            </Row>
                        )}
                    </Spin>
                </div>
                {/* --- FIXED BOTTOM SECTION --- */}
                <div style={{
                    flex: '0 0 auto',
                    padding: '12px 16px',
                    borderTop: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                    color: theme.colors.textSecondary,
                    borderRadius: 12
                }}>
                    <div>
                        Showing <strong>{filteredProjects.length}</strong> project{filteredProjects.length !== 1 && 's'}
                        {filteredProjects.length !== projects.length && ` (filtered from ${projects.length})`}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} /> Completed
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1890ff' }} /> Active
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#faad14' }} /> Check
                        </span>
                    </div>
                </div>
            </>
        );
    };

    // ==================== MAIN RENDER ====================
    return (
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
            <MenuTemplate type="System" defaultSelectedKeys="2" defaultOpenKeys="sub1" />
            <Layout style={{
                backgroundColor: theme.colors.background,
                height: 'calc(100vh - 64px)'
            }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content className="kb-vscroll" style={{
                    height: '100%',
                    padding: '15px',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                }}>
                    {/* --- FIXED TOP SECTION --- */}
                    <div style={{ flex: '0 0 auto' }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16
                        }}>
                            <div>
                                <h1 style={{
                                    fontSize: 26,
                                    fontWeight: 700,
                                    color: theme.colors.textPrimary,
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12
                                }}>
                                    <ProjectOutlined style={{ color: theme.colors.primary }} />
                                    Project Dashboard
                                </h1>
                                <span style={{ color: theme.colors.textSecondary, fontSize: 13, marginLeft: 40 }}>
                                    Overview of all engineering projects
                                </span>
                            </div>
                            <Button
                                type="primary"
                                size="large"
                                icon={<PlusOutlined />}
                                onClick={handleCreateProject}
                                style={{
                                    background: theme.colors.primary,
                                    borderColor: theme.colors.primary,
                                    fontWeight: 600,
                                    borderRadius: 8,
                                    height: 40,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }}
                            >
                                New Project
                            </Button>
                        </div>

                        {/* Admin Simulation Mode */}
                        {isAD && (
                            <div style={{
                                marginBottom: 12,
                                padding: '10px 16px',
                                background: simActive ? 'rgba(250, 173, 20, 0.08)' : theme.colors.surfaceHover,
                                border: `1px solid ${simActive ? '#faad14' : theme.colors.border}`,
                                borderRadius: 10,
                                transition: 'all 0.3s'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: simActive ? 10 : 0 }}>
                                    <Space size={8}>
                                        <EyeOutlined style={{ color: simActive ? '#faad14' : theme.colors.textSecondary }} />
                                        <Text strong style={{ fontSize: 13, color: simActive ? '#faad14' : theme.colors.textSecondary }}>
                                            Admin Simulation
                                        </Text>
                                        {simActive && simUser && (
                                            <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>
                                                Viewing as: {simUser.u_name} ({simUser.u_department}/{simUser.u_role}/{simUser.u_group})
                                            </Tag>
                                        )}
                                    </Space>
                                    <Select
                                        value={simActive}
                                        onChange={(v) => {
                                            setSimActive(v);
                                            if (!v) setSimUser(null);
                                        }}
                                        size="small"
                                        style={{ width: 80 }}
                                        options={[
                                            { value: false, label: 'Off' },
                                            { value: true, label: 'On' }
                                        ]}
                                    />
                                </div>
                                {simActive && (
                                    <div>
                                        <Select
                                            size="small"
                                            placeholder="Select a user to simulate..."
                                            value={simUser?.user_empid}
                                            onChange={(userId) => {
                                                const user = allUsers.find(u => u.user_empid === userId);
                                                setSimUser(user || null);
                                            }}
                                            showSearch
                                            optionFilterProp="children"
                                            style={{ width: '100%' }}
                                        >
                                            {allUsers.map(u => (
                                                <Option key={u.user_empid} value={u.user_empid}>
                                                    {u.u_name} ({u.u_nick}) — {u.u_department}/{u.u_role}/{u.u_group}
                                                </Option>
                                            ))}
                                        </Select>
                                        {simUser && (
                                            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <Tag color="blue">Dept: {simUser.u_department}</Tag>
                                                <Tag color="purple">Role: {simUser.u_role}</Tag>
                                                <Tag color="cyan">Group: {simUser.u_group}</Tag>
                                                <Tag color="default">ID: {simUser.user_empid}</Tag>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab Navigation */}
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            style={{ marginBottom: 0 }}
                            items={[
                                {
                                    key: 'dashboard',
                                    label: (
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                                            <DashboardOutlined style={{ marginRight: 8 }} />
                                            Dashboard
                                        </span>
                                    ),
                                    children: (
                                        <Spin spinning={detailLoading}>
                                            {renderDashboardTab()}
                                        </Spin>
                                    ),
                                },
                                {
                                    key: 'projects',
                                    label: (
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                                            <AppstoreOutlined style={{ marginRight: 8 }} />
                                            All Projects
                                            <Badge
                                                count={projects.length}
                                                style={{
                                                    marginLeft: 8,
                                                    backgroundColor: theme.colors.primary,
                                                    fontSize: 11
                                                }}
                                            />
                                        </span>
                                    ),
                                    children: renderProjectsTab(),
                                }
                            ]}
                        />
                    </div>

                </Content>
            </Layout>

            <ProjectForm
                visible={isProjectFormVisible}
                onCancel={handleProjectFormCancel}
                onSuccess={handleProjectFormSuccess}
                editingProject={editingProject}
                userContext={{ userId: currentUserId, canAssignProjects }}
            />
        </Layout>
    );
};

export default ProjectDashboard;
