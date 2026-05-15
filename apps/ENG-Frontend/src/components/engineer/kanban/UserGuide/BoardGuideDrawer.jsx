/**
 * BoardGuideDrawer.jsx
 * 
 * Interactive guide for the Board Canvas.
 * Works in TWO modes:
 *   1. Standalone Drawer — triggered by BoardToolbar's "?" button (open/onClose props)
 *   2. Inline content    — rendered inside UserGuideDrawer/UserGuideFullPage (no open/onClose)
 */

import React, { useState, useMemo } from 'react';
import { Drawer, Typography, Button, Input, Switch, Tag, Badge, Avatar, Tooltip, Progress, Space, Modal } from 'antd';
import { BsThreeDots, BsGripVertical, BsCardChecklist } from 'react-icons/bs';
import { FiPlus } from 'react-icons/fi';
import { MdOutlineDescription, MdOutlineAttachFile, MdOutlineComment, MdAccessTime, MdOutlineSubtitles, MdLockOutline, MdFamilyRestroom, MdDragIndicator } from 'react-icons/md';
import { CiMemoPad } from 'react-icons/ci';
import { IoCloseOutline, IoArchiveOutline, IoHelpCircleOutline } from 'react-icons/io5';
import { AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import {
    getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, SectionLabel,
    StepRow, Callout, LabeledDivider,
} from './guideStyles';
import { MOCK_CARDS, MOCK_LISTS, MOCK_USERS, MOCK_LABELS, MOCK_SUSPENDED_CARD, PRIORITY_CONFIG } from './mockData';

const { Text } = Typography;

/* ─── Inner content (reusable in both modes) ────────────────────────── */
const BoardGuideContent = ({ theme }) => {
    const [mockCards, setMockCards] = useState(() => {
        const copy = {};
        Object.entries(MOCK_CARDS).forEach(([k, v]) => { copy[k] = v.map(c => ({ ...c })); });
        copy['302'] = [...(copy['302'] || []), { ...MOCK_SUSPENDED_CARD }];
        return copy;
    });
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [newCardName, setNewCardName] = useState('');
    const [isPrivateCard, setIsPrivateCard] = useState(false);
    
    // State for Badge Reference Modal
    const [selectedBadge, setSelectedBadge] = useState(null);
    const [isBadgeModalVisible, setIsBadgeModalVisible] = useState(false);

    const handleAddCard = () => {
        if (!newCardName.trim()) return;
        const newCard = {
            id: Date.now(), name: newCardName.trim(), priority: 'medium',
            labels: [], assignees: [], comment_count: 0, attachment_count: 0,
            total_tasks: 0, completed_tasks: 0, is_private: isPrivateCard,
            is_suspended: false, parent_id: null, list_id: 301,
            created_at: new Date().toISOString(), list_changed_at: new Date().toISOString(),
        };
        setMockCards(prev => ({ ...prev, 301: [...(prev[301] || []), newCard] }));
        setNewCardName('');
        setIsPrivateCard(false);
        setIsAddingCard(false);
    };

    const getDueDateInfo = (dueDate) => {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        const diffHours = (due - now) / 36e5;
        if (diffHours < 0) return { bgColor: '#eb5a46', textColor: '#fff', dateStr: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
        if (diffHours < 24) return { bgColor: '#f2d600', textColor: '#333', dateStr: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
        return { bgColor: '#61bd4f', textColor: '#fff', dateStr: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    };

    const [draggingCard, setDraggingCard] = useState(null);

    const handleDragStart = (e, card, sourceListId) => {
        setDraggingCard({ ...card, sourceListId });
        e.dataTransfer.effectAllowed = 'move';
        // Add a slight delay before making it look 'grabbed'
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggingCard(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetListId) => {
        e.preventDefault();
        if (!draggingCard) return;

        const { sourceListId, id } = draggingCard;
        if (sourceListId === targetListId) return;

        // Prevent dropping suspended cards
        if (draggingCard.is_suspended) {
            alert('Cannot move a suspended card!');
            return;
        }

        setMockCards(prev => {
            const sourceCards = prev[sourceListId].filter(c => c.id !== id);
            const targetCards = [...(prev[targetListId] || []), { ...draggingCard, list_id: targetListId }];
            return { ...prev, [sourceListId]: sourceCards, [targetListId]: targetCards };
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ SECTION 1: Board Canvas Overview ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🎨" title="Board Canvas Overview"
                    subtitle="The board is your visual workflow canvas. It contains vertical Lists (columns) and Cards (tasks) that you can drag and rearrange."
                    theme={theme} />

                {/* List Explanations */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: theme.colors.surfaceHover, padding: 12, borderRadius: 8, borderLeft: `4px solid ${theme.colors.textSecondary}` }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>To Do</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>Tasks that have been planned but not yet started. This is the backlog of upcoming work.</Text>
                    </div>
                    <div style={{ background: theme.colors.surfaceHover, padding: 12, borderRadius: 8, borderLeft: `4px solid ${theme.colors.primary}` }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>In Progress</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>Tasks currently being worked on by the team. Keep this list small to maintain flow.</Text>
                    </div>
                    <div style={{ background: theme.colors.surfaceHover, padding: 12, borderRadius: 8, borderLeft: `4px solid #fa8c16` }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Check</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>Tasks that are completed but waiting for review, QA testing, or approval.</Text>
                    </div>
                    <div style={{ background: theme.colors.surfaceHover, padding: 12, borderRadius: 8, borderLeft: `4px solid #52c41a` }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Done</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>Fully completed and approved tasks. End of the workflow.</Text>
                    </div>
                </div>

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                        {MOCK_LISTS.map(list => {
                            const listCards = mockCards[list.id] || [];
                            return (
                                <div key={list.id} 
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, list.id)}
                                    style={{
                                        width: 240, minWidth: 240, flexShrink: 0,
                                        background: `${theme.colors.surfaceHover}E8`,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: theme.borderRadius.lg || 12,
                                        display: 'flex', flexDirection: 'column', maxHeight: 380,
                                        transition: 'background 0.2s',
                                }}>
                                    {/* List Header */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 12px', borderBottom: `1px solid ${theme.colors.border}44`,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <BsGripVertical size={12} color={theme.colors.textTertiary} style={{ cursor: 'grab' }} />
                                            <Text strong style={{ fontSize: 13 }}>{list.name}</Text>
                                            <Badge count={listCards.length} style={{
                                                backgroundColor: theme.colors.surfaceHover, color: theme.colors.textTertiary,
                                                fontSize: 10, fontWeight: 600, boxShadow: 'none',
                                            }} overflowCount={99} />
                                        </div>
                                        <Button type="text" size="small" icon={<BsThreeDots size={14} color={theme.colors.textTertiary} />} />
                                    </div>

                                    {/* Cards */}
                                    <div style={{ padding: 8, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {listCards.map(card => (
                                            <div key={card.id}
                                                draggable={!card.is_suspended}
                                                onDragStart={(e) => handleDragStart(e, card, list.id)}
                                                onDragEnd={handleDragEnd}
                                                style={{ cursor: card.is_suspended ? 'not-allowed' : 'grab' }}>
                                                <MockCardCompact card={card} theme={theme} getDueDateInfo={getDueDateInfo} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Card */}
                                    {list.id === 301 && (
                                        <div style={{ padding: '6px 8px', borderTop: `1px solid ${theme.colors.border}22` }}>
                                            {isAddingCard ? (
                                                <div>
                                                    <Input.TextArea placeholder="Enter a title..." value={newCardName}
                                                        onChange={e => setNewCardName(e.target.value)}
                                                        onPressEnter={e => { e.preventDefault(); handleAddCard(); }}
                                                        autoFocus autoSize={{ minRows: 2, maxRows: 3 }}
                                                        style={{ marginBottom: 6, borderRadius: 6, fontSize: 12 }} />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Space size={4}>
                                                            <Button type="primary" size="small" onClick={handleAddCard}
                                                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: 4, fontSize: 12 }}>
                                                                Add Card
                                                            </Button>
                                                            <Button type="text" size="small" icon={<IoCloseOutline size={16} />}
                                                                onClick={() => { setIsAddingCard(false); setNewCardName(''); }} />
                                                        </Space>
                                                        <Tooltip title="Private: visible only to assigned members">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <Switch size="small" checked={isPrivateCard} onChange={setIsPrivateCard} />
                                                                <Text type="secondary" style={{ fontSize: 10 }}>Private</Text>
                                                            </div>
                                                        </Tooltip>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div onClick={() => setIsAddingCard(true)} style={{
                                                    padding: '4px 8px', cursor: 'pointer', borderRadius: 6,
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    color: theme.colors.textTertiary, fontSize: 12,
                                                }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                    <FiPlus size={13} /> Add a card
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 2: Card Badge Legend ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🏷️" title="Card Badge Reference"
                    subtitle="Every icon and indicator on a card has meaning. Click any badge to see its details and where it appears."
                    theme={theme} />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                        {[
                            { id: 'priority', icon: <Tag color="red" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>HIGH</Tag>, label: 'Priority Badge', desc: 'Indicates task urgency (Red=High, Orange=Medium, Blue=Low). Use this to sequence work.' },
                            { id: 'duedate', icon: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, background: '#eb5a46', color: '#fff', fontSize: 10, fontWeight: 600 }}><MdAccessTime size={10} />May 15</div>, label: 'Due Date', desc: 'Target completion date. Red=Overdue, Yellow=Due soon (<3d), Green=On track. Helps track deadlines.' },
                            { id: 'statetime', icon: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, background: `${theme.colors.primary}15`, color: theme.colors.primary, fontSize: 10, fontWeight: 600 }}>⏱ 3d 5h</div>, label: 'State Time', desc: 'Time elapsed since the card entered its current list. Use this to identify bottlenecks or stalled tasks.' },
                            { id: 'desc', icon: <MdOutlineDescription size={14} color={theme.colors.textTertiary} />, label: 'Description', desc: 'Indicates the card contains a detailed markdown description or specification.' },
                            { id: 'issues', icon: <MdOutlineSubtitles size={14} color={theme.colors.textTertiary} />, label: 'Issues Logged', desc: 'Shows the card has recorded problem/solution entries for troubleshooting history.' },
                            { id: 'memo', icon: <CiMemoPad size={14} color={theme.colors.textTertiary} />, label: 'Memo Attached', desc: 'Indicates internal notes or quick memos are attached to the card.' },
                            { id: 'attachments', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: theme.colors.textTertiary, fontSize: 11 }}><MdOutlineAttachFile size={13} /> 4</span>, label: 'Attachments', desc: 'Total number of files (PDFs, images, spreadsheets) attached to the task.' },
                            { id: 'comments', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: theme.colors.textTertiary, fontSize: 11 }}><MdOutlineComment size={13} /> 7</span>, label: 'Comments', desc: 'Active discussion thread. Click to read team communications regarding this task.' },
                            { id: 'parent', icon: <MdFamilyRestroom size={14} color={theme.colors.textTertiary} />, label: 'Parent Link', desc: 'This task is a sub-task (child) of a larger parent initiative.' },
                            { id: 'child', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: theme.colors.textTertiary }}><MdFamilyRestroom size={13} /> 1/2</span>, label: 'Child Progress', desc: 'Shows how many child tasks are completed vs total. Helps track epic progress.' },
                            { id: 'suspended', icon: <MdLockOutline size={14} color="#cf1322" />, label: 'Suspended', desc: 'Card is temporarily locked (e.g., waiting on external factors). No edits or moves are allowed.' },
                            { id: 'assignees', icon: <Avatar size={20} style={{ background: theme.colors.primary, fontSize: 9, fontWeight: 700 }}>PL</Avatar>, label: 'Assignees', desc: 'Team members responsible for this task. Hover to see full names.' },
                        ].map((item, i) => (
                            <div key={i} 
                                onClick={() => { setSelectedBadge(item); setIsBadgeModalVisible(true); }}
                                style={{
                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                                    background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                    e.currentTarget.style.boxShadow = `0 2px 8px ${theme.colors.primary}22`;
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                    e.currentTarget.style.boxShadow = 'none';
                                }}>
                                <div style={{ flexShrink: 0, marginTop: 2, minWidth: 28, display: 'flex', justifyContent: 'center' }}>{item.icon}</div>
                                <div>
                                    <Text strong style={{ fontSize: 12, display: 'block', color: theme.colors.primary }}>{item.label}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Badge Reference Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedBadge?.icon}
                        <span>{selectedBadge?.label}</span>
                    </div>
                }
                open={isBadgeModalVisible}
                onCancel={() => setIsBadgeModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setIsBadgeModalVisible(false)}>
                        Close
                    </Button>
                ]}
                width={500}
                centered
            >
                {selectedBadge && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                        <div style={{ background: `${theme.colors.background}`, padding: 12, borderRadius: 8 }}>
                            <Text>{selectedBadge.desc}</Text>
                        </div>
                        
                        <Text strong style={{ fontSize: 14 }}>Example Position on Card</Text>
                        <div style={{ 
                            background: theme.colors.surface, 
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: 8, 
                            padding: 12,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            position: 'relative'
                        }}>
                            {/* Generic Card Layout representing a standard Kanban card */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {selectedBadge.id === 'priority' ? (
                                        <div style={{ padding: 4, borderRadius: 4, background: `${theme.colors.primary}11`, border: `2px dashed ${theme.colors.primary}` }}>
                                            {selectedBadge.icon}
                                        </div>
                                    ) : (
                                        <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '16px', opacity: 0.5 }}>LOW</Tag>
                                    )}
                                    {selectedBadge.id === 'parent' ? (
                                        <div style={{ padding: 4, borderRadius: 4, background: `${theme.colors.primary}11`, border: `2px dashed ${theme.colors.primary}` }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: theme.colors.textSecondary, background: theme.colors.background, padding: '2px 6px', borderRadius: 4 }}>
                                                <MdFamilyRestroom size={12} /> <Text underline style={{ fontSize: 11 }}>PRJ-123</Text>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                
                                {selectedBadge.id === 'suspended' ? (
                                    <div style={{ padding: 4, borderRadius: 4, background: `${theme.colors.primary}11`, border: `2px dashed ${theme.colors.primary}` }}>
                                        {selectedBadge.icon}
                                    </div>
                                ) : (
                                    <Tooltip title="Edit"><Button type="text" size="small" icon={<BsThreeDots />} style={{ opacity: 0.5 }} /></Tooltip>
                                )}
                            </div>

                            <Text strong style={{ display: 'block', fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
                                Example Task Title That Needs to Be Done
                            </Text>

                            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                                <Tag color="blue" style={{ opacity: 0.5 }}>Frontend</Tag>
                                <Tag color="purple" style={{ opacity: 0.5 }}>Design</Tag>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {['duedate', 'statetime'].includes(selectedBadge.id) ? (
                                        <div style={{ padding: 4, borderRadius: 4, background: `${theme.colors.primary}11`, border: `2px dashed ${theme.colors.primary}` }}>
                                            {selectedBadge.icon}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, background: theme.colors.background, color: theme.colors.textSecondary, fontSize: 10, opacity: 0.5 }}>
                                            <MdAccessTime size={10} /> May 15
                                        </div>
                                    )}

                                    {/* Action Icons group */}
                                    <div style={{ display: 'flex', gap: 6, color: theme.colors.textTertiary }}>
                                        {['desc', 'issues', 'memo', 'attachments', 'comments', 'child'].includes(selectedBadge.id) ? (
                                            <>
                                                {selectedBadge.id !== 'desc' && <MdOutlineDescription size={14} style={{ opacity: 0.3 }} />}
                                                {selectedBadge.id !== 'comments' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, opacity: 0.3 }}><MdOutlineComment size={13} /> 2</span>}
                                                <div style={{ padding: 4, borderRadius: 4, background: `${theme.colors.primary}11`, border: `2px dashed ${theme.colors.primary}`, display: 'flex', alignItems: 'center' }}>
                                                    {selectedBadge.icon}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <MdOutlineDescription size={14} style={{ opacity: 0.3 }} />
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, opacity: 0.3 }}><MdOutlineComment size={13} /> 2</span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, opacity: 0.3 }}><MdOutlineAttachFile size={13} /> 1</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {selectedBadge.id === 'assignees' ? (
                                    <div style={{ padding: 4, borderRadius: 4, background: `${theme.colors.primary}11`, border: `2px dashed ${theme.colors.primary}` }}>
                                        <Avatar.Group size="small">
                                            {selectedBadge.icon}
                                            <Avatar style={{ background: '#f56a00', fontSize: 9 }}>JD</Avatar>
                                        </Avatar.Group>
                                    </div>
                                ) : (
                                    <Avatar.Group size="small" style={{ opacity: 0.5 }}>
                                        <Avatar style={{ background: theme.colors.primary, fontSize: 9 }}>PL</Avatar>
                                    </Avatar.Group>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ═══ SECTION 3: Drag-and-Drop ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdDragIndicator />} title="Drag-and-Drop"
                    subtitle="Both cards and lists support full drag-and-drop reordering."
                    theme={theme} />
                <StepRow number={1} title="Drag Cards Between Lists" description="Click and hold any card, then drag it to another list column. This moves the task between workflow stages (e.g., Backlog → In Progress)." theme={theme} />
                <StepRow number={2} title="Reorder Cards Within a List" description="Drag a card up or down within the same list to change its position/priority order." theme={theme} />
                <StepRow number={3} title="Drag Lists Horizontally" description="Grab the ⠿ grip handle on a list header to drag and reorder entire columns." theme={theme} />
                <Callout type="warning" title="Suspended Cards Cannot Be Dragged" theme={theme}>
                    Cards with the 🔒 lock icon are suspended and will not respond to drag events. Unsuspend the card first via the Card Detail sidebar.
                </Callout>
            </div>

            {/* ═══ SECTION 4: List Menu Actions ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<BsThreeDots />} title="List Menu Actions"
                    subtitle="Click the ⋯ button on any list header to access these actions."
                    theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{
                        background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                        borderRadius: 8, padding: 8, width: 220,
                    }}>
                        {[
                            { icon: <FiPlus size={13} />, label: 'Add Card', desc: 'Create a new blank card in this list' },
                            { icon: <BsCardChecklist size={13} />, label: 'Card from Template', desc: 'Create a card using a saved template' },
                            { icon: <AiOutlineEdit size={13} />, label: 'Rename List', desc: 'Change the column name' },
                            { label: 'divider' },
                            { icon: '↕', label: 'Sort By', desc: 'Name, Due Date, Created, Priority' },
                            { label: 'divider' },
                            { icon: <IoArchiveOutline size={13} />, label: 'Archive All Cards', desc: 'Move all cards to archive' },
                            { icon: <AiOutlineDelete size={13} color={theme.colors.error} />, label: 'Delete List', desc: 'Permanently remove list + cards', danger: true },
                        ].map((item, i) => {
                            if (item.label === 'divider') return <div key={i} style={{ height: 1, background: theme.colors.border, margin: '4px 0' }} />;
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                                    color: item.danger ? theme.colors.error : theme.colors.textPrimary, fontSize: 13,
                                }}
                                    onMouseOver={e => e.currentTarget.style.background = theme.colors.surfaceHover}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                    <span style={{ width: 16, display: 'flex', justifyContent: 'center' }}>{item.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                                        <div style={{ fontSize: 10, color: theme.colors.textTertiary }}>{item.desc}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <Callout type="danger" title="Archive vs Delete" theme={theme}>
                    <strong>Archive</strong> hides cards from the board but keeps them for reporting/audit. Use Board Settings → Archived Items to restore.
                    <br /><strong>Delete</strong> is permanent and cannot be undone. Only Owners/Admins can delete lists.
                </Callout>
            </div>

            {/* ═══ SECTION 5: WIP Limits ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🚦" title="WIP (Work-in-Progress) Limits"
                    subtitle="The system enforces a global card display limit per list to maintain UI performance."
                    theme={theme} />
                <StepRow number={1} title="Global Card Limit" description="System administrators can enable a card limit (default: 10 cards per list) via Admin Settings." theme={theme} />
                <StepRow number={2} title="Show More / Show Less" description="When a list exceeds the limit, a dashed 'Show X more cards' button appears. Click to expand." theme={theme} />
                <StepRow number={3} title="Filtering Bypasses Limits" description="When you apply search or filters, all matching cards are shown regardless of the WIP limit." theme={theme} />
                <Callout type="info" theme={theme}>
                    This is a <strong>display limit</strong>, not a workflow constraint. All cards remain in the list — they're just visually paginated to keep the board responsive.
                </Callout>
            </div>

            {/* ═══ SECTION 6: Label Bars ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🎨" title="Label System"
                    subtitle="Labels are color-coded tags applied to cards for categorization."
                    theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {MOCK_LABELS.slice(0, 6).map(l => (
                            <div key={l.id} style={{
                                height: 24, borderRadius: 4, background: l.color,
                                display: 'flex', alignItems: 'center', padding: '0 10px',
                                color: '#fff', fontSize: 11, fontWeight: 600,
                            }}>{l.name}</div>
                        ))}
                    </div>
                </div>
                <Callout type="tip" theme={theme}>
                    Labels are defined at the <strong>board level</strong>. All cards within a board share the same label set.
                    Create labels from the Card Detail sidebar or Board Settings → Labels tab.
                </Callout>
            </div>
        </div>
    );
};

/* ─── Compact Mock Card (for board preview) ──────────────────────────── */
const MockCardCompact = ({ card, theme, getDueDateInfo }) => {
    const [hovered, setHovered] = useState(false);
    const dueDateInfo = getDueDateInfo(card.due_date);

    return (
        <div
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            style={{
                background: theme.colors.surface, borderRadius: 8, cursor: 'pointer',
                overflow: 'hidden', padding: '8px 10px',
                boxShadow: hovered ? theme.shadows.sm : 'none',
                border: `1px solid ${hovered ? `${theme.colors.primary}30` : theme.colors.border}`,
                transition: 'all 0.15s ease',
            }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                {card.is_suspended && <MdLockOutline size={12} color="#cf1322" style={{ marginTop: 2 }} />}
                <Text style={{ fontSize: 12, lineHeight: 1.4, color: card.is_suspended ? theme.colors.textTertiary : theme.colors.textPrimary, wordBreak: 'break-word' }}>
                    {card.name}
                </Text>
            </div>
            {card.labels && card.labels.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                    {card.labels.map(l => (
                        <div key={l.id} style={{ height: 18, borderRadius: 3, background: l.color, padding: '0 6px', color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                            {l.name}
                        </div>
                    ))}
                </div>
            )}
            {card.total_tasks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Progress percent={Math.round((card.completed_tasks / card.total_tasks) * 100)} size="small" showInfo={false}
                        strokeColor={card.completed_tasks === card.total_tasks ? '#61bd4f' : theme.colors.primary}
                        trailColor={`${theme.colors.textTertiary}30`} style={{ margin: 0, flex: 1 }} />
                    <span style={{ fontSize: 10, color: theme.colors.textTertiary }}>{card.completed_tasks}/{card.total_tasks}</span>
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Tag style={{ fontSize: 9, margin: 0, lineHeight: '14px', padding: '0 4px', textTransform: 'uppercase',
                    color: card.priority === 'high' ? '#cf1322' : card.priority === 'low' ? '#096dd9' : '#d46b08',
                    background: card.priority === 'high' ? '#fff1f0' : card.priority === 'low' ? '#e6f7ff' : '#fff7e6',
                    border: 'none', borderRadius: 3 }}>
                    {card.priority || 'medium'}
                </Tag>
                {dueDateInfo && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '0 4px', borderRadius: 3, background: dueDateInfo.bgColor, color: dueDateInfo.textColor, fontSize: 9, fontWeight: 600 }}>
                        <MdAccessTime size={9} />{dueDateInfo.dateStr}
                    </div>
                )}
                {card.comment_count > 0 && <span style={{ fontSize: 10, color: theme.colors.textTertiary }}><MdOutlineComment size={11} /> {card.comment_count}</span>}
                {card.attachment_count > 0 && <span style={{ fontSize: 10, color: theme.colors.textTertiary }}><MdOutlineAttachFile size={11} /> {card.attachment_count}</span>}
                {card.assignees && card.assignees.length > 0 && (
                    <>
                        <div style={{ flex: 1 }} />
                        <Avatar.Group max={{ count: 2, style: { width: 18, height: 18, fontSize: 8 } }} size={18}>
                            {card.assignees.map(a => {
                                const u = MOCK_USERS.find(u2 => u2.u_code === a);
                                return <Avatar key={a} size={18} style={{ background: theme.colors.primary, fontSize: 8, fontWeight: 700 }}>{(u?.u_name || a).charAt(0)}</Avatar>;
                            })}
                        </Avatar.Group>
                    </>
                )}
            </div>
        </div>
    );
};

/* ─── Main export: Drawer wrapper OR inline content ─────────────────── */
const BoardGuideDrawer = ({ open, onClose, theme }) => {
    // If open/onClose are provided → render as standalone Drawer
    if (typeof open !== 'undefined') {
        return (
            <Drawer
                title={
                    <Space>
                        <IoHelpCircleOutline size={22} color={theme.colors.primary} />
                        <span style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 700 }}>Board Interface Guide</span>
                    </Space>
                }
                placement="right"
                onClose={onClose}
                open={open}
                width={720}
                styles={{
                    header: { background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` },
                    body: { background: theme.colors.background, padding: 24 },
                }}
            >
                <BoardGuideContent theme={theme} />
            </Drawer>
        );
    }

    // Otherwise → render inline content (used inside UserGuideDrawer/FullPage)
    return <BoardGuideContent theme={theme} />;
};

export default BoardGuideDrawer;
