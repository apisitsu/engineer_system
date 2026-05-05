import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Typography, Spin, Alert, Select, Button, Space, Input, Avatar, Tooltip, Badge, Dropdown, Form, Tag, Popover, Tabs, Row, Col, Progress, Statistic, Layout, Switch, Menu, Checkbox, Modal } from 'antd';
import { useKanbanStore } from './store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useNavigate, useParams } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    IoSettingsOutline, IoSearchOutline, IoAddOutline, IoGridOutline,
    IoListOutline, IoChevronBackOutline, IoNotificationsOutline, IoTimeOutline, IoHelpCircleOutline,
    IoLockClosedOutline
} from 'react-icons/io5';
import { useKanbanPermissions } from './hooks/useKanbanPermissions';
import { MdOutlinePeople, MdOutlineLabel, MdOutlineDashboard, MdOutlineAssessment, MdDragIndicator } from 'react-icons/md';
import { BsKanban } from 'react-icons/bs';
import { FiPlus, FiEdit2, FiFilter } from 'react-icons/fi';
import { AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import { RiKanbanView } from 'react-icons/ri';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import ProjectListPage from './Tabs/ProjectListPage';
import ProjectSettingsDrawer from './Settings/ProjectSettingsDrawer';
import BoardSettingsDrawer from './Settings/BoardSettingsDrawer';
import ScrollbarStyle from '../../common/scrollbar';
import CardDetailDrawer from './CardDetail/CardDetailDrawer';

// Extracted Board Layout Components
import ProjectHeader from './Board/ProjectHeader';
import BoardTabBar from './Board/BoardTabBar';
import BoardToolbar from './Board/BoardToolbar';
import BoardGroupModal from './Board/components/BoardGroupModal';
import BoardView from './Board/BoardView';
import ReportsTab from './Tabs/ReportsTab';
import BoardDashboard from './BoardDashboard';

dayjs.extend(relativeTime);

const { Content } = Layout;
const { Title, Text } = Typography;
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
        resetBoardTabOrder, fetchUserPreferences,
        projectManagers, users, addProjectManager, removeProjectManager, fetchProjectManagers, fetchUsers, fetchSystemSettings
    } = useKanbanStore(
        useShallow(state => ({
            projects: state.projects, activeProject: state.activeProject,
            boards: state.boards, activeBoard: state.activeBoard,
            isLoading: state.isLoading, error: state.error,
            fetchProjects: state.fetchProjects, setActiveProject: state.setActiveProject,
            fetchBoards: state.fetchBoards, setActiveBoard: state.setActiveBoard,
            lists: state.lists, openProjectSettings: state.openProjectSettings,
            openBoardSettings: state.openBoardSettings,
            connectWebSocket: state.connectWebSocket, disconnectWebSocket: state.disconnectWebSocket,
            viewMode: state.viewMode, boardTabOrders: state.boardTabOrders,
            boardGroups: state.boardGroups, activeBoardGroup: state.activeBoardGroup,
            setBoardGroups: state.setBoardGroups, setActiveBoardGroup: state.setActiveBoardGroup,
            setBoardTabOrder: state.setBoardTabOrder, resetBoardTabOrder: state.resetBoardTabOrder,
            fetchUserPreferences: state.fetchUserPreferences,
            projectManagers: state.projectManagers, users: state.users,
            addProjectManager: state.addProjectManager, removeProjectManager: state.removeProjectManager,
            fetchProjectManagers: state.fetchProjectManagers, fetchUsers: state.fetchUsers,
            fetchSystemSettings: state.fetchSystemSettings
        }))
    );

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
        if (!boards || !activeProject) return [];
        if (!currentBoardGroupId) return orderedBoards;

        const group = projectBoardGroups.find(g => g.id === currentBoardGroupId);
        if (!group || !group.boardIds) return orderedBoards;

        const groupBoards = [];
        group.boardIds.forEach(id => {
            const b = boards.find(board => board.id === id);
            if (b) groupBoards.push(b);
        });
        return groupBoards;
    }, [boards, orderedBoards, currentBoardGroupId, projectBoardGroups, activeProject]);

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

            if (currentBoardGroupId) {
                const groupIndex = projectBoardGroups.findIndex(g => g.id === currentBoardGroupId);
                if (groupIndex >= 0) {
                    const newGroups = [...projectBoardGroups];
                    newGroups[groupIndex] = { ...newGroups[groupIndex], boardIds: newArray.map(b => b.id) };
                    setBoardGroups(activeProject.id, newGroups);
                }
            } else {
                const currentFullOrder = boardTabOrders?.[activeProject?.id] || boards.map(b => b.id);
                const allBoardsDict = currentFullOrder.filter(id => !filteredOrderedBoards.find(b => b.id === id));
                const newFullOrder = [...newArray.map(b => b.id), ...allBoardsDict];
                setBoardTabOrder(activeProject.id, newFullOrder);
            }
        }
    };



    // Board Group Modal State
    const [groupModalState, setGroupModalState] = useState({ open: false, group: null });

    const handleOpenGroupModal = (group = null) => {
        setGroupModalState({ open: true, group });
    };

    // Global permissions
    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
    });

    const [isInitLoading, setIsInitLoading] = useState(true);
    const [isGroupInitialized, setIsGroupInitialized] = useState(false);
    const initializedProjects = useRef(new Set());

    // Auto-select Board Group based on auto_open configuration when entering project
    useEffect(() => {
        if (!isInitLoading && activeProject?.id && projectBoardGroups) {
            if (!initializedProjects.current.has(activeProject.id)) {
                initializedProjects.current.add(activeProject.id);
                const autoGroup = projectBoardGroups.find(g => g.auto_open);
                if (autoGroup) {
                    setActiveBoardGroup(activeProject.id, autoGroup.id);
                }
            }
            setIsGroupInitialized(true);
        }
    }, [isInitLoading, activeProject?.id, projectBoardGroups, setActiveBoardGroup]);

    // Auto-select first board in filtered list if current activeBoard is not in the list
    useEffect(() => {
        if (!isInitLoading && isGroupInitialized && filteredOrderedBoards.length > 0) {
            // ONLY auto-select if the project is not permanent!
            if (!activeProject?.is_permanent) {
                if (!activeBoard || !filteredOrderedBoards.find(b => b.id === activeBoard.id)) {
                    setActiveBoard(filteredOrderedBoards[0]);
                }
            }
        }
    }, [filteredOrderedBoards, activeBoard, setActiveBoard, isInitLoading, isGroupInitialized, activeProject?.is_permanent]);

    // On mount: fetch all projects and user preferences
    useEffect(() => {
        let isMounted = true;
        const initKanban = async () => {
            await Promise.all([
                fetchUserPreferences(),
                fetchProjects(),
                fetchSystemSettings()
            ]);
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

    // WebSocket lifecycle — connect on board change, cleanup listeners on transition
    useEffect(() => {
        if (activeBoard?.id) { connectWebSocket(activeBoard.id, empNo); }
        return () => {
            // Clean up all event listeners from the previous board to prevent stale handler accumulation
            const socket = useKanbanStore.getState().wsSocket;
            if (socket) {
                socket.off('cardUpdate');
                socket.off('cardCreate');
                socket.off('cardDelete');
                socket.off('listUpdate');
                socket.off('commentCreate');
                socket.off('commentUpdate');
                socket.off('commentDelete');
                socket.off('notificationCreate');
            }
        };
    }, [activeBoard?.id, empNo, connectWebSocket]);

    // Disconnect WebSocket fully only on component unmount
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
                    <ProjectHeader theme={theme} activeProject={activeProject} />

                    {/* Board Tab Bar */}
                    <BoardTabBar
                        theme={theme}
                        activeProject={activeProject}
                        projectBoardGroups={projectBoardGroups}
                        currentBoardGroupId={currentBoardGroupId}
                        filteredOrderedBoards={filteredOrderedBoards}
                        handleDragEndBoards={handleDragEndBoards}
                        handleOpenGroupModal={handleOpenGroupModal}
                    />
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
                        ) : activeProject?.is_permanent && !activeBoard ? (
                            <BoardDashboard boards={boards} onSelectBoard={setActiveBoard} onOpenBoardSettings={(board) => openBoardSettings(board)} />
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

            <BoardGroupModal
                open={groupModalState.open}
                onClose={() => setGroupModalState({ open: false, group: null })}
                initialGroup={groupModalState.group}
                activeProject={activeProject}
                orderedBoards={orderedBoards}
                projectBoardGroups={projectBoardGroups}
                currentBoardGroupId={currentBoardGroupId}
                theme={theme}
            />
        </>
    );
};

export default KanbanMain;
