import React, { useState, useMemo } from 'react';
import { Card, Typography, Space, Button, Input, Dropdown, Popconfirm, Badge, Switch, Tooltip } from 'antd';
import { BsThreeDots, BsGripVertical } from 'react-icons/bs';
import { IoCloseOutline } from 'react-icons/io5';
import { AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import { FiPlus } from 'react-icons/fi';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useKanbanStore } from '../store/kanbanStore';
import { useTheme } from '../../../../theme';
import KanbanCard from './KanbanCard';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
<<<<<<< HEAD
import { useAuthStore } from '../../../../stores/authStore';
=======
>>>>>>> old-work-backup

const { Text } = Typography;

// ─── Sortable Card Wrapper ─────────────────────────────────────────
const SortableCard = ({ card }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `card-${card.id}`, data: { type: 'card', card } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <KanbanCard card={card} />
        </div>
    );
};

// ─── KanbanList Component ──────────────────────────────────────────
const KanbanList = ({ list, dragHandleListeners, isOverlay }) => {
    const {
        cards, createCard, updateList, deleteList, sortListCards,
<<<<<<< HEAD
        searchQuery, filterMembers, filterLabels,
        activeProject, activeBoardMembers
    } = useKanbanStore();
    const { theme } = useTheme();
    const { empNo } = useAuthStore();
=======
        searchQuery, filterMembers, filterLabels
    } = useKanbanStore();
    const { theme } = useTheme();
>>>>>>> old-work-backup

    const [isAddingCard, setIsAddingCard] = useState(false);
    const [newCardName, setNewCardName] = useState('');
    const [isPrivateCard, setIsPrivateCard] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(list.name);

    // Permission Hook
<<<<<<< HEAD
    const currentUserRole = activeBoardMembers.find(m => m.u_code === empNo)?.role;
    const { canEditBoard, isReadOnly } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
        boardRole: currentUserRole
    });
=======
    const { canEditBoard, isReadOnly } = useKanbanPermissions();
>>>>>>> old-work-backup

    // Get and filter cards
    const filteredCards = useMemo(() => {
        let listCards = (cards[list.id] || []).slice().sort((a, b) => a.position - b.position);


        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            listCards = listCards.filter(c =>
                c.name?.toLowerCase().includes(q) ||
                c.description?.toLowerCase().includes(q)
            );
        }

        // Member Filter (multi-select: show cards assigned to ANY selected member)
        if (filterMembers && filterMembers.length > 0) {
            listCards = listCards.filter(c => {
                const assignees = c.assignees || [];
                return filterMembers.some(m => assignees.includes(m));
            });
        }

        // Label Filter (matches ANY selected label)
        if (filterLabels && filterLabels.length > 0) {
            listCards = listCards.filter(c => {
                const cardLabelIds = (c.label_ids || []).map(id => String(id));
                return filterLabels.some(lbl => cardLabelIds.includes(String(lbl)));
            });
        }

        return listCards;
    }, [cards, list.id, searchQuery, filterMembers, filterLabels]);

    const totalCards = (cards[list.id] || []).length;

    // Memoize card IDs for SortableContext
    const cardIds = useMemo(
        () => filteredCards.map(c => `card-${c.id}`),
        [filteredCards]
    );

    // Make this list a droppable target for cards (even when empty)
    const { setNodeRef: setDropRef } = useDroppable({
        id: `list-${list.id}`,
        data: { type: 'list', list },
    });

    const handleAddCard = async () => {
        const name = newCardName.trim();
        if (!name) return;
        await createCard(list.id, name, isPrivateCard);
        setNewCardName('');
        setIsPrivateCard(false);
    };

    const handleSaveName = async () => {
        if (editName.trim() && editName !== list.name) {
            await updateList(list.id, { name: editName.trim() });
        }
        setIsEditingName(false);
    };

    const handleDeleteList = async () => {
        await deleteList(list.id);
    };

    const menuItems = [];

    if (canEditBoard) {
        menuItems.push({
            key: 'edit',
            label: 'Rename List',
            icon: <AiOutlineEdit />,
            onClick: () => {
                setEditName(list.name);
                setIsEditingName(true);
            }
        });
        menuItems.push({ type: 'divider' });
    }

    menuItems.push({
        key: 'sort',
        label: 'Sort By',
        children: [
            { key: 'sort-name', label: 'Name (A-Z)', onClick: () => sortListCards(list.id, 'name', 'asc') },
            { key: 'sort-name-desc', label: 'Name (Z-A)', onClick: () => sortListCards(list.id, 'name', 'desc') },
            { key: 'sort-due', label: 'Due Date ↑', onClick: () => sortListCards(list.id, 'due_date', 'asc') },
            { key: 'sort-due-desc', label: 'Due Date ↓', onClick: () => sortListCards(list.id, 'due_date', 'desc') },
            { key: 'sort-created', label: 'Created ↑', onClick: () => sortListCards(list.id, 'created_at', 'asc') },
            { key: 'sort-created-desc', label: 'Created ↓', onClick: () => sortListCards(list.id, 'created_at', 'desc') },
        ]
    });

    if (canEditBoard) {
        menuItems.push({ type: 'divider' });
        menuItems.push({
            key: 'delete',
            label: (
                <Popconfirm
                    title="Delete this list?"
                    description="All cards in this list will be deleted."
                    onConfirm={handleDeleteList}
                    okText="Delete"
                    okType="danger"
                    cancelText="Cancel"
                >
                    <span style={{ color: theme.colors.error }}>Delete List</span>
                </Popconfirm>
            ),
            icon: <AiOutlineDelete style={{ color: theme.colors.error }} />,
        });
    }

    return (
        <div style={{
            width: 320,
            minWidth: 320,
            marginBottom: '16px',
            overflow: 'hidden',
            maxHeight: '100%',
            flexShrink: 0,
            background: `${theme.colors.surfaceHover}E8`,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            boxShadow: isOverlay ? theme.shadows.lg : theme.shadows.xs,
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(8px)',
            transition: `box-shadow ${theme.transitions.fast}`,
        }}>
            {/* List Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: `${theme.spacing.md} ${theme.spacing.md}`,
                borderBottom: `1px solid ${theme.colors.border}22`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    {/* Drag Handle for List */}
                    {dragHandleListeners && (
                        <span
                            {...dragHandleListeners}
                            style={{
                                cursor: 'grab',
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: theme.colors.textTertiary,
                                padding: '2px',
                                flexShrink: 0,
                            }}
                        >
                            <BsGripVertical size={14} />
                        </span>
                    )}
                    {isEditingName ? (
                        <Input
                            size="small"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onPressEnter={handleSaveName}
                            onBlur={handleSaveName}
                            autoFocus
                            style={{ flex: 1, borderRadius: theme.borderRadius.sm }}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                            <Text
                                strong
                                style={{
                                    color: theme.colors.textPrimary,
                                    fontSize: theme.typography.fontSize.sm,
                                    fontWeight: theme.typography.fontWeight.semibold,
                                    cursor: canEditBoard ? 'pointer' : 'default',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                onDoubleClick={() => {
                                    if (canEditBoard) {
                                        setEditName(list.name);
                                        setIsEditingName(true);
                                    }
                                }}
                            >
                                {list.name}
                            </Text>
                            <Badge
                                count={totalCards}
                                style={{
                                    backgroundColor: theme.colors.surfaceHover,
                                    color: theme.colors.textTertiary,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    boxShadow: 'none',
                                }}
                                overflowCount={99}
                            />
                        </div>
                    )}
                </div>
                <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                    <Button
                        type="text"
                        icon={<BsThreeDots style={{ color: theme.colors.textTertiary }} />}
                        size="small"
                        style={{ flexShrink: 0 }}
                    />
                </Dropdown>
            </div>

            {/* Card Area — Flex child that scrolls vertically */}
            <div
                ref={setDropRef}
                className="kb-vscroll"
                style={{
                    padding: `${theme.spacing.sm}`,
                    flex: '1 1 auto',
                    minHeight: 0, /* CRITICAL for flexbox scrolling inside the list */
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}
            >
                <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filteredCards.map(card => (
                            <SortableCard key={card.id} card={card} />
                        ))}
                    </div>
                </SortableContext>
            </div>

            {/* Add Card Section */}
            {!isReadOnly && (
                <div style={{
                    padding: `${theme.spacing.xs} ${theme.spacing.sm} ${theme.spacing.sm}`,
                    borderTop: filteredCards.length > 0 ? `1px solid ${theme.colors.border}22` : 'none',
                }}>
                    {isAddingCard ? (
                        <div>
                            <Input.TextArea
                                placeholder="Enter a title for this card..."
                                value={newCardName}
                                onChange={(e) => setNewCardName(e.target.value)}
                                onPressEnter={(e) => {
                                    e.preventDefault();
                                    handleAddCard();
                                }}
                                autoFocus
                                autoSize={{ minRows: 2, maxRows: 4 }}
                                style={{
                                    marginBottom: 8,
                                    borderRadius: theme.borderRadius.sm,
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                    <Button type="primary" size="small" onClick={handleAddCard}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                    >
                                        Add Card
                                    </Button>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<IoCloseOutline size={18} />}
                                        onClick={() => {
                                            setIsAddingCard(false);
                                            setNewCardName('');
                                            setIsPrivateCard(false);
                                        }}
                                    />
                                </Space>
                                <Tooltip title="Private cards are only visible to explicitly added members, project owners, and admins.">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Switch size="small" checked={isPrivateCard} onChange={setIsPrivateCard} />
                                        <Text type="secondary" style={{ fontSize: 11 }}>Private</Text>
                                    </div>
                                </Tooltip>
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                cursor: 'pointer',
                                borderRadius: theme.borderRadius.sm,
                                transition: `background ${theme.transitions.fast}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                            onClick={() => setIsAddingCard(true)}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <FiPlus size={14} color={theme.colors.textTertiary} />
                            <Text type="secondary" style={{ fontSize: theme.typography.fontSize.sm }}>
                                Add a card
                            </Text>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default KanbanList;
