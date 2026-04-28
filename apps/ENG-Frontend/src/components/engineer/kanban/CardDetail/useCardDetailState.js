/**
 * useCardDetailState.js
 * 
 * Central Context Provider for the CardDetailDrawer decomposition (F3-05).
 * 
 * Provides a single shared state object to all sub-components via React Context,
 * eliminating prop-drilling and ensuring consistent data access across:
 *   - CardHeader (title, status, priority, badges)
 *   - CardComments (comment input, mentions, activity log)
 *   - CardTaskLists (checklists, task CRUD)
 *   - CardDetailDrawer (lightweight shell)
 *
 * Uses useKanbanStore with useShallow for optimized Zustand subscriptions,
 * preventing unnecessary re-renders when unrelated store slices change.
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../../../stores/authStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useTheme } from '../../../../theme';
import dayjs from 'dayjs';
import Swal from 'sweetalert2';

// ─── Context ────────────────────────────────────────────────────────
const CardDetailContext = createContext(null);

/**
 * Hook for sub-components to consume the shared CardDetail state.
 * Throws if used outside of <CardDetailProvider>.
 */
export const useCardDetailState = () => {
    const ctx = useContext(CardDetailContext);
    if (!ctx) {
        throw new Error('useCardDetailState must be used within a <CardDetailProvider>');
    }
    return ctx;
};

// ─── Helper: format duration from ms ────────────────────────────────
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

// ─── Provider Component ─────────────────────────────────────────────
export const CardDetailProvider = ({ children }) => {
    // ── Zustand store subscriptions ──
    const {
        isCardDetailOpen, activeCardId, activeCardDetail, closeCardDetail,
        lists, cards, labels, updateCard, deleteCard, moveCard,
        addComment, deleteComment,
        createTaskList, updateTaskList, deleteTaskList, createTask, updateTask, deleteTask,
        addCardLabel, removeCardLabel, fetchCardActions,
        addLinkAttachment, addFileAttachment, deleteAttachment,
        fetchCustomFieldValues, upsertCustomFieldValue,
        activeBoardMembers, addCardMember, removeCardMember,
        projectManagers, users, activeProject, activeBoard,
        createCardIssue, updateCardIssue, deleteCardIssue, createLabel,
        baseCustomFieldGroups, customFields, fetchCustomFields, cfGroupPreferences
    } = useKanbanStore(
        useShallow(state => ({
            isCardDetailOpen: state.isCardDetailOpen, activeCardId: state.activeCardId,
            activeCardDetail: state.activeCardDetail, closeCardDetail: state.closeCardDetail,
            lists: state.lists, cards: state.cards, labels: state.labels,
            updateCard: state.updateCard, deleteCard: state.deleteCard, moveCard: state.moveCard,
            addComment: state.addComment, deleteComment: state.deleteComment,
            createTaskList: state.createTaskList, updateTaskList: state.updateTaskList,
            deleteTaskList: state.deleteTaskList, createTask: state.createTask,
            updateTask: state.updateTask, deleteTask: state.deleteTask,
            addCardLabel: state.addCardLabel, removeCardLabel: state.removeCardLabel,
            fetchCardActions: state.fetchCardActions,
            addLinkAttachment: state.addLinkAttachment, addFileAttachment: state.addFileAttachment,
            deleteAttachment: state.deleteAttachment,
            fetchCustomFieldValues: state.fetchCustomFieldValues,
            upsertCustomFieldValue: state.upsertCustomFieldValue,
            activeBoardMembers: state.activeBoardMembers,
            addCardMember: state.addCardMember, removeCardMember: state.removeCardMember,
            projectManagers: state.projectManagers, users: state.users,
            activeProject: state.activeProject, activeBoard: state.activeBoard,
            createCardIssue: state.createCardIssue, updateCardIssue: state.updateCardIssue,
            deleteCardIssue: state.deleteCardIssue, createLabel: state.createLabel,
            baseCustomFieldGroups: state.baseCustomFieldGroups,
            customFields: state.customFields, fetchCustomFields: state.fetchCustomFields,
            cfGroupPreferences: state.cfGroupPreferences
        }))
    );

    const { theme } = useTheme();
    const { user, empNo } = useAuthStore();

    // ── Card reference ──
    const card = activeCardDetail;

    // ── Local UI state (editing toggles) ──
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
    const [editingTaskListId, setEditingTaskListId] = useState(null);
    const [editTaskListName, setEditTaskListName] = useState('');

    const [showMoveSelect, setShowMoveSelect] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [isCreatingLabel, setIsCreatingLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#ef5350');
    const [activityLog, setActivityLog] = useState([]);
    const [showActivityLog, setShowActivityLog] = useState(false);
    const [showLinkAttach, setShowLinkAttach] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkName, setLinkName] = useState('');
    const [customFieldValues, setCustomFieldValues] = useState([]);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [showPrioritySelect, setShowPrioritySelect] = useState(false);
    const [showEstimatedHours, setShowEstimatedHours] = useState(false);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    // Issue State
    const [editingIssueId, setEditingIssueId] = useState(null);
    const [editProblem, setEditProblem] = useState('');
    const [editSolution, setEditSolution] = useState('');
    const [showProblemSection, setShowProblemSection] = useState(false);

    const [showDependencySelect, setShowDependencySelect] = useState(false);
    const [editSuspendReason, setEditSuspendReason] = useState('');

    const fileInputRef = useRef(null);
    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [editMemo, setEditMemo] = useState('');
    const [showMemoSection, setShowMemoSection] = useState(false);
    const [editEstimatedHours, setEditEstimatedHours] = useState(0);

    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    // ── Permissions ──
    const currentUserCode = empNo || '';
    const tempCardMembers = card?.memberships || card?.assignees || card?.members || [];
    const {
        canManageCard,
        canEditCard,
        isReadOnly: baseIsReadOnly,
        isCardMember,
        isSuperAdmin,
        isManagerOrCoord,
        canManageBoardStructure,
        canEditBoard
    } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
        boardRole: activeBoardMembers?.find(m => m.u_code === currentUserCode)?.role,
        cardRole: tempCardMembers.find(m => m.u_code === currentUserCode)?.role,
    });

    // ── Derived data ──
    const parentCard = useMemo(() => {
        if (!card?.parent_id) return null;
        return Object.values(cards || {}).flat().find(c => String(c.id) === String(card.parent_id));
    }, [card?.parent_id, cards]);

    const childCards = useMemo(() => {
        if (!card?.id || !cards) return [];
        return Object.values(cards).flat().filter(c => String(c.parent_id) === String(card.id));
    }, [card?.id, cards]);

    const isEffectivelySuspended = card?.is_suspended || parentCard?.is_suspended;
    const isReadOnly = baseIsReadOnly || isEffectivelySuspended;
    const canEditEstimatedHours = isSuperAdmin || isManagerOrCoord;

    // ── Time Tracking ──
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
            inProgressAt,
            checkAt,
            checkBy: null,
            doneAt,
            doneBy: null,
            done_at: doneAt ? doneAt.toISOString() : null,
        };
    }, [card, activityLog, lists, users]);

    // ── Derived card data ──
    const listName = useMemo(() => {
        if (!card) return '';
        const l = lists.find(list => String(list.id) === String(card.list_id));
        return l ? l.name : 'Unknown';
    }, [card?.list_id, lists]);

    const visibleLists = useMemo(() => lists.filter(l => l.list_type === 'active' || l.list_type === 'closed'), [lists]);
    const cardLabels = card?.labels || [];
    const cardLabelIds = cardLabels.map(l => String(l.label_id || l.id));
    const taskLists = card?.task_lists || [];
    const comments = card?.comments || [];
    const attachments = card?.attachments || [];
    const cardMembers = tempCardMembers;
    const cardIssues = card?.issues || [];

    // ── Effects ──
    useEffect(() => {
        if (card) {
            setEditName(card.name || '');
            setEditDesc(card.description || '');
            setEditMemo(card.memo || '');
            setShowProblemSection((card.issues && card.issues.length > 0) || !!card.problem_detail || !!card.solution_detail);
            setShowMemoSection(!!card.memo);
            setEditEstimatedHours(card.estimated_hours || 0);
            setEditSuspendReason(card.suspended_reason || '');

            fetchCardActions(card.id).then(actions => setActivityLog(actions));
            fetchCustomFieldValues(card.id).then(vals => setCustomFieldValues(vals || []));
        }
    }, [card]);

    useEffect(() => {
        if (isCardDetailOpen && baseCustomFieldGroups) {
            baseCustomFieldGroups.forEach(g => {
                if (!customFields || !customFields[g.id]) {
                    fetchCustomFields(g.id);
                }
            });
        }
    }, [isCardDetailOpen, baseCustomFieldGroups]);

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
            setShowEstimatedHours(false);
            setShowMemberPicker(false);
            setMemberSearch('');
            setEditingTaskListId(null);
            setEditTaskListName('');
            setIsPreviewVisible(false);
            setPreviewAttachment(null);
        }
    }, [isCardDetailOpen]);

    // ── Handlers ──
    const checkCanEdit = async (showWarning = true) => {
        if (!isCardMember) {
            if (canEditCard) {
                await addCardMember(card.id, currentUserCode, empNo);
                return true;
            } else {
                if (showWarning) {
                    Swal.fire({
                        title: 'แจ้งเตือน',
                        text: 'กรุณากด Join เพื่อเข้าร่วมการ์ดก่อนทำการแก้ไข',
                        icon: 'warning',
                        confirmButtonColor: theme.colors.primary
                    });
                }
                return false;
            }
        }
        return true;
    };

    const handleSaveName = async () => {
        if (!(await checkCanEdit(false))) return;
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

    const handleSaveEstimatedHours = async () => {
        if (isReadOnly) return;
        const val = parseFloat(editEstimatedHours);
        if (!isNaN(val) && val !== (card.estimated_hours || 0)) {
            await updateCard(card.id, { estimated_hours: val });
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;

        let formattedComment = commentText.trim();
        const mentionMatches = formattedComment.match(/@([\w]+)/g) || [];
        const mentionedCodes = [];

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

    const handleSaveTaskListName = async (tlId) => {
        if (isReadOnly) return;
        const oldName = taskLists.find(t => t.id === tlId)?.name;
        if (editTaskListName.trim() && editTaskListName !== oldName) {
            await updateTaskList(tlId, { name: editTaskListName.trim() }, card.id);
        }
        setEditingTaskListId(null);
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

        if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
            url = url.substring(1, url.length - 1).trim();
        }

        const urlPattern = /^(?:https?:\/\/[\w\d-]+(?:\.[\w\d-]+)*(?::\d+)?(?:\/.*)?|(?:[\w\d-]+\.)+[\w\d]{2,}(?::\d+)?(?:\/.*)?|[\w\d-]+:\d+(?:\/.*)?)$/i;
        const localPathPattern = /^[a-zA-Z]:[\\\/]|^\\\\[^\/\\]+/;

        if (!urlPattern.test(url) && !localPathPattern.test(url)) {
            Swal.fire('Error', 'Invalid link format. Must be a URL or a direct file path (e.g. H:\\...)', 'error');
            return;
        }

        let finalUrl = url;
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
            // message.success handled at call site
        } catch {
            // message.error handled at call site
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAttachmentClick = (att) => {
        setPreviewAttachment(att);
        setIsPreviewVisible(true);
    };

    // ── Assembled context value (memoized to prevent cascading re-renders) ──
    const value = useMemo(() => ({
        // Store actions
        closeCardDetail, updateCard, deleteCard, moveCard,
        addComment, deleteComment,
        createTaskList, updateTaskList, deleteTaskList, createTask, updateTask, deleteTask,
        addCardLabel, removeCardLabel,
        addLinkAttachment, addFileAttachment, deleteAttachment,
        upsertCustomFieldValue, addCardMember, removeCardMember,
        createCardIssue, updateCardIssue, deleteCardIssue, createLabel,
        fetchCustomFields,

        // Store data
        isCardDetailOpen, activeCardId, lists, cards, labels,
        activeBoardMembers, projectManagers, users,
        activeProject, activeBoard,
        baseCustomFieldGroups, customFields, cfGroupPreferences,

        // Card & derived
        card, parentCard, childCards,
        listName, visibleLists,
        cardLabels, cardLabelIds, taskLists, comments, attachments, cardMembers, cardIssues,

        // Theme
        theme,

        // Auth
        empNo, currentUserCode,

        // Permissions
        canManageCard, canEditCard, baseIsReadOnly, isReadOnly,
        isCardMember, isSuperAdmin, isManagerOrCoord, canManageBoardStructure, canEditBoard,
        isEffectivelySuspended, canEditEstimatedHours,

        // Time tracking
        timeTrackingData,

        // Activity log
        activityLog, setActivityLog,

        // Custom field values
        customFieldValues, setCustomFieldValues,

        // Local state + setters (editing toggles)
        isEditingName, setIsEditingName, editName, setEditName,
        isEditingDesc, setIsEditingDesc, editDesc, setEditDesc,
        editingLinkId, setEditingLinkId, editLinkUrl, setEditLinkUrl, editLinkName, setEditLinkName,
        commentText, setCommentText,
        newTaskListName, setNewTaskListName, showAddTaskList, setShowAddTaskList,
        newTaskNames, setNewTaskNames,
        editingTaskId, setEditingTaskId, editTaskName, setEditTaskName,
        editingTaskListId, setEditingTaskListId, editTaskListName, setEditTaskListName,
        showMoveSelect, setShowMoveSelect,
        showLabelPicker, setShowLabelPicker,
        isCreatingLabel, setIsCreatingLabel, newLabelName, setNewLabelName, newLabelColor, setNewLabelColor,
        showActivityLog, setShowActivityLog,
        showLinkAttach, setShowLinkAttach, linkUrl, setLinkUrl, linkName, setLinkName,
        showDueDatePicker, setShowDueDatePicker,
        showPrioritySelect, setShowPrioritySelect,
        showEstimatedHours, setShowEstimatedHours,
        showMemberPicker, setShowMemberPicker, memberSearch, setMemberSearch,
        isUploadingFile, setIsUploadingFile,
        editingIssueId, setEditingIssueId, editProblem, setEditProblem, editSolution, setEditSolution,
        showProblemSection, setShowProblemSection,
        showDependencySelect, setShowDependencySelect,
        editSuspendReason, setEditSuspendReason,
        fileInputRef,
        isEditingMemo, setIsEditingMemo, editMemo, setEditMemo,
        showMemoSection, setShowMemoSection,
        editEstimatedHours, setEditEstimatedHours,
        previewAttachment, setPreviewAttachment,
        isPreviewVisible, setIsPreviewVisible,

        // Handlers
        checkCanEdit,
        handleSaveName, handleSaveDesc,
        handleSaveIssue, handleCancelIssue,
        handleSaveMemo, handleSaveEstimatedHours,
        handleAddComment, handleDeleteCard, handleMoveCard,
        handleAddTaskList, handleSaveTaskListName,
        handleAddTask, handleToggleTask, handleEditTaskSave,
        handleEditLinkSave, handleToggleLabel, handleSetDueDate,
        handleFileUpload, handleAttachmentClick
    }), [
        // Store data dependencies (reactive)
        isCardDetailOpen, activeCardId, lists, cards, labels,
        activeBoardMembers, projectManagers, users,
        activeProject, activeBoard,
        baseCustomFieldGroups, customFields, cfGroupPreferences,
        // Derived card data
        card, parentCard, childCards, listName, visibleLists,
        cardLabels, cardLabelIds, taskLists, comments, attachments, cardMembers, cardIssues,
        // Theme & auth
        theme, empNo, currentUserCode,
        // Permissions
        canManageCard, canEditCard, baseIsReadOnly, isReadOnly,
        isCardMember, isSuperAdmin, isManagerOrCoord, canManageBoardStructure, canEditBoard,
        isEffectivelySuspended, canEditEstimatedHours,
        // Tracking
        timeTrackingData, activityLog, customFieldValues,
        // Local state toggles
        isEditingName, editName, isEditingDesc, editDesc,
        editingLinkId, editLinkUrl, editLinkName,
        commentText, newTaskListName, showAddTaskList, newTaskNames,
        editingTaskId, editTaskName, editingTaskListId, editTaskListName,
        showMoveSelect, showLabelPicker, isCreatingLabel, newLabelName, newLabelColor,
        showActivityLog, showLinkAttach, linkUrl, linkName,
        showDueDatePicker, showPrioritySelect, showEstimatedHours,
        showMemberPicker, memberSearch, isUploadingFile,
        editingIssueId, editProblem, editSolution, showProblemSection,
        showDependencySelect, editSuspendReason,
        isEditingMemo, editMemo, showMemoSection, editEstimatedHours,
        previewAttachment, isPreviewVisible,
        // Store action refs (stable, but included for completeness)
        closeCardDetail, updateCard, deleteCard, moveCard,
        addComment, deleteComment,
        createTaskList, updateTaskList, deleteTaskList, createTask, updateTask, deleteTask,
        addCardLabel, removeCardLabel,
        addLinkAttachment, addFileAttachment, deleteAttachment,
        upsertCustomFieldValue, addCardMember, removeCardMember,
        createCardIssue, updateCardIssue, deleteCardIssue, createLabel, fetchCustomFields,
        // Handlers
        checkCanEdit,
        handleSaveName, handleSaveDesc,
        handleSaveIssue, handleCancelIssue,
        handleSaveMemo, handleSaveEstimatedHours,
        handleAddComment, handleDeleteCard, handleMoveCard,
        handleAddTaskList, handleSaveTaskListName,
        handleAddTask, handleToggleTask, handleEditTaskSave,
        handleEditLinkSave, handleToggleLabel, handleSetDueDate,
        handleFileUpload, handleAttachmentClick,
    ]);

    return (
        <CardDetailContext.Provider value={value}>
            {children}
        </CardDetailContext.Provider>
    );
};

export default CardDetailProvider;
