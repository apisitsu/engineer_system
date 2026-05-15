import React, { useEffect, useState } from 'react';
import { Modal, Typography, Input, Checkbox, Switch, Button } from 'antd';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MdDragIndicator } from 'react-icons/md';
import { useKanbanStore } from '../../store/kanbanStore';

// ─── Modal Checkbox List Item ───────────────────────────────────────
const SortableModalBoardItem = ({ id, board, isChecked, onChange, theme }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.sm, background: theme.colors.surface,
        marginBottom: 8,
        zIndex: isDragging ? 1 : 0, position: isDragging ? 'relative' : 'static',
    };
    return (
        <div ref={setNodeRef} style={style}>
            <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                <MdDragIndicator size={18} color={theme.colors.textTertiary} />
            </div>
            <Checkbox checked={isChecked} onChange={(e) => onChange(e.target.checked)}>
                {board.name}
            </Checkbox>
        </div>
    );
};

const BoardGroupModal = ({ open, onClose, initialGroup, activeProject, orderedBoards, projectBoardGroups, currentBoardGroupId, theme }) => {
    const boards = useKanbanStore(state => state.boards);
    const setBoardGroups = useKanbanStore(state => state.setBoardGroups);
    const setActiveBoardGroup = useKanbanStore(state => state.setActiveBoardGroup);

    const [groupFormName, setGroupFormName] = useState('');
    const [groupFormBoards, setGroupFormBoards] = useState([]);
    const [groupFormAutoOpen, setGroupFormAutoOpen] = useState(false);
    const [modalBoardOrder, setModalBoardOrder] = useState([]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (open) {
            if (initialGroup) {
                setGroupFormName(initialGroup.name);
                setGroupFormBoards(initialGroup.boardIds || []);
                setGroupFormAutoOpen(initialGroup.auto_open || false);

                const groupBoardIds = initialGroup.boardIds || [];
                const otherBoards = orderedBoards.filter(b => !groupBoardIds.includes(b.id)).map(b => b.id);
                setModalBoardOrder([...groupBoardIds, ...otherBoards]);
            } else {
                setGroupFormName('');
                setGroupFormBoards([]);
                setGroupFormAutoOpen(false);
                setModalBoardOrder(orderedBoards.map(b => b.id));
            }
        }
    }, [open, initialGroup, orderedBoards]);

    const handleSaveGroup = () => {
        if (!groupFormName.trim()) return;
        const newGroups = [...projectBoardGroups];

        if (groupFormAutoOpen) {
            newGroups.forEach(g => g.auto_open = false);
        }

        const finalBoardIds = modalBoardOrder.filter(id => groupFormBoards.includes(id));

        if (initialGroup?.id) {
            const idx = newGroups.findIndex(g => g.id === initialGroup.id);
            if (idx >= 0) {
                newGroups[idx] = { ...newGroups[idx], name: groupFormName, boardIds: finalBoardIds, auto_open: groupFormAutoOpen };
            }
        } else {
            const newId = `bg-${Date.now()}`;
            newGroups.push({ id: newId, name: groupFormName, boardIds: finalBoardIds, auto_open: groupFormAutoOpen });
            setActiveBoardGroup(activeProject.id, newId);
        }
        setBoardGroups(activeProject.id, newGroups);
        onClose();
    };

    const handleDragEndGroupForm = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = modalBoardOrder.indexOf(active.id);
        const newIndex = modalBoardOrder.indexOf(over.id);
        const newArray = arrayMove(modalBoardOrder, oldIndex, newIndex);
        setModalBoardOrder(newArray);
    };

    const handleDeleteGroup = () => {
        if (!initialGroup?.id) return;
        const newGroups = projectBoardGroups.filter(g => g.id !== initialGroup.id);
        setBoardGroups(activeProject.id, newGroups);
        if (currentBoardGroupId === initialGroup.id) {
            setActiveBoardGroup(activeProject.id, null);
        }
        onClose();
    };

    return (
        <Modal
            title={initialGroup?.id ? "Edit Board Group" : "Create Board Group"}
            open={open}
            onCancel={onClose}
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
                    <Typography.Text strong>Select Boards to include (Drag to reorder)</Typography.Text>
                    <div style={{
                        marginTop: 8,
                        maxHeight: 250,
                        overflowY: 'auto',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                        padding: 12,
                        background: theme.colors.background,
                    }}>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndGroupForm}>
                            <SortableContext items={modalBoardOrder} strategy={verticalListSortingStrategy}>
                                {modalBoardOrder.map(id => {
                                    const board = boards.find(b => b.id === id);
                                    if (!board) return null;
                                    return (
                                        <SortableModalBoardItem
                                            key={board.id}
                                            id={board.id}
                                            board={board}
                                            isChecked={groupFormBoards.includes(board.id)}
                                            onChange={(checked) => {
                                                if (checked) setGroupFormBoards(prev => [...prev, board.id]);
                                                else setGroupFormBoards(prev => prev.filter(bId => bId !== board.id));
                                            }}
                                            theme={theme}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm }}>
                    <div>
                        <Typography.Text strong style={{ display: 'block' }}>Auto Open</Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Automatically select this group when opening the project.</Typography.Text>
                    </div>
                    <Switch checked={groupFormAutoOpen} onChange={setGroupFormAutoOpen} />
                </div>
                {initialGroup?.id && (
                    <Button danger onClick={handleDeleteGroup}>
                        Delete this Group
                    </Button>
                )}
            </div>
        </Modal>
    );
};

export default BoardGroupModal;
