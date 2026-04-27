import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Typography, Spin, Alert, Select, Button, Space, Input, Avatar, Tooltip, Badge, Dropdown, Form, Tag, Popover, Tabs, Row, Col, Progress, Statistic, Layout, Switch, Menu, Checkbox, Modal } from 'antd';
import { useKanbanStore } from './store/kanbanStore';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useNavigate, useParams } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    IoSettingsOutline, IoSearchOutline, IoAddOutline, IoGridOutline,
    IoListOutline, IoChevronBackOutline, IoNotificationsOutline, IoStarOutline, IoStar,
    IoCalendarOutline, IoLayersOutline, IoTimeOutline, IoHelpCircleOutline,
    IoRocketOutline, IoFlashOutline, IoHeartOutline, IoDiamondOutline,
    IoLeafOutline, IoBookOutline, IoCodeSlashOutline, IoColorPaletteOutline,
    IoGameControllerOutline, IoMusicalNotesOutline, IoPlanetOutline, IoShieldCheckmarkOutline,
    IoTrophyOutline, IoBulbOutline, IoConstructOutline, IoCubeOutline,
    IoFlagOutline, IoGlobeOutline, IoHammerOutline, IoPizzaOutline,
    IoPulseOutline, IoSchoolOutline, IoTerminalOutline, IoThunderstormOutline,
    IoWaterOutline, IoAirplaneOutline, IoBicycleOutline, IoCafeOutline,
    IoFitnessOutline, IoHomeOutline, IoLockClosedOutline
} from 'react-icons/io5';
import { useKanbanPermissions } from './hooks/useKanbanPermissions';
import { MdOutlinePeople, MdOutlineLabel, MdOutlineDashboard, MdPersonAddAlt1, MdOutlineAssessment } from 'react-icons/md';
import { BsKanban, BsThreeDots, BsGrid3X3Gap, BsList } from 'react-icons/bs';
import { FiPlus, FiMoreVertical, FiEdit2, FiTrash2, FiSearch, FiMessageSquare, FiPaperclip, FiFilter } from 'react-icons/fi';
import { AiOutlineCheck, AiOutlineClose, AiOutlineEdit, AiOutlineStar, AiFillStar } from 'react-icons/ai';
import { RiKanbanView } from 'react-icons/ri';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extracted Tab Components
import DashboardTab from './Tabs/DashboardTab';
import ProjectsTab from './Tabs/ProjectsTab';
import ReportsTab from './Tabs/ReportsTab';
import WorkloadTab from './Tabs/WorkloadTab';

import BoardView from './Board/BoardView';
import CardDetailDrawer from './CardDetail/CardDetailDrawer';
import ProjectSettingsDrawer from './Settings/ProjectSettingsDrawer';
import BoardSettingsDrawer from './Settings/BoardSettingsDrawer';
import ScrollbarStyle from '../../common/scrollbar';
import UserGuideDrawer from './UserGuide/UserGuideDrawer';
import BoardGuideDrawer from './UserGuide/BoardGuideDrawer';

dayjs.extend(relativeTime);

const { Content } = Layout;
const { Title, Text } = Typography;

// ─── Gradient colors for project cards ────────────────────────────
const GRADIENTS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#0ea5e9,#3b82f6)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#ec4899,#f43f5e)',
    'linear-gradient(135deg,#14b8a6,#06b6d4)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#f97316,#fb923c)',
];

// ─── Selectable project icons ─────────────────────────────────────
const PROJECT_ICONS = [
    { key: 'rocket', icon: IoRocketOutline, label: 'Rocket' },
    { key: 'flash', icon: IoFlashOutline, label: 'Flash' },
    { key: 'heart', icon: IoHeartOutline, label: 'Heart' },
    { key: 'diamond', icon: IoDiamondOutline, label: 'Diamond' },
    { key: 'leaf', icon: IoLeafOutline, label: 'Leaf' },
    { key: 'book', icon: IoBookOutline, label: 'Book' },
    { key: 'code', icon: IoCodeSlashOutline, label: 'Code' },
    { key: 'palette', icon: IoColorPaletteOutline, label: 'Palette' },
    { key: 'game', icon: IoGameControllerOutline, label: 'Game' },
    { key: 'music', icon: IoMusicalNotesOutline, label: 'Music' },
    { key: 'planet', icon: IoPlanetOutline, label: 'Planet' },
    { key: 'shield', icon: IoShieldCheckmarkOutline, label: 'Shield' },
    { key: 'trophy', icon: IoTrophyOutline, label: 'Trophy' },
    { key: 'bulb', icon: IoBulbOutline, label: 'Bulb' },
    { key: 'construct', icon: IoConstructOutline, label: 'Tools' },
    { key: 'cube', icon: IoCubeOutline, label: 'Cube' },
    { key: 'flag', icon: IoFlagOutline, label: 'Flag' },
    { key: 'globe', icon: IoGlobeOutline, label: 'Globe' },
    { key: 'hammer', icon: IoHammerOutline, label: 'Hammer' },
    { key: 'pizza', icon: IoPizzaOutline, label: 'Pizza' },
    { key: 'pulse', icon: IoPulseOutline, label: 'Pulse' },
    { key: 'school', icon: IoSchoolOutline, label: 'School' },
    { key: 'terminal', icon: IoTerminalOutline, label: 'Terminal' },
    { key: 'storm', icon: IoThunderstormOutline, label: 'Storm' },
    { key: 'water', icon: IoWaterOutline, label: 'Water' },
    { key: 'airplane', icon: IoAirplaneOutline, label: 'Airplane' },
    { key: 'bicycle', icon: IoBicycleOutline, label: 'Bicycle' },
    { key: 'cafe', icon: IoCafeOutline, label: 'Cafe' },
    { key: 'fitness', icon: IoFitnessOutline, label: 'Fitness' },
    { key: 'home', icon: IoHomeOutline, label: 'Home' },
    { key: 'kanban', icon: BsKanban, label: 'Kanban' },
    { key: 'layers', icon: IoLayersOutline, label: 'Layers' },
    { key: 'settings', icon: IoSettingsOutline, label: 'Settings' },
    { key: 'star', icon: IoStarOutline, label: 'Star' },
    { key: 'time', icon: IoTimeOutline, label: 'Time' },
    { key: 'calendar', icon: IoCalendarOutline, label: 'Calendar' },
];

const getProjectIcon = (iconKey) => {
    const found = PROJECT_ICONS.find(i => i.key === iconKey);
    return found ? found.icon : null;
};

// ─── Helper Components for Project Creation ────────────────────────
const GradientPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
        {GRADIENTS.map((g, i) => (
            <div
                key={i}
                onClick={() => onChange(g)}
                style={{
                    width: 28, height: 28, borderRadius: '50%', background: g,
                    cursor: 'pointer', border: value === g ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                    boxShadow: value === g ? '0 0 0 1px #fff' : 'none',
                    transition: 'all 0.2s ease', transform: value === g ? 'scale(1.1)' : 'none',
                }}
            />
        ))}
    </div>
);

const IconPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
        {PROJECT_ICONS.map((item) => {
            const Icon = item.icon;
            return (
                <Tooltip key={item.key} title={item.label}>
                    <div
                        onClick={() => onChange(item.key)}
                        style={{
                            width: 32, height: 32, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', background: value === item.key ? theme.colors.primary : theme.colors.surface,
                            color: value === item.key ? '#fff' : theme.colors.textSecondary,
                            border: `1px solid ${value === item.key ? theme.colors.primary : theme.colors.border}`,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <Icon size={16} />
                    </div>
                </Tooltip>
            );
        })}
    </div>
);

// ─── Project List Page ─────────────────────────────────────────────
const ProjectListPage = ({ onSelectProject, theme }) => {
    const {
        projects, fetchProjects, isLoading, openProjectSettings,
        createProject, toggleFavorite, kanbanTabOrder
    } = useKanbanStore();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUserGuide, setShowUserGuide] = useState(false);
    const [form] = Form.useForm();

    // Default active tab to the first item in the preferred order
    const [activeTab, setActiveTab] = useState(kanbanTabOrder?.[0] || 'dashboard');

    // Global permissions
    const { canCreateProject } = useKanbanPermissions();

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    // Creation State
    const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
    const [selectedIcon, setSelectedIcon] = useState('rocket');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedPriority, setSelectedPriority] = useState('Medium');
    const [selectedStatus, setSelectedStatus] = useState('Active');

    const handleCreate = async (values) => {
        const result = await createProject({
            ...values,
            background_type: 'gradient',
            background_value: selectedGradient,
            icon: selectedIcon,
            is_private: isPrivate,
            priority: selectedPriority,
            status: selectedStatus,
        });
        if (result) {
            setShowCreateModal(false);
            form.resetFields();
            setSelectedGradient(GRADIENTS[0]);
            setSelectedIcon('rocket');
            setIsPrivate(false);
            setSelectedPriority('Medium');
            setSelectedStatus('Active');
            fetchProjects();
        }
    };

    const handleToggleFavorite = async (projectId) => {
        await toggleFavorite(projectId);
    };

    // Tab items configuration
    const tabConfig = {
        dashboard: {
            key: 'dashboard',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 120 }}>
                    <MdOutlineDashboard size={15} /> Dashboard
                </span>
            ),
            content: (
                <DashboardTab
                    projects={projects}
                    isLoading={isLoading}
                    onSelectProject={onSelectProject}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenProjectSettings={openProjectSettings}
                    onShowCreateModal={() => setShowCreateModal(true)}
                    theme={theme}
                />
            )
        },
        projects: {
            key: 'projects',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 120 }}>
                    <BsKanban size={14} /> Projects
                    {projects.length > 0 && <Badge count={projects.length} size="small" style={{ backgroundColor: theme.colors.primary, fontSize: 10 }} />}
                </span>
            ),
            content: (
                <ProjectsTab
                    projects={projects}
                    onSelectProject={onSelectProject}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenProjectSettings={openProjectSettings}
                    onShowCreateModal={() => setShowCreateModal(true)}
                    theme={theme}
                />
            )
        },
        reports: {
            key: 'reports',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 120 }}>
                    <MdOutlineAssessment size={15} /> Reports
                </span>
            ),
            content: <ReportsTab theme={theme} />
        },
        workload: {
            key: 'workload',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 120 }}>
                    <IoTimeOutline size={15} /> Workload
                </span>
            ),
            content: <WorkloadTab theme={theme} />
        }
    };

    // Build tabs based on preferred order
    const orderedTabs = useMemo(() => {
        return kanbanTabOrder.map(key => tabConfig[key]).filter(Boolean);
    }, [kanbanTabOrder, projects, theme]);

    // Ensure activeTab is still valid after order changes
    useEffect(() => {
        if (kanbanTabOrder && !kanbanTabOrder.includes(activeTab)) {
            setActiveTab(kanbanTabOrder[0]);
        }
    }, [kanbanTabOrder, activeTab]);

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: theme.colors.background, overflow: 'hidden' }}>
            <ScrollbarStyle primary={theme.colors.primary} />
            {/* Page Header */}
            <div style={{
                background: theme.colors.surface,
                borderBottom: `1px solid ${theme.colors.border}`,
                padding: `${theme.spacing.lg} ${theme.spacing['2xl']}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: theme.borderRadius.md,
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark || theme.colors.primary}CC)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <RiKanbanView size={22} color="#fff" />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                            Projects Management System
                            <Tooltip title="User Guide">
                                <Button
                                    type="text"
                                    shape="circle"
                                    icon={<IoHelpCircleOutline size={18} />}
                                    onClick={() => setShowUserGuide(true)}
                                    style={{ color: theme.colors.textSecondary, marginLeft: 4 }}
                                />
                            </Tooltip>
                        </Title>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            {projects.length} projects total
                        </Text>
                    </div>
                </div>
                {canCreateProject && (
                    <Button
                        type="primary"
                        icon={<IoAddOutline size={18} />}
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            background: theme.colors.primary, borderColor: theme.colors.primary,
                            borderRadius: theme.borderRadius.md, height: 38,
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                        }}
                    >
                        New Project
                    </Button>
                )}
            </div>

            {/* Main Content Area with Dynamic Tabs */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                maxWidth: 1500,
                width: '100%',
                margin: '0 auto',
                padding: `0 ${theme.spacing['2xl']}`,
            }}>
                <div style={{ flexShrink: 0 }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        size="default"
                        style={{ marginBottom: 0 }}
                        items={orderedTabs.map(t => ({ key: t.key, label: t.label }))}
                    />
                </div>

                <div className={activeTab === 'reports' ? "" : "kb-vscroll"} style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: activeTab === 'reports' ? 'hidden' : 'auto',
                    padding: activeTab === 'reports' ? '16px 16px 0 16px' : '16px'
                }}>
                    {tabConfig[activeTab]?.content}
                </div>
            </div>

            {/* Create Project Modal */}
            <Modal
                title={<span style={{ color: theme.colors.textPrimary }}>Create Project</span>}
                open={showCreateModal}
                onCancel={() => { setShowCreateModal(false); form.resetFields(); }}
                footer={null}
                styles={{ body: { padding: theme.spacing.xl } }}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate}>
                    <Form.Item name="name" label="Project Name" rules={[{ required: true, message: 'Please enter a project name' }]}>
                        <Input placeholder="Enter project name..." />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea placeholder="Add a description..." autoSize={{ minRows: 2, maxRows: 4 }} />
                    </Form.Item>
                    <Form.Item label="Gradient Color">
                        <GradientPicker value={selectedGradient} onChange={setSelectedGradient} theme={theme} />
                    </Form.Item>
                    <Form.Item label="Project Icon">
                        <IconPicker value={selectedIcon} onChange={setSelectedIcon} theme={theme} />
                    </Form.Item>
                    <Form.Item label={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <IoLockClosedOutline size={14} /> Private Project
                        </span>
                    }>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Switch checked={isPrivate} onChange={setIsPrivate} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {isPrivate
                                    ? 'Only members can see this project'
                                    : 'Visible to managers and coordinators'}
                            </Text>
                        </div>
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item label="Priority" style={{ flex: 1 }}>
                            <Select value={selectedPriority} onChange={setSelectedPriority}>
                                <Select.Option value="Low">Low</Select.Option>
                                <Select.Option value="Medium">Medium</Select.Option>
                                <Select.Option value="High">High</Select.Option>
                                <Select.Option value="Urgent">Urgent</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item label="Status" style={{ flex: 1 }}>
                            <Select value={selectedStatus} onChange={setSelectedStatus}>
                                <Select.Option value="Waiting">Waiting (Pool)</Select.Option>
                                <Select.Option value="Active">Active</Select.Option>
                                <Select.Option value="Completed">Completed</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block
                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary, height: 40 }}
                        >
                            Create Project
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <ProjectSettingsDrawer />
            <UserGuideDrawer open={showUserGuide} onClose={() => setShowUserGuide(false)} theme={theme} />
        </div>
    );
};

// ─── Board Toolbar Component ───────────────────────────────────────
const BoardToolbar = ({ theme, activeProject }) => {
    const {
        activeBoard, activeBoardMembers, labels, searchQuery, filterMembers, filterLabels,
        setSearchQuery, toggleFilterMember, toggleFilterLabel, viewMode, setViewMode, clearFilters,
        openBoardSettings,
        notifications, unreadNotificationCount, fetchNotifications, markAllNotificationsRead, markNotificationRead, openCardDetail,
        projectManagers, fetchProjectManagers, addProjectManager, removeProjectManager,
        users, fetchUsers
    } = useKanbanStore();

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const [showSearch, setShowSearch] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [showBoardGuide, setShowBoardGuide] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [showMemberFilter, setShowMemberFilter] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberFilterSearch, setMemberFilterSearch] = useState('');
    const [showAllNotifs, setShowAllNotifs] = useState(false);

    useEffect(() => {
        if (activeProject?.id) { fetchProjectManagers(activeProject.id); }
    }, [activeProject?.id, fetchProjectManagers]);

    const availableUsersForProject = users.filter(u =>
        u.u_code.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (u.u_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (u.u_nickname || '').toLowerCase().includes(memberSearch.toLowerCase())
    );

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const hasFilters = searchQuery || filterMembers.length > 0 || filterLabels.length > 0;

    const filteredNotifications = useMemo(() => {
        if (showAllNotifs) return notifications || [];
        return (notifications || []).filter(n => {
            if (!n.is_read) return true;
            return dayjs().diff(dayjs(n.created_at), 'hour') < 48;
        });
    }, [notifications, showAllNotifs]);

    const hasHiddenNotifs = (notifications?.length || 0) > filteredNotifications.length;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
            background: `${theme.colors.surface}CC`,
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${theme.colors.border}`,
        }}>
            <Space size={12}>
                {/* Members Section (Project + Board) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 8 }}>
                    {/* Board Members */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 2 }}>Board</Typography.Text>
                        <Avatar.Group max={{ count: 3, style: { color: '#1677ff', backgroundColor: '#e6f4ff' } }} size="small">
                            {activeBoardMembers.map(mgr => {
                                const userObj = users.find(u => u.u_code?.toLowerCase() === mgr.u_code?.toLowerCase());
                                const name = userObj?.u_name || userObj?.u_nickname || mgr.u_code;
                                const words = (userObj?.u_name || '').split(' ');
                                const initials = words.length >= 2
                                    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                    : (userObj?.u_nickname?.[0] || mgr.u_code[0]).toUpperCase();
                                return (
                                    <Tooltip title={`${name} (Board Member)`} placement="bottom" key={mgr.id || mgr.u_code}>
                                        {userObj?.profile_img_b64 ? (
                                            <Avatar size="small" src={userObj.profile_img_b64} />
                                        ) : (
                                            <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>{initials}</Avatar>
                                        )}
                                    </Tooltip>
                                );
                            })}
                        </Avatar.Group>
                        <Popover
                            trigger="click" placement="bottom"
                            title={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography.Text strong>Board Members</Typography.Text>
                                </div>
                            }
                            content={
                                <div style={{ width: 250 }}>
                                    <Select
                                        showSearch
                                        placeholder="Add member to board..."
                                        style={{ width: '100%', marginBottom: 12 }}
                                        optionFilterProp="children"
                                        onSearch={setMemberSearch}
                                        onChange={(val) => {
                                            if (val) useKanbanStore.getState().addBoardMember(activeBoard.id, val);
                                        }}
                                        value={null}
                                        filterOption={false}
                                    >
                                        {availableUsersForProject.map(u => (
                                            <Select.Option key={u.u_code} value={u.u_code}>
                                                <Space>
                                                    {u.profile_img_b64 ? (
                                                        <Avatar size="small" src={u.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                            {(u.u_name || u.u_code)[0].toUpperCase()}
                                                        </Avatar>
                                                    )}

                                                    <Typography.Text style={{ fontSize: 13 }}>
                                                        {u.u_code} - {u.u_name || u.u_nickname || u.u_code}
                                                    </Typography.Text>
                                                </Space>
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {activeBoardMembers.map(mgr => {
                                            const u = users.find(user => user.u_code?.toLowerCase() === mgr.u_code?.toLowerCase()) || { u_code: mgr.u_code, u_name: mgr.u_code };
                                            const words = (u.u_name || '').split(' ');
                                            const initials = words.length >= 2
                                                ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                                : (u.u_nickname?.[0] || u.u_code[0]).toUpperCase();
                                            return (
                                                <div
                                                    key={mgr.u_code}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '6px 8px', borderRadius: theme.borderRadius.sm,
                                                        background: `${theme.colors.info}10`,
                                                    }}
                                                >
                                                    <Space>
                                                        {u.profile_img_b64 ? (
                                                            <Avatar size="small" src={u.profile_img_b64} />
                                                        ) : (
                                                            <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                                {initials}
                                                            </Avatar>
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <Typography.Text style={{ fontSize: 13, lineHeight: 1.2 }}>{u.u_name || u.u_nickname || u.u_code}</Typography.Text>
                                                            <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{u.u_code}</Typography.Text>
                                                        </div>
                                                    </Space>
                                                    <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => useKanbanStore.getState().removeBoardMember(activeBoard.id, mgr.u_code)} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            }
                        >
                            <Button shape="circle" size="small" type="text" icon={<IoAddOutline size={16} />}
                                style={{ background: theme.colors.surfaceHover, color: theme.colors.textSecondary }} />
                        </Popover>
                    </div>
                </div >

                {/* Filter Members — Multi-select Popover */}
                < Popover
                    content={
                        < div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Input
                                size="small" placeholder="Search members by name or ID..."
                                prefix={<IoSearchOutline />}
                                value={memberFilterSearch}
                                onChange={e => setMemberFilterSearch(e.target.value)}
                                style={{ marginBottom: 8, borderRadius: theme.borderRadius.sm }}
                                allowClear
                            />
                            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {/* Merge all unique users spanning project and board */}
                                {Array.from(new Set([...(projectManagers || []), ...(activeBoardMembers || [])].map(m => m.u_code)))
                                    .filter(uCode => {
                                        if (!memberFilterSearch) return true;
                                        const q = memberFilterSearch.toLowerCase();
                                        const u = users.find(user => user.u_code?.toLowerCase() === uCode?.toLowerCase());
                                        const name = u?.u_name || u?.u_nickname || uCode || '';
                                        return name.toLowerCase().includes(q) || uCode.toLowerCase().includes(q);
                                    }).map(uCode => {
                                        const u = users.find(user => user.u_code?.toLowerCase() === uCode?.toLowerCase());
                                        const name = u?.u_name || u?.u_nickname || uCode || 'User';
                                        const initials = name.charAt(0).toUpperCase();
                                        const isChecked = filterMembers.includes(uCode);
                                        return (
                                            <div
                                                key={uCode}
                                                onClick={() => toggleFilterMember(uCode)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '6px 8px', borderRadius: theme.borderRadius.sm,
                                                    cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
                                                    background: isChecked ? `${theme.colors.primary}15` : 'transparent',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = isChecked ? `${theme.colors.primary}20` : theme.colors.surfaceHover; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = isChecked ? `${theme.colors.primary}15` : 'transparent'; }}
                                            >
                                                <Space>
                                                    {u?.profile_img_b64 ? (
                                                        <Avatar size="small" src={u?.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size="small" style={{ backgroundColor: isChecked ? theme.colors.primary : theme.colors.secondary }}>
                                                            {initials}
                                                        </Avatar>
                                                    )}
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Text style={{ fontSize: 13, lineHeight: 1.2 }}>{name}</Text>
                                                        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{uCode}</Text>
                                                    </div>
                                                </Space>
                                                {isChecked && <AiOutlineCheck color={theme.colors.primary} size={16} />}
                                            </div>
                                        );
                                    })}
                                {((projectManagers || []).length === 0 && (activeBoardMembers || []).length === 0) && (
                                    <Text type="secondary" style={{ fontSize: 13, padding: 8 }}>No members.</Text>
                                )}
                            </div>
                        </div >
                    }
                    title="Filter by Member" trigger="click"
                    open={showMemberFilter} onOpenChange={setShowMemberFilter} placement="bottomLeft"
                >
                    <Button type={filterMembers.length > 0 ? 'primary' : 'text'} size="small"
                        style={{ borderRadius: theme.borderRadius.sm, color: filterMembers.length > 0 ? undefined : theme.colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdOutlinePeople size={16} />
                        Members{filterMembers.length > 0 ? ` (${filterMembers.length})` : ''}
                    </Button>
                </Popover >

                {/* Labels */}
                < Popover
                    content={
                        < div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {labels && labels.length > 0 ? labels.map(label => {
                                const isChecked = filterLabels.includes(label.id);
                                return (
                                    <div
                                        key={label.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', cursor: 'pointer',
                                            height: 32, borderRadius: 6, background: label.color,
                                            padding: '0 10px', color: '#fff', fontSize: 13, fontWeight: 500,
                                            transition: `all ${theme.transitions.fast}`, opacity: isChecked ? 1 : 0.85,
                                        }}
                                        onClick={() => toggleFilterLabel(label.id)}
                                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.opacity = isChecked ? 1 : 0.85; }}
                                    >
                                        <span style={{ flex: 1 }}>{label.name || ''}</span>
                                        {isChecked && <AiOutlineCheck style={{ marginLeft: 8 }} size={16} />}
                                    </div>
                                );
                            }) : (
                                <Text type="secondary" style={{ fontSize: 13, padding: 8 }}>No labels available.</Text>
                            )}
                        </div >
                    }
                    title="Filter by Label" trigger="click"
                    open={showLabelPicker} onOpenChange={setShowLabelPicker} placement="bottomLeft"
                >
                    <Button type={filterLabels.length > 0 ? 'primary' : 'text'} size="small"
                        style={{ borderRadius: theme.borderRadius.sm, color: filterLabels.length > 0 ? undefined : theme.colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdOutlineLabel size={16} /> Labels
                    </Button>
                </Popover >

                {/* Search */}
                {
                    showSearch ? (
                        <Input
                            size="small" placeholder="Search cards..."
                            prefix={<IoSearchOutline />}
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                            autoFocus style={{ width: 200, borderRadius: theme.borderRadius.sm }} allowClear
                        />
                    ) : (
                        <Button type={searchQuery ? 'primary' : 'text'} size="small"
                            onClick={() => setShowSearch(true)}
                            style={{ borderRadius: theme.borderRadius.sm, color: searchQuery ? undefined : theme.colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IoSearchOutline size={16} /> Search
                        </Button>
                    )
                }

                {
                    hasFilters && (
                        <Button type="link" size="small" onClick={clearFilters}
                            style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.xs }}>
                            Clear filters
                        </Button>
                    )
                }
            </Space >

            <Space size={8}>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, padding: 2 }}>
                    <Tooltip title="Board View">
                        <Button type={viewMode === 'board' ? 'primary' : 'text'} size="small"
                            icon={<IoGridOutline size={14} />} onClick={() => setViewMode('board')}
                            style={{ borderRadius: theme.borderRadius.sm, ...(viewMode === 'board' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}) }} />
                    </Tooltip>
                    <Tooltip title="List View">
                        <Button type={viewMode === 'list' ? 'primary' : 'text'} size="small"
                            icon={<IoListOutline size={14} />} onClick={() => setViewMode('list')}
                            style={{ borderRadius: theme.borderRadius.sm, ...(viewMode === 'list' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}) }} />
                    </Tooltip>
                    <Tooltip title="Report View">
                        <Button type={viewMode === 'report' ? 'primary' : 'text'} size="small"
                            icon={<MdOutlineAssessment size={14} />} onClick={() => setViewMode('report')}
                            style={{ borderRadius: theme.borderRadius.sm, ...(viewMode === 'report' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}) }} />
                    </Tooltip>
                </div>

                {/* Notification Bell */}
                <Dropdown
                    open={notifOpen} onOpenChange={setNotifOpen}
                    trigger={['click']} placement="bottomRight"
                    popupRender={() => (
                        <div style={{
                            width: 340, maxHeight: 420, overflowY: 'auto',
                            background: theme.colors.surface, borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.lg,
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                borderBottom: `1px solid ${theme.colors.border}`,
                            }}>
                                <Text strong style={{ fontSize: 14 }}>Notifications</Text>
                                {unreadNotificationCount > 0 && (
                                    <Button type="link" size="small" onClick={() => markAllNotificationsRead()} style={{ fontSize: 12, padding: 0 }}>
                                        Mark all read
                                    </Button>
                                )}
                            </div>
                            {(!filteredNotifications || filteredNotifications.length === 0) ? (
                                <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>No notifications yet</Text>
                                </div>
                            ) : (
                                <>
                                    {filteredNotifications.map(n => {
                                        let textStr = 'Notification';
                                        if (n.notif_type === 'mentionInComment') textStr = `${n.actor_u_code} mentioned you in a comment`;
                                        else if (n.notif_type === 'commentCard') textStr = `${n.actor_u_code} commented on a card you follow`;
                                        else if (n.notif_type === 'addMemberToCard') textStr = `${n.actor_u_code} added you to a card`;
                                        else textStr = n.content || n.action || textStr;

                                        return (
                                            <div key={n.id}
                                                onClick={() => {
                                                    if (!n.is_read) markNotificationRead(n.id);
                                                    if (n.card_id) openCardDetail(n.card_id);
                                                    setNotifOpen(false);
                                                }}
                                                style={{
                                                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                                    borderBottom: `1px solid ${theme.colors.border}`,
                                                    background: n.is_read ? 'transparent' : `${theme.colors.primary}08`,
                                                    cursor: 'pointer',
                                                    transition: `background ${theme.transitions.fast}`,
                                                }}>
                                                <Text style={{ fontSize: 13, display: 'block', fontWeight: n.is_read ? 'normal' : '500' }}>{textStr}</Text>
                                                <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.created_at).fromNow()}</Text>
                                                {n.notif_data?.text && (
                                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        "{n.notif_data.text}"
                                                    </Text>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {(hasHiddenNotifs || showAllNotifs) && (
                                        <div style={{ padding: '8px 12px', textAlign: 'center', borderTop: `1px solid ${theme.colors.border}` }}>
                                            <Button
                                                type="link"
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowAllNotifs(!showAllNotifs);
                                                }}
                                                style={{ fontSize: 12 }}
                                            >
                                                {showAllNotifs ? 'Hide older read notifications' : `See all notifications (${notifications.length})`}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                >
                    <span style={{ display: 'none' }}>
                        <Badge count={unreadNotificationCount} size="small" offset={[-2, 2]}>
                            <Button type="text" size="small" icon={<IoNotificationsOutline size={18} />}
                                style={{ color: theme.colors.textSecondary }} />
                        </Badge>
                    </span>
                </Dropdown>


                <Tooltip title="Board Interface Guide">
                    <Button type="text" size="small" icon={<IoHelpCircleOutline size={18} />}
                        onClick={() => setShowBoardGuide(true)} style={{ color: theme.colors.textSecondary }} />
                </Tooltip>

                {/* Board Settings */}
                <Button type="text" size="small" icon={<IoSettingsOutline size={16} />}
                    onClick={openBoardSettings} style={{ color: theme.colors.textSecondary }} />
            </Space>

            <BoardGuideDrawer open={showBoardGuide} onClose={() => setShowBoardGuide(false)} theme={theme} />

        </div >
    );
};

// ─── Main Kanban Component ─────────────────────────────────────────
const KanbanMain = () => {
    const { theme } = useTheme();
    const { empNo } = useAuthStore();
    const navigate = useNavigate();
    const { projectId: projectIdParam } = useParams();

    const {
        projects, activeProject, boards, activeBoard, isLoading, error,
        fetchProjects, setActiveProject, fetchBoards, setActiveBoard,
        lists, openProjectSettings, openBoardSettings,
        connectWebSocket, disconnectWebSocket, viewMode, boardTabOrders,
        boardGroups, activeBoardGroup, setBoardGroups, setActiveBoardGroup, setBoardTabOrder,
        fetchUserPreferences
    } = useKanbanStore();

    const orderedBoards = useMemo(() => {
        if (!boards || !activeProject) return [];
        const order = boardTabOrders?.[activeProject.id];
        if (!order || order.length === 0) return boards;

        return [...boards].sort((a, b) => {
            const idxA = order.indexOf(a.id);
            const idxB = order.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }, [boards, boardTabOrders, activeProject]);

    const projectBoardGroups = activeProject ? (boardGroups?.[activeProject.id] || []) : [];
    const currentBoardGroupId = activeProject ? activeBoardGroup?.[activeProject.id] : null;

    const filteredOrderedBoards = useMemo(() => {
        if (!currentBoardGroupId) return orderedBoards;
        const group = projectBoardGroups.find(g => g.id === currentBoardGroupId);
        if (!group) return orderedBoards;
        return orderedBoards.filter(b => group.boardIds.includes(b.id));
    }, [orderedBoards, currentBoardGroupId, projectBoardGroups]);

    // ─── Drag and Drop Setup for Board Tabs ───
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEndBoards = (event) => {
        const { active, over } = event;
        if (!over) return;
        if (active.id !== over.id) {
            const oldIndex = filteredOrderedBoards.findIndex(b => b.id === active.id);
            const newIndex = filteredOrderedBoards.findIndex(b => b.id === over.id);
            const newArray = arrayMove(filteredOrderedBoards, oldIndex, newIndex);

            // To preserve the order of hidden boards, we just get the current overall order
            // and replace the filtered ones in their new relative positions.
            const currentFullOrder = boardTabOrders?.[activeProject?.id] || boards.map(b => b.id);
            const allBoardsDict = currentFullOrder.filter(id => !filteredOrderedBoards.find(b => b.id === id));

            // Simple approach: just take the newly sorted visible boards, and append the hidden ones at the end
            // This is safe because usually they just sort what they see.
            const newFullOrder = [...newArray.map(b => b.id), ...allBoardsDict];
            setBoardTabOrder(activeProject.id, newFullOrder);
        }
    };

    const SortableBoardTab = ({ board, isActive, setActiveBoard, theme }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id });
        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
            zIndex: isDragging ? 10 : 1,
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            cursor: 'grab',
            borderBottom: isActive ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            color: isActive ? theme.colors.primary : theme.colors.textSecondary,
            fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
            fontSize: theme.typography.fontSize.sm,
            whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
        };
        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                onClick={() => setActiveBoard(board)}
                onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = theme.colors.primary; }}
                onMouseOut={(e) => { if (!isActive) e.currentTarget.style.color = theme.colors.textSecondary; }}
            >
                <BsKanban size={14} />
                {board.name}
            </div>
        );
    };

    // Board Group Modal State
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [groupFormName, setGroupFormName] = useState('');
    const [groupFormBoards, setGroupFormBoards] = useState([]);
    const [groupFormAutoOpen, setGroupFormAutoOpen] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState(null);

    const handleOpenGroupModal = (group = null) => {
        if (group) {
            setEditingGroupId(group.id);
            setGroupFormName(group.name);
            setGroupFormBoards(group.boardIds || []);
            setGroupFormAutoOpen(group.auto_open || false);
        } else {
            setEditingGroupId(null);
            setGroupFormName('');
            setGroupFormBoards([]);
            setGroupFormAutoOpen(false);
        }
        setIsGroupModalOpen(true);
    };

    const handleSaveGroup = () => {
        if (!groupFormName.trim()) return;
        const newGroups = [...projectBoardGroups];

        if (groupFormAutoOpen) {
            newGroups.forEach(g => g.auto_open = false);
        }

        if (editingGroupId) {
            const idx = newGroups.findIndex(g => g.id === editingGroupId);
            if (idx >= 0) newGroups[idx] = { ...newGroups[idx], name: groupFormName, boardIds: groupFormBoards, auto_open: groupFormAutoOpen };
        } else {
            const newId = `bg-${Date.now()}`;
            newGroups.push({ id: newId, name: groupFormName, boardIds: groupFormBoards, auto_open: groupFormAutoOpen });
            setActiveBoardGroup(activeProject.id, newId);
        }
        setBoardGroups(activeProject.id, newGroups);
        setIsGroupModalOpen(false);
    };

    const handleDeleteGroup = (groupId) => {
        const newGroups = projectBoardGroups.filter(g => g.id !== groupId);
        setBoardGroups(activeProject.id, newGroups);
        if (currentBoardGroupId === groupId) {
            setActiveBoardGroup(activeProject.id, null);
        }
    };

    // Global permissions
    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
    });

    const [isInitLoading, setIsInitLoading] = useState(true);
    const initializedProjects = useRef(new Set());

    // Auto-select Board Group based on auto_open configuration when entering project
    useEffect(() => {
        if (!isInitLoading && activeProject?.id && projectBoardGroups) {
            if (!initializedProjects.current.has(activeProject.id)) {
                initializedProjects.current.add(activeProject.id);
                const autoGroup = projectBoardGroups.find(g => g.auto_open);
                if (autoGroup) {
                    setActiveBoardGroup(activeProject.id, autoGroup.id);
                } else {
                    setActiveBoardGroup(activeProject.id, null);
                }
            }
        }
    }, [isInitLoading, activeProject?.id, projectBoardGroups, setActiveBoardGroup]);

    // Auto-select first board in filtered list if current activeBoard is not in the list
    useEffect(() => {
        if (!isInitLoading && filteredOrderedBoards.length > 0) {
            if (!activeBoard || !filteredOrderedBoards.find(b => b.id === activeBoard.id)) {
                setActiveBoard(filteredOrderedBoards[0]);
            }
        }
    }, [filteredOrderedBoards, activeBoard, setActiveBoard, isInitLoading]);

    // On mount: fetch all projects and user preferences
    useEffect(() => {
        let isMounted = true;
        const initKanban = async () => {
            await fetchUserPreferences();
            await fetchProjects();
            // Give the URL param effect a moment to process before dropping the shade
            setTimeout(() => {
                if (isMounted) setIsInitLoading(false);
            }, 100);
        };
        initKanban();
        return () => { isMounted = false; }
    }, [fetchProjects]);

    // Handle initial selection from URL params
    useEffect(() => {
        if (projectIdParam && projects.length > 0 && !isLoading) {
            const currentId = activeProject?.id ? String(activeProject.id) : null;
            if (currentId !== String(projectIdParam)) {
                const p = projects.find(pr => String(pr.id) === String(projectIdParam));
                if (p) {
                    setActiveProject(p);
                }
            }
        }
    }, [projectIdParam, projects, activeProject, setActiveProject, isLoading]);

    // WebSocket lifecycle
    useEffect(() => {
        if (activeBoard?.id) { connectWebSocket(activeBoard.id, empNo); }
        return () => { };
    }, [activeBoard?.id, empNo, connectWebSocket]);

    useEffect(() => {
        return () => disconnectWebSocket();
    }, [disconnectWebSocket]);

    const handleSelectProject = (project) => {
        setActiveProject(project);
        navigate(`/eng/kanban/${project.id}`);
    };

    const handleBackToProjects = () => {
        navigate('/eng/kanban');
    };

    // ── Project List Page ──
    const isBoard = !!projectIdParam;

    if (!isBoard) {
        return (
            <>
                <ScrollbarStyle primary={theme.colors.primary} />
                <ProjectListPage onSelectProject={handleSelectProject} theme={theme} />
            </>
        );
    }

    // ── Board Page ──
    if (error) {
        return (
            <div style={{ padding: theme.spacing.xl, background: theme.colors.background, minHeight: '100vh' }}>
                <Alert message="Error Loading Kanban" description={error} type="error" showIcon />
            </div>
        );
    }

    if (isInitLoading) {
        return (
            <div style={{ padding: theme.spacing.xl, background: theme.colors.background, minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <>
            <ScrollbarStyle primary={theme.colors.primary} />
            {/* Main container: perfectly fills the viewport minus the App header (64px) */}
            <div style={{
                height: 'calc(100vh - 64px)',
                display: 'flex',
                flexDirection: 'column',
                background: theme.colors.background,
                overflow: 'hidden'
            }}>
                {/* Top Bar — Project & Board Navigation */}
                <div style={{
                    background: theme.colors.surface,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    flexShrink: 0,
                }}>
                    {/* Main header row */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: `0 ${theme.spacing.xl}`, height: 56,
                    }}>
                        <Space size={8} align="center">
                            {/* Back button */}
                            <Button type="text" icon={<IoChevronBackOutline size={18} />}
                                onClick={handleBackToProjects}
                                style={{ color: theme.colors.textSecondary, padding: '4px 8px' }} />

                            {/* Project selector dropdown — bold & larger */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Select
                                    value={activeProject?.id}
                                    onChange={(val) => {
                                        const p = projects.find(pr => pr.id === val);
                                        if (p) {
                                            setActiveProject(p);
                                            navigate(`/eng/kanban/${p.id}`);
                                        }
                                    }}
                                    style={{ minWidth: 220 }}
                                    options={projects.filter(p => !p.status || p.status.toLowerCase() === 'active').map(p => ({ label: p.name, value: p.id }))}
                                    popupMatchSelectWidth={false}
                                    variant="borderless"
                                    className="kanban-project-title"
                                    suffixIcon={null}
                                />

                                {/* Project Members Popover triggered by Settings or Dropdown Icon near Project Name */}
                                <Dropdown
                                    trigger={['click']}  //'hover', 
                                    placement="bottom"
                                    popupRender={() => (
                                        <div style={{ width: 300, padding: 16, background: theme.colors.surface, borderRadius: theme.borderRadius.lg, boxShadow: theme.shadows.lg }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <Typography.Text strong>Project Members ({useKanbanStore.getState().projectManagers.length})</Typography.Text>
                                            </div>
                                            <Select
                                                showSearch
                                                placeholder="Add member to project..."
                                                style={{ width: '100%', marginBottom: 12 }}
                                                optionFilterProp="children"
                                                onSearch={(val) => {
                                                    // useKanbanStore exposes state directly here is tricky, we can use local state if needed
                                                    // For now, let's keep search basic or omit it in the popover if we use the store's users
                                                }}
                                                onChange={(val) => {
                                                    if (val) useKanbanStore.getState().addProjectManager(activeProject?.id, val);
                                                }}
                                                value={null}
                                                filterOption={(input, option) =>
                                                    (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase()) ||
                                                    (option?.value ?? '').toString().toLowerCase().includes(input.toLowerCase())
                                                }
                                            >
                                                {useKanbanStore.getState().users.map(u => (
                                                    <Select.Option key={u.u_code} value={u.u_code}>
                                                        <Space>
                                                            {u.profile_img_b64 ? (
                                                                <Avatar size="small" src={u.profile_img_b64} />
                                                            ) : (
                                                                <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                                    {(u.u_name || u.u_code)[0].toUpperCase()}
                                                                </Avatar>
                                                            )}

                                                            <Typography.Text style={{ fontSize: 13 }}>
                                                                {u.u_code} - {u.u_name || u.u_nickname || u.u_code}
                                                            </Typography.Text>
                                                        </Space>
                                                    </Select.Option>
                                                ))}
                                            </Select>

                                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                {useKanbanStore.getState().projectManagers.map(mgr => {
                                                    const u = useKanbanStore.getState().users.find(user => user.u_code?.toLowerCase() === mgr.u_code?.toLowerCase()) || { u_code: mgr.u_code };
                                                    return (
                                                        <div key={mgr.u_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${theme.colors.border}` }}>
                                                            <Space>
                                                                {u.profile_img_b64 ? (
                                                                    <Avatar size="small" src={u.profile_img_b64} />
                                                                ) : (
                                                                    <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                                        {(u.u_name || u.u_code)[0].toUpperCase()}
                                                                    </Avatar>
                                                                )}
                                                                {/* <Avatar size="small" style={{ backgroundColor: theme.colors.primary }}></Avatar> */}
                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <Typography.Text style={{ fontSize: 13 }}>{u.u_name || u.u_code}</Typography.Text>
                                                                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{u.u_code}</Typography.Text>
                                                                </div>
                                                            </Space>
                                                            <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => useKanbanStore.getState().removeProjectManager(activeProject?.id, mgr.u_code)} />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                >
                                    <Tooltip title="Project Members">
                                        <Button
                                            type="text"
                                            icon={<MdOutlinePeople size={16} />}
                                            style={{ color: theme.colors.textSecondary, padding: '4px 6px', marginLeft: -8 }}
                                        />
                                    </Tooltip>
                                </Dropdown>

                                {/* Project Settings — pencil icon next to project name */}
                                {canManageProject && (
                                    <Tooltip title="Project Settings">
                                        <Button
                                            type="text"
                                            icon={<FiEdit2 size={15} />}
                                            onClick={() => openProjectSettings(activeProject?.id)}
                                            style={{ color: theme.colors.textSecondary, padding: '4px 6px' }}
                                        />
                                    </Tooltip>
                                )}
                            </div>
                        </Space>
                    </div>

                    {/* Board Tab Bar */}
                    {activeProject && (
                        <div className="kb-hscroll" style={{
                            display: 'flex', alignItems: 'center',
                            padding: `0 ${theme.spacing.xl}`,
                            gap: 0,
                            overflowX: 'auto',
                        }}>
                            {canManageProject && (
                                <Tooltip title="Create New Board">
                                    <div
                                        onClick={openBoardSettings}
                                        style={{
                                            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                            cursor: 'pointer',
                                            color: theme.colors.textSecondary,
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            borderRight: `1px solid ${theme.colors.border}`,
                                            marginRight: 4
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                                        onMouseOut={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
                                    >
                                        <FiPlus size={18} />
                                    </div>
                                </Tooltip>
                            )}

                            <Dropdown
                                menu={{
                                    items: [
                                        {
                                            key: 'all',
                                            onClick: () => setActiveBoardGroup(activeProject.id, null),
                                            label: <div style={{ fontWeight: !currentBoardGroupId ? 'bold' : 'normal' }}>All Boards</div>
                                        },
                                        { type: 'divider' },
                                        ...projectBoardGroups.map(g => ({
                                            key: g.id,
                                            label: (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                                                    <span
                                                        onClick={() => setActiveBoardGroup(activeProject.id, g.id)}
                                                        style={{ flex: 1, fontWeight: currentBoardGroupId === g.id ? 'bold' : 'normal' }}
                                                    >
                                                        {g.name}
                                                    </span>
                                                    <Button type="text" size="small" icon={<FiEdit2 size={12} />} onClick={(e) => { e.stopPropagation(); handleOpenGroupModal(g); }} />
                                                </div>
                                            )
                                        })),
                                        { type: 'divider' },
                                        {
                                            key: 'create',
                                            onClick: () => handleOpenGroupModal(),
                                            label: '+ Create Board Group'
                                        }
                                    ]
                                }}
                                trigger={['click']}
                            >
                                <div style={{
                                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                    cursor: 'pointer',
                                    color: currentBoardGroupId ? theme.colors.primary : theme.colors.textSecondary,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    borderRight: `1px solid ${theme.colors.border}`,
                                    marginRight: 4,
                                    fontWeight: currentBoardGroupId ? 'bold' : 'normal'
                                }}>
                                    <FiFilter size={16} />
                                    {currentBoardGroupId ? projectBoardGroups.find(g => g.id === currentBoardGroupId)?.name : 'All Boards'}
                                </div>
                            </Dropdown>

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndBoards}>
                                <SortableContext items={filteredOrderedBoards.map(b => b.id)} strategy={horizontalListSortingStrategy}>
                                    {filteredOrderedBoards.map((board) => (
                                        <SortableBoardTab
                                            key={board.id}
                                            board={board}
                                            isActive={activeBoard?.id === board.id}
                                            setActiveBoard={setActiveBoard}
                                            theme={theme}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        </div>
                    )}
                </div>

                {/* Board Toolbar */}
                {activeBoard && <BoardToolbar theme={theme} activeProject={activeProject} />}


                {/* Board Canvas Area — TWO-DIV PATTERN */}
                <div style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                    background: activeBoard?.background_type === 'gradient'
                        ? activeBoard.background_value
                        : activeBoard?.background_type === 'color'
                            ? activeBoard.background_value
                            : theme.colors.background,
                    transition: 'background 0.3s ease',
                }}>
                    {/* Scroll pocket — absolutely fills parent, handles ALL scrolling */}
                    <div className="kb-hscroll" style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        padding: theme.spacing.lg,
                        overflowX: 'auto',
                        overflowY: 'auto',
                    }}>
                        {isLoading && !activeBoard ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <Spin size="large" />
                            </div>
                        ) : viewMode === 'report' ? (
                            <ReportsTab theme={theme} />
                        ) : activeBoard ? (
                            <BoardView />
                        ) : (
                            <div style={{
                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                height: '100%', flexDirection: 'column', gap: theme.spacing.lg
                            }}>
                                <BsKanban size={48} color={theme.colors.textTertiary} />
                                <Text type="secondary" style={{ fontSize: theme.typography.fontSize.base }}>
                                    {boards.length === 0
                                        ? 'No boards yet. Create one in Board Settings.'
                                        : 'Select a board to get started.'}
                                </Text>
                                {boards.length === 0 && (
                                    <Button type="primary" onClick={openBoardSettings}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}>
                                        Create Board
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <CardDetailDrawer />
                <ProjectSettingsDrawer />
                <BoardSettingsDrawer />
            </div>

            <Modal
                title={editingGroupId ? "Edit Board Group" : "Create Board Group"}
                open={isGroupModalOpen}
                onCancel={() => setIsGroupModalOpen(false)}
                onOk={handleSaveGroup}
                okText="Save Group"
                okButtonProps={{ disabled: !groupFormName.trim() }}
                styles={{ body: { padding: '24px 0' } }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 24px' }}>
                    <div>
                        <Typography.Text strong>Group Name</Typography.Text>
                        <Input
                            placeholder="e.g. My Custom View"
                            value={groupFormName}
                            onChange={(e) => setGroupFormName(e.target.value)}
                            style={{ marginTop: 8 }}
                        />
                    </div>
                    <div>
                        <Typography.Text strong>Select Boards to include</Typography.Text>
                        <div style={{
                            marginTop: 8,
                            maxHeight: 200,
                            overflowY: 'auto',
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.borderRadius.sm,
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8
                        }}>
                            {orderedBoards.map(b => (
                                <Checkbox
                                    key={b.id}
                                    checked={groupFormBoards.includes(b.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) setGroupFormBoards(prev => [...prev, b.id]);
                                        else setGroupFormBoards(prev => prev.filter(id => id !== b.id));
                                    }}
                                >
                                    {b.name}
                                </Checkbox>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm }}>
                        <div>
                            <Typography.Text strong style={{ display: 'block' }}>Auto Open</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Automatically select this group when opening the project.</Typography.Text>
                        </div>
                        <Switch checked={groupFormAutoOpen} onChange={setGroupFormAutoOpen} />
                    </div>
                    {editingGroupId && (
                        <Button danger onClick={() => { handleDeleteGroup(editingGroupId); setIsGroupModalOpen(false); }}>
                            Delete this Group
                        </Button>
                    )}
                </div>
            </Modal>
        </>
    );
};

export default KanbanMain;
