/**
 * BoardGuideDrawer.jsx
 * 
 * Interactive guide for the Board Canvas — covers lists, cards, drag-and-drop,
 * card badges, WIP limits, add card flow, and list menu actions.
 * Rendered inline inside UserGuideDrawer (not as a standalone Drawer).
 */

import React, { useState, useMemo } from 'react';
import { Typography, Button, Input, Switch, Tag, Badge, Avatar, Tooltip, Progress, Dropdown, Popconfirm, Space } from 'antd';
import { BsThreeDots, BsGripVertical, BsCardChecklist } from 'react-icons/bs';
import { FiPlus } from 'react-icons/fi';
import { MdOutlineDescription, MdOutlineAttachFile, MdOutlineComment, MdAccessTime, MdOutlineSubtitles, MdLockOutline, MdFamilyRestroom, MdDragIndicator } from 'react-icons/md';
import { CiMemoPad } from 'react-icons/ci';
import { IoCloseOutline, IoArchiveOutline } from 'react-icons/io5';
import { AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai';
import {
    getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, SectionLabel,
    StepRow, Callout, LabeledDivider,
} from './guideStyles';
import { MOCK_CARDS, MOCK_LISTS, MOCK_USERS, MOCK_LABELS, MOCK_SUSPENDED_CARD, PRIORITY_CONFIG } from './mockData';

const { Text } = Typography;

const BoardGuideDrawer = ({ theme }) => {
    // ─── Interactive State ──────────────────────────────────────────
    const [mockCards, setMockCards] = useState(() => {
        const copy = {};
        Object.entries(MOCK_CARDS).forEach(([k, v]) => { copy[k] = v.map(c => ({ ...c })); });
        // Add suspended card to list 302
        copy['302'] = [...(copy['302'] || []), { ...MOCK_SUSPENDED_CARD }];
        return copy;
    });
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [newCardName, setNewCardName] = useState('');
    const [isPrivateCard, setIsPrivateCard] = useState(false);
    const [expandedChecklist, setExpandedChecklist] = useState(null);
    const [showListMenu, setShowListMenu] = useState(null);

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ SECTION 1: Board Canvas Overview ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🎨" title="Board Canvas Overview"
                    subtitle="The board is your visual workflow canvas. It contains vertical Lists (columns) and Cards (tasks) that you can drag and rearrange."
                    theme={theme} />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                        {MOCK_LISTS.map(list => {
                            const listCards = mockCards[list.id] || [];
                            return (
                                <div key={list.id} style={{
                                    width: 260, minWidth: 260, flexShrink: 0,
                                    background: `${theme.colors.surfaceHover}E8`,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: theme.borderRadius.lg || 12,
                                    display: 'flex', flexDirection: 'column', maxHeight: 400,
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
                                            <MockCardCompact key={card.id} card={card} theme={theme} getDueDateInfo={getDueDateInfo} />
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
                    subtitle="Every icon and indicator on a card has meaning. Here's the complete legend."
                    theme={theme} />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                            { icon: <Tag color="red" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>HIGH</Tag>, label: 'Priority Badge', desc: 'Color-coded: Red=High, Orange=Medium, Blue=Low' },
                            { icon: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, background: '#eb5a46', color: '#fff', fontSize: 10, fontWeight: 600 }}><MdAccessTime size={10} />May 15</div>, label: 'Due Date', desc: 'Red=Overdue, Yellow=Due soon, Green=On time' },
                            { icon: <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, background: `${theme.colors.primary}15`, color: theme.colors.primary, fontSize: 10, fontWeight: 600 }}>⏱ 3d 5h</div>, label: 'State Time', desc: 'How long the card has been in its current list' },
                            { icon: <MdOutlineDescription size={14} color={theme.colors.textTertiary} />, label: 'Has Description', desc: 'Card includes a markdown description' },
                            { icon: <MdOutlineSubtitles size={14} color={theme.colors.textTertiary} />, label: 'Has Issues', desc: 'Problem/Solution entries are logged' },
                            { icon: <CiMemoPad size={14} color={theme.colors.textTertiary} />, label: 'Has Memo', desc: 'Internal notes are attached' },
                            { icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: theme.colors.textTertiary, fontSize: 11 }}><MdOutlineAttachFile size={13} /> 4</span>, label: 'Attachments', desc: 'Number of files attached' },
                            { icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: theme.colors.textTertiary, fontSize: 11 }}><MdOutlineComment size={13} /> 7</span>, label: 'Comments', desc: 'Number of comments/discussions' },
                            { icon: <MdFamilyRestroom size={14} color={theme.colors.textTertiary} />, label: 'Parent Link', desc: 'This card is a child of another card' },
                            { icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: theme.colors.textTertiary }}><MdFamilyRestroom size={13} /> 1/2</span>, label: 'Child Progress', desc: 'Done children / Total children count' },
                            { icon: <MdLockOutline size={14} color="#cf1322" />, label: 'Suspended', desc: 'Card is locked — no edits or moves allowed' },
                            { icon: <Avatar size={20} style={{ background: theme.colors.primary, fontSize: 9, fontWeight: 700 }}>PL</Avatar>, label: 'Assignees', desc: 'Team members assigned to this card' },
                        ].map((item, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: 10, alignItems: 'flex-start',
                                padding: '8px 10px', borderRadius: 6,
                                background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                            }}>
                                <div style={{ flexShrink: 0, marginTop: 2, minWidth: 28, display: 'flex', justifyContent: 'center' }}>{item.icon}</div>
                                <div>
                                    <Text strong style={{ fontSize: 12, display: 'block' }}>{item.label}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

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
                            { icon: <IoArchiveOutline size={13} />, label: 'Archive All Cards', desc: 'Move all cards to archive', danger: false },
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
    const isEffectivelySuspended = card.is_suspended;

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
            {/* Name */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                {isEffectivelySuspended && <MdLockOutline size={12} color="#cf1322" style={{ marginTop: 2 }} />}
                <Text style={{ fontSize: 12, lineHeight: 1.4, color: isEffectivelySuspended ? theme.colors.textTertiary : theme.colors.textPrimary, wordBreak: 'break-word' }}>
                    {card.name}
                </Text>
            </div>
            {/* Labels */}
            {card.labels && card.labels.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                    {card.labels.map(l => (
                        <div key={l.id} style={{ height: 18, borderRadius: 3, background: l.color, padding: '0 6px', color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                            {l.name}
                        </div>
                    ))}
                </div>
            )}
            {/* Task Progress */}
            {card.total_tasks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Progress percent={Math.round((card.completed_tasks / card.total_tasks) * 100)} size="small" showInfo={false}
                        strokeColor={card.completed_tasks === card.total_tasks ? '#61bd4f' : theme.colors.primary}
                        trailColor={`${theme.colors.textTertiary}30`} style={{ margin: 0, flex: 1 }} />
                    <span style={{ fontSize: 10, color: theme.colors.textTertiary }}>{card.completed_tasks}/{card.total_tasks}</span>
                </div>
            )}
            {/* Badges Row */}
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

export default BoardGuideDrawer;
