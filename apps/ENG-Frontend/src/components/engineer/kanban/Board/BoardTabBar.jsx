import React, { useState } from 'react';
import { Tooltip, Dropdown, Button } from 'antd';
import { FiPlus, FiEdit2, FiFilter } from 'react-icons/fi';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useKanbanStore } from '../store/kanbanStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';

import SortableBoardTab from './SortableBoardTab';
import CreateBoardModal from '../Tabs/components/CreateBoardModal';
import BlueprintInstantiationModal from '../Tabs/components/BlueprintInstantiationModal';
import { IoLayersOutline } from 'react-icons/io5';

const BoardTabBar = ({ theme, activeProject, projectBoardGroups, currentBoardGroupId, filteredOrderedBoards, handleDragEndBoards, handleOpenGroupModal }) => {
    const activeBoard = useKanbanStore(state => state.activeBoard);
    const setActiveBoard = useKanbanStore(state => state.setActiveBoard);
    const openBoardSettings = useKanbanStore(state => state.openBoardSettings);
    const setActiveBoardGroup = useKanbanStore(state => state.setActiveBoardGroup);

    const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
    const [showBlueprintModal, setShowBlueprintModal] = useState(false);

    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    if (!activeProject) return null;

    return (
    <>
        <div className="kb-hscroll" style={{
            display: 'flex', alignItems: 'center',
            padding: `0 ${theme.spacing.xl}`,
            gap: 0,
            overflowX: 'auto',
        }}>
            {canManageProject && (
                <>
                    <Tooltip title="Create Board from Template">
                        <div
                            onClick={() => setShowBlueprintModal(true)}
                            style={{
                                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                cursor: 'pointer',
                                color: theme.colors.textSecondary,
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                            onMouseOut={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
                        >
                            <IoLayersOutline size={18} />
                        </div>
                    </Tooltip>
                    <Tooltip title="Create New Board">
                        <div
                            onClick={() => setShowCreateBoardModal(true)}
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
                </>
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

        {showCreateBoardModal && (
            <CreateBoardModal
                open={showCreateBoardModal}
                onCancel={() => setShowCreateBoardModal(false)}
                theme={theme}
            />
        )}
        <BlueprintInstantiationModal
            open={showBlueprintModal}
            onCancel={() => setShowBlueprintModal(false)}
            template={null}
            initialMode="existing"
            targetProjectId={activeProject?.id}
            theme={theme}
        />
    </>
    );
};

export default BoardTabBar;
