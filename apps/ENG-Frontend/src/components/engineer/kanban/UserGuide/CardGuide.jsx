/**
 * CardGuide.jsx — Interactive guide for the Card Detail Drawer.
 * Covers header, description, checklists, issues, memo, attachments,
 * comments, sidebar actions, and suspension system.
 */
import React, { useState } from 'react';
import { Typography, Button, Input, Switch, Tag, Badge, Avatar, Tooltip, Progress, Space, Checkbox, Divider, DatePicker } from 'antd';
import { MdOutlineSubtitles, MdAccessTime, MdOutlineTimer, MdLockOutline, MdOutlinePeople, MdOutlineDescription, MdOutlineAttachFile, MdOutlineComment, MdLowPriority } from 'react-icons/md';
import { FaCheckSquare } from 'react-icons/fa';
import { FiUpload } from 'react-icons/fi';
import { IoArchiveOutline, IoSearchOutline } from 'react-icons/io5';
import { AiOutlineTags, AiOutlineCopy, AiOutlineCheck, AiOutlineDelete } from 'react-icons/ai';
import { BiMove, BiLinkExternal } from 'react-icons/bi';
import { BsCheckSquare } from 'react-icons/bs';
import { CiMemoPad } from 'react-icons/ci';
import { getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, SectionLabel, StepRow, Callout, LabeledDivider } from './guideStyles';
import { MOCK_CARDS, MOCK_USERS, MOCK_LABELS, MOCK_TASK_LISTS, MOCK_COMMENTS, MOCK_ATTACHMENTS, MOCK_ISSUES, MOCK_ACTIVITY, MOCK_LISTS, MOCK_SUSPENDED_CARD, LABEL_PALETTE } from './mockData';

const { Text, Paragraph } = Typography;

// Sidebar button mock
const SidebarBtn = ({ icon, label, active, onClick, theme, color }) => (
    <Button block onClick={onClick} style={{
        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, height: 34,
        borderRadius: 6, background: active ? `${color || theme.colors.primary}20` : 'transparent',
        border: `1px solid ${active ? `${color || theme.colors.primary}40` : 'transparent'}`,
        color: active ? (color || theme.colors.primary) : theme.colors.textPrimary,
        fontSize: 12, fontWeight: 400, cursor: 'pointer', transition: 'all 0.15s',
    }}>{icon}{label}</Button>
);

const CardGuide = ({ theme }) => {
    // Card state
    const card = { ...MOCK_CARDS[302][0] };
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(card.name);
    const [description, setDescription] = useState(card.description || '');
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [taskLists, setTaskLists] = useState(MOCK_TASK_LISTS.map(tl => ({ ...tl, tasks: tl.tasks.map(t => ({ ...t })) })));
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [showDueDate, setShowDueDate] = useState(false);
    const [showPriority, setShowPriority] = useState(false);
    const [showEstHours, setShowEstHours] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [showIssue, setShowIssue] = useState(false);
    const [showMemo, setShowMemo] = useState(false);
    const [showMove, setShowMove] = useState(false);
    const [showDependency, setShowDependency] = useState(false);
    const [isSuspended, setIsSuspended] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [isJoined, setIsJoined] = useState(true);
    const [newTaskName, setNewTaskName] = useState('');
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState(MOCK_COMMENTS.map(c => ({ ...c })));
    const [memo, setMemo] = useState(card.memo || '');
    const [cardLabels, setCardLabels] = useState([1]);
    const [estHours, setEstHours] = useState(card.estimated_hours || 0);

    const toggleTask = (tlId, tId) => {
        setTaskLists(prev => prev.map(tl => tl.id === tlId
            ? { ...tl, tasks: tl.tasks.map(t => t.id === tId ? { ...t, is_completed: !t.is_completed } : t) }
            : tl
        ));
    };

    const addComment = () => {
        if (!newComment.trim()) return;
        setComments(prev => [{ id: Date.now(), card_id: card.id, u_code: 'LE131', text: newComment.trim(), created_at: new Date().toISOString() }, ...prev]);
        setNewComment('');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ SECTION 1: Card Header ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineSubtitles />} title="Card Header" subtitle="The top section shows the card title (click to edit), current list, and info badges." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {/* Suspended Banner */}
                    {isSuspended && (
                        <div style={{ padding: 12, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 8, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ width: 22, height: 22, background: '#cf1322', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <MdLockOutline size={12} color="#fff" />
                            </div>
                            <div>
                                <Text strong style={{ color: '#cf1322', fontSize: 13 }}>This card is Suspended.</Text>
                                <br /><Text style={{ color: '#cf1322', fontSize: 12 }}>Reason: {suspendReason || 'No reason provided.'}</Text>
                            </div>
                        </div>
                    )}
                    {/* Title */}
                    <Space align="start" size={8} style={{ width: '100%', marginBottom: 12 }}>
                        <MdOutlineSubtitles size={20} color={theme.colors.primary} style={{ marginTop: 4 }} />
                        <div style={{ flex: 1 }}>
                            {isEditingName ? (
                                <Input value={editName} onChange={e => setEditName(e.target.value)}
                                    onPressEnter={() => setIsEditingName(false)} onBlur={() => setIsEditingName(false)}
                                    autoFocus style={{ fontSize: 16, fontWeight: 600, borderRadius: 6 }} />
                            ) : (
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, cursor: 'pointer', color: theme.colors.textPrimary }}
                                    onClick={() => setIsEditingName(true)}>{editName}</h3>
                            )}
                            <Text type="secondary" style={{ fontSize: 12 }}>in list <span style={{ textDecoration: 'underline', fontWeight: 500 }}>In Progress</span></Text>
                        </div>
                    </Space>
                    {/* Info Badges */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginLeft: 28 }}>
                        {/* Labels */}
                        <div>
                            <SectionLabel theme={theme}>Labels</SectionLabel>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {MOCK_LABELS.filter(l => cardLabels.includes(l.id)).map(l => (
                                    <div key={l.id} style={{ height: 22, borderRadius: 4, background: l.color, padding: '0 8px', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{l.name}</div>
                                ))}
                            </div>
                        </div>
                        {/* Members */}
                        <div>
                            <SectionLabel theme={theme}>Members</SectionLabel>
                            <Avatar.Group size={28} max={{ count: 3 }}>
                                {card.assignees.map(a => {
                                    const u = MOCK_USERS.find(u2 => u2.u_code === a);
                                    return <Avatar key={a} size={28} style={{ background: theme.colors.primary, fontSize: 10, fontWeight: 700 }}>{(u?.u_name || a).charAt(0)}</Avatar>;
                                })}
                            </Avatar.Group>
                        </div>
                        {/* Priority */}
                        <div>
                            <SectionLabel theme={theme}>Priority</SectionLabel>
                            <Tag color="red" style={{ borderRadius: 4, textTransform: 'capitalize' }}>{card.priority}</Tag>
                        </div>
                        {/* Est Hours */}
                        <div>
                            <SectionLabel theme={theme}>Est. Hours</SectionLabel>
                            <Tag color="blue" style={{ borderRadius: 4 }}><MdOutlineTimer size={11} style={{ marginRight: 3 }} />{estHours}h</Tag>
                        </div>
                    </div>
                </div>
                <Callout type="tip" theme={theme}>Click the card title to edit it inline. The "in list" indicator shows which column this card currently belongs to.</Callout>
            </div>

            {/* ═══ SECTION 2: Description ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineDescription />} title="Description" subtitle="Rich markdown text field for detailed task context." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {isEditingDesc ? (
                        <div>
                            <Input.TextArea value={description} onChange={e => setDescription(e.target.value)}
                                autoSize={{ minRows: 3, maxRows: 8 }} style={{ borderRadius: 6, marginBottom: 8 }} />
                            <Space>
                                <Button type="primary" size="small" onClick={() => setIsEditingDesc(false)}
                                    style={{ background: theme.colors.primary, borderRadius: 4 }}>Save</Button>
                                <Button size="small" onClick={() => setIsEditingDesc(false)}>Cancel</Button>
                            </Space>
                        </div>
                    ) : (
                        <div onClick={() => setIsEditingDesc(true)} style={{
                            padding: 12, background: theme.colors.surfaceHover, borderRadius: 8, cursor: 'pointer',
                            minHeight: 60, fontSize: 13, color: description ? theme.colors.textPrimary : theme.colors.textTertiary,
                            lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        }}>
                            {description || 'Click to add a description...'}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ SECTION 3: Checklists ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<FaCheckSquare />} title="Checklists (Task Lists)" subtitle="Break down work into actionable sub-tasks. Click checkboxes to toggle completion." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {taskLists.map(tl => {
                        const done = tl.tasks.filter(t => t.is_completed).length;
                        const pct = tl.tasks.length > 0 ? Math.round((done / tl.tasks.length) * 100) : 0;
                        return (
                            <div key={tl.id} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <BsCheckSquare size={14} color={theme.colors.primary} />
                                    <Text strong style={{ fontSize: 13, flex: 1 }}>{tl.name}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{done}/{tl.tasks.length}</Text>
                                </div>
                                <Progress percent={pct} size="small" showInfo={false}
                                    strokeColor={pct === 100 ? '#52c41a' : theme.colors.primary}
                                    style={{ marginBottom: 6 }} />
                                {tl.tasks.map(t => (
                                    <div key={t.id} onClick={() => toggleTask(tl.id, t.id)} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer',
                                    }}>
                                        <Checkbox checked={t.is_completed} />
                                        <Text style={{
                                            fontSize: 12, textDecoration: t.is_completed ? 'line-through' : 'none',
                                            color: t.is_completed ? theme.colors.textTertiary : theme.colors.textPrimary,
                                        }}>{t.name}</Text>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
                <Callout type="feature" theme={theme}>Checklist progress is shown as a progress bar on the card in the board view. When all items are checked, the bar turns green.</Callout>
            </div>

            {/* ═══ SECTION 4: Issues (Problem/Solution) ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineSubtitles />} title="Issues (Problem & Solution)" subtitle="Log obstacles and their resolutions for audit compliance and knowledge sharing." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {MOCK_ISSUES.map(issue => (
                        <div key={issue.id} style={{ padding: 12, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Tag color={issue.status === 'resolved' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{issue.status}</Tag>
                                <Text type="secondary" style={{ fontSize: 10 }}>by {issue.u_code}</Text>
                            </div>
                            <div style={{ marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 11, color: '#cf1322' }}>Problem:</Text>
                                <div style={{ fontSize: 12, color: theme.colors.textPrimary, marginTop: 2 }}>{issue.problem_detail}</div>
                            </div>
                            {issue.solution_detail && (
                                <div>
                                    <Text strong style={{ fontSize: 11, color: '#389e0d' }}>Solution:</Text>
                                    <div style={{ fontSize: 12, color: theme.colors.textPrimary, marginTop: 2 }}>{issue.solution_detail}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ SECTION 5: Attachments ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineAttachFile />} title="Attachments" subtitle="Upload files or link network drive paths. Supports PDF, images, Office docs, and direct links." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {MOCK_ATTACHMENTS.map(att => (
                        <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 6, marginBottom: 6 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: att.file_type === 'link' ? '#e6f7ff' : att.file_type?.includes('pdf') ? '#fff1f0' : att.file_type?.includes('image') ? '#f6ffed' : '#f9f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                                {att.file_type === 'link' ? '🔗' : att.file_type?.includes('pdf') ? '📄' : att.file_type?.includes('image') ? '🖼️' : '📊'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontSize: 12, display: 'block' }} ellipsis>{att.file_name || att.link_name}</Text>
                                <Text type="secondary" style={{ fontSize: 10 }}>by {att.u_code}</Text>
                            </div>
                        </div>
                    ))}
                </div>
                <Callout type="info" theme={theme}>Network drive paths (e.g. <code>H:\Engineering\...</code>) are supported as link attachments. The system validates URL and local path formats before saving.</Callout>
            </div>

            {/* ═══ SECTION 6: Comments & Mentions ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineComment />} title="Comments & @Mentions" subtitle="Collaborate with team members. Type @username to notify them." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ marginBottom: 12 }}>
                        <Input.TextArea placeholder="Write a comment... Use @username to mention" value={newComment}
                            onChange={e => setNewComment(e.target.value)} autoSize={{ minRows: 2, maxRows: 4 }}
                            style={{ borderRadius: 6, marginBottom: 6 }} />
                        <Button type="primary" size="small" onClick={addComment} disabled={!newComment.trim()}
                            style={{ background: theme.colors.primary, borderRadius: 4 }}>Post Comment</Button>
                    </div>
                    {comments.map(c => {
                        const u = MOCK_USERS.find(u2 => u2.u_code === c.u_code);
                        return (
                            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <Avatar size={28} style={{ background: theme.colors.primary, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                    {(u?.u_name || c.u_code).charAt(0)}
                                </Avatar>
                                <div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                                        <Text strong style={{ fontSize: 12 }}>{u?.u_name || c.u_code}</Text>
                                        <Text type="secondary" style={{ fontSize: 10 }}>{new Date(c.created_at).toLocaleDateString()}</Text>
                                    </div>
                                    <div style={{ fontSize: 12, color: theme.colors.textPrimary, lineHeight: 1.5 }}>{c.text}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Callout type="tip" theme={theme}>When you @mention a user, the system automatically: (1) sends them a notification, (2) adds them to the card if they aren't already a member.</Callout>
            </div>

            {/* ═══ SECTION 7: Right Sidebar ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="📋" title="Card Sidebar — Complete Reference" subtitle="Every button in the right sidebar of the Card Detail Drawer." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 16 }}>
                        {/* Sidebar Column */}
                        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <SectionLabel theme={theme}>Membership</SectionLabel>
                            <SidebarBtn icon={isJoined ? <MdOutlinePeople size={14} /> : <MdOutlinePeople size={14} />}
                                label={isJoined ? 'Leave' : 'Join'} active onClick={() => setIsJoined(!isJoined)}
                                theme={theme} color={isJoined ? theme.colors.error : '#52c41a'} />

                            <Divider style={{ margin: '8px 0' }} />
                            <SectionLabel theme={theme}>Add to Card</SectionLabel>
                            <SidebarBtn icon={<AiOutlineTags size={14} />} label="Labels" active={showLabelPicker} onClick={() => setShowLabelPicker(!showLabelPicker)} theme={theme} />
                            <SidebarBtn icon={<MdOutlinePeople size={14} />} label="Members" active={showMemberPicker} onClick={() => setShowMemberPicker(!showMemberPicker)} theme={theme} />
                            <SidebarBtn icon={<MdAccessTime size={14} />} label="Due Date" active={showDueDate} onClick={() => setShowDueDate(!showDueDate)} theme={theme} />
                            <SidebarBtn icon={<MdLowPriority size={14} />} label="Priority" active={showPriority} onClick={() => setShowPriority(!showPriority)} theme={theme} />
                            <SidebarBtn icon={<MdOutlineTimer size={14} />} label="Estimated Hours" active={showEstHours} onClick={() => setShowEstHours(!showEstHours)} theme={theme} />
                            <SidebarBtn icon={<FaCheckSquare size={12} />} label="Checklist" active={showChecklist} onClick={() => setShowChecklist(!showChecklist)} theme={theme} />
                            <SidebarBtn icon={<MdOutlineSubtitles size={14} />} label="Add Issue" onClick={() => setShowIssue(!showIssue)} theme={theme} />
                            <SidebarBtn icon={<CiMemoPad size={14} />} label="Memo" onClick={() => setShowMemo(!showMemo)} theme={theme} />
                            <SidebarBtn icon={<FiUpload size={14} />} label="Attach File" theme={theme} />
                            <SidebarBtn icon={<BiLinkExternal size={14} />} label="Attach Link" theme={theme} />

                            <Divider style={{ margin: '8px 0' }} />
                            <SectionLabel theme={theme}>Actions</SectionLabel>
                            <SidebarBtn icon={<BiLinkExternal size={14} />} label="Dependency" active={showDependency} onClick={() => setShowDependency(!showDependency)} theme={theme} />
                            <SidebarBtn icon={<BiMove size={14} />} label="Move" active={showMove} onClick={() => setShowMove(!showMove)} theme={theme} />
                            <SidebarBtn icon={<AiOutlineCopy size={14} />} label="Duplicate" theme={theme} />
                            <SidebarBtn icon={<BiLinkExternal size={14} />} label="Copy Link" theme={theme} />
                            <SidebarBtn icon={<IoArchiveOutline size={14} />} label="Archive" theme={theme} />
                            <SidebarBtn icon={<AiOutlineDelete size={14} />} label="Delete Card" theme={theme} color={theme.colors.error} />

                            <Divider style={{ margin: '8px 0' }} />
                            <SectionLabel theme={theme}>Card Status</SectionLabel>
                            <div style={{
                                padding: '8px 10px', borderRadius: 6,
                                background: isSuspended ? '#fff1f0' : theme.colors.surface,
                                border: `1px solid ${isSuspended ? '#ffa39e' : theme.colors.border}`,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <Text strong style={{ fontSize: 12, color: isSuspended ? '#cf1322' : 'inherit' }}>Suspend</Text>
                                        <br /><Text type="secondary" style={{ fontSize: 10 }}>Lock card</Text>
                                    </div>
                                    <Switch size="small" checked={isSuspended} onChange={setIsSuspended} />
                                </div>
                                {isSuspended && (
                                    <Input size="small" placeholder="Reason..." value={suspendReason}
                                        onChange={e => setSuspendReason(e.target.value)}
                                        style={{ marginTop: 6, borderRadius: 4 }} />
                                )}
                            </div>
                        </div>

                        {/* Explanation Column */}
                        <div style={{ flex: 1 }}>
                            <StepRow number={1} title="Join / Leave" description="Toggle your membership on this card. Members receive notifications for all card activity." theme={theme} />
                            <StepRow number={2} title="Labels" description="Apply color-coded tags from the board's label set, or create new labels/import from templates." theme={theme} />
                            <StepRow number={3} title="Members" description="Add/remove team members. Search by name or ID. Only board members appear in the list." theme={theme} />
                            <StepRow number={4} title="Due Date" description="Set a deadline. The card badge turns red when overdue, yellow when due within 24h." theme={theme} />
                            <StepRow number={5} title="Priority" description="Set Low/Medium/High. Displayed as a colored badge on the card." theme={theme} />
                            <StepRow number={6} title="Estimated Hours" description="Declare work effort. This drives the Workload dashboard capacity calculations." theme={theme} />
                            <StepRow number={7} title="Checklist" description="Create named task lists with sub-items. Can import from checklist templates." theme={theme} />
                            <StepRow number={8} title="Dependency" description="Set a parent card to create a hierarchy. Child cards inherit suspension from parents." theme={theme} />
                            <StepRow number={9} title="Move / Duplicate / Archive / Delete" description="Transfer between lists, clone the card, soft-archive, or permanently delete (admin only)." theme={theme} />
                            <StepRow number={10} title="Suspend" description="Lock the card completely. Prevents edits, moves, and drag-drop. Provide a reason for the audit trail." theme={theme} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 8: Time Tracking ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdAccessTime />} title="Time Tracking" subtitle="Automatic lead time measurement for performance metrics." theme={theme} />
                <StepRow number={1} title="Time in Current State" description="How long the card has been in its current list since the last move. Helps identify stuck tasks." theme={theme} />
                <StepRow number={2} title="Total Lead Time" description="Measured from 'In Progress' entry to 'Done' completion. This is the primary performance KPI." theme={theme} />
                <Callout type="info" theme={theme}>Time tracking is fully automatic — no manual start/stop needed. The system records timestamps on every list change via the audit trail.</Callout>
            </div>

            {/* ═══ SECTION 9: Visibility ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🔒" title="Card Visibility" subtitle="Control who can see this card." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                        borderRadius: 8, padding: '10px 14px',
                    }}>
                        <div>
                            <Text strong style={{ fontSize: 13 }}>Private Card</Text>
                            <br /><Text type="secondary" style={{ fontSize: 11 }}>Only explicit members can view</Text>
                        </div>
                        <Switch size="small" checked={isPrivate} onChange={setIsPrivate} />
                    </div>
                </div>
                <Callout type="warning" theme={theme}>When a card is private, only explicitly added members, project owners, and system admins can see it. Other board members will not see this card at all.</Callout>
            </div>
        </div>
    );
};

export default CardGuide;
