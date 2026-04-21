import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Row, Col, Card, Avatar, Progress, Tag, Input, List, Empty, Tabs, Drawer, Select, Tooltip, Calendar, Badge, Space, Alert } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useTheme } from '../../../../theme';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import {
    MdOutlinePerson,
    MdOutlineGroup,
    MdCalendarToday,
    MdOutlineAssignment,
    MdTimer,
    MdWarning,
    MdOutlineSnooze,
    MdOutlineTrendingUp,
    MdOutlineTimer,
    MdOutlineReportProblem
} from 'react-icons/md';
import { IoSearchOutline, IoTimeOutline } from 'react-icons/io5';
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

// Note: Overdue tasks are always included in current timeframes to reflect true load
const TIMEFRAMES = {
    daily: { label: 'Daily (Today)', capacity: 6, filter: (d) => dayjs(d).isSame(dayjs(), 'day') || dayjs(d).isBefore(dayjs(), 'day') },
    weekly: { label: 'Weekly (This Week)', capacity: 30, filter: (d) => dayjs(d).isSame(dayjs(), 'week') || dayjs(d).isBefore(dayjs(), 'week') },
    monthly: { label: 'Monthly (This Month)', capacity: 120, filter: (d) => dayjs(d).isSame(dayjs(), 'month') || dayjs(d).isBefore(dayjs(), 'month') },
    yearly: { label: 'Yearly (This Year)', capacity: 1440, filter: (d) => dayjs(d).isSame(dayjs(), 'year') || dayjs(d).isBefore(dayjs(), 'year') },
    overall: { label: 'Overall (Until All Done)', capacity: 'dynamic', filter: () => true }
};

const WorkloadDashboard = ({ theme }) => {
    const { teamWorkload, fetchTeamWorkload, projects, isLoading } = useKanbanStore();
    const { empNo } = useAuthStore();
    
    const { isManagerOrCoord, isSuperAdmin } = useKanbanPermissions();
    const canViewTeam = isManagerOrCoord || isSuperAdmin;

    const [activeTab, setActiveTab] = useState('my_workload');
    const [timeframeMode, setTimeframeMode] = useState('weekly');
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [search, setSearch] = useState('');
    const [calendarUserFilter, setCalendarUserFilter] = useState('all');
    
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerUserCode, setDrawerUserCode] = useState(null);

    useEffect(() => {
        const params = {};
        if (selectedProjectId) params.project_id = selectedProjectId;
        fetchTeamWorkload(params);
    }, [fetchTeamWorkload, selectedProjectId]);

    const processedWorkload = useMemo(() => {
        const tf = TIMEFRAMES[timeframeMode];
        
        return teamWorkload.map(user => {
            const validCards = user.cards?.filter(c => c.list_type !== 'closed' && tf.filter(c.due_date)) || [];
            const totalHours = validCards.reduce((sum, c) => sum + (parseFloat(c.estimated_hours) || 0), 0);
            
            let capacity = tf.capacity;
            if (capacity === 'dynamic') {
                if (validCards.length === 0) {
                    capacity = 6;
                } else {
                    const maxDate = dayjs(Math.max(...validCards.map(c => dayjs(c.due_date).valueOf())));
                    let days = maxDate.diff(dayjs(), 'day', true);
                    if (days < 1) days = 1;
                    capacity = Math.round(days * 6);
                }
            }

            return {
                ...user,
                filteredCards: validCards,
                totalHours: Math.round(totalHours * 10) / 10,
                capacity: capacity,
                utilization: Math.min(Math.round((totalHours / capacity) * 100), 100)
            };
        });
    }, [teamWorkload, timeframeMode]);

    const myWorkload = useMemo(() => {
        const myCode = (empNo || '').toLowerCase();
        return processedWorkload.find(w => (w.u_code || '').toLowerCase() === myCode) || { totalHours: 0, capacity: 6, filteredCards: [] };
    }, [processedWorkload, empNo]);

    const getStats = (cards) => {
        const now = dayjs();
        let nearDeadline = 0, overdueReal = 0, overdueEstimated = 0, longPending = 0;
        cards.forEach(c => {
            const diffDays = dayjs(c.due_date).diff(now, 'day', true);
            if (diffDays < 0) {
                if (c.is_estimated_due_date) overdueEstimated++;
                else overdueReal++;
            }
            else if (diffDays <= 3) nearDeadline++;
            
            if (c.card_created_at && now.diff(dayjs(c.card_created_at), 'day') > 14) longPending++;
        });
        return { total: cards.length, nearDeadline, overdueReal, overdueEstimated, overdueTotal: overdueReal + overdueEstimated, longPending };
    };

    // =========================================================
    // COMPONENTS
    // =========================================================
    const StatCard = ({ title, value, icon, color, bg }) => (
        <Card size="small" style={{ borderRadius: theme.borderRadius.md, background: bg, border: 'none', height: '100%' }}>
            <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {title}</Text>
            <Title level={2} style={{ margin: '8px 0 0', color }}>{value}</Title>
        </Card>
    );

    const renderWorkloadView = (data, isTeamView = false) => {
        if (!data) return null;
        const stats = getStats(data.filteredCards || []);
        const estHours = data.totalHours;
        const capHours = data.capacity;
        const isOverloaded = estHours > capHours;
        const gaugeColor = isOverloaded ? theme.colors.error : (estHours > capHours * 0.8 ? theme.colors.warning : theme.colors.success);

        const sortedCards = [...(data.filteredCards || [])].sort((a, b) => dayjs(a.due_date).diff(dayjs(b.due_date)));

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: isTeamView ? 0 : '0 16px' }}>
                
                {/* Overdue Alert Banner */}
                {stats.overdueTotal > 0 && (
                    <Alert
                        message="Overdue Tasks Detected"
                        description={
                            <span>
                                You have <b>{stats.overdueTotal} tasks</b> that should have been completed by now 
                                ({stats.overdueReal} with hard deadlines, {stats.overdueEstimated} with estimated deadlines). 
                                Please prioritize them to prevent work buildup.
                            </span>
                        }
                        type="error"
                        showIcon
                        icon={<MdOutlineReportProblem />}
                    />
                )}

                <Row gutter={[16, 16]}>
                    <Col xs={12} sm={6}>
                        <StatCard title="Total Tasks" value={stats.total} icon={<MdOutlineAssignment />} color={theme.colors.info} bg={`${theme.colors.info}15`} />
                    </Col>
                    <Col xs={12} sm={6}>
                        <StatCard title="Near Deadline" value={stats.nearDeadline} icon={<MdTimer />} color={theme.colors.warning} bg={`${theme.colors.warning}15`} />
                    </Col>
                    <Col xs={12} sm={6}>
                        <StatCard title="Overdue" value={stats.overdueTotal} icon={<MdWarning />} color={theme.colors.error} bg={`${theme.colors.error}15`} />
                    </Col>
                    <Col xs={12} sm={6}>
                        <StatCard title="Long Pending" value={stats.longPending} icon={<MdOutlineSnooze />} color={theme.colors.textSecondary} bg={`${theme.colors.textSecondary}15`} />
                    </Col>
                </Row>

                <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, height: '100%', boxShadow: theme.shadows.sm }}>
                            <Row align="middle" justify="space-around" style={{ height: '100%' }}>
                                <Col span={10}>
                                    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
                                        <Doughnut 
                                            data={{
                                                labels: ['Allocated', 'Free'],
                                                datasets: [{
                                                    data: [estHours, Math.max(capHours - estHours, 0)],
                                                    backgroundColor: [gaugeColor, theme.colors.borderLight],
                                                    borderWidth: 0,
                                                    cutout: '80%'
                                                }]
                                            }} 
                                            options={{ plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }} 
                                        />
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '100%' }}>
                                            <Title level={3} style={{ margin: 0, color: gaugeColor }}>{estHours}h</Title>
                                            <Text type="secondary" style={{ fontSize: 11 }}>/ {capHours}h Limit</Text>
                                        </div>
                                    </div>
                                </Col>
                                <Col span={12}>
                                    <Title level={5}><MdOutlineTrendingUp style={{ color: theme.colors.primary, marginRight: 8 }}/> Capacity Analytics</Title>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                        Based on <b>{TIMEFRAMES[timeframeMode].label}</b> projection. 
                                        {isOverloaded ? " You are currently exceeding safe capacity limits." : " You are operating within safe capacity limits."}
                                    </Text>
                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Pending Tasks</Text>
                                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.total}</div>
                                        </div>
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Utilization</Text>
                                            <div style={{ fontSize: 20, fontWeight: 'bold', color: gaugeColor }}>{data.utilization}%</div>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                    
                    <Col xs={24} md={12}>
                        <Card size="small" title={`Task List (${TIMEFRAMES[timeframeMode].label})`} style={{ borderRadius: theme.borderRadius.lg, height: 300, overflowY: 'auto', boxShadow: theme.shadows.sm }}>
                            <List
                                dataSource={sortedCards}
                                locale={{ emptyText: <Empty description="No tasks scheduled for this timeframe" /> }}
                                renderItem={card => {
                                    const isOverdue = dayjs(card.due_date).isBefore(dayjs(), 'day');
                                    return (
                                        <List.Item style={{ padding: '12px 0', borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                                        <Tag color="blue" style={{ border: 'none', fontSize: 10 }}>{card.project_name}</Tag>
                                                        {card.is_unfeasible && <Tag color="error" style={{ border: 'none', fontSize: 10 }}>Unfeasible</Tag>}
                                                        {isOverdue && <Tag color="error" style={{ border: 'none', fontSize: 10 }}>Overdue</Tag>}
                                                    </div>
                                                    <Text strong style={{ fontSize: 13, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {card.card_name}
                                                    </Text>
                                                    <Text type={isOverdue ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>
                                                        Due: {dayjs(card.due_date).format('DD MMM YYYY')} {card.is_estimated_due_date && <i>(Estimated)</i>}
                                                    </Text>
                                                </div>
                                                <div style={{ textAlign: 'right', minWidth: 60 }}>
                                                    <Tag icon={<IoTimeOutline />} color="orange" style={{ margin: 0, fontWeight: 'bold' }}>
                                                        {card.estimated_hours}h
                                                    </Tag>
                                                </div>
                                            </div>
                                        </List.Item>
                                    );
                                }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    };

    const renderTeamWorkload = () => {
        let filtered = processedWorkload;
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(w =>
                w.u_name?.toLowerCase().includes(s) || w.u_code?.toLowerCase().includes(s)
            );
        }
        
        filtered.sort((a, b) => b.totalHours - a.totalHours);

        const commonCapacity = TIMEFRAMES[timeframeMode].capacity === 'dynamic' ? null : TIMEFRAMES[timeframeMode].capacity;
        const maxChartVal = Math.max(...filtered.map(w => w.totalHours), commonCapacity || 0, 10);

        const barData = {
            labels: filtered.map(w => w.u_name || w.u_code),
            datasets: [{
                label: 'Allocated Hours',
                data: filtered.map(w => w.totalHours),
                backgroundColor: filtered.map(w => {
                    if (w.totalHours > w.capacity) return theme.colors.error;
                    if (w.totalHours >= w.capacity * 0.8) return theme.colors.warning;
                    return theme.colors.success;
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
                verticalBaseline: commonCapacity ? { baseline: commonCapacity, color: theme.colors.error } : null
            },
            scales: {
                x: { beginAtZero: true, max: maxChartVal + (maxChartVal * 0.1) }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    setDrawerUserCode(filtered[elements[0].index].u_code);
                    setDrawerVisible(true);
                }
            }
        };

        return (
            <div style={{ padding: '0 16px' }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={24}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, boxShadow: theme.shadows.sm }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <Title level={5} style={{ margin: 0 }}>Team Utilization Chart</Title>
                                    <Text type="secondary">Based on {TIMEFRAMES[timeframeMode].label}. Click a bar to view details.</Text>
                                </div>
                                <Input
                                    placeholder="Search team..."
                                    prefix={<IoSearchOutline />}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: 200, borderRadius: theme.borderRadius.md }}
                                />
                            </div>
                            <div style={{ height: Math.max(300, filtered.length * 45) }}>
                                <Bar data={barData} options={barOptions} />
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    };

    const renderCalendar = () => {
        const getListData = (value) => {
            const dateStr = value.format('YYYY-MM-DD');
            let listData = [];
            
            let sources = processedWorkload;
            if (calendarUserFilter === 'me') {
                sources = [myWorkload];
            } else if (calendarUserFilter !== 'all') {
                sources = processedWorkload.filter(w => w.u_code === calendarUserFilter);
            }

            sources.forEach(w => {
                w.filteredCards.forEach(c => {
                    if (dayjs(c.due_date).format('YYYY-MM-DD') === dateStr) {
                        listData.push({
                            type: c.is_unfeasible ? 'error' : dayjs(c.due_date).isBefore(dayjs(), 'day') ? 'warning' : 'processing',
                            content: `[${w.u_code}] ${c.card_name} ${c.is_estimated_due_date ? '(Est.)' : ''}`
                        });
                    }
                });
            });

            return Array.from(new Set(listData.map(a => a.content)))
                .map(content => listData.find(a => a.content === content));
        };

        const dateCellRender = (value) => {
            const listData = getListData(value);
            return (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {listData.map((item, index) => (
                        <li key={index} style={{ marginBottom: 2 }}>
                            <Tooltip title={item.content}>
                                <Badge status={item.type} text={
                                    <span style={{ fontSize: 10, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.content}
                                    </span>
                                } />
                            </Tooltip>
                        </li>
                    ))}
                </ul>
            );
        };

        return (
            <div style={{ padding: '0 16px' }}>
                <Card size="small" style={{ borderRadius: theme.borderRadius.lg, boxShadow: theme.shadows.sm }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                        <Text strong>Filter Member:</Text>
                        <Select
                            value={calendarUserFilter}
                            onChange={setCalendarUserFilter}
                            style={{ width: 250 }}
                            showSearch
                            optionFilterProp="label"
                            options={[
                                { value: 'all', label: 'Entire Team' },
                                { value: 'me', label: 'My Calendar' },
                                ...processedWorkload.map(w => ({ value: w.u_code, label: `${w.u_code} - ${w.u_name}` }))
                            ]}
                        />
                    </div>
                    <Calendar dateCellRender={dateCellRender} />
                </Card>
            </div>
        );
    };

    const targetDrawerData = processedWorkload.find(w => w.u_code === drawerUserCode) || null;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.bgPrimary }}>
            
            <div style={{ padding: '20px 24px', backgroundColor: theme.colors.bodyBg, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col>
                        <Title level={3} style={{ margin: 0 }}>Workload & Capacity</Title>
                        <Text type="secondary">AI-driven analysis of effort distribution</Text>
                    </Col>
                    <Col>
                        <Space>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: theme.colors.bgSecondary, padding: '4px 12px', borderRadius: theme.borderRadius.md }}>
                                <MdOutlineTimer style={{ color: theme.colors.primary }} />
                                <Text strong>Analysis Mode:</Text>
                                <Select
                                    value={timeframeMode}
                                    onChange={setTimeframeMode}
                                    style={{ width: 200 }}
                                    variant="borderless"
                                    options={Object.entries(TIMEFRAMES).map(([key, val]) => ({ value: key, label: val.label }))}
                                />
                            </div>
                            <Select
                                placeholder="Filter by Project"
                                allowClear
                                style={{ width: 220 }}
                                value={selectedProjectId}
                                onChange={setSelectedProjectId}
                                options={projects.map(p => ({ label: p.name, value: p.id }))}
                            />
                        </Space>
                    </Col>
                </Row>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    centered
                    tabBarStyle={{ marginBottom: 24 }}
                    items={[
                        {
                            key: 'my_workload',
                            label: <span><MdOutlinePerson size={16} style={{ verticalAlign: 'middle', marginRight: 8 }}/>My Workload</span>,
                            children: isLoading ? <div style={{ textAlign: 'center', padding: '100px 0' }}><Progress type="circle" /></div> : renderWorkloadView(myWorkload)
                        },
                        canViewTeam && {
                            key: 'team_workload',
                            label: <span><MdOutlineGroup size={16} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Team Workload</span>,
                            children: isLoading ? <div style={{ textAlign: 'center', padding: '100px 0' }}><Progress type="circle" /></div> : renderTeamWorkload()
                        },
                        {
                            key: 'schedule',
                            label: <span><MdCalendarToday size={16} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Schedule</span>,
                            children: isLoading ? <div style={{ textAlign: 'center', padding: '100px 0' }}><Progress type="circle" /></div> : renderCalendar()
                        }
                    ].filter(Boolean)}
                />
            </div>

            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar style={{ backgroundColor: theme.colors.primary }}>{targetDrawerData?.u_name?.charAt(0)}</Avatar>
                        <div>
                            <div style={{ fontWeight: 600 }}>{targetDrawerData?.u_name}</div>
                            <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>{targetDrawerData?.u_code}</div>
                        </div>
                    </div>
                }
                placement="right"
                width={500}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
            >
                {drawerVisible && renderWorkloadView(targetDrawerData, true)}
            </Drawer>
        </div>
    );
};

export default WorkloadDashboard;
