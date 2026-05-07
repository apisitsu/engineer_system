import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Row, Col, Card, Avatar, Progress, Tag, Input, Empty, Tabs, Drawer, Select, Tooltip, Calendar, Badge, Space, Alert, Table } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
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
import { IoSearchOutline } from 'react-icons/io5';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
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
dayjs.extend(isSameOrBefore);

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
        const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
        const yPos = y.getPixelForValue(options.baseline);
        if (yPos >= top && yPos <= bottom) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(left, yPos);
            ctx.lineTo(right, yPos);
            ctx.lineWidth = 2;
            ctx.strokeStyle = options.color || '#ff4d4f';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
};
ChartJS.register(verticalBaselinePlugin);

const TOTAL_DAILY_HOURS = 8;
const DAILY_ROUTINE_HOURS = 2;
const NET_DAILY_CAPACITY = TOTAL_DAILY_HOURS - DAILY_ROUTINE_HOURS;

const getBusinessDays = (startDate, endDate) => {
    let start = dayjs(startDate || dayjs());
    let end = dayjs(endDate || dayjs());
    if (end.isBefore(start, 'day')) return 1;
    let count = 0;
    let current = start.clone();
    while (current.isSameOrBefore(end, 'day')) {
        const dayOfWeek = current.day();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        current = current.add(1, 'day');
    }
    return count > 0 ? count : 1; 
};

const getFiscalYearBounds = (currentDate = dayjs()) => {
    let year = currentDate.year();
    let month = currentDate.month(); // 0-indexed, March is 2
    if (month < 2) {
        return {
            fy_start: dayjs(`${year - 1}-03-01`).startOf('day'),
            fy_end: dayjs(`${year}-02-28`).endOf('month').endOf('day')
        };
    } else {
        return {
            fy_start: dayjs(`${year}-03-01`).startOf('day'),
            fy_end: dayjs(`${year + 1}-02-28`).endOf('month').endOf('day')
        };
    }
};

const CHART_COLORS = [
    '#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', 
    '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
];

const TIMEFRAMES = {
    daily: { label: 'Daily (Today)', getBounds: () => [dayjs().startOf('day'), dayjs().endOf('day')] },
    weekly: { label: 'Weekly (This Week)', getBounds: () => [dayjs().startOf('week'), dayjs().endOf('week')] },
    monthly: { label: 'Monthly (This Month)', getBounds: () => [dayjs().startOf('month'), dayjs().endOf('month')] },
    yearly: { label: 'Yearly (This Year)', getBounds: () => [dayjs().startOf('year'), dayjs().endOf('year')] },
    overall: { label: 'Overall (Until All Done)', getBounds: () => [dayjs().startOf('day'), dayjs().add(10, 'year')] }
};

const WorkloadDashboard = ({ theme }) => {
    const { teamWorkload, fetchTeamWorkload, projects, isLoading } = useKanbanStore(
        useShallow(state => ({
            teamWorkload: state.teamWorkload, fetchTeamWorkload: state.fetchTeamWorkload,
            projects: state.projects, isLoading: state.isLoading
        }))
    );
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
        const [tfStart, tfEnd] = tf.getBounds();
        
        return teamWorkload.map(user => {
            let userTotalHours = 0;
            const validCards = [];
            const projectsMap = {};

            (user.cards || []).forEach(card => {
                if (card.list_type === 'closed') return;

                let cStart = dayjs(card.start_date || card.card_created_at || dayjs());
                let cEnd = dayjs(card.due_date || dayjs());
                const totalHoursRaw = parseFloat(card.estimated_hours) || 0;
                
                let allocatedHours = 0;

                if (timeframeMode === 'overall') {
                    allocatedHours = totalHoursRaw;
                } else {
                    if (cEnd.isBefore(dayjs(), 'day')) {
                        if (dayjs().isBetween(tfStart, tfEnd, 'day', '[]')) {
                            allocatedHours = totalHoursRaw;
                        }
                    } else {
                        if (cStart.isBefore(dayjs(), 'day')) cStart = dayjs();
                        const totalBysDays = getBusinessDays(cStart, cEnd);
                        const hoursPerDay = totalHoursRaw / totalBysDays;
                        
                        let daysInTf = 0;
                        let curr = cStart.clone();
                        while (curr.isSameOrBefore(cEnd, 'day')) {
                            if (curr.isBetween(tfStart, tfEnd, 'day', '[]')) {
                                const d = curr.day();
                                if (d !== 0 && d !== 6) daysInTf++;
                            }
                            curr = curr.add(1, 'day');
                        }
                        allocatedHours = daysInTf * hoursPerDay;
                    }
                }

                if (allocatedHours > 0) {
                    const finalHours = Math.round(allocatedHours * 10) / 10;
                    userTotalHours += finalHours;
                    
                    const pName = card.project_name || 'Unassigned Project';
                    const bName = card.board_name || card.list_name || 'Main Board';

                    if (!projectsMap[pName]) projectsMap[pName] = { projectName: pName, totalHours: 0, boardsMap: {} };
                    if (!projectsMap[pName].boardsMap[bName]) projectsMap[pName].boardsMap[bName] = { boardName: bName, hours: 0, tasks: [] };

                    projectsMap[pName].totalHours += finalHours;
                    projectsMap[pName].boardsMap[bName].hours += finalHours;
                    
                    const cardCopy = { ...card, allocated_hours: finalHours };
                    projectsMap[pName].boardsMap[bName].tasks.push(cardCopy);
                    validCards.push(cardCopy);
                }
            });

            const projectsArray = Object.values(projectsMap).map(p => ({
                ...p,
                totalHours: Math.round(p.totalHours * 10) / 10,
                boards: Object.values(p.boardsMap).map(b => ({
                    ...b,
                    hours: Math.round(b.hours * 10) / 10
                }))
            }));

            let capacity = 0;
            if (timeframeMode === 'overall') {
                if (validCards.length === 0) capacity = NET_DAILY_CAPACITY;
                else {
                    const maxDate = dayjs(Math.max(...validCards.map(c => dayjs(c.due_date).valueOf())));
                    capacity = getBusinessDays(dayjs(), maxDate) * NET_DAILY_CAPACITY;
                }
            } else {
                capacity = getBusinessDays(tfStart, tfEnd) * NET_DAILY_CAPACITY;
            }

            return {
                ...user,
                filteredCards: validCards,
                projects: projectsArray,
                totalHours: Math.round(userTotalHours * 10) / 10,
                capacity: capacity,
                utilization: Math.min(Math.round((userTotalHours / capacity) * 100), 100) || 0
            };
        });
    }, [teamWorkload, timeframeMode]);

    const myWorkload = useMemo(() => {
        const myCode = (empNo || '').toLowerCase();
        return processedWorkload.find(w => (w.u_code || '').toLowerCase() === myCode) || { totalHours: 0, capacity: NET_DAILY_CAPACITY, filteredCards: [], projects: [] };
    }, [processedWorkload, empNo]);

    const fyeStats = useMemo(() => {
        const myCode = (empNo || '').toLowerCase();
        const user = teamWorkload.find(w => (w.u_code || '').toLowerCase() === myCode);
        if (!user || !user.cards) return null;

        const { fy_start, fy_end } = getFiscalYearBounds();
        const totalFyDays = getBusinessDays(fy_start, fy_end);
        const grossAnnualCapacity = totalFyDays * TOTAL_DAILY_HOURS;
        const netAnnualCapacity = totalFyDays * NET_DAILY_CAPACITY;

        const today = dayjs();
        const ytd_end = today.isBefore(fy_end) ? today : fy_end;
        const ytdDays = getBusinessDays(fy_start, ytd_end);

        let ytdHours = ytdDays * DAILY_ROUTINE_HOURS; // Baseline Routine YTD

        user.cards.forEach(card => {
            // Note: If you want true FYE, ideally you include closed cards too if available.
            // For now we process whatever is in user.cards (which are typically active cards)
            if (card.list_type === 'closed') return;
            
            let cStart = dayjs(card.start_date || card.card_created_at || today);
            let cEnd = dayjs(card.due_date || today);
            const totalHoursRaw = parseFloat(card.estimated_hours) || 0;
            
            let totalBysDays = getBusinessDays(cStart, cEnd);
            let hoursPerDay = totalHoursRaw / totalBysDays;

            let curr = cStart.clone();
            while (curr.isSameOrBefore(cEnd, 'day')) {
                const d = curr.day();
                if (d !== 0 && d !== 6) {
                    if (curr.isBetween(fy_start, fy_end, 'day', '[]')) {
                        if (curr.isSameOrBefore(today, 'day')) {
                            ytdHours += hoursPerDay;
                        }
                    }
                }
                curr = curr.add(1, 'day');
            }
        });

        let monthDiff = ytd_end.diff(fy_start, 'month', true);
        if (monthDiff < 1) monthDiff = 1;

        const avgMonthlyBurn = ytdHours / monthDiff;
        const remainingFyHours = Math.max(0, netAnnualCapacity - (ytdHours - (ytdDays * DAILY_ROUTINE_HOURS))); // Remaining net capacity

        return {
            grossAnnualCapacity,
            netAnnualCapacity,
            ytdHours: Math.round(ytdHours * 10) / 10,
            remainingFyHours: Math.round(remainingFyHours * 10) / 10,
            avgMonthlyBurn: Math.round(avgMonthlyBurn * 10) / 10
        };
    }, [teamWorkload, empNo]);

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

    const StatCard = ({ title, value, icon, color, bg }) => (
        <Card size="small" style={{ borderRadius: theme.borderRadius.md, background: bg, border: 'none', height: '100%' }}>
            <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {title}</Text>
            <Title level={2} style={{ margin: '8px 0 0', color }}>{value}</Title>
        </Card>
    );

    const MyWorkloadTable = ({ data }) => {
        const projectColumns = [
            { title: 'Project', dataIndex: 'projectName', key: 'projectName', render: text => <Text strong>{text}</Text> },
            { title: 'Total Hours', dataIndex: 'totalHours', key: 'totalHours', render: val => <Tag color="blue">{val}h</Tag>, width: 120 }
        ];

        const expandedRowRender = (project) => {
            const boardColumns = [
                { title: 'Board', dataIndex: 'boardName', key: 'boardName' },
                { title: 'Hours', dataIndex: 'hours', key: 'hours', render: val => <Tag color="cyan">{val}h</Tag>, width: 120 }
            ];

            const taskExpandedRowRender = (board) => {
                const taskColumns = [
                    { title: 'Task Name', dataIndex: 'card_name', key: 'card_name' },
                    { title: 'Status', dataIndex: 'list_name', key: 'list_name', width: 150 },
                    { title: 'Due Date', dataIndex: 'due_date', key: 'due_date', render: d => dayjs(d).format('DD MMM YYYY'), width: 150 },
                    { title: 'Alloc. Hours', dataIndex: 'allocated_hours', key: 'allocated_hours', render: val => `${val}h`, width: 120 }
                ];
                return <Table columns={taskColumns} dataSource={board.tasks} pagination={false} rowKey="id" size="small" />;
            };

            return <Table columns={boardColumns} dataSource={project.boards} pagination={false} expandable={{ expandedRowRender: taskExpandedRowRender }} rowKey="boardName" size="small" />;
        };

        return <Table columns={projectColumns} dataSource={data.projects} expandable={{ expandedRowRender }} rowKey="projectName" size="middle" />;
    };

    const renderWorkloadView = (data, isTeamView = false) => {
        if (!data) return null;
        const stats = getStats(data.filteredCards || []);
        
        let routineHours = 0;
        let totalGrossCapacity = 0;
        let capHours = data.capacity; // This is net capacity
        
        if (timeframeMode === 'overall') {
            routineHours = (data.capacity / NET_DAILY_CAPACITY) * DAILY_ROUTINE_HOURS;
            totalGrossCapacity = (data.capacity / NET_DAILY_CAPACITY) * TOTAL_DAILY_HOURS;
        } else {
            const [s, e] = TIMEFRAMES[timeframeMode].getBounds();
            const bd = getBusinessDays(s, e);
            routineHours = bd * DAILY_ROUTINE_HOURS;
            totalGrossCapacity = bd * TOTAL_DAILY_HOURS;
        }

        const estHours = data.totalHours; // Kanban allocated
        const totalAllocated = estHours + routineHours;
        const isOverloaded = totalAllocated > totalGrossCapacity;
        const gaugeColor = isOverloaded ? theme.colors.error : (totalAllocated > totalGrossCapacity * 0.8 ? theme.colors.warning : theme.colors.success);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: isTeamView ? 0 : '0 16px' }}>
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
                    <Col xs={24} md={10}>
                        <Card size="small" style={{ borderRadius: theme.borderRadius.lg, minHeight: 420, height: '100%', boxShadow: theme.shadows.sm }}>
                            <Row align="top" justify="space-around" style={{ height: '100%', flexDirection: 'column' }}>
                                <Col span={24} style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <Title level={5}><MdOutlineTrendingUp style={{ color: theme.colors.primary, marginRight: 8 }}/> Capacity Analytics</Title>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                        Based on <b>{TIMEFRAMES[timeframeMode].label}</b> projection.
                                    </Text>
                                    <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}>
                                        <Doughnut 
                                            data={{
                                                labels: ['Routine / Admin', ...(data.projects.length > 0 ? data.projects.map(p => p.projectName) : [])],
                                                datasets: [{
                                                    data: [routineHours, ...(data.projects.length > 0 ? data.projects.map(p => p.totalHours) : [])],
                                                    backgroundColor: [theme.colors.borderLight || '#d9d9d9', ...(data.projects.length > 0 ? data.projects.map((p, i) => CHART_COLORS[i % CHART_COLORS.length]) : [])],
                                                    borderWidth: 0,
                                                    cutout: '70%'
                                                }]
                                            }} 
                                            options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }} 
                                        />
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '100%' }}>
                                            <Title level={3} style={{ margin: 0, color: gaugeColor }}>{Math.round(totalAllocated*10)/10}h</Title>
                                            <Text type="secondary" style={{ fontSize: 11 }}>/ {totalGrossCapacity}h Limit</Text>
                                        </div>
                                    </div>
                                </Col>
                                
                                {fyeStats && (
                                    <Col span={24} style={{ width: '100%', marginTop: 12, paddingTop: 16, borderTop: `1px solid ${theme.colors.borderLight}` }}>
                                        <Title level={5}><MdOutlineTrendingUp style={{ color: theme.colors.primary, marginRight: 8 }}/> FYE YTD Analytics</Title>
                                        <Row gutter={[16, 16]}>
                                            <Col span={12}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>Gross FY Cap</Text>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>{fyeStats.grossAnnualCapacity}h</div>
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>Net FY Cap</Text>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>{fyeStats.netAnnualCapacity}h</div>
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>YTD Burned</Text>
                                                <div style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.warning }}>{fyeStats.ytdHours}h</div>
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>Avg Burn Rate</Text>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>{fyeStats.avgMonthlyBurn}h/mo</div>
                                            </Col>
                                        </Row>
                                    </Col>
                                )}
                            </Row>
                        </Card>
                    </Col>
                    
                    <Col xs={24} md={14}>
                        <Card size="small" title={`Project Breakdown (${TIMEFRAMES[timeframeMode].label})`} style={{ borderRadius: theme.borderRadius.lg, minHeight: 420, height: '100%', overflowY: 'auto', boxShadow: theme.shadows.sm }}>
                            {data.projects.length > 0 ? (
                                <MyWorkloadTable data={data} />
                            ) : (
                                <Empty description="No tasks scheduled for this timeframe" />
                            )}
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

        let commonCapacity = 0;
        let commonRoutine = 0;
        if (TIMEFRAMES[timeframeMode].getBounds) {
             const [s, e] = TIMEFRAMES[timeframeMode].getBounds();
             const bd = getBusinessDays(s, e);
             commonCapacity = bd * TOTAL_DAILY_HOURS;
             commonRoutine = bd * DAILY_ROUTINE_HOURS;
        }

        const allProjects = Array.from(new Set(filtered.flatMap(w => w.projects.map(p => p.projectName))));
        
        const routineDataset = {
            label: 'Routine / Admin',
            data: filtered.map(w => {
                if (timeframeMode === 'overall') {
                    return (w.capacity / NET_DAILY_CAPACITY) * DAILY_ROUTINE_HOURS;
                }
                return commonRoutine;
            }),
            backgroundColor: theme.colors.borderLight || '#d9d9d9',
            stack: 'Stack 0',
        };

        const projectDatasets = allProjects.map((projName, i) => ({
            label: projName,
            data: filtered.map(w => {
                const p = w.projects.find(proj => proj.projectName === projName);
                return p ? p.totalHours : 0;
            }),
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
            stack: 'Stack 0',
        }));

        const datasets = [routineDataset, ...projectDatasets];

        const barData = {
            labels: filtered.map(w => w.u_name || w.u_code),
            datasets: datasets
        };

        const barOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                verticalBaseline: timeframeMode !== 'overall' ? { baseline: commonCapacity, color: theme.colors.error } : null,
                tooltip: {
                    callbacks: {
                        afterLabel: (context) => {
                            const userIndex = context.dataIndex;
                            const user = filtered[userIndex];
                            const datasetLabel = context.dataset.label;
                            
                            if (datasetLabel === 'Routine / Admin') return 'Base Hours';

                            const project = user.projects.find(p => p.projectName === datasetLabel);
                            if (!project || project.boards.length === 0) return '';
                            
                            const lines = ['--- Boards ---'];
                            project.boards.forEach(b => {
                                lines.push(`${b.boardName}: ${b.hours}h`);
                            });
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
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
                            <div style={{ height: 400 }}>
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
                width={800}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
            >
                {drawerVisible && renderWorkloadView(targetDrawerData, true)}
            </Drawer>
        </div>
    );
};

export default WorkloadDashboard;
