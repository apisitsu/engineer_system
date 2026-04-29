import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Button, Tooltip, Badge, Tabs } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';

import { MdOutlineDashboard, MdOutlineAssessment } from 'react-icons/md';
import { BsKanban } from 'react-icons/bs';
import { IoTimeOutline, IoHelpCircleOutline, IoAddOutline } from 'react-icons/io5';
import { RiKanbanView } from 'react-icons/ri';

import DashboardTab from './DashboardTab';
import ProjectsTab from './ProjectsTab';
import ReportsTab from './ReportsTab';
import WorkloadTab from './WorkloadTab';

import CreateProjectModal from './components/CreateProjectModal';
import ProjectSettingsDrawer from '../Settings/ProjectSettingsDrawer';
import UserGuideDrawer from '../UserGuide/UserGuideDrawer';
import ScrollbarStyle from '../../../common/scrollbar';

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
    const [showUserGuide, setShowUserGuide] = useState(false);

    // Default active tab to the first item in the preferred order
    const [activeTab, setActiveTab] = useState(kanbanTabOrder?.[0] || 'dashboard');

    // Global permissions
    const { canCreateProject } = useKanbanPermissions();

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

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
            <CreateProjectModal 
                open={showCreateModal} 
                onCancel={() => setShowCreateModal(false)} 
                theme={theme} 
            />
            <ProjectSettingsDrawer />
            <UserGuideDrawer open={showUserGuide} onClose={() => setShowUserGuide(false)} theme={theme} />
        </div>
    );
};

export default ProjectListPage;
