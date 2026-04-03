import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Drawer, Typography, Row, Col, Space, Divider, Tag, Button, Input, Checkbox, Progress, Popconfirm, Select, Tooltip, Timeline, DatePicker, Avatar, Popover, Upload, message, Tabs, Mentions, Switch } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useTheme } from '../../../../theme';
import { server } from '../../../../constance/constance';

import { MdOutlineSubtitles, MdOutlineDescription, MdOutlinePeople, MdOutlineLabel, MdAccessTime, MdOutlineTimer, MdOutlineAttachFile, } from 'react-icons/md';
import { FaCheckSquare } from 'react-icons/fa';
import { CiMemoPad } from "react-icons/ci";
import { FiPaperclip, FiUpload } from 'react-icons/fi';
import { GoDiscussionClosed } from 'react-icons/go';
import { IoCloseOutline, IoSearchOutline } from 'react-icons/io5';
import { AiOutlineDelete, AiOutlineTags, AiOutlineCopy, AiOutlineEdit } from 'react-icons/ai';
import { BiMove, BiLinkExternal } from 'react-icons/bi';
import { RiInputField } from 'react-icons/ri';
import dayjs from 'dayjs';
import { AiOutlineCheck } from "react-icons/ai";
import Swal from 'sweetalert2';

import { AttachmentLink, AttachmentPreviewModal } from './AttachmentViewManager';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Label Color Grid ──────────────────────────────────────────────
const LABEL_COLORS = [
    '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0',
    '#42a5f5', '#29b6f6', '#26c6da', '#26a69a', '#66bb6a',
    '#9ccc65', '#d4e157', '#ffee58', '#ffca28', '#ffa726',
    '#ff7043', '#8d6e63', '#78909c', '#546e7a', '#37474f',
];

// ─── Sidebar Action Button ─────────────────────────────────────────
const SidebarButton = ({ icon, label, onClick, active, theme }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <Button
            block
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                borderRadius: theme.borderRadius.sm,
                background: active
                    ? `${theme.colors.primary}25`
                    : (isHovered ? theme.colors.surfaceHover : 'transparent'),
                border: `1px solid ${active ? `${theme.colors.primary}40` : (isHovered ? `${theme.colors.primary}20` : 'transparent')}`,
                color: (active || isHovered) ? theme.colors.primary : theme.colors.textPrimary,
                fontWeight: theme.typography.fontWeight.normal,
                fontSize: theme.typography.fontSize.sm,
                transition: `all ${theme.transitions.fast}`,
                cursor: 'pointer'
            }}
        >
            {icon}
            {label}
        </Button>
    );
};

// ─── Section Header ────────────────────────────────────────────────
const SectionHeader = ({ icon, title, theme, extra }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: theme.spacing.md
    }}>
        <Space align="center" size={8}>
            {React.cloneElement(icon, { size: 20, color: theme.colors.primary })}
            <Title level={5} style={{ margin: 0, fontSize: 14, color: theme.colors.textPrimary }}>{title}</Title>
        </Space>
        {extra}
    </div>
);

// Helper for rendering mentions
const renderCommentContent = (content) => {
    if (!content) return null;
    // Regex matching @[Name](u_code)
    const regex = /@\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
        // Text before the mention
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }
        // The mention
        parts.push(
            <Text strong style={{ color: '#1677ff', cursor: 'pointer' }} key={`mention-${match.index}`}>
                @{match[1]}
            </Text>
        );
        lastIndex = regex.lastIndex;
    }
    // Remaining text
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }
    return parts.length > 0 ? parts : content;
};

const CardDetailDrawer = () => {
    const {
        isCardDetailOpen, activeCardId, activeCardDetail, closeCardDetail,
        lists, labels, updateCard, deleteCard, moveCard,
        addComment, deleteComment,
        createTaskList, updateTaskList, createTask, updateTask, deleteTask,
        addCardLabel, removeCardLabel, fetchCardActions,
        addLinkAttachment, addFileAttachment, deleteAttachment,
        fetchCustomFieldValues, upsertCustomFieldValue,
        activeBoardMembers, addCardMember, removeCardMember,
        projectManagers, users, activeProject,
        createCardIssue, updateCardIssue, deleteCardIssue
    } = useKanbanStore();
    const { theme } = useTheme();
    const { user, empNo } = useAuthStore();

    // Local state
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editDesc, setEditDesc] = useState('');
    const [editingLinkId, setEditingLinkId] = useState(null);
    const [editLinkUrl, setEditLinkUrl] = useState('');
    const [editLinkName, setEditLinkName] = useState('');

    const [commentText, setCommentText] = useState('');
    const [newTaskListName, setNewTaskListName] = useState('');
    const [showAddTaskList, setShowAddTaskList] = useState(false);
    const [newTaskNames, setNewTaskNames] = useState({});
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editTaskName, setEditTaskName] = useState('');
    const [showMoveSelect, setShowMoveSelect] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [activityLog, setActivityLog] = useState([]);
    const [showActivityLog, setShowActivityLog] = useState(false);
    const [showLinkAttach, setShowLinkAttach] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkName, setLinkName] = useState('');
    const [customFieldValues, setCustomFieldValues] = useState([]);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    // Issue State
    const [editingIssueId, setEditingIssueId] = useState(null); // 'new' or issue.id
    const [editProblem, setEditProblem] = useState('');
    const [editSolution, setEditSolution] = useState('');
    const [showProblemSection, setShowProblemSection] = useState(false);

    const fileInputRef = useRef(null);
    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [editMemo, setEditMemo] = useState('');
    const [showMemoSection, setShowMemoSection] = useState(false);

    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const handleAttachmentClick = (att) => {
        setPreviewAttachment(att);
        setIsPreviewVisible(true);
    };

    const card = activeCardDetail;

    // Evaluate explicit permissions using the central hook
    const currentUserCode = empNo || 'LE131';
    const tempCardMembers = card?.memberships || card?.assignees || card?.members || [];
    const {
        canManageCard,
        canEditCard,
        isReadOnly,
        isCardMember
    } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
        boardRole: activeBoardMembers?.find(m => m.u_code === currentUserCode)?.role,
        cardRole: tempCardMembers.find(m => m.u_code === currentUserCode)?.role,
    });

    const timeTrackingData = useMemo(() => {
        if (!card || !activityLog) return null;
        let createdItem = activityLog.find(a => a.action_type === 'card_created');
        let creationTime = dayjs(createdItem ? createdItem.created_at : (card.created_at || card.list_changed_at || new Date()));

        let movements = activityLog
            .filter(a => a.action_type === 'card_moved')
            .sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());

        let segments = [];
        let currentListId = createdItem?.action_data?.list_id
            || (movements.length > 0 ? movements[0].action_data?.from_list_id : card.list_id);
        let currentStartTime = creationTime;

        movements.forEach(m => {
            let enterTime = dayjs(m.created_at);
            segments.push({
                listId: currentListId,
                enteredAt: currentStartTime,
                leftAt: enterTime,
                durationMs: enterTime.diff(currentStartTime)
            });
            currentListId = m.action_data?.to_list_id;
            currentStartTime = enterTime;
        });

        // Add current segment
        let now = card.is_closed ? dayjs(card.updated_at || card.list_changed_at || new Date()) : dayjs();
        segments.push({
            listId: currentListId || card.list_id,
            enteredAt: currentStartTime,
            leftAt: now,
            durationMs: Math.max(0, now.diff(currentStartTime)),
            isCurrent: !card.is_closed
        });
        // Merge adjacent identical lists
        let merged = [];
        segments.forEach(s => {
            if (merged.length > 0 && String(merged[merged.length - 1].listId) === String(s.listId)) {
                merged[merged.length - 1].leftAt = s.leftAt;
                merged[merged.length - 1].durationMs += s.durationMs;
                merged[merged.length - 1].isCurrent = s.isCurrent;
            } else {
                merged.push({ ...s });
            }
        });

        const formatDuration = (ms) => {
            if (ms < 0) ms = 0;
            const totalMins = Math.floor(ms / 60000);
            const totalHours = Math.floor(totalMins / 60);
            const days = Math.floor(totalHours / 24);
            const hours = totalHours % 24;
            const mins = totalMins % 60;
            if (days > 0) return `${days}d ${hours}h`;
            if (hours > 0) return `${hours}h ${mins}m`;
            return `${mins}m`;
        };

        merged.forEach(s => {
            s.formattedDuration = formatDuration(s.durationMs);
            const matchingList = lists.find(l => String(l.id) === String(s.listId));
            s.listName = matchingList ? matchingList.name : 'Unknown';
        });

        let inProgressAt = null;
        let doneAt = null;
        let checkAt = null;

        for (const s of merged) {
            const lName = (s.listName || '').toLowerCase();
            if (!inProgressAt && (lName.includes('in progress') || lName.includes('working') || lName.includes('กำลังทำ'))) {
                inProgressAt = dayjs(s.enteredAt);
            }
            if (!checkAt && (lName.includes('check') || lName.includes('review') || lName.includes('ตรวจ'))) {
                checkAt = dayjs(s.enteredAt);
            }
            if (!doneAt && (lName.includes('done') || lName.includes('completed') || lName.includes('เสร็จ'))) {
                doneAt = dayjs(s.enteredAt);
            }
        }

        let leadTimeStart = inProgressAt;
        let leadTimeEnd = doneAt ? doneAt : dayjs();
        let computedLeadTimeMs = 0;

        if (leadTimeStart) {
            computedLeadTimeMs = Math.max(0, leadTimeEnd.diff(leadTimeStart));
        }

        return {
            creationTime,
            segments: merged,
            totalLeadTime: leadTimeStart ? formatDuration(computedLeadTimeMs) : 'Not Started',
            totalLeadTimeMs: computedLeadTimeMs,

            // Explicit tracking from segments
            inProgressAt: inProgressAt,
            checkAt: checkAt,
            checkBy: null, // Optional tracking
            doneAt: doneAt,
            doneBy: null,
            done_at: doneAt ? doneAt.toISOString() : null, // To satisfy UI conditions
        };
    }, [card, activityLog, lists, users]);

    useEffect(() => {
        if (card) {
            setEditName(card.name || '');
            setEditDesc(card.description || '');
            setEditMemo(card.memo || '');
            setShowProblemSection((card.issues && card.issues.length > 0) || !!card.problem_detail || !!card.solution_detail);
            setShowMemoSection(!!card.memo);

            fetchCardActions(card.id).then(actions => setActivityLog(actions));
            fetchCustomFieldValues(card.id).then(vals => setCustomFieldValues(vals || []));
        }
    }, [card]);

    useEffect(() => {
        if (!isCardDetailOpen) {
            setIsEditingName(false);
            setIsEditingDesc(false);
            setEditingIssueId(null);
            setEditProblem('');
            setEditSolution('');
            setEditMemo('');
            setCommentText('');
            setShowAddTaskList(false);
            setShowMoveSelect(false);
            setShowLabelPicker(false);
            setShowDueDatePicker(false);
            setShowMemberPicker(false);
            setMemberSearch('');
            setIsPreviewVisible(false);
            setPreviewAttachment(null);
        }
    }, [isCardDetailOpen]);

    if (!isCardDetailOpen) return null;

    const listName = (() => {
        if (!card) return '';
        const l = lists.find(list => String(list.id) === String(card.list_id));
        return l ? l.name : 'Unknown';
    })();

    const visibleLists = lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
    const cardLabels = card?.labels || [];
    // Always use label_id from kb_card_label join rows (the actual label FK), NOT the card_label row id
    const cardLabelIds = cardLabels.map(l => String(l.label_id || l.id));
    const taskLists = card?.task_lists || [];
    const comments = card?.comments || [];
    const attachments = card?.attachments || [];
    const cardMembers = tempCardMembers;
    const cardIssues = card?.issues || [];

    // ─── Handlers ──────────────────────────────────────────────────
    const handleSaveName = async () => {
        if (isReadOnly) return;
        if (editName.trim() && editName !== card.name) {
            await updateCard(card.id, { name: editName.trim() });
        }
        setIsEditingName(false);
    };

    const handleSaveDesc = async () => {
        if (isReadOnly) return;
        if (editDesc !== (card.description || '')) {
            await updateCard(card.id, { description: editDesc });
        }
        setIsEditingDesc(false);
    };

    const handleSaveIssue = async () => {
        if (isReadOnly) return;
        if (editingIssueId === 'new') {
            await createCardIssue(card.id, {
                problem_detail: editProblem,
                solution_detail: editSolution
            });
        } else if (editingIssueId) {
            await updateCardIssue(editingIssueId, {
                problem_detail: editProblem,
                solution_detail: editSolution
            }, card.id);
        }
        setEditingIssueId(null);
        setEditProblem('');
        setEditSolution('');
    };

    const handleCancelIssue = () => {
        setEditingIssueId(null);
        setEditProblem('');
        setEditSolution('');
    };

    const handleSaveMemo = async () => {
        if (isReadOnly) return;
        if (editMemo !== (card.memo || '')) {
            await updateCard(card.id, { memo: editMemo });
        }
        setIsEditingMemo(false);
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;

        let formattedComment = commentText.trim();
        const mentionMatches = formattedComment.match(/@([\w]+)/g) || [];
        const mentionedCodes = [];

        // Rewrite comment text to Planka format @[Name](uCode)
        for (const match of mentionMatches) {
            const nameOrCode = match.slice(1);
            const uObj = users.find(u =>
                (u.u_name && u.u_name.replace(/\s+/g, '') === nameOrCode) ||
                (u.u_code === nameOrCode) ||
                (u.u_nickname === nameOrCode)
            );
            if (uObj) {
                mentionedCodes.push(uObj.u_code);
                const regex = new RegExp(`@${nameOrCode}\\b`, 'g');
                formattedComment = formattedComment.replace(regex, `@[${uObj.u_name || uObj.u_nickname || uObj.u_code}](${uObj.u_code})`);
            }
        }

        await addComment(card.id, formattedComment, empNo);

        // Auto-add mentioned users who are not yet card members
        for (const code of mentionedCodes) {
            const alreadyMember = cardMembers.some(cm => cm.u_code === code);
            const isProjectMember = projectManagers.some(pm => pm.u_code === code);
            if (!alreadyMember && isProjectMember) {
                await addCardMember(card.id, code, empNo);
            }
        }
        setCommentText('');
    };

    const handleDeleteCard = async () => {
        await deleteCard(card.id);
    };

    const handleMoveCard = async (newListId) => {
        await moveCard(card.id, newListId);
        setShowMoveSelect(false);
        closeCardDetail();
    };

    const handleAddTaskList = async () => {
        if (!newTaskListName.trim()) return;
        await createTaskList(card.id, newTaskListName.trim());
        setNewTaskListName('');
        setShowAddTaskList(false);
    };

    const handleAddTask = async (taskListId) => {
        const name = newTaskNames[taskListId]?.trim();
        if (!name) return;
        await createTask(taskListId, name, card.id);
        setNewTaskNames(prev => ({ ...prev, [taskListId]: '' }));
    };

    const handleToggleTask = async (task) => {
        await updateTask(task.id, { is_completed: !task.is_completed }, card.id);
    };

    const handleEditTaskSave = async (taskId) => {
        if (!editTaskName.trim()) {
            setEditingTaskId(null);
            return;
        }
        await updateTask(taskId, { name: editTaskName.trim() }, card.id);
        setEditingTaskId(null);
    };

    const handleEditLinkSave = async (linkId) => {
        let url = editLinkUrl.trim();
        if (!url) {
            Swal.fire('Error', 'URL cannot be empty', 'error');
            return;
        }

        // Strip quotes if any
        if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
            url = url.substring(1, url.length - 1).trim();
        }

        const urlPattern = /^(https?:\/\/)?([\w\d-]+\.)+[\w\d]{2,}(\/.*)?$/i;
        const localPathPattern = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/;

        if (!urlPattern.test(url) && !localPathPattern.test(url)) {
            Swal.fire('Error', 'Invalid link format. Must be a URL or a direct file path (e.g. H:\\...)', 'error');
            return;
        }

        let finalUrl = url;
        // Only prepend http:// if it's a standard web URL pattern and missing protocol
        if (urlPattern.test(url) && !/^https?:\/\//i.test(finalUrl) && !localPathPattern.test(finalUrl)) {
            finalUrl = 'http://' + finalUrl;
        }

        await useKanbanStore.getState().updateAttachment(linkId, {
            url: finalUrl,
            name: editLinkName.trim() || finalUrl
        }, card.id);
        setEditingLinkId(null);
    };

    const handleToggleLabel = async (labelId) => {
        const strId = String(labelId);
        if (cardLabelIds.includes(strId)) {
            await removeCardLabel(card.id, labelId);
        } else {
            await addCardLabel(card.id, labelId);
        }
    };

    const handleSetDueDate = async (date) => {
        await updateCard(card.id, { due_date: date ? date.toISOString() : null });
        setShowDueDatePicker(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingFile(true);
        try {
            await addFileAttachment(card.id, file);
            message.success(`Uploaded: ${file.name}`);
        } catch {
            message.error('Failed to upload file');
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Separate attachments by type
    const fileAttachments = attachments.filter(a => a.attachment_type === 'file');
    const linkAttachments = attachments.filter(a => a.attachment_type === 'link');

    return (
        <>
            <Drawer
                title={null}
                placement="right"
                width={760}
                onClose={closeCardDetail}
                open={isCardDetailOpen}
                closable={false}
                styles={{ body: { padding: 0, background: theme.colors.background } }}
            >
                {!card ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <Text type="secondary">Loading card details...</Text>
                    </div>
                ) : (
                    <>
                        {/* Header Cover */}
                        <div style={{
                            height: 56,
                            background: `linear-gradient(135deg, ${theme.colors.primaryLight}, ${theme.colors.secondaryLight || theme.colors.primaryLight})`,
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            padding: `0 ${theme.spacing.md}`
                        }}>
                            <Button
                                type="text"
                                icon={<IoCloseOutline size={22} />}
                                onClick={closeCardDetail}
                                style={{
                                    background: 'rgba(255,255,255,0.7)',
                                    backdropFilter: 'blur(4px)',
                                    borderRadius: '50%',
                                    width: 36, height: 36,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            />
                        </div>

                        <div style={{ padding: `${theme.spacing.xl} ${theme.spacing.xl}` }}>
                            <Row gutter={24}>
                                {/* ─── LEFT COLUMN ─── */}
                                <Col span={16}>
                                    {/* Card Title */}
                                    <div style={{ marginBottom: theme.spacing.xl }}>
                                        <Space align="start" size={8} style={{ width: '100%' }}>
                                            <MdOutlineSubtitles size={22} color={theme.colors.primary} style={{ marginTop: 4, flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                {isEditingName ? (
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onPressEnter={handleSaveName}
                                                        onBlur={handleSaveName}
                                                        autoFocus
                                                        style={{ fontSize: 18, fontWeight: 600, borderRadius: theme.borderRadius.sm }}
                                                    />
                                                ) : (
                                                    <h2 style={{ margin: 0, fontSize: 20, color: theme.colors.textPrimary, fontWeight: 600, wordBreak: 'break-word', cursor: isReadOnly ? 'default' : 'pointer' }} onClick={() => !isReadOnly && setIsEditingName(true)}>
                                                        {card.name}
                                                    </h2>
                                                )}
                                                <Text type="secondary" style={{ fontSize: 13 }}>
                                                    in list <span style={{ textDecoration: 'underline', fontWeight: 500 }}>{listName}</span>
                                                </Text>
                                            </div>
                                        </Space>
                                        {isReadOnly && (
                                            <Tag color="warning" style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>
                                                Read-Only Mode: You must join this task to edit it.
                                            </Tag>
                                        )}
                                    </div>

                                    {/* Info Badges Row — Labels, Members, Due Date */}
                                    <div style={{ display: 'flex', gap: theme.spacing.xl, flexWrap: 'wrap', marginBottom: theme.spacing.xl }}>
                                        {/* Labels */}
                                        {cardLabels.length > 0 && (
                                            <div>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                                    Labels
                                                </Text>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {cardLabels.map(label => (
                                                        <div key={label.id || label.label_id}
                                                            style={{
                                                                height: 24, minWidth: 32, borderRadius: 4,
                                                                background: label.color,
                                                                display: 'flex', alignItems: 'center',
                                                                padding: label.name ? '0 8px' : '0',
                                                                color: '#fff', fontSize: 12, fontWeight: 600,
                                                            }}
                                                        >
                                                            {label.name || ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Members */}
                                        {cardMembers.length > 0 && (
                                            <div>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                                    Members
                                                </Text>
                                                <Avatar.Group
                                                    max={{ count: 5, style: { width: 32, height: 32, lineHeight: '32px', fontSize: 11, border: `2px solid ${theme.colors.surface}` } }}
                                                    size={32}
                                                >
                                                    {cardMembers.map((m, i) => {
                                                        const uCode = typeof m === 'string' ? m : (m.u_code || m);
                                                        const userObj = users.find(u => u.u_code === uCode);
                                                        const name = userObj?.u_name || userObj?.u_nickname || uCode;
                                                        const words = (userObj?.u_name || '').split(' ');
                                                        const initials = words.length >= 2
                                                            ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                                            : name.charAt(0).toUpperCase();
                                                        return (
                                                            <Tooltip key={i} title={name}>
                                                                {userObj?.profile_img_b64 ? (
                                                                    <Avatar
                                                                        size={32}
                                                                        src={userObj.profile_img_b64}
                                                                        style={{ border: `2px solid ${theme.colors.surface}`, cursor: 'pointer' }}
                                                                    />
                                                                ) : (
                                                                    <Avatar
                                                                        size={32}
                                                                        style={{
                                                                            background: theme.colors.primary,
                                                                            fontSize: 12,
                                                                            fontWeight: 700,
                                                                            border: `2px solid ${theme.colors.surface}`,
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    >
                                                                        {initials}
                                                                    </Avatar>
                                                                )}
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </Avatar.Group>
                                            </div>
                                        )}

                                        {/* Due Date */}
                                        {card.due_date && (
                                            <div>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                                    Due Date
                                                </Text>
                                                <Tag color={new Date(card.due_date) < new Date() ? 'red' : 'green'} style={{ borderRadius: 4 }}>
                                                    <MdAccessTime size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                    {new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </Tag>
                                            </div>
                                        )}
                                    </div>

                                    {/* ─── Current State Time ─── */}
                                    {timeTrackingData && (
                                        <div style={{ marginBottom: theme.spacing.xl, marginLeft: 28 }}>
                                            <Row gutter={[16, 16]}>
                                                {!timeTrackingData.done_at && (
                                                    <Col span={12}>
                                                        <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                            Time in Current State
                                                        </Text>
                                                        <Text strong style={{ fontSize: 14, color: theme.colors.primary }}>
                                                            {timeTrackingData.segments.length > 0
                                                                ? timeTrackingData.segments[timeTrackingData.segments.length - 1].formattedDuration
                                                                : '0m'}
                                                        </Text>
                                                    </Col>
                                                )}
                                                <Col span={timeTrackingData.done_at ? 24 : 12}>
                                                    <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                        Total Lead Time
                                                    </Text>
                                                    <Text strong={!!timeTrackingData.done_at} style={{ fontSize: 14, color: timeTrackingData.done_at ? theme.colors.primary : theme.colors.textPrimary }}>
                                                        {timeTrackingData.totalLeadTime}
                                                    </Text>
                                                </Col>
                                            </Row>
                                        </div>
                                    )}

                                    {/* ─── Description ─── */}
                                    <div style={{ marginBottom: theme.spacing.xl }}>
                                        <SectionHeader icon={<MdOutlineDescription />} title="Description" theme={theme} />
                                        <div style={{ marginLeft: 28 }}>
                                            {isEditingDesc ? (
                                                <div>
                                                    <TextArea
                                                        // variant="borderless"
                                                        value={editDesc}
                                                        onChange={(e) => setEditDesc(e.target.value)}
                                                        autoSize={{ minRows: 3, maxRows: 10 }}
                                                        autoFocus
                                                        placeholder="Add a more detailed description..."
                                                        style={{ borderRadius: theme.borderRadius.sm }}
                                                    />
                                                    <Space style={{ marginTop: 8 }}>
                                                        <Button type="primary" size="small" onClick={handleSaveDesc}
                                                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                        >Save</Button>
                                                        <Button size="small" onClick={() => { setIsEditingDesc(false); setEditDesc(card.description || ''); }}
                                                            style={{ borderRadius: theme.borderRadius.sm }}
                                                        >Cancel</Button>
                                                    </Space>
                                                </div>
                                            ) : (
                                                <div
                                                    style={{
                                                        // background: theme.colors.surfaceHover,
                                                        padding: theme.spacing.sm,
                                                        borderRadius: theme.borderRadius.md,
                                                        // border: `1px solid ${theme.colors.border}`,
                                                        cursor: isReadOnly ? 'default' : 'pointer',
                                                        minHeight: 50,
                                                        transition: `background ${theme.transitions.fast}`,
                                                    }}
                                                    onClick={() => !isReadOnly && setIsEditingDesc(true)}
                                                    onMouseOver={(e) => e.currentTarget.style.background = `${theme.colors.surfaceHover}CC`}
                                                    onMouseOut={(e) => e.currentTarget.style.background = theme.colors.surfaceHover}
                                                >
                                                    <Paragraph
                                                        style={{
                                                            margin: 0,
                                                            whiteSpace: 'pre-wrap',
                                                            color: theme.colors.textPrimary,
                                                            cursor: isReadOnly ? 'default' : 'pointer', minHeight: 40
                                                        }}
                                                        onClick={() => !isReadOnly && setIsEditingDesc(true)}>
                                                        {card.description || <span style={{
                                                            color: theme.colors.textTertiary
                                                        }}>
                                                            Add a more detailed description...
                                                        </span>}
                                                    </Paragraph>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ─── Issues (Problem & Solution) ─── */}
                                    {showProblemSection && (
                                        <div style={{ marginBottom: theme.spacing.xl }}>
                                            <SectionHeader icon={<MdOutlineSubtitles />} title="Issues (Problem & Solution)" theme={theme} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, marginLeft: 28 }}>
                                                {cardIssues.map((issue, idx) => (
                                                    <div key={issue.id} style={{
                                                        background: theme.colors.surfaceHover,
                                                        padding: theme.spacing.md,
                                                        borderRadius: theme.borderRadius.md,
                                                        border: `1px solid ${theme.colors.border}`,
                                                    }}>
                                                        {editingIssueId === issue.id ? (
                                                            <div>
                                                                <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Problem / Issue</Text>
                                                                <TextArea
                                                                    value={editProblem}
                                                                    onChange={(e) => setEditProblem(e.target.value)}
                                                                    autoSize={{ minRows: 2, maxRows: 6 }}
                                                                    placeholder="Detail the problem encountered..."
                                                                    style={{ borderRadius: theme.borderRadius.sm, marginBottom: 12 }}
                                                                />
                                                                <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>Solution / Fix</Text>
                                                                <TextArea
                                                                    value={editSolution}
                                                                    onChange={(e) => setEditSolution(e.target.value)}
                                                                    autoSize={{ minRows: 2, maxRows: 6 }}
                                                                    placeholder="Describe the solution applied..."
                                                                    style={{ borderRadius: theme.borderRadius.sm }}
                                                                />
                                                                <Space style={{ marginTop: 12 }}>
                                                                    <Button type="primary" size="small" onClick={handleSaveIssue}
                                                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                                    >Save</Button>
                                                                    <Button size="small" onClick={handleCancelIssue}
                                                                        style={{ borderRadius: theme.borderRadius.sm }}
                                                                    >Cancel</Button>
                                                                </Space>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                                    <Text strong style={{ color: theme.colors.primary, fontSize: 13 }}>Issue #{idx + 1}</Text>
                                                                    {!isReadOnly && (
                                                                        <Space size={4}>
                                                                            <Button type="text" size="small" icon={<MdOutlineSubtitles size={14} />} onClick={() => {
                                                                                setEditingIssueId(issue.id);
                                                                                setEditProblem(issue.problem_detail || '');
                                                                                setEditSolution(issue.solution_detail || '');
                                                                            }} />
                                                                            <Popconfirm title="Delete issue?" onConfirm={() => deleteCardIssue(issue.id, card.id)}>
                                                                                <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                                                            </Popconfirm>
                                                                        </Space>
                                                                    )}
                                                                </div>
                                                                <Row gutter={16}>
                                                                    <Col span={12}>
                                                                        <Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Problem</Text>
                                                                        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>
                                                                            {issue.problem_detail || '-'}
                                                                        </Paragraph>
                                                                    </Col>
                                                                    <Col span={12}>
                                                                        <Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Solution</Text>
                                                                        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>
                                                                            {issue.solution_detail || '-'}
                                                                        </Paragraph>
                                                                    </Col>
                                                                </Row>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}

                                                {/* Legacy single issue data support (before migration fully complete) */}
                                                {cardIssues.length === 0 && (card.problem_detail || card.solution_detail) && (
                                                    <div style={{
                                                        background: theme.colors.surfaceHover,
                                                        padding: theme.spacing.md,
                                                        borderRadius: theme.borderRadius.md,
                                                        border: `1px dashed ${theme.colors.border}`,
                                                    }}>
                                                        <Text type="warning" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>Unmigrated Legacy Issue</Text>
                                                        <Row gutter={16}>
                                                            <Col span={12}>
                                                                <Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Problem</Text>
                                                                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>{card.problem_detail || '-'}</Paragraph>
                                                            </Col>
                                                            <Col span={12}>
                                                                <Text strong style={{ fontSize: 12, color: theme.colors.textTertiary }}>Solution</Text>
                                                                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, fontSize: 13 }}>{card.solution_detail || '-'}</Paragraph>
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                )}

                                                {/* Create new issue form */}
                                                {editingIssueId === 'new' ? (
                                                    <div style={{
                                                        background: `${theme.colors.primary}10`,
                                                        padding: theme.spacing.md,
                                                        borderRadius: theme.borderRadius.md,
                                                        border: `1px solid ${theme.colors.primary}50`,
                                                    }}>
                                                        <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>New Problem / Issue</Text>
                                                        <TextArea
                                                            value={editProblem}
                                                            onChange={(e) => setEditProblem(e.target.value)}
                                                            autoSize={{ minRows: 2, maxRows: 6 }}
                                                            placeholder="Detail the problem encountered..."
                                                            style={{ borderRadius: theme.borderRadius.sm, marginBottom: 12 }}
                                                            autoFocus
                                                        />
                                                        <Text strong style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>New Solution / Fix</Text>
                                                        <TextArea
                                                            value={editSolution}
                                                            onChange={(e) => setEditSolution(e.target.value)}
                                                            autoSize={{ minRows: 2, maxRows: 6 }}
                                                            placeholder="Describe the solution applied..."
                                                            style={{ borderRadius: theme.borderRadius.sm }}
                                                        />
                                                        <Space style={{ marginTop: 12 }}>
                                                            <Button type="primary" size="small" onClick={handleSaveIssue}
                                                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                            >Save Issue</Button>
                                                            <Button size="small" onClick={handleCancelIssue}
                                                                style={{ borderRadius: theme.borderRadius.sm }}
                                                            >Cancel</Button>
                                                        </Space>
                                                    </div>
                                                ) : (
                                                    !isReadOnly && (
                                                        <Button type="dashed" onClick={() => {
                                                            setEditingIssueId('new');
                                                            setEditProblem('');
                                                            setEditSolution('');
                                                            setShowProblemSection(true);
                                                        }} style={{ borderRadius: theme.borderRadius.sm }}>
                                                            + Add Issue
                                                        </Button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ─── Memo ─── */}
                                    {showMemoSection && (
                                        <div style={{ marginBottom: theme.spacing.xl }}>
                                            <SectionHeader icon={<CiMemoPad />} title="Memo" theme={theme} />
                                            <div style={{ marginLeft: 28 }}>
                                                {isEditingMemo ? (
                                                    <div>
                                                        <TextArea
                                                            value={editMemo}
                                                            onChange={(e) => setEditMemo(e.target.value)}
                                                            autoSize={{ minRows: 3, maxRows: 10 }}
                                                            autoFocus
                                                            placeholder="Add any additional notes or comments..."
                                                            style={{ borderRadius: theme.borderRadius.sm }}
                                                        />
                                                        <Space style={{ marginTop: 8 }}>
                                                            <Button type="primary" size="small" onClick={handleSaveMemo}
                                                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                            >Save</Button>
                                                            <Button size="small" onClick={() => { setIsEditingMemo(false); setEditMemo(card.memo || ''); }}
                                                                style={{ borderRadius: theme.borderRadius.sm }}
                                                            >Cancel</Button>
                                                        </Space>
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            background: theme.colors.surfaceHover,
                                                            padding: theme.spacing.md,
                                                            borderRadius: theme.borderRadius.md,
                                                            border: `1px solid ${theme.colors.border}`,
                                                            cursor: isReadOnly ? 'default' : 'pointer',
                                                            minHeight: 50,
                                                            transition: `background ${theme.transitions.fast}`,
                                                        }}
                                                        onClick={() => !isReadOnly && setIsEditingMemo(true)}
                                                        onMouseOver={(e) => e.currentTarget.style.background = `${theme.colors.surfaceHover}CC`}
                                                        onMouseOut={(e) => e.currentTarget.style.background = theme.colors.surfaceHover}
                                                    >
                                                        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: theme.colors.textPrimary, cursor: isReadOnly ? 'default' : 'pointer', minHeight: 40 }} onClick={() => !isReadOnly && setIsEditingMemo(true)}>
                                                            {card.memo || <span style={{ color: theme.colors.textTertiary }}>Add any additional notes or comments...</span>}
                                                        </Paragraph>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ─── Attachments ─── */}
                                    {attachments.length > 0 && (
                                        <div style={{ marginBottom: theme.spacing.xl }}>
                                            <SectionHeader icon={<MdOutlineAttachFile />} title="Attachments" theme={theme} />
                                            <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {/* File Attachments */}
                                                {fileAttachments.map(att => {
                                                    // Build a download URL from the relative file_path
                                                    // server.API_URL usually has a trailing slash, e.g. "http://localhost:2005/"
                                                    // file_path is like "public/kanban_attachments/..."
                                                    const cleanPath = att.file_path?.replace(/^public[\/\\]/, '')?.replace(/\\/g, '/');
                                                    const fileUrl = att.file_path?.startsWith('http')
                                                        ? att.file_path
                                                        : `${server.API_URL}${cleanPath}`;
                                                    return (
                                                        <div key={att.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                                            background: theme.colors.surfaceHover,
                                                            borderRadius: theme.borderRadius.sm,
                                                            border: `1px solid ${theme.colors.border}`,
                                                        }}>
                                                            {att.is_image ? (
                                                                <div style={{
                                                                    width: 40, height: 40, borderRadius: 4,
                                                                    background: `url(${fileUrl}) center/cover`,
                                                                    flexShrink: 0, cursor: 'pointer',
                                                                }} onClick={() => handleAttachmentClick(att)} />
                                                            ) : (
                                                                <FiPaperclip size={16} color={theme.colors.primary} />
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <AttachmentLink
                                                                    attachment={att}
                                                                    theme={theme}
                                                                    onClick={handleAttachmentClick}
                                                                />
                                                                {att.file_size && (
                                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                                        {(att.file_size / 1024).toFixed(1)} KB
                                                                    </Text>
                                                                )}
                                                            </div>
                                                            <Tooltip title="Open in new tab">
                                                                <Button type="text" size="small" icon={<FiUpload size={14} style={{ transform: 'rotate(180deg)' }} />}
                                                                    onClick={() => window.open(fileUrl, '_blank', 'noreferrer')}
                                                                />
                                                            </Tooltip>
                                                            {!isReadOnly && (
                                                                <Popconfirm title="Delete attachment?" onConfirm={() => deleteAttachment(att.id, card.id)}>
                                                                    <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                                                </Popconfirm>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {/* Link Attachments */}
                                                {linkAttachments.map(att => {
                                                    const linkData = typeof att.link_data === 'string' ? JSON.parse(att.link_data) : att.link_data;
                                                    const isEditing = editingLinkId === att.id;
                                                    return (
                                                        <div key={att.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                                            background: theme.colors.surfaceHover,
                                                            borderRadius: theme.borderRadius.sm,
                                                            border: `1px solid ${theme.colors.border}`,
                                                        }}>
                                                            <BiLinkExternal size={16} color={theme.colors.primary} />
                                                            {isEditing ? (
                                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                    <Input
                                                                        size="small"
                                                                        placeholder="Link Title (optional)"
                                                                        value={editLinkName}
                                                                        onChange={e => setEditLinkName(e.target.value)}
                                                                    />
                                                                    <Input
                                                                        size="small"
                                                                        placeholder="URL (required)"
                                                                        value={editLinkUrl}
                                                                        onChange={e => setEditLinkUrl(e.target.value)}
                                                                        onPressEnter={() => handleEditLinkSave(att.id)}
                                                                    />
                                                                    <Space>
                                                                        <Button size="small" type="primary" onClick={() => handleEditLinkSave(att.id)}>Save</Button>
                                                                        <Button size="small" onClick={() => setEditingLinkId(null)}>Cancel</Button>
                                                                    </Space>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <AttachmentLink
                                                                        attachment={att}
                                                                        theme={theme}
                                                                        onClick={handleAttachmentClick}
                                                                    />
                                                                    {!isReadOnly && (
                                                                        <Space size={4}>
                                                                            <Button type="text" size="small" onClick={() => {
                                                                                setEditingLinkId(att.id);
                                                                                setEditLinkName(att.file_name || linkData?.name || '');
                                                                                setEditLinkUrl(linkData?.url || att.file_path || '');
                                                                            }}>
                                                                                <AiOutlineEdit size={14} />
                                                                            </Button>
                                                                            <Popconfirm title="Delete attachment?" onConfirm={() => deleteAttachment(att.id, card.id)}>
                                                                                <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                                                            </Popconfirm>
                                                                        </Space>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ─── Task Lists ─── */}
                                    {taskLists.length > 0 && taskLists.map(tl => {
                                        const tasks = tl.tasks || [];
                                        const visibleTasks = tl.hide_completed_tasks
                                            ? tasks.filter(t => !t.is_completed)
                                            : tasks;
                                        const completed = tasks.filter(t => t.is_completed).length;
                                        const total = tasks.length;
                                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                                        return (
                                            <div key={tl.id} style={{ marginBottom: theme.spacing.xl }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <SectionHeader icon={<FaCheckSquare />} title={tl.name} theme={theme} />
                                                    {!isReadOnly && (
                                                        <Button
                                                            type="text" size="small"
                                                            style={{ color: tl.hide_completed_tasks ? theme.colors.primary : theme.colors.textTertiary, fontSize: 12 }}
                                                            onClick={() => updateTaskList(tl.id, { hide_completed_tasks: !tl.hide_completed_tasks }, card.id)}
                                                        >
                                                            {tl.hide_completed_tasks ? `Show completed (${completed})` : 'Hide completed'}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div style={{ marginLeft: 28 }}>
                                                    <Progress
                                                        percent={pct}
                                                        size="small"
                                                        strokeColor={theme.colors.primary}
                                                        style={{ marginBottom: 8 }}
                                                    />
                                                    {visibleTasks.map(task => (
                                                        <div key={task.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: '4px 0',
                                                            borderBottom: `1px solid ${theme.colors.border}30`
                                                        }}>
                                                            <Checkbox
                                                                checked={task.is_completed}
                                                                onChange={() => !isReadOnly && handleToggleTask(task)}
                                                                disabled={isReadOnly}
                                                            />
                                                            {editingTaskId === task.id ? (
                                                                <Input
                                                                    value={editTaskName}
                                                                    onChange={(e) => setEditTaskName(e.target.value)}
                                                                    onPressEnter={() => handleEditTaskSave(task.id)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Escape') {
                                                                            setEditingTaskId(null);
                                                                        }
                                                                    }}
                                                                    onBlur={() => handleEditTaskSave(task.id)}
                                                                    autoFocus
                                                                    size="small"
                                                                    style={{ flex: 1, borderRadius: theme.borderRadius.sm, fontSize: 13 }}
                                                                />
                                                            ) : (
                                                                <Text
                                                                    delete={task.is_completed}
                                                                    style={{
                                                                        flex: 1,
                                                                        color: task.is_completed ? theme.colors.textTertiary : theme.colors.textPrimary,
                                                                        fontSize: 13,
                                                                        cursor: isReadOnly ? 'default' : 'pointer'
                                                                    }}
                                                                    onClick={() => {
                                                                        if (!isReadOnly) {
                                                                            setEditingTaskId(task.id);
                                                                            setEditTaskName(task.name);
                                                                        }
                                                                    }}
                                                                >
                                                                    {task.name}
                                                                </Text>
                                                            )}
                                                            {!isReadOnly && (
                                                                <Button
                                                                    type="text" size="small" danger
                                                                    icon={<AiOutlineDelete size={12} />}
                                                                    onClick={() => deleteTask(task.id, card.id)}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                    {!isReadOnly && (
                                                        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                                                            <Input
                                                                placeholder="Add a task..."
                                                                size="small"
                                                                value={newTaskNames[tl.id] || ''}
                                                                onChange={(e) => setNewTaskNames(prev => ({ ...prev, [tl.id]: e.target.value }))}
                                                                onPressEnter={() => handleAddTask(tl.id)}
                                                                style={{ borderRadius: theme.borderRadius.sm }}
                                                            />
                                                            <Button size="small" type="primary" onClick={() => handleAddTask(tl.id)}
                                                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                            >Add</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Add Task List Button */}
                                    {!isReadOnly && (
                                        showAddTaskList ? (
                                            <div style={{ marginTop: theme.spacing.md }}>
                                                <div style={{ display: 'flex', gap: 4, marginLeft: 28 }}>
                                                    <Input
                                                        placeholder="Checklist name"
                                                        size="small"
                                                        value={newTaskListName}
                                                        onChange={(e) => setNewTaskListName(e.target.value)}
                                                        onPressEnter={handleAddTaskList}
                                                        style={{ borderRadius: theme.borderRadius.sm }}
                                                    />
                                                    <Button size="small" type="primary" onClick={handleAddTaskList}
                                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                    >Add</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ marginBottom: theme.spacing.xl, marginLeft: 28 }}>
                                                <Button type="dashed" block onClick={() => setShowAddTaskList(true)} style={{ borderRadius: theme.borderRadius.sm }}>
                                                    Add Checklist
                                                </Button>
                                            </div>
                                        )
                                    )}

                                    {/* ─── Custom Fields ─── */}
                                    {customFieldValues.length > 0 && (
                                        <div style={{ marginBottom: theme.spacing.xl }}>
                                            <SectionHeader icon={<RiInputField />} title="Custom Fields" theme={theme} />
                                            <div style={{ marginLeft: 28 }}>
                                                {customFieldValues.map(cfv => (
                                                    <div key={cfv.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        marginBottom: 6
                                                    }}>
                                                        <Text strong style={{ minWidth: 100, fontSize: 13 }}>{cfv.field_name}:</Text>
                                                        <Input
                                                            size="small"
                                                            defaultValue={cfv.content || ''}
                                                            disabled={isReadOnly}
                                                            onBlur={(e) => {
                                                                if (e.target.value !== (cfv.content || '')) {
                                                                    upsertCustomFieldValue(card.id, {
                                                                        custom_field_id: cfv.custom_field_id,
                                                                        content: e.target.value
                                                                    });
                                                                }
                                                            }}
                                                            onPressEnter={(e) => e.target.blur()}
                                                            style={{ borderRadius: theme.borderRadius.sm }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ─── Comments & Actions Tabs (Planka-style) ─── */}
                                    <div style={{ marginBottom: theme.spacing.xl }}>
                                        <Tabs
                                            defaultActiveKey="comments"
                                            size="small"
                                            items={[
                                                {
                                                    key: 'comments',
                                                    label: 'Comments',
                                                    children: (
                                                        <div>
                                                            {/* Comment Input */}
                                                            {!isReadOnly && (
                                                                <div style={{ marginBottom: theme.spacing.md }}>
                                                                    <Mentions
                                                                        placeholder="Write a comment... type @ to mention"
                                                                        value={commentText}
                                                                        onChange={setCommentText}
                                                                        autoSize={{ minRows: 2, maxRows: 4 }}
                                                                        style={{ borderRadius: theme.borderRadius.sm, width: '100%' }}
                                                                        options={(projectManagers || []).map(m => {
                                                                            const uObj = users.find(u => u.u_code === m.u_code);
                                                                            const displayName = uObj?.u_name || uObj?.u_nickname || m.u_code;
                                                                            const mentionValue = displayName.replace(/\s+/g, '');
                                                                            return {
                                                                                value: mentionValue,
                                                                                label: displayName
                                                                            };
                                                                        })}
                                                                    />
                                                                    <Button
                                                                        type="primary"
                                                                        size="small"
                                                                        style={{ marginTop: 8, background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                                        onClick={handleAddComment}
                                                                        disabled={!commentText.trim()}
                                                                    >
                                                                        Save Comment
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            {/* Comments List */}
                                                            {comments.length > 0 ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                                    {comments.map(comment => (
                                                                        <div key={comment.id} style={{
                                                                            background: theme.colors.surfaceHover,
                                                                            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                                                            borderRadius: theme.borderRadius.md,
                                                                            border: `1px solid ${theme.colors.border}`,
                                                                        }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                                <Space size={8}>
                                                                                    {(() => {
                                                                                        const commentUser = users.find(u => u.u_code === comment.u_code);
                                                                                        const cmWords = (commentUser?.u_name || '').split(' ');
                                                                                        const cmInitials = cmWords.length >= 2
                                                                                            ? (cmWords[0][0] + cmWords[cmWords.length - 1][0]).toUpperCase()
                                                                                            : (comment.u_code || 'U').charAt(0).toUpperCase();
                                                                                        return commentUser?.profile_img_b64 ? (
                                                                                            <Avatar size={26} src={commentUser.profile_img_b64} style={{ border: `2px solid ${theme.colors.border}` }} />
                                                                                        ) : (
                                                                                            <Avatar size={26} style={{ background: theme.colors.primary, fontSize: 11, fontWeight: 700 }}>
                                                                                                {cmInitials}
                                                                                            </Avatar>
                                                                                        );
                                                                                    })()}
                                                                                    <Text strong style={{ fontSize: 13 }}>{users.find(u => u.u_code === comment.u_code)?.u_name || comment.u_code || 'User'}</Text>
                                                                                </Space>
                                                                                <Space size={4}>
                                                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                                                        {new Date(comment.created_at).toLocaleString()}
                                                                                    </Text>
                                                                                    {!isReadOnly && (
                                                                                        <Popconfirm
                                                                                            title="Delete comment?"
                                                                                            onConfirm={() => deleteComment(comment.id, card.id)}
                                                                                            okText="Yes" cancelText="No"
                                                                                        >
                                                                                            <Button type="text" size="small" danger icon={<AiOutlineDelete size={12} />} />
                                                                                        </Popconfirm>
                                                                                    )}
                                                                                </Space>
                                                                            </div>
                                                                            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginLeft: 32, color: theme.colors.textPrimary }}>
                                                                                {renderCommentContent(comment.text || comment.content)}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <Text type="secondary" style={{ fontSize: 13 }}>No comments yet.</Text>
                                                            )}
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    key: 'actions',
                                                    label: 'Actions',
                                                    children: (
                                                        <div>
                                                            {activityLog.length > 0 ? (
                                                                <Timeline
                                                                    items={activityLog.map(action => {
                                                                        const msgs = {
                                                                            card_created: 'created this card',
                                                                            card_moved: 'moved this card',
                                                                            member_added: 'was added to this card',
                                                                            member_removed: 'was removed from this card',
                                                                            comment_added: 'added a comment',
                                                                            label_added: 'added a label',
                                                                            label_removed: 'removed a label',
                                                                            attachment_added: 'attached a file',
                                                                            task_completed: 'completed a task',
                                                                            tasklist_created: 'added a checklist',
                                                                            task_created: 'added a checklist task',
                                                                            task_checked: 'checked off a task',
                                                                            task_unchecked: 'unchecked a task',
                                                                            card_updated: 'updated this card',
                                                                            due_date_changed: 'changed the due date'
                                                                        };

                                                                        // Format metadata if present
                                                                        let metaText = '';
                                                                        if (action.metadata) {
                                                                            const m = action.metadata;
                                                                            if (m.file_name) metaText = ` "${m.file_name}"`;
                                                                            else if (m.name) metaText = ` "${m.name}"`;
                                                                            else if (action.action_type === 'due_date_changed') metaText = m.new_date ? ` to ${new Date(m.new_date).toLocaleDateString()}` : ` (removed)`;
                                                                        }

                                                                        return {
                                                                            children: (
                                                                                <div>
                                                                                    <Text strong style={{ fontSize: 13 }}>{action.user_display_name || action.u_code || 'User'}</Text>
                                                                                    {' '}
                                                                                    <Text style={{ fontSize: 13 }}>
                                                                                        {msgs[action.action_type] || action.action_type}
                                                                                        {metaText}
                                                                                    </Text>
                                                                                    <br />
                                                                                    <Text type="secondary" style={{ fontSize: 11 }}>{new Date(action.created_at).toLocaleString()}</Text>
                                                                                </div>
                                                                            ),
                                                                        };
                                                                    })}
                                                                />
                                                            ) : (
                                                                <Text type="secondary" style={{ fontSize: 13 }}>No activity recorded yet.</Text>
                                                            )}
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    key: 'time_tracking',
                                                    label: 'Time Tracking',
                                                    children: (
                                                        <div>
                                                            {timeTrackingData ? (
                                                                <div style={{ padding: theme.spacing.sm }}>
                                                                    <Row gutter={[16, 16]}>
                                                                        <Col span={12}>
                                                                            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                                                Created At
                                                                            </Text>
                                                                            <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                                                {timeTrackingData.creationTime.format('MMM D, YYYY HH:mm')}
                                                                            </Text>
                                                                        </Col>
                                                                        <Col span={12}>
                                                                            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                                                In Progress
                                                                            </Text>
                                                                            <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                                                {timeTrackingData.inProgressAt ? timeTrackingData.inProgressAt.format('MMM D, YYYY HH:mm') : '-'}
                                                                            </Text>
                                                                        </Col>
                                                                        <Col span={12}>
                                                                            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                                                Checked By
                                                                            </Text>
                                                                            <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                                                {timeTrackingData.checkBy ? `${timeTrackingData.checkBy} (${timeTrackingData.checkAt.format('MMM D HH:mm')})` : '-'}
                                                                            </Text>
                                                                        </Col>
                                                                        <Col span={12}>
                                                                            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                                                Done By
                                                                            </Text>
                                                                            <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                                                {timeTrackingData.doneBy ? `${timeTrackingData.doneBy} (${timeTrackingData.doneAt.format('MMM D HH:mm')})` : '-'}
                                                                            </Text>
                                                                        </Col>
                                                                    </Row>

                                                                    <Divider style={{ margin: '16px 0' }} />

                                                                    <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 12 }}>
                                                                        State Transition History
                                                                    </Text>
                                                                    <Timeline
                                                                        items={timeTrackingData.segments.map((seg, i) => ({
                                                                            color: seg.isCurrent ? theme.colors.primary : 'gray',
                                                                            children: (
                                                                                <div>
                                                                                    <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                                                        {seg.listName}
                                                                                    </Text>
                                                                                    <br />
                                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                                        Entered: {seg.enteredAt.format('MMM D, HH:mm')}
                                                                                        {' • '}
                                                                                        <span style={{ color: seg.isCurrent ? theme.colors.primary : theme.colors.textTertiary, fontWeight: 500 }}>
                                                                                            Spent: {seg.formattedDuration} {seg.isCurrent && '(Current)'}
                                                                                        </span>
                                                                                    </Text>
                                                                                </div>
                                                                            )
                                                                        }))}
                                                                        style={{ margin: 0, paddingLeft: 4, marginTop: 8 }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <Text type="secondary" style={{ fontSize: 13 }}>No tracking data available.</Text>
                                                            )}
                                                        </div>
                                                    ),
                                                },
                                            ]}
                                        />
                                    </div>
                                </Col>

                                {/* ─── RIGHT COLUMN — Sidebar ─── */}
                                <Col xs={24} md={8}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>

                                        {/* Membership Actions */}
                                        <div style={{ marginBottom: theme.spacing.lg }}>
                                            <Text strong style={{
                                                fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                                                color: theme.colors.textTertiary, display: 'block', marginBottom: 8
                                            }}>
                                                Membership
                                            </Text>
                                            <Space direction="vertical" style={{ width: '100%' }} size={4}>
                                                {!isCardMember ? (
                                                    <SidebarButton icon={<MdOutlinePeople size={16} />} label="Join" theme={theme} onClick={() => addCardMember(card.id, currentUserCode, empNo)} />
                                                ) : (
                                                    <SidebarButton icon={<MdOutlinePeople size={16} />} label="Leave" theme={theme} onClick={() => removeCardMember(card.id, currentUserCode, empNo)} />
                                                )}
                                            </Space>
                                        </div>

                                        {/* Add to Card */}
                                        {!isReadOnly && (
                                            <div style={{ marginBottom: theme.spacing.lg }}>
                                                <Text strong style={{
                                                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                                                    color: theme.colors.textTertiary, display: 'block', marginBottom: 8
                                                }}>
                                                    Add to card
                                                </Text>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {/* Members */}
                                                    <SidebarButton
                                                        icon={<MdOutlinePeople size={16} />}
                                                        label="Members"
                                                        active={showMemberPicker}
                                                        onClick={() => setShowMemberPicker(!showMemberPicker)}
                                                        theme={theme}
                                                    />
                                                    {showMemberPicker && (
                                                        <div style={{
                                                            background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: theme.borderRadius.md, padding: theme.spacing.sm,
                                                        }}>
                                                            <Input
                                                                placeholder="Search by name or ID..."
                                                                prefix={<IoSearchOutline />}
                                                                value={memberSearch}
                                                                onChange={e => setMemberSearch(e.target.value)}
                                                                style={{ marginBottom: 8, borderRadius: theme.borderRadius.sm }}
                                                                allowClear
                                                                size="small"
                                                            />
                                                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                                {(() => {
                                                                    const filteredMembers = (projectManagers || []).filter(m => {
                                                                        if (!memberSearch) return true;
                                                                        const mUser = users.find(u => u.u_code === m.u_code);
                                                                        const s = memberSearch.toLowerCase();
                                                                        return (
                                                                            m.u_code?.toLowerCase().includes(s) ||
                                                                            mUser?.u_name?.toLowerCase().includes(s) ||
                                                                            mUser?.u_nickname?.toLowerCase().includes(s)
                                                                        );
                                                                    });

                                                                    return filteredMembers.length > 0 ? filteredMembers.map(m => {
                                                                        const isMem = cardMembers.some(cm => cm.u_code === m.u_code);
                                                                        return (
                                                                            <div
                                                                                key={m.u_code || m.id}
                                                                                style={{
                                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                                    padding: '4px 0', cursor: 'pointer',
                                                                                }}
                                                                                onClick={() => {
                                                                                    if (isMem) removeCardMember(card.id, m.u_code, empNo);
                                                                                    else addCardMember(card.id, m.u_code, empNo);
                                                                                }}
                                                                            >
                                                                                {(() => {
                                                                                    const mUser = users.find(u => u.u_code === m.u_code);
                                                                                    const mName = mUser?.u_name || mUser?.u_nickname || m.u_code || 'U';
                                                                                    const mWords = mName.split(' ');
                                                                                    const mInitials = mWords.length >= 2
                                                                                        ? (mWords[0][0] + mWords[mWords.length - 1][0]).toUpperCase()
                                                                                        : mName.charAt(0).toUpperCase();
                                                                                    return mUser?.profile_img_b64 ? (
                                                                                        <Avatar size={28} src={mUser.profile_img_b64} style={{ border: `2px solid ${theme.colors.border}`, flexShrink: 0 }} />
                                                                                    ) : (
                                                                                        <Avatar size={28} style={{ background: isMem ? theme.colors.primary : theme.colors.secondary, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                                                                            {mInitials}
                                                                                        </Avatar>
                                                                                    );
                                                                                })()}
                                                                                <Text style={{ flex: 1, fontSize: 13 }}>{users.find(u => u.u_code === m.u_code)?.u_name || m.u_code || 'User'}</Text>
                                                                                {isMem && <AiOutlineCheck color={theme.colors.primary} />}
                                                                            </div>
                                                                        );
                                                                    }) : (
                                                                        <Text type="secondary" style={{ fontSize: 13 }}>No project members available.</Text>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Labels */}
                                                    <SidebarButton
                                                        icon={<AiOutlineTags size={16} />}
                                                        label="Labels"
                                                        active={showLabelPicker}
                                                        onClick={() => setShowLabelPicker(!showLabelPicker)}
                                                        theme={theme}
                                                    />
                                                    {showLabelPicker && (
                                                        <div style={{
                                                            background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: theme.borderRadius.md, padding: theme.spacing.sm,
                                                        }}>
                                                            {labels.length > 0 ? labels.map(label => {
                                                                const isChecked = cardLabelIds.includes(String(label.id));
                                                                return (
                                                                    <div
                                                                        key={label.id}
                                                                        style={{
                                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                                            padding: '4px 0', cursor: 'pointer'
                                                                        }}
                                                                        onClick={() => handleToggleLabel(label.id)}
                                                                    >
                                                                        <Checkbox checked={isChecked} />
                                                                        <div style={{
                                                                            flex: 1, height: 28, borderRadius: 6,
                                                                            background: label.color,
                                                                            display: 'flex', alignItems: 'center',
                                                                            padding: '0 10px',
                                                                            color: '#fff', fontSize: 13, fontWeight: 500,
                                                                            border: isChecked ? '2px solid rgba(255,255,255,0.8)' : '2px solid transparent',
                                                                            boxShadow: isChecked ? `0 0 0 1px ${label.color}` : 'none',
                                                                        }}>
                                                                            {label.name || ''}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : (
                                                                <Text type="secondary" style={{ fontSize: 13 }}>No labels on this board yet.</Text>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Due Date */}
                                                    <SidebarButton
                                                        icon={<MdAccessTime size={16} />}
                                                        label="Due Date"
                                                        active={showDueDatePicker}
                                                        onClick={() => setShowDueDatePicker(!showDueDatePicker)}
                                                        theme={theme}
                                                    />
                                                    {showDueDatePicker && (
                                                        <div style={{
                                                            background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: theme.borderRadius.md, padding: theme.spacing.sm,
                                                        }}>
                                                            <DatePicker
                                                                showTime
                                                                style={{ width: '100%', marginBottom: 8, borderRadius: theme.borderRadius.sm }}
                                                                value={card.due_date ? dayjs(card.due_date) : null}
                                                                onChange={handleSetDueDate}
                                                                placeholder="Select due date..."
                                                            />
                                                            {card.due_date && (
                                                                <Button size="small" danger block onClick={() => handleSetDueDate(null)}
                                                                    style={{ borderRadius: theme.borderRadius.sm }}
                                                                >
                                                                    Remove Due Date
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Checklist */}
                                                    <SidebarButton
                                                        icon={<FaCheckSquare size={14} />}
                                                        label="Checklist"
                                                        active={showAddTaskList}
                                                        onClick={() => setShowAddTaskList(!showAddTaskList)}
                                                        theme={theme}
                                                    />
                                                    {showAddTaskList && (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <Input
                                                                placeholder="Checklist name"
                                                                size="small"
                                                                value={newTaskListName}
                                                                onChange={(e) => setNewTaskListName(e.target.value)}
                                                                onPressEnter={handleAddTaskList}
                                                                style={{ borderRadius: theme.borderRadius.sm }}
                                                            />
                                                            <Button size="small" type="primary" onClick={handleAddTaskList}
                                                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                            >Add</Button>
                                                        </div>
                                                    )}

                                                    {/* Problem & Solution */}
                                                    {!showProblemSection && (
                                                        <SidebarButton
                                                            icon={<MdOutlineSubtitles size={16} />}
                                                            label="Add Issue"
                                                            active={false}
                                                            onClick={() => {
                                                                setShowProblemSection(true);
                                                                setEditingIssueId('new');
                                                            }}
                                                            theme={theme}
                                                        />
                                                    )}

                                                    {/* Memo */}
                                                    {!showMemoSection && (
                                                        <SidebarButton
                                                            icon={<MdOutlineDescription size={16} />}
                                                            label="Memo"
                                                            active={false}
                                                            onClick={() => {
                                                                setShowMemoSection(true);
                                                                setIsEditingMemo(true);
                                                            }}
                                                            theme={theme}
                                                        />
                                                    )}

                                                    {/* Attach File */}
                                                    <SidebarButton
                                                        icon={<FiUpload size={16} />}
                                                        label="Attach File"
                                                        active={false}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        theme={theme}
                                                    />
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        style={{ display: 'none' }}
                                                        onChange={handleFileUpload}
                                                    />
                                                    {isUploadingFile && (
                                                        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>Uploading...</Text>
                                                    )}

                                                    {/* Attach Link */}
                                                    <SidebarButton
                                                        icon={<BiLinkExternal size={16} />}
                                                        label="Attach Link"
                                                        active={showLinkAttach}
                                                        onClick={() => setShowLinkAttach(!showLinkAttach)}
                                                        theme={theme}
                                                    />
                                                    {showLinkAttach && (
                                                        <div style={{
                                                            background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                                            borderRadius: theme.borderRadius.md, padding: theme.spacing.sm,
                                                            display: 'flex', flexDirection: 'column', gap: 6
                                                        }}>
                                                            <Input placeholder="https://..." size="small" value={linkUrl}
                                                                onChange={(e) => setLinkUrl(e.target.value)}
                                                                style={{ borderRadius: theme.borderRadius.sm }}
                                                            />
                                                            <Input placeholder="Link name (optional)" size="small" value={linkName}
                                                                onChange={(e) => setLinkName(e.target.value)}
                                                                style={{ borderRadius: theme.borderRadius.sm }}
                                                            />
                                                            <Button
                                                                size="small" type="primary"
                                                                disabled={!linkUrl.trim()}
                                                                onClick={async () => {
                                                                    let url = linkUrl.trim();
                                                                    if (!url) return;

                                                                    // Strip quotes if any
                                                                    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
                                                                        url = url.substring(1, url.length - 1).trim();
                                                                    }

                                                                    const urlPattern = /^(https?:\/\/)?([\w\d-]+\.)+[\w\d]{2,}(\/.*)?$/i;
                                                                    const localPathPattern = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/;

                                                                    if (!urlPattern.test(url) && !localPathPattern.test(url)) {
                                                                        Swal.fire('Error', 'Invalid link format. Must be a URL or a direct file path (e.g. H:\\...)', 'error');
                                                                        return;
                                                                    }

                                                                    let finalUrl = url;
                                                                    if (urlPattern.test(url) && !/^https?:\/\//i.test(finalUrl) && !localPathPattern.test(finalUrl)) {
                                                                        finalUrl = 'http://' + finalUrl;
                                                                    }

                                                                    await addLinkAttachment(card.id, finalUrl, linkName.trim());
                                                                    setLinkUrl(''); setLinkName(''); setShowLinkAttach(false);
                                                                }}
                                                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                                            >Attach</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Private Toggle — only for those who can manage card */}
                                        {canManageCard && (
                                            <div style={{ marginBottom: theme.spacing.lg }}>
                                                <Text strong style={{
                                                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                                                    color: theme.colors.textTertiary, display: 'block', marginBottom: 8
                                                }}>
                                                    Visibility
                                                </Text>
                                                <div style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                                    borderRadius: theme.borderRadius.md, padding: '8px 12px'
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Text strong style={{ fontSize: 13, lineHeight: '1.2' }}>Private Card</Text>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>Only explicit members</Text>
                                                    </div>
                                                    <Switch
                                                        size="small"
                                                        checked={card.is_private}
                                                        onChange={(val) => updateCard(card.id, { is_private: val })}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <Divider style={{ margin: `${theme.spacing.sm} 0` }} />

                                        {/* Actions */}
                                        {!isReadOnly && (
                                            <div style={{ marginBottom: theme.spacing.lg }}>
                                                <Text strong style={{
                                                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
                                                    color: theme.colors.textTertiary, display: 'block', marginBottom: 8
                                                }}>
                                                    Actions
                                                </Text>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {/* Move */}
                                                    <SidebarButton
                                                        icon={<BiMove size={16} />}
                                                        label="Move"
                                                        active={showMoveSelect}
                                                        onClick={() => setShowMoveSelect(!showMoveSelect)}
                                                        theme={theme}
                                                    />
                                                    {showMoveSelect && (
                                                        <Select
                                                            placeholder="Move to list..."
                                                            style={{ width: '100%' }}
                                                            onChange={handleMoveCard}
                                                            options={visibleLists
                                                                .filter(l => String(l.id) !== String(card.list_id))
                                                                .map(l => ({ label: l.name, value: l.id }))
                                                            }
                                                        />
                                                    )}
                                                    <SidebarButton
                                                        icon={<AiOutlineCopy size={16} />}
                                                        label="Duplicate"
                                                        // active={showDuplicateSelect}
                                                        onClick={async () => {
                                                            await useKanbanStore.getState().duplicateCard(card.id, card.list_id);
                                                            closeCardDetail();
                                                        }}
                                                        theme={theme}
                                                    />

                                                    {/* Delete */}
                                                    {canManageCard && (
                                                        <Popconfirm
                                                            title="Delete this card?"
                                                            description="This action cannot be undone."
                                                            onConfirm={handleDeleteCard}
                                                            okText="Delete"
                                                            okType="danger"
                                                            cancelText="Cancel"
                                                        >
                                                            <Button block danger style={{
                                                                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                                                                height: 36, borderRadius: theme.borderRadius.sm,
                                                            }}>
                                                                <AiOutlineDelete size={16} />
                                                                Delete Card
                                                            </Button>
                                                        </Popconfirm>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    </>
                )
                }
            </Drawer >

            <AttachmentPreviewModal
                visible={isPreviewVisible}
                onClose={() => setIsPreviewVisible(false)}
                attachment={previewAttachment}
                theme={theme}
            />
        </>
    );
};

export default CardDetailDrawer;
