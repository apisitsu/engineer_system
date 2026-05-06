import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Typography, Form, Input, Button, Divider, Space, Popconfirm, Switch, Select, Avatar, Tooltip, Menu, Alert, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineClose, AiOutlineBgColors, AiOutlineUser, AiOutlineQuestionCircle } from 'react-icons/ai';
import { IoSettingsOutline, IoRocketOutline, IoLockClosedOutline, IoLayersOutline } from 'react-icons/io5';
import { FiUsers } from 'react-icons/fi';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../../../stores/authStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useTheme } from '../../../../theme';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import Swal from 'sweetalert2';
import TemplateBuilderDrawer from './TemplateBuilderDrawer';
import { GRADIENTS, PROJECT_ICONS } from '../constants/kanbanConstants';

const { Title, Text } = Typography;

// ─── Shared Components ─────────────────────────────────────────────
const SectionLabel = ({ children, theme }) => (
    <Text strong style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
        color: theme.colors.textTertiary, display: 'block', marginBottom: 8
    }}>
        {children}
    </Text>
);

const ToggleRow = ({ title, description, checked, onChange, theme }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
            <Text strong style={{ fontSize: 13 }}>{title}</Text>
            {description && (
                <>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{description}</Text>
                </>
            )}
        </div>
        <Switch checked={checked} onChange={onChange} />
    </div>
);



const GradientPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, padding: '4px 0' }}>
        {GRADIENTS.map((g, i) => (
            <div
                key={i}
                onClick={() => onChange(g)}
                style={{
                    width: '100%', aspectRatio: '1', borderRadius: '50%', background: g,
                    cursor: 'pointer', border: value === g ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                    boxShadow: value === g ? `0 0 0 2px #fff, 0 0 0 3px ${theme.colors.primary}` : '0 1px 4px rgba(0,0,0,0.10)',
                    transition: 'all 0.2s ease', transform: value === g ? 'scale(1.05)' : 'none',
                }}
            />
        ))}
    </div>
);

const IconPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, padding: '4px 0' }}>
        {PROJECT_ICONS.map((item) => {
            const Icon = item.icon;
            return (
                <Tooltip key={item.key} title={item.label}>
                    <div
                        onClick={() => onChange(item.key)}
                        style={{
                            width: '100%', aspectRatio: '1', borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', background: value === item.key ? theme.colors.primary : theme.colors.surface,
                            color: value === item.key ? '#fff' : theme.colors.textSecondary,
                            border: `1.5px solid ${value === item.key ? theme.colors.primary : theme.colors.border}`,
                            transition: 'all 0.2s ease',
                            boxShadow: value === item.key ? `0 2px 8px ${theme.colors.primary}40` : 'none',
                        }}
                    >
                        <Icon size={18} />
                    </div>
                </Tooltip>
            );
        })}
    </div>
);

const ProjectSettingsDrawer = () => {
    const { theme } = useTheme();

    const activeProject = useKanbanStore(state => state.activeProject);
    const projects = useKanbanStore(state => state.projects);
    const {
        isProjectSettingsOpen, closeProjectSettings, projectSettingsTargetId, fetchProjects,
        setActiveProject, updateProject, deleteProject,
        userPreferences, fetchUserPreferences, updateUserPreferences,
        projectManagers, fetchProjectManagers, addProjectManager, removeProjectManager, users
    } = useKanbanStore(
        useShallow(state => ({
            isProjectSettingsOpen: state.isProjectSettingsOpen, closeProjectSettings: state.closeProjectSettings,
            projectSettingsTargetId: state.projectSettingsTargetId, fetchProjects: state.fetchProjects,
            setActiveProject: state.setActiveProject, updateProject: state.updateProject, deleteProject: state.deleteProject,
            userPreferences: state.userPreferences, fetchUserPreferences: state.fetchUserPreferences,
            updateUserPreferences: state.updateUserPreferences, projectManagers: state.projectManagers,
            fetchProjectManagers: state.fetchProjectManagers, addProjectManager: state.addProjectManager,
            removeProjectManager: state.removeProjectManager, users: state.users
        }))
    );

    const [form] = Form.useForm();
    const [activeTab, setActiveTab] = useState('project_info');
    const [selectedProjectId, setSelectedProjectId] = useState(null);

    // Edit Form State
    const [editingName, setEditingName] = useState('');
    const [editingDesc, setEditingDesc] = useState('');
    const [editingGradient, setEditingGradient] = useState(GRADIENTS[0]);
    const [editingIcon, setEditingIcon] = useState('rocket');
    const [editingPrivate, setEditingPrivate] = useState(false);
    const [editingPermanent, setEditingPermanent] = useState(false);
    const [editingPriority, setEditingPriority] = useState('Medium');
    const [editingStatus, setEditingStatus] = useState('Active');
    const [editingStartDate, setEditingStartDate] = useState(null);
    const [editingDueDate, setEditingDueDate] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
    const [editingRoleUcode, setEditingRoleUcode] = useState(null);

    const isSingleProjectMode = !!projectSettingsTargetId;
    const targetId = isSingleProjectMode ? projectSettingsTargetId : selectedProjectId;
    const targetProject = projects.find(p => String(p.id) === String(targetId));

    const { canManageProjectMembers, canManageProject } = useKanbanPermissions({
        isPrivateProject: targetProject?.is_private,
        projectRole: targetProject?.role,
    });

    const userInfo = useAuthStore(state => state.userInfo) || {};
    const userDepartment = useAuthStore(state => state.userDepartment);
    const userRole = useAuthStore(state => state.userRole);
    const currentUserDept = userDepartment || userInfo.u_dept || '';
    const currentUserRole = userRole || userInfo.u_role || userInfo.role || '';
    const isAD = (currentUserDept || '').toUpperCase() === 'AD' || (currentUserRole || '').toUpperCase() === 'AD';
    const isADorMgr = ['AD', 'MGR', 'COORD'].includes((currentUserDept || '').toUpperCase());
    const isOwner = targetProject?.role === 'owner';
    const canChangeRole = isADorMgr || isOwner;

    useEffect(() => {
        if (isProjectSettingsOpen) fetchUserPreferences();
    }, [isProjectSettingsOpen, fetchUserPreferences]);

    useEffect(() => {
        if (isProjectSettingsOpen) {
            if (isSingleProjectMode) {
                setSelectedProjectId(projectSettingsTargetId);
                loadProjectData(projectSettingsTargetId);
            } else if (projects.length > 0 && !selectedProjectId) {
                setSelectedProjectId(projects[0].id);
                loadProjectData(projects[0].id);
            }
        }
    }, [isProjectSettingsOpen, projectSettingsTargetId, projects]);

    const loadProjectData = (pid) => {
        const proj = projects.find(p => p.id === pid);
        if (proj) {
            setEditingName(proj.name);
            setEditingDesc(proj.description || '');
            setEditingGradient(proj.background_value || GRADIENTS[(proj.id || 0) % GRADIENTS.length]);
            setEditingIcon(proj.icon || 'rocket');
            setEditingPrivate(proj.is_private || false);
            setEditingPermanent(proj.is_permanent || false);
            setEditingPriority(proj.priority || 'Medium');
            setEditingStatus(proj.status || 'Active');
            setEditingStartDate(proj.start_date ? dayjs(proj.start_date) : null);
            setEditingDueDate(proj.due_date ? dayjs(proj.due_date) : null);
            fetchProjectManagers(proj.id);
        }
    };

    const handleProjectChange = (val) => {
        setSelectedProjectId(val);
        loadProjectData(val);
    };

    const handleSaveInfo = async () => {
        if (!targetId || !editingName.trim()) return;
        await updateProject(targetId, {
            name: editingName.trim(), description: editingDesc,
            priority: editingPriority, status: editingStatus,
            start_date: editingStartDate ? editingStartDate.toISOString() : null,
            due_date: editingDueDate ? editingDueDate.toISOString() : null,
        });
        Swal.fire({ icon: 'success', title: 'Saved', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    };

    const handleSaveAppearance = async () => {
        if (!targetId) return;
        await updateProject(targetId, {
            background_type: 'gradient', background_value: editingGradient, icon: editingIcon,
        });
        Swal.fire({ icon: 'success', title: 'Saved', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    };

    const handleSaveAccess = async () => {
        if (!targetId) return;
        await updateProject(targetId, {
            is_private: editingPrivate, is_permanent: editingPermanent,
        });
        Swal.fire({ icon: 'success', title: 'Saved', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    };

    const handleDeleteProject = async () => {
        if (!targetId) return;
        const ok = await deleteProject(targetId);
        if (ok) {
            Swal.fire({ icon: 'success', title: 'Project Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            if (isSingleProjectMode) closeProjectSettings();
            else {
                setSelectedProjectId(null);
                setActiveTab('user_prefs');
            }
        }
    };

    const handleRemoveMemberClick = (member) => {
        if (member.role === 'owner') {
            const owners = projectManagers.filter(m => m.role === 'owner');
            if (owners.length <= 1) {
                Swal.fire({ icon: 'warning', title: 'Cannot Remove Last Owner', text: 'This project must have at least one owner.' });
                return;
            }
        }
        removeProjectManager(targetId, member.u_code);
    };

    const handleRoleChange = (member, newRole) => {
        if (member.role === 'owner' && newRole !== 'owner') {
            const owners = projectManagers.filter(m => m.role === 'owner');
            if (owners.length <= 1) {
                Swal.fire({ icon: 'warning', title: 'Cannot Change Role', text: 'This project must have at least one owner.' });
                return;
            }
        }
        addProjectManager(targetId, member.u_code, newRole);
        setEditingRoleUcode(null);
    };

    const availableUsersForProject = useMemo(() => {
        return users.filter(u =>
            u.u_code.toLowerCase().includes((memberSearch || '').toLowerCase()) ||
            (u.u_name || '').toLowerCase().includes((memberSearch || '').toLowerCase()) ||
            (u.u_nickname || '').toLowerCase().includes((memberSearch || '').toLowerCase())
        );
    }, [users, memberSearch]);

    const Card = ({ children, style }) => (
        <div style={{
            background: theme.colors.surface, padding: theme.spacing.lg,
            borderRadius: theme.borderRadius.lg, border: `1px solid ${theme.colors.border}`,
            marginBottom: theme.spacing.md, ...style,
        }}>
            {children}
        </div>
    );

    const menuItems = [
        { key: 'project_info', icon: <IoRocketOutline />, label: 'Project Info' },
        { key: 'appearance', icon: <AiOutlineBgColors />, label: 'Appearance' },
        { key: 'access', icon: <IoLockClosedOutline />, label: 'Access' },
        { key: 'members', icon: <FiUsers />, label: 'Members' },
        { key: 'user_prefs', icon: <AiOutlineUser />, label: 'My Preferences' },
    ];

    const ProjectInfoTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <IoRocketOutline size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Project Information</Title>
            </div>
            {canManageProject ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Name</Text>
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="Project Name..." style={{ borderRadius: theme.borderRadius.sm }} />
                    </div>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Description</Text>
                        <Input.TextArea value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} placeholder="Project description..." rows={2} style={{ borderRadius: theme.borderRadius.sm }} />
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Priority</Text>
                            <Select value={editingPriority} onChange={setEditingPriority} style={{ width: '100%' }}>
                                <Select.Option value="Low">Low</Select.Option>
                                <Select.Option value="Medium">Medium</Select.Option>
                                <Select.Option value="High">High</Select.Option>
                                <Select.Option value="Urgent">Urgent</Select.Option>
                            </Select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Status</Text>
                            <Select value={editingStatus} onChange={setEditingStatus} style={{ width: '100%' }}>
                                <Select.Option value="Waiting">Waiting (Pool)</Select.Option>
                                <Select.Option value="Active">Active</Select.Option>
                                <Select.Option value="Completed">Completed</Select.Option>
                            </Select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Start Date</Text>
                            <DatePicker
                                style={{ width: '100%' }}
                                format="DD MMM YYYY"
                                value={editingStartDate}
                                disabled
                                placeholder="Auto-assigned"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>Due Date</Text>
                            <DatePicker
                                style={{ width: '100%' }}
                                format="DD MMM YYYY"
                                placeholder="Not set"
                                value={editingDueDate}
                                onChange={(date) => setEditingDueDate(date || null)}
                            />
                        </div>
                    </div>
                    <Button type="primary" onClick={handleSaveInfo}>Save Changes</Button>
                    {isAD && (
                        <>
                            <Divider style={{ margin: '8px 0' }} />
                            <Button block icon={<IoLayersOutline />} onClick={() => setShowTemplateBuilder(true)} style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}>Save as Blueprint Template</Button>
                        </>
                    )}
                    <Divider style={{ margin: '8px 0' }} />
                    <Text strong style={{ color: theme.colors.error }}>Danger Zone</Text>
                    <Popconfirm title="Delete this project?" description="All boards and cards will be deleted." onConfirm={handleDeleteProject} okText="Yes, delete it" cancelText="Cancel" okButtonProps={{ danger: true }}>
                        <Button danger block icon={<AiOutlineDelete />}>Delete Project</Button>
                    </Popconfirm>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Text strong style={{ fontSize: 16 }}>{targetProject?.name}</Text>
                    <Text type="secondary">{targetProject?.description || 'No description'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>Priority: {targetProject?.priority || 'Medium'} | Status: {targetProject?.status || 'Active'}</Text>
                </div>
            )}
        </Card>
    );

    const AppearanceTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <AiOutlineBgColors size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Appearance</Title>
            </div>
            {canManageProject ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <SectionLabel theme={theme}>Gradient Color</SectionLabel>
                        <GradientPicker value={editingGradient} onChange={setEditingGradient} theme={theme} />
                    </div>
                    <div>
                        <SectionLabel theme={theme}>Project Icon</SectionLabel>
                        <IconPicker value={editingIcon} onChange={setEditingIcon} theme={theme} />
                    </div>
                    <Button type="primary" onClick={handleSaveAppearance}>Save Appearance</Button>
                </div>
            ) : (
                <Text type="secondary">You don't have permission to change appearance.</Text>
            )}
        </Card>
    );

    const AccessTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <IoLockClosedOutline size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Access & Settings</Title>
            </div>
            {canManageProject ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ToggleRow title="Private Project" description="Only members can see this project" checked={editingPrivate} onChange={setEditingPrivate} theme={theme} />
                    <Divider style={{ margin: '0' }} />
                    <ToggleRow title="Permanent Project" description="Enable for continuous operations dashboard" checked={editingPermanent} onChange={setEditingPermanent} theme={theme} />
                    <Button type="primary" onClick={handleSaveAccess}>Save Access Settings</Button>
                </div>
            ) : (
                <Text type="secondary">You don't have permission to change access settings.</Text>
            )}
        </Card>
    );

    const MembersTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <FiUsers size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Project Members</Title>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {projectManagers.map(mgr => {
                        const u = users.find(user => user.u_code === mgr.u_code) || { u_code: mgr.u_code, u_name: mgr.u_code };
                        return (
                            <div key={mgr.u_code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: theme.borderRadius.sm, background: `${theme.colors.info}10` }}>
                                <Space>
                                    <Avatar size="small" src={u.profile_img_b64} style={{ backgroundColor: theme.colors.info }}>
                                        {u.profile_img_b64 ? null : (u.u_name || u.u_code)[0].toUpperCase()}
                                    </Avatar>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <Text style={{ fontSize: 13, lineHeight: 1.2 }}>{u.u_name || u.u_nickname || u.u_code}</Text>
                                        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{u.u_code}</Text>
                                    </div>
                                </Space>
                                <Space>
                                    {editingRoleUcode === mgr.u_code ? (
                                        <>
                                            <Select size="small" value={mgr.role} onChange={(newRole) => handleRoleChange(mgr, newRole)} options={[{ label: 'Viewer', value: 'viewer' }, { label: 'Editor', value: 'editor' }, { label: 'Owner', value: 'owner' }]} style={{ width: 85, fontSize: 11 }} />
                                            <Button type="text" size="small" icon={<AiOutlineClose />} onClick={() => setEditingRoleUcode(null)} />
                                        </>
                                    ) : (
                                        <>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{mgr.role}</Text>
                                            {canChangeRole && <Button type="text" size="small" icon={<AiOutlineEdit style={{ color: theme.colors.textSecondary }} />} onClick={() => setEditingRoleUcode(mgr.u_code)} />}
                                        </>
                                    )}
                                    {canChangeRole && <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => handleRemoveMemberClick(mgr)} />}
                                </Space>
                            </div>
                        );
                    })}
                </div>
                {(canManageProjectMembers || canManageProject) && (
                    <div style={{ marginTop: 8 }}>
                        <Select 
                            showSearch 
                            placeholder="Add member..." 
                            style={{ width: '100%' }} 
                            onChange={(val) => { if (val) { addProjectManager(targetId, val); } }} 
                            value={null} 
                            filterOption={(input, option) => {
                                return (`${option.search_data}`.toLowerCase()).includes(input.toLowerCase());
                            }}
                        >
                            {users.map(u => (
                                <Select.Option key={u.u_code} value={u.u_code} search_data={`${u.u_code} ${u.u_name || ''} ${u.u_nickname || ''}`}>
                                    <Space>
                                        <Avatar size="small" src={u.profile_img_b64} />
                                        <Text style={{ fontSize: 13 }}>{u.u_code} - {u.u_name || u.u_code}</Text>
                                    </Space>
                                </Select.Option>
                            ))}
                        </Select>
                    </div>
                )}
            </div>
        </Card>
    );

    const UserPrefsTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <AiOutlineUser size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>My Preferences</Title>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ToggleRow title="Subscribe to own cards" description="Auto-subscribe to cards you create" checked={userPreferences?.subscribe_to_own_cards || false} onChange={(checked) => updateUserPreferences({ subscribe_to_own_cards: checked })} theme={theme} />
                <Divider style={{ margin: '0' }} />
                <ToggleRow title="Turn off Notifications" description="Disable all in-app notifications" checked={userPreferences?.is_notification_off || false} onChange={(checked) => updateUserPreferences({ is_notification_off: checked })} theme={theme} />
                <Divider style={{ margin: '0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13 }}>Language</Text>
                    <Select size="small" style={{ width: 120 }} value={userPreferences?.pref_language || 'en'} onChange={(val) => updateUserPreferences({ pref_language: val })} options={[{ label: 'English', value: 'en' }, { label: 'ไทย', value: 'th' }]} />
                </div>
            </div>
        </Card>
    );

    const renderActiveTab = () => {
        if (!targetProject && activeTab !== 'user_prefs') {
            return <div style={{ textAlign: 'center', padding: theme.spacing.xl }}><Text type="secondary">Please select a project.</Text></div>;
        }
        switch (activeTab) {
            case 'project_info': return <ProjectInfoTab />;
            case 'appearance': return <AppearanceTab />;
            case 'access': return <AccessTab />;
            case 'members': return <MembersTab />;
            case 'user_prefs': return <UserPrefsTab />;
            default: return <ProjectInfoTab />;
        }
    };

    return (
        <Drawer
            title={<Space><IoSettingsOutline /> Project Settings</Space>}
            placement="right"
            extra={
                <Tooltip title="View User Guide">
                    <Button 
                        type="text" 
                        icon={<AiOutlineQuestionCircle />} 
                        onClick={() => window.open('/eng/user-guide#settings-permissions', '_blank')}
                    />
                </Tooltip>
            }
            onClose={closeProjectSettings}
            open={isProjectSettingsOpen}
            width={720}
            styles={{
                body: { background: theme.colors.background, padding: 0 },
                header: { background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }
            }}
        >
            <div style={{ display: 'flex', height: '100%' }}>
                {/* Sidebar */}
                <div style={{ width: 220, borderRight: `1px solid ${theme.colors.border}`, background: theme.colors.surface, padding: '16px 8px', display: 'flex', flexDirection: 'column' }}>
                    {!isSingleProjectMode && (
                        <div style={{ padding: '0 8px 16px 8px' }}>
                            <Select
                                value={selectedProjectId}
                                onChange={handleProjectChange}
                                style={{ width: '100%' }}
                                placeholder="Select Project"
                                options={projects.map(p => ({ label: p.name, value: p.id }))}
                            />
                        </div>
                    )}
                    <Menu
                        mode="vertical"
                        selectedKeys={[activeTab]}
                        onClick={({ key }) => setActiveTab(key)}
                        items={menuItems}
                        style={{ border: 'none', background: 'transparent' }}
                    />
                </div>
                {/* Content */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                    {renderActiveTab()}
                </div>
            </div>
            
            {showTemplateBuilder && targetProject && (
                <TemplateBuilderDrawer
                    open={showTemplateBuilder}
                    onClose={() => setShowTemplateBuilder(false)}
                    masterProject={targetProject}
                />
            )}
        </Drawer>
    );
};

export default ProjectSettingsDrawer;
