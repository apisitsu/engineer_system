import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Button, Tooltip, Badge, Tabs } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useAuthStore } from '../../../../stores/authStore';

import { MdOutlineAssessment } from 'react-icons/md';
import { BsKanban } from 'react-icons/bs';
import { IoTimeOutline, IoHelpCircleOutline, IoAddOutline, IoSettingsOutline } from 'react-icons/io5';
import { RiKanbanView } from 'react-icons/ri';

import ProjectsTab from './ProjectsTab';
import ReportsTab from './ReportsTab';
import WorkloadTab from './WorkloadTab';
import TemplatesTab from './TemplatesTab';

import CreateProjectModal from './components/CreateProjectModal';
import BlueprintInstantiationModal from './components/BlueprintInstantiationModal';
import ProjectSettingsDrawer from '../Settings/ProjectSettingsDrawer';
import KanbanAdminSettings from '../Settings/KanbanAdminSettings';
import UserGuideDrawer from '../UserGuide/UserGuideDrawer';
import ScrollbarStyle from '../../../common/scrollbar';
import { IoLayersOutline } from 'react-icons/io5';

const { Title, Text } = Typography;

const ProjectListPage = ({ onSelectProject, theme }) => {
    const {
        projects, fetchProjects, isLoading, openProjectSettings,
        toggleFavorite, kanbanTabOrder
    } = useKanbanStore(
        useShallow(state => ({
            projects: state.projects, fetchProjects: state.fetchProjects,
            isLoading: state.isLoading, openProjectSettings: state.openProjectSettings,
            toggleFavorite: state.toggleFavorite,
            kanbanTabOrder: state.kanbanTabOrder
        }))
    );

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBlueprintModal, setShowBlueprintModal] = useState(false);
    const [showUserGuide, setShowUserGuide] = useState(false);

    // Default active tab — 'dashboard' is no longer valid, map to 'projects'
    const getInitialTab = () => {
        const first = kanbanTabOrder?.[0] || 'projects';
        return first === 'dashboard' ? 'projects' : first;
    };
    const [activeTab, setActiveTab] = useState(getInitialTab);

    const { canCreateProject, canManageTemplates } = useKanbanPermissions();
    const { userDepartment, userRole } = useAuthStore();
    const isAdmin = userRole === 'admin' || userDepartment === 'AD' || userRole === 'system_admin';

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const handleToggleFavorite = async (projectId) => {
        await toggleFavorite(projectId);
    };

    // Tab items configuration
    const tabConfig = {
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
                    isLoading={isLoading}
                    onSelectProject={onSelectProject}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenProjectSettings={openProjectSettings}
                    onShowCreateModal={() => setShowCreateModal(true)}
                    onShowBlueprintModal={() => setShowBlueprintModal(true)}
                    theme={theme}
                />
            )
        },
        templates: {
            key: 'templates',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 120 }}>
                    <RiKanbanView size={15} /> Templates
                </span>
            ),
            content: <TemplatesTab theme={theme} />
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

    // Build tabs based on preferred order, filtering out removed 'dashboard' key
    const orderedTabs = useMemo(() => {
        return kanbanTabOrder
            .filter(key => key !== 'dashboard') // Dashboard is merged into Projects
            .filter(key => key !== 'templates' || canManageTemplates) // Templates only for admins
            .map(key => tabConfig[key])
            .filter(Boolean);
    }, [kanbanTabOrder, projects, theme, canManageTemplates]);

    // Ensure activeTab is still valid after order changes
    useEffect(() => {
        if (kanbanTabOrder) {
            const validTabs = kanbanTabOrder.filter(k => k !== 'dashboard');
            if (!validTabs.includes(activeTab)) {
                setActiveTab(validTabs[0] || 'projects');
            }
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
                <div style={{ display: 'flex', gap: 8 }}>
                    {isAdmin && (
                        <Tooltip title="Global System Settings">
                            <Button
                                onClick={() => setIsSettingsOpen(true)}
                                icon={<IoSettingsOutline size={18} />}
                                style={{
                                    height: 38, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: theme.borderRadius.md, color: theme.colors.textSecondary
                                }}
                            />
                        </Tooltip>
                    )}
                    {canCreateProject && (
                        <>
                            <Tooltip title="Create from Template">
                                <Button
                                    icon={<IoLayersOutline size={18} />}
                                    onClick={() => setShowBlueprintModal(true)}
                                    style={{
                                        borderRadius: theme.borderRadius.md, height: 38,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: theme.colors.textSecondary
                                    }}
                                />
                            </Tooltip>
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
                        </>
                    )}
                </div>
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
            <CreateProjectModal 
                open={showCreateModal} 
                onCancel={() => setShowCreateModal(false)} 
                theme={theme} 
            />
            <BlueprintInstantiationModal
                open={showBlueprintModal}
                onCancel={() => setShowBlueprintModal(false)}
                template={null}
                initialMode="new"
                theme={theme}
            />
            <ProjectSettingsDrawer />
            <KanbanAdminSettings open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <UserGuideDrawer open={showUserGuide} onClose={() => setShowUserGuide(false)} theme={theme} context="projects" />
        </div>
    );
};

export default ProjectListPage;
