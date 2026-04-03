import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Typography, Form, Input, Button, Divider, Space, Popconfirm, Switch, Select, Avatar, Tooltip } from 'antd';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineCheck, AiOutlineClose, AiOutlineUser, AiOutlineUserAdd } from 'react-icons/ai';
import {
    IoSettingsOutline, IoRocketOutline, IoFlashOutline, IoHeartOutline, IoDiamondOutline,
    IoLeafOutline, IoBookOutline, IoCodeSlashOutline, IoColorPaletteOutline,
    IoGameControllerOutline, IoMusicalNotesOutline, IoPlanetOutline, IoShieldCheckmarkOutline,
    IoTrophyOutline, IoBulbOutline, IoConstructOutline, IoCubeOutline,
    IoFlagOutline, IoGlobeOutline, IoHammerOutline, IoPizzaOutline,
    IoPulseOutline, IoSchoolOutline, IoTerminalOutline, IoThunderstormOutline,
    IoWaterOutline, IoAirplaneOutline, IoBicycleOutline, IoCafeOutline,
    IoFitnessOutline, IoHomeOutline, IoLayersOutline, IoStarOutline,
    IoCalendarOutline, IoTimeOutline
} from 'react-icons/io5';
import { IoLockClosedOutline } from 'react-icons/io5';
import { MdOutlineDashboard } from 'react-icons/md';
import { BsKanban } from 'react-icons/bs';
import { useKanbanStore } from '../store/kanbanStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useTheme } from '../../../../theme';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;

// ─── Shared constants ─────────────────────────────────────────────
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

// ─── Mini Gradient Picker ─────────────────────────────────────────
const GradientPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {GRADIENTS.map((g, i) => (
            <div key={i} onClick={() => onChange(g)}
                style={{
                    width: 24, height: 24, borderRadius: 5,
                    background: g, cursor: 'pointer',
                    border: value === g ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: value === g ? `0 0 0 2px ${theme.colors.primary}` : 'none',
                    transition: 'all 0.15s ease',
                }}
            />
        ))}
    </div>
);

// ─── Mini Icon Picker ─────────────────────────────────────────────
const IconPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {PROJECT_ICONS.map(({ key, icon: Icon, label }) => (
            <Tooltip title={label} key={key}>
                <div onClick={() => onChange(key)}
                    style={{
                        width: 28, height: 28, borderRadius: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        background: value === key ? `${theme.colors.primary}20` : 'transparent',
                        border: value === key ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                        color: value === key ? theme.colors.primary : theme.colors.textSecondary,
                        transition: 'all 0.15s ease',
                    }}
                >
                    <Icon size={15} />
                </div>
            </Tooltip>
        ))}
    </div>
);

const ProjectSettingsDrawer = () => {
    const { theme } = useTheme();

<<<<<<< HEAD
    const activeProject = useKanbanStore(state => state.activeProject);
    const projects = useKanbanStore(state => state.projects);
=======
>>>>>>> old-work-backup
    const {
        isProjectSettingsOpen,
        closeProjectSettings,
        projectSettingsTargetId,
<<<<<<< HEAD
=======
        projects,
>>>>>>> old-work-backup
        fetchProjects,
        setActiveProject,
        updateProject,
        deleteProject,
        userPreferences, fetchUserPreferences, updateUserPreferences,
        projectManagers, fetchProjectManagers, addProjectManager, removeProjectManager,
        users
    } = useKanbanStore();

    const [form] = Form.useForm();
    const [isCreating, setIsCreating] = useState(false);

    // Edit Form State
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [editingDesc, setEditingDesc] = useState('');
    const [editingGradient, setEditingGradient] = useState(GRADIENTS[0]);
    const [editingIcon, setEditingIcon] = useState('rocket');
    const [editingPrivate, setEditingPrivate] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');

<<<<<<< HEAD
    const targetId = projectSettingsTargetId || activeProject?.id;
    const activeProjectForPermissions = projects.find(p => String(p.id) === String(targetId));
    const { canCreateProject, canManageProjectMembers, canManageProject } = useKanbanPermissions({
        isPrivateProject: activeProjectForPermissions?.is_private,
        projectRole: activeProjectForPermissions?.role,
    });

    useEffect(() => {
        if (isProjectSettingsOpen) fetchUserPreferences();
    }, [isProjectSettingsOpen, fetchUserPreferences]);
=======
    const { canCreateProject, canManageProjectMembers, canManageProject } = useKanbanPermissions();

    useEffect(() => {
        if (isProjectSettingsOpen) fetchUserPreferences();
    }, [isProjectSettingsOpen]);
>>>>>>> old-work-backup

    // Single-project mode: auto-open editing when drawer opens with a target
    const isSingleProjectMode = !!projectSettingsTargetId;
    const targetProject = isSingleProjectMode ? projects.find(p => p.id === projectSettingsTargetId) : null;

    useEffect(() => {
        if (isProjectSettingsOpen && isSingleProjectMode && targetProject) {
            startEditing(targetProject);
        }
        if (!isProjectSettingsOpen) {
            setEditingId(null);
        }
    }, [isProjectSettingsOpen, projectSettingsTargetId]);

    const handleCreateProject = async (values) => {
        setIsCreating(true);
        try {
            const res = await axios.post(server.KANBAN_PROJECTS, { name: values.projectName });
            if (res.data?.data) {
                Swal.fire({ icon: 'success', title: 'Project Created', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                form.resetFields();
                await fetchProjects();
                setActiveProject(res.data.data);
                closeProjectSettings();
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to create project', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditProject = async (projectId) => {
        if (!editingName.trim()) return;
        await updateProject(projectId, {
            name: editingName.trim(),
            description: editingDesc,
            background_type: 'gradient',
            background_value: editingGradient,
            icon: editingIcon,
            is_private: editingPrivate,
        });
        setEditingId(null);
        setEditingName('');
        setEditingDesc('');
    };

    const startEditing = (proj) => {
        setEditingId(proj.id);
        setEditingName(proj.name);
        setEditingDesc(proj.description || '');
        setEditingGradient(proj.background_value || GRADIENTS[(proj.id || 0) % GRADIENTS.length]);
        setEditingIcon(proj.icon || 'rocket');
        setEditingPrivate(proj.is_private || false);
        setMemberSearch('');
        fetchProjectManagers(proj.id);
    };

    // Filter users for the project member dropdown
    const availableUsersForProject = useMemo(() => {
        return users.filter(u =>
            u.u_code.toLowerCase().includes(memberSearch.toLowerCase()) ||
            (u.u_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
            (u.u_nickname || '').toLowerCase().includes(memberSearch.toLowerCase())
        );
    }, [users, memberSearch]);

    const handleDeleteProject = async (projectId) => {
        const ok = await deleteProject(projectId);
        if (ok) {
            Swal.fire({ icon: 'success', title: 'Project Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        }
    };

    // Which projects to show in the list
    const displayProjects = isSingleProjectMode && targetProject
        ? [targetProject]
        : projects;

    return (
        <Drawer
            title={
                <Space>
                    <IoSettingsOutline size={20} color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textPrimary }}>
                        {isSingleProjectMode ? `${targetProject?.name || 'Project'} Settings` : 'Project Settings'}
                    </span>
                </Space>
            }
            placement="right"
            onClose={closeProjectSettings}
            open={isProjectSettingsOpen}
            width={420}
            styles={{
                body: { background: theme.colors.background, padding: 0 },
                header: { background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }
            }}
        >
            <div style={{ padding: theme.spacing.xl }}>

                {/* Create Project — only show in global mode for AD/MGR */}
                {!isSingleProjectMode && canCreateProject && (
                    <div style={{
                        background: theme.colors.surface,
                        padding: theme.spacing.lg,
                        borderRadius: theme.borderRadius.lg,
                        border: `1px solid ${theme.colors.border}`,
                        marginBottom: theme.spacing.xl,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                            <MdOutlineDashboard size={18} color={theme.colors.primary} />
                            <Title level={5} style={{ margin: 0, fontSize: 15 }}>Create New Project</Title>
                        </div>
                        <Text type="secondary" style={{ display: 'block', marginBottom: theme.spacing.md, fontSize: 13 }}>
                            Start a new workspace to organize your boards.
                        </Text>
                        <Form form={form} layout="vertical" onFinish={handleCreateProject}>
                            <Form.Item
                                name="projectName"
                                rules={[{ required: true, message: 'Please input project name!' }]}
                                style={{ marginBottom: theme.spacing.md }}
                            >
                                <Input
                                    placeholder="E.g., Production Line A, IT Helpdesk"
                                    style={{ borderRadius: theme.borderRadius.sm }}
                                />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={isCreating} block
                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm, height: 38 }}
                            >
                                Create Project
                            </Button>
                        </Form>
                    </div>
                )}

                {/* Projects List */}
                <div style={{ marginBottom: theme.spacing.xl }}>
                    <Text strong style={{
                        fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                        color: theme.colors.textTertiary, display: 'block', marginBottom: theme.spacing.md
                    }}>
                        {isSingleProjectMode ? 'Edit Project' : 'Your Projects'}
                    </Text>
                    {projects.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: theme.spacing.xl,
                            background: theme.colors.surface, borderRadius: theme.borderRadius.md,
                            border: `1px dashed ${theme.colors.border}`
                        }}>
                            <Text type="secondary">No projects found. Create one above!</Text>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {displayProjects.map((proj, idx) => (
                                <div key={proj.id} style={{
                                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                    background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.primary}05)`,
                                    borderRadius: theme.borderRadius.md,
                                    border: `1px solid ${theme.colors.border}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: `all ${theme.transitions.fast}`,
                                }}>
                                    {editingId === proj.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, flex: 1, width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text strong>Edit Project</Text>
                                                <Button size="small" type="text" icon={<AiOutlineClose />} onClick={() => setEditingId(null)} />
                                            </div>

                                            <div>
                                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Name</Text>
                                                <Input
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    placeholder="Project Name..."
                                                    style={{ borderRadius: theme.borderRadius.sm }}
                                                />
                                            </div>

                                            <div>
                                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Description</Text>
                                                <Input.TextArea
                                                    value={editingDesc}
                                                    onChange={(e) => setEditingDesc(e.target.value)}
                                                    placeholder="Project description..."
                                                    rows={2}
                                                    style={{ borderRadius: theme.borderRadius.sm }}
                                                />
                                            </div>

                                            <Divider style={{ margin: '8px 0' }} />

                                            {/* Gradient Picker */}
                                            <div>
                                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>Gradient Color</Text>
                                                <GradientPicker value={editingGradient} onChange={setEditingGradient} theme={theme} />
                                            </div>

                                            {/* Icon Picker */}
                                            <div>
                                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>Project Icon</Text>
                                                <IconPicker value={editingIcon} onChange={setEditingIcon} theme={theme} />
                                            </div>

                                            <Divider style={{ margin: '8px 0' }} />

                                            {/* Private Project Toggle */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <IoLockClosedOutline size={14} color={theme.colors.textSecondary} />
                                                    <div>
                                                        <Text strong style={{ fontSize: 13 }}>Private Project</Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                                            {editingPrivate ? 'Only members can see this project' : 'Visible to managers'}
                                                        </Text>
                                                    </div>
                                                </div>
                                                <Switch checked={editingPrivate} onChange={setEditingPrivate} />
                                            </div>

                                            <Divider style={{ margin: '8px 0' }} />

                                            {/* Members Section inside Edit Modal */}
                                            <div>
                                                <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>Project Members</Text>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                                    {projectManagers.map(mgr => {
                                                        const userObj = users.find(u => u.u_code === mgr.u_code);
                                                        const words = (userObj?.u_name || '').split(' ');
                                                        const initials = words.length >= 2
                                                            ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                                            : (userObj?.u_nickname?.[0] || mgr.u_code[0]).toUpperCase();
                                                        return (
                                                            <div key={mgr.id} style={{
                                                                display: 'flex', alignItems: 'center', gap: 4,
                                                                background: theme.colors.background, padding: '2px 8px 2px 2px',
                                                                borderRadius: 16, border: `1px solid ${theme.colors.border}`
                                                            }}>
                                                                {userObj?.profile_img_b64 ? (
                                                                    <Avatar size={24} src={userObj.profile_img_b64} />
                                                                ) : (
                                                                    <Avatar size={24}>{initials}</Avatar>
                                                                )}
                                                                <Text style={{ fontSize: 12 }}>{userObj?.u_name || userObj?.u_nickname || mgr.u_code}</Text>
                                                                {mgr.role !== 'owner' && (
                                                                    <AiOutlineClose
                                                                        size={12}
                                                                        style={{ cursor: 'pointer', marginLeft: 4, color: theme.colors.textSecondary }}
                                                                        onClick={() => removeProjectManager(proj.id, mgr.u_code)}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {canManageProjectMembers && (
                                                    <Select
                                                        showSearch
                                                        placeholder="Add member to project..."
                                                        style={{ width: '100%' }}
                                                        optionFilterProp="children"
                                                        onSearch={setMemberSearch}
                                                        onChange={(val) => {
                                                            if (val) addProjectManager(proj.id, val);
                                                        }}
                                                        value={null}
                                                        filterOption={false}
                                                    >
                                                        {availableUsersForProject.map(u => (
                                                            <Select.Option key={u.u_code} value={u.u_code}>
                                                                {u.u_code} - {u.u_name || u.u_nickname || u.u_code}
                                                            </Select.Option>
                                                        ))}
                                                    </Select>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                                <Button onClick={() => setEditingId(null)}>Cancel</Button>
                                                <Button type="primary" onClick={() => handleEditProject(proj.id)}>Save Changes</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <Text strong style={{ fontSize: 14, color: theme.colors.textPrimary }}>{proj.name}</Text>
                                                <br />
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {proj.board_count || 0} board(s)
                                                </Text>
                                            </div>
                                            <Space size={2}>
                                                {canManageProject && (
                                                    <>
                                                        <Button
                                                            type="text" size="small"
                                                            icon={<AiOutlineEdit style={{ color: theme.colors.textSecondary }} />}
                                                            onClick={() => startEditing(proj)}
                                                        />
                                                        <Popconfirm
                                                            title="Delete this project?"
                                                            description="All boards and cards will be deleted."
                                                            onConfirm={() => handleDeleteProject(proj.id)}
                                                            okText="Delete"
                                                            okType="danger"
                                                        >
                                                            <Button type="text" size="small" danger icon={<AiOutlineDelete />} />
                                                        </Popconfirm>
                                                    </>
                                                )}
                                            </Space>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Divider style={{ margin: `${theme.spacing.sm} 0` }} />

                {/* User Preferences */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                        <AiOutlineUser size={18} color={theme.colors.primary} />
                        <Title level={5} style={{ margin: 0, fontSize: 15 }}>User Preferences</Title>
                    </div>
                    <div style={{
                        background: theme.colors.surface, padding: theme.spacing.lg,
                        borderRadius: theme.borderRadius.lg, border: `1px solid ${theme.colors.border}`,
                        display: 'flex', flexDirection: 'column', gap: 14
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong style={{ fontSize: 13 }}>Subscribe to own cards</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>Auto-subscribe to cards you create</Text>
                            </div>
                            <Switch
                                checked={userPreferences?.subscribe_to_own_cards || false}
                                onChange={(checked) => updateUserPreferences({ subscribe_to_own_cards: checked })}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong style={{ fontSize: 13 }}>Turn off Notifications</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>Disable all in-app notifications</Text>
                            </div>
                            <Switch
                                checked={userPreferences?.is_notification_off || false}
                                onChange={(checked) => updateUserPreferences({ is_notification_off: checked })}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong style={{ fontSize: 13 }}>Language</Text>
                            </div>
                            <Select
                                size="small" style={{ width: 120 }}
                                value={userPreferences?.pref_language || 'en'}
                                onChange={(val) => updateUserPreferences({ pref_language: val })}
                                options={[
                                    { label: 'English', value: 'en' },
                                    { label: 'ไทย', value: 'th' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Drawer>
    );
};

export default ProjectSettingsDrawer;
