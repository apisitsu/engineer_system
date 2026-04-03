import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Spin, Alert, Select, Button, Space, Input, Avatar, Tooltip, Badge, Dropdown, Modal, Form, Tag, Popover, Tabs, Row, Col, Progress, Statistic, Layout, Switch } from 'antd';
import { useKanbanStore } from './store/kanbanStore';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useNavigate, useParams } from 'react-router-dom';
import {
    IoSettingsOutline, IoSearchOutline, IoAddOutline, IoGridOutline,
    IoListOutline, IoChevronBackOutline, IoNotificationsOutline, IoStarOutline, IoStar,
    IoCalendarOutline, IoLayersOutline, IoTimeOutline,
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
<<<<<<< HEAD
import { MdOutlinePeople, MdOutlineLabel, MdOutlineDashboard, MdPersonAddAlt1, MdOutlineAssessment } from 'react-icons/md';
=======
import { MdOutlinePeople, MdOutlineLabel, MdOutlineDashboard, MdPersonAddAlt1 } from 'react-icons/md';
>>>>>>> old-work-backup
import { BsKanban, BsThreeDots, BsGrid3X3Gap, BsList } from 'react-icons/bs';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import { AiOutlineCheck, AiOutlineClose, AiOutlineEdit, AiOutlineStar, AiFillStar } from 'react-icons/ai';
import { RiKanbanView } from 'react-icons/ri';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import BoardView from './Board/BoardView';
import CardDetailDrawer from './CardDetail/CardDetailDrawer';
import ProjectSettingsDrawer from './Settings/ProjectSettingsDrawer';
import BoardSettingsDrawer from './Settings/BoardSettingsDrawer';
import ScrollbarStyle from '../../common/scrollbar';
<<<<<<< HEAD
import ReportDashboard from './Reports/ReportDashboard';
=======
>>>>>>> old-work-backup

dayjs.extend(relativeTime);

const { Content } = Layout;
const { Title, Text } = Typography;

// ─── Scrollbar CSS injection ────────────────────────────────────────
// const ScrollbarStyle = ({ primary }) => (
//     <style>{`
//         .kb-hscroll::-webkit-scrollbar, .kb-vscroll::-webkit-scrollbar { width: 10px; height: 10px; }
//         .kb-hscroll::-webkit-scrollbar-track, .kb-vscroll::-webkit-scrollbar-track { background: transparent; }
//         .kb-hscroll::-webkit-scrollbar-thumb, .kb-vscroll::-webkit-scrollbar-thumb {
//             background: ${primary}44; border-radius: 4px;
//         }
//         .kb-hscroll::-webkit-scrollbar-thumb:hover, .kb-vscroll::-webkit-scrollbar-thumb:hover {
//             background: ${primary}88;
//         }
//         .kanban-project-title .ant-select-selector {
//             font-size: 17px !important;
//             font-weight: 700 !important;
//             color: inherit !important;
//         }
//         .kanban-project-title .ant-select-selection-item {
//             font-size: 17px !important;
//             font-weight: 700 !important;
//         }
//     `}</style>
// );

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

// ─── Gradient Picker Component ─────────────────────────────────────
const GradientPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {GRADIENTS.map((g, i) => (
            <div
                key={i}
                onClick={() => onChange(g)}
                style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: g, cursor: 'pointer',
                    border: value === g ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: value === g ? `0 0 0 2px ${theme.colors.primary}` : 'none',
                    transition: 'all 0.15s ease',
                }}
            />
        ))}
    </div>
);

// ─── Icon Picker Component ──────────────────────────────────────────
const IconPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {PROJECT_ICONS.map(({ key, icon: Icon, label }) => (
            <Tooltip title={label} key={key}>
                <div
                    onClick={() => onChange(key)}
                    style={{
                        width: 32, height: 32, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        background: value === key ? `${theme.colors.primary}20` : 'transparent',
                        border: value === key ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                        color: value === key ? theme.colors.primary : theme.colors.textSecondary,
                        transition: 'all 0.15s ease',
                    }}
                >
                    <Icon size={18} />
                </div>
            </Tooltip>
        ))}
    </div>
);

// ─── Project Stat Card ─────────────────────────────────────────────
const StatCard = ({ icon, label, value, color, theme }) => (
    <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
        display: 'flex', alignItems: 'center', gap: theme.spacing.lg,
        boxShadow: theme.shadows.sm,
        flex: 1, minWidth: 140,
    }}>
        <div style={{
            width: 48, height: 48, borderRadius: theme.borderRadius.md,
            background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
        }}>
            <span style={{ color, fontSize: 22 }}>{icon}</span>
        </div>
        <div>
            <Text style={{ fontSize: 26, fontWeight: 800, color: theme.colors.textPrimary, lineHeight: 1.1 }}>{value}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block', marginTop: 2 }}>{label}</Text>
        </div>
    </div>
);

// ─── Project Grid Card ─────────────────────────────────────────────
const ProjectGridCard = ({ project, onClick, onToggleFavorite, onOpenSettings, theme }) => {
    const [hovered, setHovered] = useState(false);
    const gradient = project.background_value || GRADIENTS[(project.id || 0) % GRADIENTS.length];
    const ProjectIcon = getProjectIcon(project.icon);

    // Evaluate permissions
    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: project.is_private,
        projectRole: project.role
    });

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: theme.colors.surface,
                border: `1px solid ${hovered ? theme.colors.primary + '60' : theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: hovered ? theme.shadows.lg : theme.shadows.sm,
                transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Top gradient banner */}
            <div style={{
                height: 80, background: gradient,
                position: 'relative', display: 'flex', alignItems: 'center', padding: theme.spacing.lg,
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 65%)',
                }} />
                <div style={{
                    width: 44, height: 44, borderRadius: theme.borderRadius.md,
                    background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.3)',
                }}>
                    {ProjectIcon ? <ProjectIcon size={22} /> : (project.name || 'P').slice(0, 2).toUpperCase()}
                </div>
                <Text strong style={{
                    fontSize: 16, color: '#fff',
                    display: 'block', margin: 4, marginLeft: 12,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {project.name}
                </Text>
                {/* {project.is_private && (
                    <Tooltip title="Private Project">
                        <div style={{
                            position: 'absolute', bottom: 8, right: 10,
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
                            padding: '2px 8px', borderRadius: 12,
                            color: '#fff', fontSize: 11, fontWeight: 600,
                        }}>
                            <IoLockClosedOutline size={11} />
                            Private
                        </div>
                    </Tooltip>
                )} */}
                {/* Top-right action buttons */}
                <div style={{
                    position: 'absolute', top: 8, right: 10,
                    display: 'flex', gap: 4,
                    opacity: hovered || project.is_favorite ? 1 : 0,
                    transition: 'all 0.15s ease',
                }}>
                    {/* Settings */}
                    {canManageProject && (
                        <div
                            onClick={(e) => { e.stopPropagation(); onOpenSettings?.(project.id); }}
                            style={{
                                width: 24, height: 24, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.2)', cursor: 'pointer',
                                opacity: hovered ? 1 : 0, transition: 'all 0.15s ease',
                            }}
                        >
                            <IoSettingsOutline size={14} color="#fff" />
                        </div>
                    )}

                    {/* Private */}
                    {project.is_private && (
                        <Tooltip title="Private Project">
                            <div
                                // onClick={(e) => { e.stopPropagation(); onOpenSettings?.(project.id); }}
                                style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(0,0,0,0.2)', cursor: 'pointer',
                                }}
                            >
                                <IoLockClosedOutline size={14} color="#fff" />
                            </div>
                        </Tooltip>
                    )}
                    {/* Favorite */}
                    <div
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(project.id); }}
                        style={{
                            width: 24, height: 24, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.2)', cursor: 'pointer',
                        }}
                    >
                        {project.is_favorite
                            ? <AiFillStar size={16} color="#fbbf24" />
                            : <AiOutlineStar size={16} color="#fff" />
                        }
                    </div>
                </div>
            </div>
            {/* Card Body */}
            <div style={{ padding: `${theme.spacing.md} ${theme.spacing.lg}` }}>
                <Text style={{
                    fontSize: 12, color: theme.colors.textSecondary,
                    display: 'block', marginBottom: theme.spacing.md,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minHeight: 18,
                }}>
                    {project.description || 'No description'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IoLayersOutline size={13} color={theme.colors.textTertiary} />
                        <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>
                            {project.board_count || 0} board{project.board_count !== 1 ? 's' : ''}
                        </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IoCalendarOutline size={12} color={theme.colors.textTertiary} />
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                            {dayjs(project.created_at).fromNow()}
                        </Text>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Project List Row ──────────────────────────────────────────────
const ProjectListRow = ({ project, onClick, onToggleFavorite, onOpenSettings, theme }) => {
    const gradient = project.background_value || GRADIENTS[(project.id || 0) % GRADIENTS.length];
    const ProjectIcon = getProjectIcon(project.icon);
    const [hovered, setHovered] = useState(false);

    // Evaluate permissions
    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: project.is_private,
        projectRole: project.role
    });

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: theme.spacing.md,
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                background: hovered ? theme.colors.surfaceHover : theme.colors.surface,
                border: `1px solid ${hovered ? theme.colors.primary + '40' : theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: hovered ? theme.shadows.sm : 'none',
            }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: theme.borderRadius.md,
                background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0,
            }}>
                {ProjectIcon ? <ProjectIcon size={20} /> : (project.name || 'P').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                        {project.name}
                    </Text>
                    {project.is_private && (
                        <Tag color="default" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <IoLockClosedOutline size={10} /> Private
                        </Tag>
                    )}
                </div>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.description || 'No description'}
                </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg, flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: 700, color: theme.colors.primary, display: 'block', lineHeight: 1 }}>{project.board_count || 0}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>Boards</Text>
                </div>
                <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>
                    {dayjs(project.created_at).format('DD MMM YY')}
                </Text>
                {/* Settings */}
                {canManageProject && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenSettings?.(project.id); }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <IoSettingsOutline size={15} color={theme.colors.textTertiary} />
                    </div>
                )}
                {/* Favorite toggle */}
                <div
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(project.id); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    {project.is_favorite
                        ? <AiFillStar size={16} color="#fbbf24" />
                        : <AiOutlineStar size={16} color={theme.colors.textTertiary} />
                    }
                </div>
            </div>
        </div>
    );
};

// ─── Project List Page ─────────────────────────────────────────────
const ProjectListPage = ({ onSelectProject, theme }) => {
    const { projects, fetchProjects, isLoading, openProjectSettings, createProject, toggleFavorite } = useKanbanStore();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState('projects');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [viewMode, setViewMode] = useState('grid');
    const [filterOwner, setFilterOwner] = useState('all'); // 'all' | 'mine' | 'favorites'

    // Global permissions
    const { canCreateProject } = useKanbanPermissions();

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
    const [selectedIcon, setSelectedIcon] = useState('rocket');

    const [isPrivate, setIsPrivate] = useState(false);

    const handleCreate = async (values) => {
        const result = await createProject({
            ...values,
            background_type: 'gradient',
            background_value: selectedGradient,
            icon: selectedIcon,
            is_private: isPrivate,
        });
        if (result) {
            setShowCreateModal(false);
            form.resetFields();
            setSelectedGradient(GRADIENTS[0]);
            setSelectedIcon('rocket');
            setIsPrivate(false);
            fetchProjects();
        }
    };

    const handleToggleFavorite = async (projectId) => {
        await toggleFavorite(projectId);
    };

    // Computed stats for dashboard
    const stats = useMemo(() => ({
        total: projects.length,
        totalBoards: projects.reduce((s, p) => s + (parseInt(p.board_count) || 0), 0),
<<<<<<< HEAD
        owned: projects.filter(p => p.role === 'owner').length,
        favorites: projects.filter(p => p.is_favorite).length,
        recent: [...projects].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    }), [projects]);
    // console.log('projects', projects)
    // console.log('stats', stats)
=======
        owned: projects.filter(p => p.is_owner).length,
        favorites: projects.filter(p => p.is_favorite).length,
        recent: [...projects].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    }), [projects]);
>>>>>>> old-work-backup

    // Filtered & sorted projects for tab 2
    const filteredProjects = useMemo(() => {
        let list = [...projects];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
        }
<<<<<<< HEAD
        if (filterOwner === 'mine') list = list.filter(p => p.role === 'owner');
=======
        if (filterOwner === 'mine') list = list.filter(p => p.is_owner);
>>>>>>> old-work-backup
        if (filterOwner === 'favorites') list = list.filter(p => p.is_favorite);

        if (sortBy === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        else if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sortBy === 'boards') list.sort((a, b) => (b.board_count || 0) - (a.board_count || 0));

        return list;
    }, [projects, search, filterOwner, sortBy]);

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
                        <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary, lineHeight: 1 }}>
                            Projects Management System
                        </Title>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            {stats.total} project{stats.total !== 1 ? 's' : ''} · {stats.totalBoards} board{stats.totalBoards !== 1 ? 's' : ''}
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

            {/* Tabs — equal-width labels so switching doesn't shift layout */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                maxWidth: 1280,
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
                        items={[
                            {
                                key: 'dashboard',
                                label: (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        gap: 6, minWidth: 140,
                                    }}>
                                        <MdOutlineDashboard size={15} /> Dashboard
                                    </span>
                                ),
                            },
                            {
                                key: 'projects',
                                label: (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        gap: 6, minWidth: 140,
                                    }}>
                                        <BsKanban size={14} /> Projects
                                        {projects.length > 0 && (
                                            <Badge count={projects.length} size="small"
                                                style={{ backgroundColor: theme.colors.primary, fontSize: 10 }} />
                                        )}
                                    </span>
                                ),
                            },
<<<<<<< HEAD
                            {
                                key: 'reports',
                                label: (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        gap: 6, minWidth: 140,
                                    }}>
                                        <MdOutlineAssessment size={15} /> Reports
                                    </span>
                                ),
                            },
=======
>>>>>>> old-work-backup
                        ]}
                    />
                </div>

                <div className="kb-vscroll" style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    paddingTop: theme.spacing.xl,
                    paddingBottom: theme.spacing.xl,
                    padding: '16px'
                }}>

                    {/* ═══ DASHBOARD TAB ═══ */}
                    {activeTab === 'dashboard' && (
                        <div>
                            {isLoading && projects.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>
                            ) : (
                                <>
                                    {/* Stat Row */}
                                    <div style={{ display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap', marginBottom: theme.spacing['2xl'] }}>
                                        <StatCard icon={<BsKanban />} label="Total Projects" value={stats.total} color={theme.colors.primary} theme={theme} />
                                        <StatCard icon={<IoLayersOutline />} label="Total Boards" value={stats.totalBoards} color="#10b981" theme={theme} />
                                        <StatCard icon={<MdOutlinePeople />} label="Owned by Me" value={stats.owned} color="#f59e0b" theme={theme} />
                                        <StatCard icon={<AiFillStar />} label="Favorites" value={stats.favorites} color="#ef4444" theme={theme} />
                                    </div>

                                    {/* Recent Projects */}
                                    <div>
                                        <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: theme.spacing.md }}>
                                            Recent Projects
                                        </Text>
                                        {stats.recent.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px 0', color: theme.colors.textTertiary }}>
                                                <BsKanban size={40} style={{ opacity: 0.3 }} />
                                                <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>No projects yet. Create your first project!</Text>
                                                {/* {canCreateProject && ( */}
                                                <Button type="primary" style={{ marginTop: 12, background: theme.colors.primary, borderColor: theme.colors.primary }}
                                                    onClick={() => { setShowCreateModal(true); }}>
                                                    Create Project
                                                </Button>

                                                <Button>Summit</Button>
                                                {/* )} */}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                                                {stats.recent.map(p => (
                                                    <ProjectListRow key={p.id} project={p} onClick={() => onSelectProject(p)} onToggleFavorite={handleToggleFavorite} onOpenSettings={(id) => openProjectSettings(id)} theme={theme} />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Board distribution */}
                                    {projects.length > 0 && (
                                        <div style={{ marginTop: theme.spacing['2xl'] }}>
                                            <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: theme.spacing.md }}>
                                                Board Distribution
                                            </Text>
                                            <div style={{
                                                background: theme.colors.surface,
                                                border: `1px solid ${theme.colors.border}`,
                                                borderRadius: theme.borderRadius.lg,
                                                padding: theme.spacing.lg,
                                            }}>
                                                {projects.filter(p => parseInt(p.board_count) > 0).slice(0, 8).map(p => {
                                                    const pct = stats.totalBoards > 0 ? Math.round((parseInt(p.board_count) / stats.totalBoards) * 100) : 0;
                                                    const gradient = p.background_value || GRADIENTS[(p.id || 0) % GRADIENTS.length];
                                                    return (
                                                        <div key={p.id} style={{ marginBottom: 12 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>{p.name}</Text>
                                                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{p.board_count} boards</Text>
                                                            </div>
                                                            <div style={{ height: 6, background: theme.colors.surfaceHover, borderRadius: 3, overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%', width: `${pct}%`,
                                                                    background: gradient, borderRadius: 3,
                                                                    transition: 'width 0.6s ease',
                                                                }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

<<<<<<< HEAD
                    {/* ═══ REPORTS TAB ═══ */}
                    {activeTab === 'reports' && (
                        <div style={{ height: '100%' }}>
                            <ReportDashboard theme={theme} />
                        </div>
                    )}

=======
>>>>>>> old-work-backup
                    {/* ═══ PROJECTS TAB ═══ */}
                    {activeTab === 'projects' && (
                        <div>
                            {/* Filter Bar */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: theme.spacing.md,
                                flexWrap: 'wrap', marginBottom: theme.spacing.xl,
                                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                                background: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.lg,
                            }}>
                                <Input
                                    placeholder="Search projects..."
                                    prefix={<IoSearchOutline color={theme.colors.textTertiary} />}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    allowClear
                                    style={{ width: 260, borderRadius: theme.borderRadius.sm }}
                                />
                                <Select
                                    value={filterOwner}
                                    onChange={setFilterOwner}
                                    style={{ width: 140 }}
                                    options={[
                                        { value: 'all', label: 'All Projects' },
                                        { value: 'mine', label: 'Owned by Me' },
                                        { value: 'favorites', label: '⭐ Favorites' },
                                    ]}
                                />
                                <Select
                                    value={sortBy}
                                    onChange={setSortBy}
                                    style={{ width: 150 }}
                                    options={[
                                        { value: 'recent', label: '🕒 Most Recent' },
                                        { value: 'name', label: '🔤 Name A→Z' },
                                        { value: 'boards', label: '📋 Most Boards' },
                                    ]}
                                />
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                    {/* <Tooltip title="Grid view">
                                        <Button type="primary" style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}
                                            onClick={() => { setShowCreateModal(true); }}>
                                            Create Project
                                        </Button>
                                    </Tooltip> */}
                                    <Tooltip title="Create Project">
                                        <Button
                                            type="text"
                                            icon={<FiPlus size={16} />}
                                            onClick={() => { setShowCreateModal(true); }}
                                            style={{ color: theme.colors.textSecondary }}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Grid view">
                                        <Button
                                            type={viewMode === 'grid' ? 'primary' : 'text'}
                                            icon={<BsGrid3X3Gap size={16} />}
                                            onClick={() => setViewMode('grid')}
                                            style={viewMode === 'grid' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}}
                                        />
                                    </Tooltip>
                                    <Tooltip title="List view">
                                        <Button
                                            type={viewMode === 'list' ? 'primary' : 'text'}
                                            icon={<BsList size={16} />}
                                            onClick={() => setViewMode('list')}
                                            style={viewMode === 'list' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Project Settings">
                                        <Button
                                            type="text"
                                            icon={<IoSettingsOutline size={16} />}
                                            onClick={openProjectSettings}
                                            style={{ color: theme.colors.textSecondary }}
                                        />
                                    </Tooltip>
                                </div>
                                {filteredProjects.length !== projects.length && (
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                        Showing {filteredProjects.length} of {projects.length}
                                    </Text>
                                )}
                            </div>

                            {isLoading && projects.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '80px 0' }}><Spin size="large" /></div>
                            ) : filteredProjects.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: theme.colors.textTertiary }}>
                                    <BsKanban size={40} style={{ opacity: 0.3 }} />
                                    <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                                        {projects.length === 0 ? 'No projects yet.' : 'No projects match the filter.'}
                                    </Text>
                                    {projects.length === 0 && (
                                        <Button type="primary" style={{ marginTop: 12, background: theme.colors.primary, borderColor: theme.colors.primary }}
                                            onClick={() => setShowCreateModal(true)}>
                                            Create Project
                                        </Button>
                                    )}
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    gap: theme.spacing.lg,
                                }}>
                                    {filteredProjects.map(p => (
                                        <ProjectGridCard key={p.id} project={p} onClick={() => onSelectProject(p)} onToggleFavorite={handleToggleFavorite} onOpenSettings={(id) => openProjectSettings(id)} theme={theme} />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                                    {filteredProjects.map(p => (
                                        <ProjectListRow key={p.id} project={p} onClick={() => onSelectProject(p)} onToggleFavorite={handleToggleFavorite} onOpenSettings={(id) => openProjectSettings(id)} theme={theme} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
        </div >
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
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [showMemberFilter, setShowMemberFilter] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberFilterSearch, setMemberFilterSearch] = useState('');
<<<<<<< HEAD
    const [showAllNotifs, setShowAllNotifs] = useState(false);
=======
>>>>>>> old-work-backup

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

<<<<<<< HEAD
    const filteredNotifications = useMemo(() => {
        if (showAllNotifs) return notifications || [];
        return (notifications || []).filter(n => {
            if (!n.is_read) return true;
            return dayjs().diff(dayjs(n.created_at), 'hour') < 48;
        });
    }, [notifications, showAllNotifs]);

    const hasHiddenNotifs = (notifications?.length || 0) > filteredNotifications.length;

=======
>>>>>>> old-work-backup
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
                                const userObj = users.find(u => u.u_code === mgr.u_code);
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
                                            const u = users.find(user => user.u_code === mgr.u_code) || { u_code: mgr.u_code, u_name: mgr.u_code };
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
                                        const u = users.find(user => user.u_code === uCode);
                                        const name = u?.u_name || u?.u_nickname || uCode || '';
                                        return name.toLowerCase().includes(q) || uCode.toLowerCase().includes(q);
                                    }).map(uCode => {
                                        const u = users.find(user => user.u_code === uCode);
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
<<<<<<< HEAD
                            {(!filteredNotifications || filteredNotifications.length === 0) ? (
=======
                            {(!notifications || notifications.length === 0) ? (
>>>>>>> old-work-backup
                                <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>No notifications yet</Text>
                                </div>
                            ) : (
<<<<<<< HEAD
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
=======
                                notifications.slice(0, 20).map(n => {
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
                                    );
                                })
>>>>>>> old-work-backup
                            )}
                        </div>
                    )}
                >
                    <Badge count={unreadNotificationCount} size="small" offset={[-2, 2]}>
                        <Button type="text" size="small" icon={<IoNotificationsOutline size={18} />}
                            style={{ color: theme.colors.textSecondary }} />
                    </Badge>
                </Dropdown>

                {/* Board Settings */}
                <Button type="text" size="small" icon={<IoSettingsOutline size={16} />}
                    onClick={openBoardSettings} style={{ color: theme.colors.textSecondary }} />
            </Space>
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
        connectWebSocket, disconnectWebSocket
    } = useKanbanStore();

    // Global permissions
    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
    });

    // On mount: if URL has a projectId, restore that project
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    useEffect(() => {
<<<<<<< HEAD
        if (projectIdParam && projects.length > 0) {
            const currentId = activeProject?.id ? String(activeProject.id) : null;
            if (currentId !== String(projectIdParam)) {
                const p = projects.find(pr => String(pr.id) === String(projectIdParam));
                if (p) setActiveProject(p);
            }
=======
        if (projectIdParam && projects.length > 0 && !activeProject) {
            const p = projects.find(pr => String(pr.id) === String(projectIdParam));
            if (p) setActiveProject(p);
>>>>>>> old-work-backup
        }
    }, [projectIdParam, projects, activeProject, setActiveProject]);

    // WebSocket lifecycle
    useEffect(() => {
        if (activeBoard?.id) { connectWebSocket(activeBoard.id, empNo); }
        return () => { };
    }, [activeBoard?.id, empNo, connectWebSocket]);

    useEffect(() => {
        return () => disconnectWebSocket();
    }, [disconnectWebSocket]);

    const handleSelectProject = (project) => {
<<<<<<< HEAD
=======
        setActiveProject(project);
>>>>>>> old-work-backup
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
<<<<<<< HEAD
                                        if (val) {
                                            navigate(`/eng/kanban/${val}`);
=======
                                        const p = projects.find(pr => pr.id === val);
                                        if (p) {
                                            setActiveProject(p);
                                            navigate(`/eng/kanban/${p.id}`);
>>>>>>> old-work-backup
                                        }
                                    }}
                                    style={{ minWidth: 220 }}
                                    options={projects.map(p => ({ label: p.name, value: p.id }))}
                                    popupMatchSelectWidth={false}
                                    variant="borderless"
                                    className="kanban-project-title"
                                    showArrow={false}
                                />

                                {/* Project Members Popover triggered by Settings or Dropdown Icon near Project Name */}
                                <Dropdown
                                    trigger={['click']}  //'hover', 
                                    placement="bottom"
                                    dropdownRender={() => (
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
                                                    const u = useKanbanStore.getState().users.find(user => user.u_code === mgr.u_code) || { u_code: mgr.u_code };
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
                            {(boards || []).map((board) => {
                                const isActive = activeBoard?.id === board.id;
                                return (
                                    <div
                                        key={board.id}
                                        onClick={() => setActiveBoard(board)}
                                        style={{
                                            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                                            cursor: 'pointer',
                                            borderBottom: isActive ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                                            color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                                            fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
                                            fontSize: theme.typography.fontSize.sm,
                                            transition: `all ${theme.transitions.fast}`,
                                            whiteSpace: 'nowrap',
                                            display: 'flex', alignItems: 'center', gap: 6,
                                        }}
                                        onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = theme.colors.primary; }}
                                        onMouseOut={(e) => { if (!isActive) e.currentTarget.style.color = theme.colors.textSecondary; }}
                                    >
                                        <BsKanban size={14} />
                                        {board.name}
                                    </div>
                                );
                            })}
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
        </>
    );
};

export default KanbanMain;
