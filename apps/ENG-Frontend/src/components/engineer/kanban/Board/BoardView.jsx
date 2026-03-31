import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Input, Button, Space, Tag, Avatar, Tooltip, Progress } from 'antd';
import { IoCloseOutline, IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { FiPlus } from 'react-icons/fi';
import { MdOutlineSubtitles, MdOutlineDescription, MdOutlineComment } from 'react-icons/md';
import { AiOutlinePaperClip } from 'react-icons/ai';
import dayjs from 'dayjs';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useKanbanStore } from '../store/kanbanStore';
import KanbanList from './KanbanList';
import KanbanCard from './KanbanCard';
import { useTheme } from '../../../../theme';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';

const { Text } = Typography;

const GAP = 65536; // must match backend

// ─── Sortable List Wrapper ─────────────────────────────────────────
const SortableList = ({ list }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `list-${list.id}`, data: { type: 'list', list } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        flexShrink: 0,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <KanbanList list={list} dragHandleListeners={listeners} />
        </div>
    );
};

// ─── List View Row — mirrors KanbanCard data resolution ───────────
const ListViewCard = ({ card, theme }) => {
    const { openCardDetail, labels: boardLabels, users } = useKanbanStore();
    const [hovered, setHovered] = useState(false);

    // Resolve labels exactly like KanbanCard
    const resolvedLabels = useMemo(() => {
        if (!card.labels && !card.label_ids) return [];
        if (card.labels && card.labels.length > 0) return card.labels;
        const ids = card.label_ids || [];
        return boardLabels.filter(l => ids.includes(l.id) || ids.includes(String(l.id)));
    }, [card.labels, card.label_ids, boardLabels]);

    // Task progress exactly like KanbanCard
    const taskProgress = useMemo(() => {
        if (card.task_lists && card.task_lists.length > 0) {
            let total = 0, completed = 0;
            card.task_lists.forEach(tl => {
                const tasks = tl.tasks || [];
                total += tasks.length;
                completed += tasks.filter(t => t.is_completed).length;
            });
            return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
        }
        const total = Number(card.total_tasks) || 0;
        const completed = Number(card.completed_tasks) || 0;
        return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [card.task_lists, card.total_tasks, card.completed_tasks]);

    const assignees = card.assignees || card.memberships || card.members || [];
    const commentCount = card.comments?.length || card.comment_count || 0;
    const attachmentCount = card.attachments?.length || card.attachment_count || 0;

    // Due date exactly like KanbanCard
    const dueDateInfo = useMemo(() => {
        if (!card.due_date) return null;
        const now = new Date();
        const due = new Date(card.due_date);
        const diffHours = (due - now) / 36e5;
        let bgColor = '#61bd4f';
        let textColor = '#fff';
        if (diffHours < 0) { bgColor = '#eb5a46'; }
        else if (diffHours < 24) { bgColor = '#f2d600'; textColor = '#333'; }
        const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { bgColor, textColor, dateStr };
    }, [card.due_date]);

    return (
        <div
            onClick={() => openCardDetail(card.id)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 120px 90px 90px',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: hovered ? `${theme.colors.primary}08` : 'transparent',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                borderBottom: `1px solid ${theme.colors.border}22`,
            }}
        >
            {/* Name + icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <Text style={{
                    fontSize: 13, color: theme.colors.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {card.name}
                </Text>
                {(card.problem_detail || card.solution_detail || Number(card.issue_count) > 0 || (card.issues && card.issues.length > 0)) && (
                    <Tooltip title="Problem/Solution"><MdOutlineSubtitles size={13} color="#f59e0b" style={{ flexShrink: 0 }} /></Tooltip>
                )}
                {card.memo && (
                    <Tooltip title="Memo"><MdOutlineDescription size={13} color="#8b5cf6" style={{ flexShrink: 0 }} /></Tooltip>
                )}
                {attachmentCount > 0 && (
                    <Tooltip title={`${attachmentCount} attachments`}><AiOutlinePaperClip size={13} color={theme.colors.textTertiary} style={{ flexShrink: 0 }} /></Tooltip>
                )}
                {commentCount > 0 && (
                    <Tooltip title={`${commentCount} comments`}>
                        <span style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <MdOutlineComment size={13} /> {commentCount}
                        </span>
                    </Tooltip>
                )}
            </div>

            {/* Labels — chips like KanbanCard */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {resolvedLabels.slice(0, 4).map(label => (
                    <div key={label.id} style={{
                        height: 20, borderRadius: 4, background: label.color,
                        display: 'flex', alignItems: 'center', padding: '0 6px',
                        color: '#fff', fontSize: 10, fontWeight: 600,
                    }}>
                        {label.name || ''}
                    </div>
                ))}
            </div>

            {/* Task Progress */}
            <div>
                {taskProgress.total > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Progress
                            percent={taskProgress.percent}
                            size="small"
                            showInfo={false}
                            strokeColor={taskProgress.completed === taskProgress.total ? '#61bd4f' : theme.colors.primary}
                            trailColor={`${theme.colors.textTertiary}30`}
                            style={{ flex: 1, margin: 0 }}
                        />
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, flexShrink: 0 }}>
                            {taskProgress.completed}/{taskProgress.total}
                        </Text>
                    </div>
                ) : <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>—</Text>}
            </div>

            {/* Due date — color-coded like KanbanCard */}
            <div>
                {dueDateInfo ? (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 4,
                        background: dueDateInfo.bgColor, color: dueDateInfo.textColor,
                        fontSize: 11, fontWeight: 600,
                    }}>
                        {dueDateInfo.dateStr}
                    </div>
                ) : <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>—</Text>}
            </div>

            {/* Assignees — profile photos or initials like KanbanCard */}
            <div>
                <Avatar.Group
                    max={{ count: 3, style: { width: 24, height: 24, lineHeight: '24px', fontSize: 10, border: `2px solid ${theme.colors.surface}` } }}
                    size={24}
                >
                    {assignees.map((member, idx) => {
                        const uCode = typeof member === 'string' ? member : (member.u_code || member);
                        const userObj = users.find(u => u.u_code === uCode);
                        const name = userObj?.u_name || userObj?.u_nickname || uCode;
                        const words = (userObj?.u_name || '').split(' ');
                        const initials = words.length >= 2 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : name.charAt(0).toUpperCase();
                        return (
                            <Tooltip key={idx} title={name}>
                                {userObj?.profile_img_b64 ? (
                                    <Avatar size={24} src={userObj.profile_img_b64}
                                        style={{ border: `2px solid ${theme.colors.surface}` }} />
                                ) : (
                                    <Avatar size={24} style={{
                                        background: theme.colors.primary, fontSize: 10, fontWeight: 700,
                                        border: `2px solid ${theme.colors.surface}`,
                                    }}>{initials}</Avatar>
                                )}
                            </Tooltip>
                        );
                    })}
                </Avatar.Group>
            </div>
        </div>
    );
};

// ─── List View Section (one list = one collapsible group) ──────────
const ListViewSection = ({ list, cards, theme }) => {
    const [collapsed, setCollapsed] = useState(false);
    const listCards = cards[list.id] || [];

    return (
        <div style={{
            marginBottom: 12,
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 10,
            overflow: 'hidden',
        }}>
            {/* Section Header */}
            <div
                onClick={() => setCollapsed(c => !c)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: `${theme.colors.surfaceHover}`,
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: theme.colors.primary,
                    }} />
                    <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                        {list.name}
                    </Text>
                    <Tag style={{
                        fontSize: 11, lineHeight: '16px', padding: '0 6px',
                        background: `${theme.colors.primary}18`, color: theme.colors.primary,
                        border: 'none', borderRadius: 8,
                    }}>
                        {listCards.length}
                    </Tag>
                </div>
                {collapsed ? <IoChevronDown size={15} color={theme.colors.textTertiary} /> : <IoChevronUp size={15} color={theme.colors.textTertiary} />}
            </div>

            {/* Column headers + cards (only show when expanded) */}
            {!collapsed && (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 120px 90px 90px',
                        gap: 8,
                        padding: '6px 14px',
                        borderBottom: `1px solid ${theme.colors.border}`,
                        background: `${theme.colors.surfaceHover}88`,
                    }}>
                        {['Card Name', 'Labels', 'Checklist', 'Due Date', 'Assignees'].map(h => (
                            <Text key={h} style={{ fontSize: 11, color: theme.colors.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {h}
                            </Text>
                        ))}
                    </div>
                    {listCards.length === 0 ? (
                        <div style={{ padding: '16px 14px', textAlign: 'center' }}>
                            <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>No cards in this list</Text>
                        </div>
                    ) : (
                        listCards.map(card => (
                            <ListViewCard key={card.id} card={card} theme={theme} />
                        ))
                    )}
                </>
            )}
        </div>
    );
};


// ─── Board View with DnD ───────────────────────────────────────────
const BoardView = () => {
    const {
        activeBoard, lists, cards, moveCard,
        searchQuery, filterMembers, filterLabels,
        viewMode, createList, reorderList, reorderCard
    } = useKanbanStore();
    const { theme } = useTheme();
    const { canEditBoard, canEditCard } = useKanbanPermissions();

    const [isAddingList, setIsAddingList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [activeItem, setActiveItem] = useState(null); // For DragOverlay

    // Filter out system lists (archive, trash) — only show active/closed
    const visibleLists = useMemo(
        () => lists.filter(l => l.list_type === 'active' || l.list_type === 'closed'),
        [lists]
    );

    // Pre-filter cards for the entire board
    const filteredCards = useMemo(() => {
        if (!searchQuery && filterMembers.length === 0 && filterLabels.length === 0) return cards;

        const filtered = {};
        for (const [listId, listCards] of Object.entries(cards)) {
            filtered[listId] = (listCards || []).filter(card => {
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    if (!card.name?.toLowerCase().includes(q) &&
                        !card.description?.toLowerCase().includes(q)) {
                        return false;
                    }
                }
                if (filterMembers.length > 0) {
                    const assignees = card.assignees || card.memberships || card.members || [];
                    const memberCodes = assignees.map(m => typeof m === 'string' ? m : (m.u_code || m));
                    if (!filterMembers.some(m => memberCodes.includes(m))) return false;
                }
                if (filterLabels.length > 0) {
                    const cardLabelIds = (card.label_ids || []).map(id => String(id));
                    const hasMatch = filterLabels.some(lbl => cardLabelIds.includes(String(lbl)));
                    if (!hasMatch) return false;
                }
                return true;
            });
        }
        return filtered;
    }, [cards, searchQuery, filterMembers, filterLabels]);

    // Sortable IDs for lists
    const listIds = useMemo(() => visibleLists.map(l => `list-${l.id}`), [visibleLists]);

    // Build flat card map: { [cardId]: { card, listId } }
    const allCardsFlat = useMemo(() => {
        const map = {};
        for (const [listId, listCards] of Object.entries(cards)) {
            (listCards || []).forEach(card => {
                map[`card-${card.id}`] = { card, listId: parseInt(listId) };
            });
        }
        return map;
    }, [cards]);

    // DnD sensors — require a 5px move before activating (to allow clicks)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // ─── Drag Handlers ─────────────────────────────────────────────
    const handleDragStart = useCallback((event) => {
        const { active } = event;
        const id = String(active.id);

        if (id.startsWith('list-')) {
            if (!canEditBoard) return; // Prevent viewing users from picking up lists
            const list = visibleLists.find(l => `list-${l.id}` === id);
            setActiveItem({ type: 'list', data: list });
        } else if (id.startsWith('card-')) {
            if (!canEditCard) return; // Prevent viewing users from picking up cards
            const entry = allCardsFlat[id];
            if (entry) setActiveItem({ type: 'card', data: entry.card });
        }
    }, [visibleLists, allCardsFlat, canEditBoard, canEditCard]);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveItem(null);
        if (!over || !activeBoard) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        if (activeId.startsWith('list-') && overId.startsWith('list-')) {
            const activeListId = parseInt(activeId.replace('list-', ''));
            const overListId = parseInt(overId.replace('list-', ''));
            if (activeListId === overListId) return;

            const overIndex = visibleLists.findIndex(l => l.id === overListId);
            const sortedWithout = visibleLists.filter(l => l.id !== activeListId);

            const prevPos = overIndex > 0 ? sortedWithout[overIndex - 1]?.position ?? 0 : 0;
            const nextPos = sortedWithout[overIndex]?.position ?? prevPos + GAP;
            const newPos = prevPos + (nextPos - prevPos) / 2;

            reorderList(activeBoard.id, activeListId, newPos);
            return;
        }

        if (activeId.startsWith('card-')) {
            const cardEntry = allCardsFlat[activeId];
            if (!cardEntry) return;
            const { card: draggedCard, listId: sourceListId } = cardEntry;

            let targetListId, targetPosition;

            if (overId.startsWith('card-')) {
                const overEntry = allCardsFlat[overId];
                if (!overEntry) return;
                targetListId = overEntry.listId;
                const targetCards = (cards[targetListId] || []).filter(c => c.id !== draggedCard.id);
                const overIdx = targetCards.findIndex(c => c.id === overEntry.card.id);

                const prevPos = overIdx > 0 ? targetCards[overIdx - 1].position : 0;
                const nextPos = targetCards[overIdx]?.position ?? prevPos + GAP;
                targetPosition = prevPos + (nextPos - prevPos) / 2;
            } else if (overId.startsWith('list-')) {
                targetListId = parseInt(overId.replace('list-', ''));
                const targetCards = (cards[targetListId] || []).filter(c => c.id !== draggedCard.id);
                const lastPos = targetCards.length > 0
                    ? targetCards[targetCards.length - 1].position
                    : 0;
                targetPosition = lastPos + GAP;
            } else {
                return;
            }

            if (targetListId === sourceListId) {
                const sameCards = (cards[sourceListId] || []);
                const origIdx = sameCards.findIndex(c => c.id === draggedCard.id);
                const newIdx = sameCards.findIndex(c => c.id === parseInt(overId.replace('card-', '')));
                if (origIdx === newIdx) return;
            }

            reorderCard(draggedCard.id, targetListId, targetPosition, sourceListId);
        }
    }, [activeBoard, visibleLists, allCardsFlat, cards, reorderList, reorderCard]);

    const handleAddList = async () => {
        const name = newListName.trim();
        if (!name || !activeBoard) return;
        await createList(activeBoard.id, name);
        setNewListName('');
        setIsAddingList(false);
    };

    // ─── LIST / ROW VIEW ────────────────────────────────────────────
    if (viewMode === 'list') {
        return (
            <div style={{ width: '100%', paddingBottom: 24 }}>
                {visibleLists.length === 0 ? (
                    <div style={{
                        padding: 32, textAlign: 'center',
                        background: `${theme.colors.surface}DD`,
                        borderRadius: theme.borderRadius.lg,
                    }}>
                        <Text type="secondary">No lists yet.</Text>
                    </div>
                ) : (
                    visibleLists.map(list => (
                        <ListViewSection
                            key={list.id}
                            list={list}
                            cards={filteredCards}
                            theme={theme}
                        />
                    ))
                )}
            </div>
        );
    }

    // ─── BOARD / KANBAN VIEW ────────────────────────────────────────
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/*
             * display: flex → matches parent's flex layout
             * height: 100% → fills the scroll area vertically so lists know their bounds
             */}
            <div style={{
                display: 'flex',
                height: '100%',
                alignItems: 'flex-start', /* Lists grow based on content but don't stretch to full height if they don't need to */
                gap: theme.spacing.lg,
                paddingBottom: theme.spacing.lg,
            }}>
                <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
                    {visibleLists.length > 0 ? (
                        visibleLists.map(list => (
                            <SortableList key={list.id} list={list} />
                        ))
                    ) : (
                        <div style={{
                            padding: theme.spacing.xl,
                            background: `${theme.colors.surface}DD`,
                            borderRadius: theme.borderRadius.lg,
                            backdropFilter: 'blur(8px)',
                        }}>
                            <Text type="secondary">No lists yet. Click "+ Add another list" to get started!</Text>
                        </div>
                    )}

                    {/* Add List Button/Form */}
                    {canEditBoard && (
                        <div style={{
                            width: 220,
                            minWidth: 220,
                            flexShrink: 0,
                            background: isAddingList ? `${theme.colors.surface}F0` : 'rgba(255,255,255,0.3)',
                            borderRadius: theme.borderRadius.lg,
                            padding: theme.spacing.md,
                            cursor: isAddingList ? 'default' : 'pointer',
                            transition: `all ${theme.transitions.fast}`,
                            border: isAddingList ? `1px solid ${theme.colors.border}` : '1px solid transparent',
                            backdropFilter: 'blur(4px)',
                        }}
                            onClick={() => { if (!isAddingList) setIsAddingList(true); }}
                            onMouseOver={(e) => { if (!isAddingList) e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; }}
                            onMouseOut={(e) => { if (!isAddingList) e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                        >
                            {isAddingList ? (
                                <div>
                                    <Input
                                        placeholder="Enter list title..."
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        onPressEnter={handleAddList}
                                        autoFocus
                                        style={{ marginBottom: 8, borderRadius: theme.borderRadius.sm }}
                                    />
                                    <Space>
                                        <Button type="primary" size="small" onClick={handleAddList}
                                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                        >
                                            Add List
                                        </Button>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<IoCloseOutline size={18} />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAddingList(false);
                                                setNewListName('');
                                            }}
                                        />
                                    </Space>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FiPlus size={16} color={theme.colors.textSecondary} />
                                    <Text strong style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                                        Add another list
                                    </Text>
                                </div>
                            )}
                        </div>
                    )}
                </SortableContext>

                {/* Drag Overlay — shows ghost while dragging */}
                <DragOverlay>
                    {activeItem?.type === 'list' && activeItem.data && (
                        <div style={{ opacity: 0.85, width: 320, pointerEvents: 'none' }}>
                            <KanbanList list={activeItem.data} isOverlay />
                        </div>
                    )}
                    {activeItem?.type === 'card' && activeItem.data && (
                        <div style={{ opacity: 0.85, pointerEvents: 'none' }}>
                            <KanbanCard card={activeItem.data} isOverlay />
                        </div>
                    )}
                </DragOverlay>
            </div>
        </DndContext>
    );
};

export default BoardView;
