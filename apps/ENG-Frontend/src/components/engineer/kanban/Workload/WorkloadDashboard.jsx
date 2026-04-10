import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Row, Col, Card, Avatar, Progress, Tag, Input, List, Empty, Tabs, Drawer, DatePicker, Select, Button, Space } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useTheme } from '../../../../theme';
import {
    MdOutlinePerson,
    MdOutlineWorkOutline,
    MdOutlineTrendingUp,
    MdOutlineAssignment,
    MdOutlineGroup,
    MdEventAvailable
} from 'react-icons/md';
import { IoSearchOutline, IoTimeOutline, IoFilterOutline } from 'react-icons/io5';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title as ChartTitle,
    Tooltip as ChartTooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

dayjs.extend(isBetween);

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ChartTitle,
    ChartTooltip,
    Legend,
    ArcElement
);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Reusable plugin for a vertical baseline in Bar charts
const verticalBaselinePlugin = {
    id: 'verticalBaseline',
    afterDraw: (chart, args, options) => {
        if (!options.baseline) return;
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x } } = chart;
        const xPos = x.getPixelForValue(options.baseline);
        if (xPos >= left && xPos <= right) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = options.color || '#ff4d4f';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
};
ChartJS.register(verticalBaselinePlugin);

const CAPACITY_HOURS = 30; // Weekly capacity

const WorkloadDashboard = ({ theme }) => {
    const { teamWorkload, fetchTeamWorkload, users, projects, isLoading } = useKanbanStore();
    const { user } = useAuthStore();
    const myUCode = user?.empno;

    const [activeTab, setActiveTab] = useState('my_workload');
    const [dateRange, setDateRange] = useState(null); // null = show ALL active cards (no date filter)
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [search, setSearch] = useState('');

    // Team View Drill-down
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerUserCode, setDrawerUserCode] = useState(null);

    useEffect(() => {
        // Build params — only include filters that are explicitly set
        const params = {};
        if (dateRange && dateRange[0] && dateRange[1]) {
            params.week_start = dateRange[0].format('YYYY-MM-DD');
            params.week_end = dateRange[1].format('YYYY-MM-DD');
        }
        if (selectedProjectId) {
            params.project_id = selectedProjectId;
        }
        fetchTeamWorkload(params);
    }, [fetchTeamWorkload, dateRange, selectedProjectId]);

    // Data Memoization
    const myWorkload = useMemo(() => {
        const myUCodeClean = (myUCode || '').toLowerCase();
        return teamWorkload.find(w => (w.u_code || '').toLowerCase() === myUCodeClean) || { total_estimated_hours: 0, cards: [] };
    }, [teamWorkload, myUCode]);

    const teamWorkloadFiltered = useMemo(() => {
        let filtered = teamWorkload;
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(w =>
                w.u_name?.toLowerCase().includes(s) ||
                w.u_code?.toLowerCase().includes(s) ||
                w.u_nickname?.toLowerCase().includes(s)
            );
        }
        return filtered.map(w => ({
            ...w,
            utilization: Math.min((parseFloat(w.total_estimated_hours || 0) / CAPACITY_HOURS) * 100, 100)
        }));
    }, [teamWorkload, search]);

    // =========================================================
    // MY WORKLOAD VIEW
    // =========================================================
    const renderMyWorkload = (workloadData, isDrawer = false) => {
        const estHours = parseFloat(workloadData.total_estimated_hours || 0);
        const utilPercent = Math.min(Math.round((estHours / CAPACITY_HOURS) * 100), 100);
        const isOverloaded = estHours > CAPACITY_HOURS;
        const gaugeColor = isOverloaded ? theme.colors.error : (utilPercent > 80 ? theme.colors.warning : theme.colors.success);

        // console.log(isDrawer);

        const pendingCards = workloadData.cards?.filter(c => c.list_type !== 'closed') || [];

        // Daily Workload Chart Data (Mon-Fri simple distribution)
        // Note: Real distribution requires analyzing each card's duration. 
        // For now, we group cards by due_date day.
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const dailyHours = [0, 0, 0, 0, 0];

        pendingCards.forEach(c => {
            if (c.due_date) {
                const dueDay = dayjs(c.due_date).day(); // 0 = Sun, 1 = Mon ... 5 = Fri
                if (dueDay >= 1 && dueDay <= 5) {
                    dailyHours[dueDay - 1] += parseFloat(c.estimated_hours || 0);
                }
            } else {
                // If no due date, spread evenly or just put on Monday for lack of better logic
                dailyHours[0] += parseFloat(c.estimated_hours || 0) / 5;
                dailyHours[1] += parseFloat(c.estimated_hours || 0) / 5;
                dailyHours[2] += parseFloat(c.estimated_hours || 0) / 5;
                dailyHours[3] += parseFloat(c.estimated_hours || 0) / 5;
                dailyHours[4] += parseFloat(c.estimated_hours || 0) / 5;
            }
        });

        const dailyChartData = {
            labels: days,
            datasets: [{
                label: 'Est. Hours',
                data: dailyHours.map(h => Math.round(h * 10) / 10),
                backgroundColor: theme.colors.primary,
                borderRadius: 4
            }]
        };

        const doughnutData = {
            labels: ['Used', 'Remaining'],
            datasets: [{
                data: [estHours, Math.max(CAPACITY_HOURS - estHours, 0)],
                backgroundColor: [gaugeColor, theme.colors.border],
                borderWidth: 0,
                cutout: '75%'
            }]
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: isDrawer ? 0 : '0 16px' }}>
                <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, height: '100%' }}>
                            <Row align="middle" justify="space-around">
                                <Col span={10}>
                                    <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
                                        <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false }, tooltip: { enabled: false } } }} />
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                            <Title level={4} style={{ margin: 0, color: gaugeColor }}>{estHours}h</Title>
                                            <Text type="secondary" style={{ fontSize: 10 }}>/ {CAPACITY_HOURS}h</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <Title level={5}><MdOutlineTrendingUp /> Capacity Utilization</Title>
                                    <Text type="secondary">You are at <b>{utilPercent}%</b> of your weekly capacity.</Text>
                                    <div style={{ marginTop: 16 }}>
                                        <Text strong style={{ fontSize: 24, color: theme.colors.primary }}>{pendingCards.length}</Text>
                                        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Pending Tasks</Text>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card size="small" title="Daily Workload Distribution" style={{ borderRadius: theme.borderRadius.lg, height: '100%' }}>
                            <div style={{ height: 140 }}>
                                <Bar
                                    data={dailyChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: { y: { beginAtZero: true, max: Math.max(...dailyHours, 8) } }
                                    }}
                                />
                            </div>
                        </Card>
                    </Col>
                </Row>

                <Card size="small" title="My Task Breakdown" style={{ borderRadius: theme.borderRadius.lg }}>
                    <List
                        dataSource={pendingCards}
                        locale={{ emptyText: <Empty description="No pending tasks for this period" /> }}
                        renderItem={card => (
                            <List.Item style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                                            <Tag color="geekblue" style={{ fontSize: 11, border: 'none' }}>{card.project_name}</Tag>
                                            <Tag style={{ fontSize: 11, border: 'none', backgroundColor: theme.colors.bgSecondary }}>{card.board_name}</Tag>
                                        </div>
                                        <Text strong style={{ fontSize: 14 }}>{card.card_name}</Text>
                                        {card.due_date && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>Due: {dayjs(card.due_date).format('DD MMM')}</Text>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <Tag color={card.list_type === 'active' ? 'processing' : 'default'}>{card.list_name}</Tag>
                                        <Tag icon={<IoTimeOutline />} color="orange" style={{ margin: 0, padding: '4px 8px', fontSize: 13 }}>
                                            {card.estimated_hours}h
                                        </Tag>
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                </Card>
            </div>
        );
    };

    // =========================================================
    // TEAM WORKLOAD VIEW
    // =========================================================
    const renderTeamWorkload = () => {
        const totalCapacity = teamWorkloadFiltered.length * CAPACITY_HOURS;
        const totalAllocated = teamWorkloadFiltered.reduce((sum, w) => sum + parseFloat(w.total_estimated_hours || 0), 0);
        const overloadedMembers = teamWorkloadFiltered.filter(w => parseFloat(w.total_estimated_hours || 0) > CAPACITY_HOURS);

        // Chart Data
        teamWorkloadFiltered.sort((a, b) => parseFloat(b.total_estimated_hours) - parseFloat(a.total_estimated_hours));

        const barData = {
            labels: teamWorkloadFiltered.map(w => w.u_name || w.u_code),
            datasets: [{
                label: 'Allocated Hours',
                data: teamWorkloadFiltered.map(w => parseFloat(w.total_estimated_hours)),
                backgroundColor: teamWorkloadFiltered.map(w => {
                    const h = parseFloat(w.total_estimated_hours);
                    if (h > CAPACITY_HOURS) return theme.colors.error;
                    if (h >= CAPACITY_HOURS * 0.85) return theme.colors.warning;
                    return theme.colors.success; // Default green
                }),
                borderRadius: 4
            }]
        };

        const barOptions = {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                verticalBaseline: {
                    baseline: CAPACITY_HOURS,
                    color: theme.colors.error
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: 'Hours' },
                    max: Math.max(...teamWorkloadFiltered.map(w => parseFloat(w.total_estimated_hours)), CAPACITY_HOURS + 10)
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    setDrawerUserCode(teamWorkloadFiltered[idx].u_code);
                    setDrawerVisible(true);
                }
            }
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 16px' }}>
                <Row gutter={[24, 24]}>
                    <Col xs={24} md={8}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, borderLeft: `4px solid ${theme.colors.error}` }}>
                            <Text type="secondary"><MdOutlineGroup /> Overloaded Members</Text>
                            <Title level={2} style={{ margin: '8px 0 0', color: overloadedMembers.length > 0 ? theme.colors.error : theme.colors.success }}>
                                {overloadedMembers.length}
                            </Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>Requiring attention</Text>
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, borderLeft: `4px solid ${theme.colors.primary}` }}>
                            <Text type="secondary"><MdOutlineAssignment /> Total Allocated</Text>
                            <Title level={2} style={{ margin: '8px 0 0' }}>{Math.round(totalAllocated)}h</Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>Across {teamWorkloadFiltered.length} members</Text>
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, borderLeft: `4px solid ${theme.colors.success}` }}>
                            <Text type="secondary"><MdEventAvailable /> Available Capacity</Text>
                            <Title level={2} style={{ margin: '8px 0 0', color: theme.colors.success }}>
                                {Math.max(totalCapacity - totalAllocated, 0)}h
                            </Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>Remaining this week</Text>
                        </Card>
                    </Col>
                </Row>

                <Card size="small" title="Team Utilization Chart" style={{ borderRadius: theme.borderRadius.lg }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                        💡 Click on a bar to drill down into the employee's assignments. Dashed line indicates base capacity ({CAPACITY_HOURS}h).
                    </Text>
                    <div style={{ height: Math.max(300, teamWorkloadFiltered.length * 40) }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                </Card>
            </div>
        );
    };

    const targetDrawerWorkload = teamWorkload.find(w => w.u_code === drawerUserCode) || {};

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.bgPrimary }}>
            {/* Global Filters */}
            <div style={{ padding: '16px 24px', flexShrink: 0, borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.bodyBg }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col>
                        <Title level={4} style={{ margin: 0 }}>Workload Dashboard</Title>
                    </Col>
                    <Col>
                        <Space wrap>
                            <Select
                                placeholder="All Projects"
                                allowClear
                                style={{ width: 200 }}
                                value={selectedProjectId}
                                onChange={setSelectedProjectId}
                                options={projects.map(p => ({ label: p.name, value: p.id }))}
                            />
                            <RangePicker
                                value={dateRange}
                                onChange={setDateRange}
                                style={{ borderRadius: theme.borderRadius.md }}
                            />
                            {activeTab === 'team_workload' && (
                                <Input
                                    placeholder="Search user..."
                                    prefix={<IoSearchOutline />}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: 180, borderRadius: theme.borderRadius.md }}
                                    allowClear
                                />
                            )}
                        </Space>
                    </Col>
                </Row>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    centered
                    tabBarStyle={{ backgroundColor: theme.colors.bodyBg, marginBottom: 24, padding: '0 24px' }}
                    items={[
                        {
                            key: 'my_workload',
                            label: <span><MdOutlinePerson /> My Workload</span>,
                            children: isLoading ? <div style={{ textAlign: 'center', padding: '100px 0' }}><Progress type="circle" percent={30} status="active" /></div> : renderMyWorkload(myWorkload)
                        },
                        {
                            key: 'team_workload',
                            label: <span><MdOutlineGroup /> Team Workload</span>,
                            children: isLoading ? <div style={{ textAlign: 'center', padding: '100px 0' }}><Progress type="circle" percent={30} status="active" /></div> : renderTeamWorkload()
                        }
                    ]}
                />
            </div>

            {/* Drill-down Drawer for Team View */}
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar style={{ backgroundColor: theme.colors.primary }}>{targetDrawerWorkload.u_name?.charAt(0)}</Avatar>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 16 }}>{targetDrawerWorkload.u_name}</div>
                            <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>{targetDrawerWorkload.u_code}</div>
                        </div>
                    </div>
                }
                placement="right"
                width={600}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Space>
                        <Button size="small">Adjust Capacity</Button>
                        <Button type="primary" size="small">Re-assign</Button>
                    </Space>
                }
            >
                {drawerVisible && renderMyWorkload(targetDrawerWorkload, true)}
            </Drawer>
        </div>
    );
};

export default WorkloadDashboard;
