import React, { useState, useEffect } from 'react';
import { Layout, Card, Row, Col, Spin, Statistic, Progress, Button, Tag, Empty, message, Modal, Input, DatePicker } from 'antd';
import {
    ProjectOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    PlusOutlined,
    ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import axios from 'axios';
import dayjs from 'dayjs';
import moment from 'moment';
import { useTheme } from '../../../../theme';

const { Content } = Layout;

const Dashboard = () => {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const userAuth = useAuthStore((state) => state.userAuth);
    const userSection = useAuthStore((state) => state.userSection);

    const [loading, setLoading] = useState(true);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [activeProjects, setActiveProjects] = useState([]);
    const [pendingProjects, setPendingProjects] = useState([]);

    // New Project Modal State
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDueDate, setNewProjectDueDate] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch dashboard statistics
            const params = {};
            if (userAuth === '2') {
                params.section = userSection;
            }

            const { data: statsData } = await axios.get(server.SYSTEM_GET_DASHBOARD_DATA, { params });
            setDashboardStats(statsData.data);

            // Fetch active projects
            const projectParams = { includeCompleted: false };
            if (userAuth === '2') {
                projectParams.section = userSection;
            }

            const { data: projectsData } = await axios.get(server.SYSTEM_GET_PROJECT, { params: projectParams });

            const active = projectsData.data.filter(p => p.status === 'active');
            const pending = projectsData.data.filter(p => p.status === 'pending_review');

            // Fetch stats for each active project
            const projectsWithStats = await Promise.all(
                active.map(async (project) => {
                    try {
                        const { data } = await axios.get(`${server.SYSTEM_GET_PROJECT_STATS}/${project.id}`);
                        return { ...project, stats: data.data };
                    } catch (error) {
                        return { ...project, stats: null };
                    }
                })
            );

            setActiveProjects(projectsWithStats);
            setPendingProjects(pending);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            message.error('Failed to load dashboard data');
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            active: 'geekblue',
            pending_review: 'gold',
            completed: 'green',
            archived: 'default'
        };
        return colors[status] || 'default';
    };

    const isOverdue = (dueDate) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isBefore(dayjs());
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) {
            message.warning('Please enter project name');
            return;
        }

        try {
            const { data } = await axios.post(server.SYSTEM_CREATE_PROJECT, {
                name: newProjectName,
                due_date: newProjectDueDate ? newProjectDueDate.toISOString() : null,
                section: userSection,
                created_by: navigate // Should be username
            });

            message.success('Project created successfully!');
            setIsCreateModalVisible(false);
            setNewProjectName('');
            setNewProjectDueDate(null);

            // Refresh dashboard
            fetchDashboardData();

            // Navigate to the new project
            navigate(`/eng/system_eng/todo_project?project=${data.data.id}`);
        } catch (error) {
            console.error('Error creating project:', error);
            message.error('Failed to create project');
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <MenuTemplate style={{ position: 'fixed' }} type={"System"} defaultSelectedKeys={"2"} defaultOpenKeys={"sub1"} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Spin tip="Loading Dashboard..." size="large" spinning={loading}>
                    <Content style={{
                        height: 'calc(100vh - 64px)',
                        overflowY: 'auto',
                        padding: '24px'
                    }}>
                        {/* Header */}
                        <div style={{ marginBottom: 24 }}>
                            <h1 style={{ fontSize: 28, fontWeight: 600, color: theme.colors.textPrimary, marginBottom: 8 }}>
                                📊 Project Dashboard
                            </h1>
                            <p style={{ color: theme.colors.textSecondary, fontSize: 16 }}>
                                {userAuth === '2'
                                    ? `Showing projects for ${userSection}`
                                    : 'Overview of all projects'}
                            </p>
                        </div>

                        {/* Statistics Cards */}
                        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col xs={24} sm={12} lg={6}>
                                <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <Statistic
                                        title="Active Projects"
                                        value={dashboardStats?.active_projects || 0}
                                        prefix={<ProjectOutlined style={{ color: theme.colors.info }} />}
                                        valueStyle={{ color: theme.colors.info, fontWeight: 600 }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} lg={6}>
                                <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <Statistic
                                        title="Pending Review"
                                        value={dashboardStats?.pending_review || 0}
                                        prefix={<ClockCircleOutlined style={{ color: theme.colors.warning }} />}
                                        valueStyle={{ color: theme.colors.warning, fontWeight: 600 }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} lg={6}>
                                <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <Statistic
                                        title="This Month"
                                        value={dashboardStats?.this_month || 0}
                                        prefix={<CheckCircleOutlined style={{ color: theme.colors.success }} />}
                                        valueStyle={{ color: theme.colors.success, fontWeight: 600 }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} lg={6}>
                                <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <Statistic
                                        title="Overdue Tasks"
                                        value={dashboardStats?.overdue_tasks || 0}
                                        prefix={<WarningOutlined style={{ color: theme.colors.error }} />}
                                        valueStyle={{ color: theme.colors.error, fontWeight: 600 }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        {/* Active Projects Section */}
                        <Card
                            title={
                                <span style={{ fontSize: 20, fontWeight: 600 }}>
                                    🚀 Active Projects
                                </span>
                            }
                            extra={
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => setIsCreateModalVisible(true)}
                                    style={{
                                        background: theme.colors.primary,
                                        borderColor: theme.colors.primary
                                    }}
                                >
                                    New Project
                                </Button>
                            }
                            bordered={false}
                            style={{ borderRadius: 12, marginBottom: 24 }}
                        >
                            {activeProjects.length === 0 ? (
                                <Empty
                                    description="No active projects"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            ) : (
                                <Row gutter={[16, 16]}>
                                    {activeProjects.map(project => (
                                        <Col xs={24} lg={12} key={project.id}>
                                            <Card
                                                hoverable
                                                onClick={() => navigate(`/eng/system_eng/todo_project?project=${project.id}`)}
                                                style={{
                                                    borderRadius: 8,
                                                    border: isOverdue(project.due_date) ? `2px solid ${theme.colors.error}` : `1px solid ${theme.colors.border}`
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: theme.colors.textPrimary }}>
                                                            {project.name}
                                                        </h3>
                                                        {project.section && (
                                                            <Tag color="blue" style={{ marginTop: 8 }}>
                                                                {project.section}
                                                            </Tag>
                                                        )}
                                                    </div>
                                                    <Tag color={getStatusColor(project.status)}>
                                                        {project.status}
                                                    </Tag>
                                                </div>

                                                {project.stats && (
                                                    <>
                                                        <div style={{ marginBottom: 8 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                <span style={{ color: theme.colors.textSecondary, fontSize: 14 }}>Progress</span>
                                                                <span style={{ fontWeight: 600, fontSize: 14 }}>
                                                                    {project.stats.completed_tasks}/{project.stats.total_tasks} tasks
                                                                </span>
                                                            </div>
                                                            <Progress
                                                                percent={project.stats.progress_percentage}
                                                                strokeColor={theme.colors.primary}
                                                                showInfo={false}
                                                            />
                                                        </div>

                                                        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                                                            <span style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                                                                📝 Todo: {project.stats.todo_tasks}
                                                            </span>
                                                            <span style={{ color: theme.colors.info, fontSize: 13 }}>
                                                                🔄 In Progress: {project.stats.in_progress_tasks}
                                                            </span>
                                                            <span style={{ color: theme.colors.success, fontSize: 13 }}>
                                                                ✅ Done: {project.stats.completed_tasks}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}

                                                {project.due_date && (
                                                    <div style={{
                                                        marginTop: 12,
                                                        paddingTop: 12,
                                                        borderTop: '1px solid #e5e7eb',
                                                        color: isOverdue(project.due_date) ? theme.colors.error : theme.colors.textSecondary,
                                                        fontSize: 13
                                                    }}>
                                                        Due: {dayjs(project.due_date).format('MMM DD, YYYY')}
                                                        {isOverdue(project.due_date) && ' (Overdue!)'}
                                                    </div>
                                                )}

                                                <Button
                                                    type="link"
                                                    icon={<ArrowRightOutlined />}
                                                    style={{ padding: 0, marginTop: 8 }}
                                                >
                                                    View Tasks
                                                </Button>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            )}
                        </Card>

                        {/* Pending Review Section (Only for Auth 0, 1) */}
                        {['0', '1'].includes(userAuth) && pendingProjects.length > 0 && (
                            <Card
                                title={
                                    <span style={{ fontSize: 20, fontWeight: 600 }}>
                                        ⏳ Pending Review
                                    </span>
                                }
                                bordered={false}
                                style={{ borderRadius: 12 }}
                            >
                                <Row gutter={[16, 16]}>
                                    {pendingProjects.map(project => (
                                        <Col xs={24} sm={12} lg={8} key={project.id}>
                                            <Card
                                                hoverable
                                                style={{
                                                    borderRadius: 8,
                                                    border: `2px solid ${theme.colors.warning}`
                                                }}
                                            >
                                                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                                                    {project.name}
                                                </h4>
                                                <Tag color="gold" style={{ marginTop: 8 }}>
                                                    Awaiting Approval
                                                </Tag>
                                                <div style={{ marginTop: 12, color: theme.colors.textSecondary, fontSize: 13 }}>
                                                    Created by: {project.created_by || 'Unknown'}
                                                </div>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            </Card>
                        )}
                    </Content>
                </Spin>
            </Layout>

            {/* Create New Project Modal */}
            <Modal
                title={<span style={{ fontSize: 20 }}>📋 Create New Project</span>}
                open={isCreateModalVisible}
                onOk={handleCreateProject}
                onCancel={() => {
                    setIsCreateModalVisible(false);
                    setNewProjectName('');
                    setNewProjectDueDate(null);
                }}
                okText="Create Project"
                cancelText="Cancel"
                okButtonProps={{
                    style: {
                        background: theme.colors.primary,
                        borderColor: theme.colors.primary
                    }
                }}
            >
                <div style={{ padding: '16px 0' }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{
                            display: 'block',
                            marginBottom: 8,
                            fontWeight: 500,
                            color: theme.colors.textPrimary
                        }}>
                            Project Name <span style={{ color: theme.colors.error }}>*</span>
                        </label>
                        <Input
                            placeholder="Enter project name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            size="large"
                            onPressEnter={handleCreateProject}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: 8,
                            fontWeight: 500,
                            color: theme.colors.textPrimary
                        }}>
                            Due Date (Optional)
                        </label>
                        <DatePicker
                            placeholder="Select due date"
                            style={{ width: '100%' }}
                            onChange={(date) => setNewProjectDueDate(date)}
                            value={newProjectDueDate}
                            size="large"
                            format="DD/MM/YYYY"
                        />
                    </div>
                </div>
            </Modal>
        </Layout>
    );
};

export default Dashboard;
