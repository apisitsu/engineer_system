/**
 * useCardDetailHandlers.js
 * 
 * Extracted handler hook for CardDetailProvider (Fix §2.3).
 * 
 * All event handlers that were previously plain `const` functions in useCardDetailState
 * are now wrapped in useCallback with explicit dependency arrays, ensuring the
 * useMemo context value only changes when actual dependencies change.
 * 
 * This eliminates cascading re-renders to all context consumers that were caused
 * by handler identity changes on every parent render.
 */

import { useCallback } from 'react';
import { useKanbanStore } from '../store/kanbanStore';
import Swal from 'sweetalert2';

/**
 * @param {object} deps — All reactive values the handlers depend on.
 * Returns an object of stable (useCallback-wrapped) handler functions.
 */
export const useCardDetailHandlers = (deps) => {
    const {
        card, isReadOnly, isCardMember, canEditCard,
        addCardMember, currentUserCode, empNo, theme,
        updateCard, deleteCard, moveCard,
        addComment, createTaskList, updateTaskList, createTask, updateTask,
        addCardLabel, removeCardLabel, addFileAttachment,
        createCardIssue, updateCardIssue,
        // Local state
        editName, setEditName, setIsEditingName,
        editDesc, setIsEditingDesc,
        editProblem, editSolution, editingIssueId,
        setEditingIssueId, setEditProblem, setEditSolution,
        editMemo, setIsEditingMemo,
        editEstimatedHours,
        commentText, setCommentText,
        cardMembers, users, projectManagers,
        newTaskListName, setNewTaskListName, setShowAddTaskList,
        editTaskListName, setEditingTaskListId, taskLists,
        newTaskNames, setNewTaskNames,
        editTaskName, setEditingTaskId,
        editLinkUrl, editLinkName, setEditingLinkId,
        cardLabelIds,
        setShowDueDatePicker, setShowMoveSelect,
        closeCardDetail,
        setIsUploadingFile, fileInputRef,
        setPreviewAttachment, setIsPreviewVisible,
        clearDirty,
    } = deps;

    // ── checkCanEdit ──
    const checkCanEdit = useCallback(async (showWarning = true) => {
        if (!isCardMember) {
            if (canEditCard) {
                try {
                    await addCardMember(card.id, currentUserCode, empNo);
                } catch (err) {
                    console.error('[CardDetail] Auto-join failed:', err);
                    return false;
                }
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
    }, [isCardMember, canEditCard, addCardMember, card?.id, currentUserCode, empNo, theme?.colors?.primary]);

    // ── handleSaveName ──
    const handleSaveName = useCallback(async () => {
        if (!(await checkCanEdit(false))) return;
        try {
            if (editName.trim() && editName !== card.name) {
                await updateCard(card.id, { name: editName.trim() });
            }
        } catch (err) {
            console.error('[CardDetail] Save name failed:', err);
        }
        clearDirty('name');
        setIsEditingName(false);
    }, [checkCanEdit, editName, card?.name, card?.id, updateCard, clearDirty, setIsEditingName]);

    // ── handleSaveDesc ──
    const handleSaveDesc = useCallback(async () => {
        if (isReadOnly) return;
        try {
            if (editDesc !== (card.description || '')) {
                await updateCard(card.id, { description: editDesc });
            }
        } catch (err) {
            console.error('[CardDetail] Save description failed:', err);
        }
        clearDirty('description');
        setIsEditingDesc(false);
    }, [isReadOnly, editDesc, card?.description, card?.id, updateCard, clearDirty, setIsEditingDesc]);

    // ── handleSaveIssue ──
    const handleSaveIssue = useCallback(async () => {
        if (isReadOnly) return;
        try {
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
        } catch (err) {
            console.error('[CardDetail] Save issue failed:', err);
        }
        setEditingIssueId(null);
        setEditProblem('');
        setEditSolution('');
    }, [isReadOnly, editingIssueId, editProblem, editSolution, card?.id, createCardIssue, updateCardIssue, setEditingIssueId, setEditProblem, setEditSolution]);

    // ── handleCancelIssue ──
    const handleCancelIssue = useCallback(() => {
        setEditingIssueId(null);
        setEditProblem('');
        setEditSolution('');
    }, [setEditingIssueId, setEditProblem, setEditSolution]);

    // ── handleSaveMemo ──
    const handleSaveMemo = useCallback(async () => {
        if (isReadOnly) return;
        try {
            if (editMemo !== (card.memo || '')) {
                await updateCard(card.id, { memo: editMemo });
            }
        } catch (err) {
            console.error('[CardDetail] Save memo failed:', err);
        }
        clearDirty('memo');
        setIsEditingMemo(false);
    }, [isReadOnly, editMemo, card?.memo, card?.id, updateCard, clearDirty, setIsEditingMemo]);

    // ── handleSaveEstimatedHours ──
    const handleSaveEstimatedHours = useCallback(async () => {
        if (isReadOnly) return;
        try {
            const val = parseFloat(editEstimatedHours);
            if (!isNaN(val) && val !== (card.estimated_hours || 0)) {
                await updateCard(card.id, { estimated_hours: val });
            }
        } catch (err) {
            console.error('[CardDetail] Save estimated hours failed:', err);
        }
    }, [isReadOnly, editEstimatedHours, card?.estimated_hours, card?.id, updateCard]);

    // ── handleAddComment ──
    const handleAddComment = useCallback(async () => {
        if (!commentText.trim()) return;
        try {
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
        } catch (err) {
            console.error('[CardDetail] Add comment failed:', err);
        }
    }, [commentText, users, card?.id, empNo, addComment, cardMembers, projectManagers, addCardMember, setCommentText]);

    // ── handleDeleteCard ──
    const handleDeleteCard = useCallback(async () => {
        try {
            await deleteCard(card.id);
        } catch (err) {
            console.error('[CardDetail] Delete card failed:', err);
        }
    }, [deleteCard, card?.id]);

    // ── handleMoveCard ──
    const handleMoveCard = useCallback(async (newListId) => {
        try {
            await moveCard(card.id, newListId);
            setShowMoveSelect(false);
            closeCardDetail();
        } catch (err) {
            console.error('[CardDetail] Move card failed:', err);
        }
    }, [moveCard, card?.id, setShowMoveSelect, closeCardDetail]);

    // ── handleAddTaskList ──
    const handleAddTaskList = useCallback(async () => {
        if (!newTaskListName.trim()) return;
        try {
            await createTaskList(card.id, newTaskListName.trim());
            setNewTaskListName('');
            setShowAddTaskList(false);
        } catch (err) {
            console.error('[CardDetail] Add task list failed:', err);
        }
    }, [newTaskListName, card?.id, createTaskList, setNewTaskListName, setShowAddTaskList]);

    // ── handleSaveTaskListName ──
    const handleSaveTaskListName = useCallback(async (tlId) => {
        if (isReadOnly) return;
        try {
            const oldName = taskLists.find(t => t.id === tlId)?.name;
            if (editTaskListName.trim() && editTaskListName !== oldName) {
                await updateTaskList(tlId, { name: editTaskListName.trim() }, card.id);
            }
        } catch (err) {
            console.error('[CardDetail] Save task list name failed:', err);
        }
        setEditingTaskListId(null);
    }, [isReadOnly, taskLists, editTaskListName, card?.id, updateTaskList, setEditingTaskListId]);

    // ── handleAddTask ──
    const handleAddTask = useCallback(async (taskListId) => {
        const name = newTaskNames[taskListId]?.trim();
        if (!name) return;
        try {
            await createTask(taskListId, name, card.id);
            setNewTaskNames(prev => ({ ...prev, [taskListId]: '' }));
        } catch (err) {
            console.error('[CardDetail] Add task failed:', err);
        }
    }, [newTaskNames, card?.id, createTask, setNewTaskNames]);

    // ── handleToggleTask ──
    const handleToggleTask = useCallback(async (task) => {
        try {
            await updateTask(task.id, { is_completed: !task.is_completed }, card.id);
        } catch (err) {
            console.error('[CardDetail] Toggle task failed:', err);
        }
    }, [updateTask, card?.id]);

    // ── handleEditTaskSave ──
    const handleEditTaskSave = useCallback(async (taskId) => {
        if (!editTaskName.trim()) {
            setEditingTaskId(null);
            return;
        }
        try {
            await updateTask(taskId, { name: editTaskName.trim() }, card.id);
        } catch (err) {
            console.error('[CardDetail] Edit task save failed:', err);
        }
        setEditingTaskId(null);
    }, [editTaskName, updateTask, card?.id, setEditingTaskId]);

    // ── handleEditLinkSave ──
    const handleEditLinkSave = useCallback(async (linkId) => {
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

        try {
            await useKanbanStore.getState().updateAttachment(linkId, {
                url: finalUrl,
                name: editLinkName.trim() || finalUrl
            }, card.id);
        } catch (err) {
            console.error('[CardDetail] Edit link save failed:', err);
        }
        setEditingLinkId(null);
    }, [editLinkUrl, editLinkName, card?.id, setEditingLinkId]);

    // ── handleToggleLabel ──
    const handleToggleLabel = useCallback(async (labelId) => {
        const strId = String(labelId);
        try {
            if (cardLabelIds.includes(strId)) {
                await removeCardLabel(card.id, labelId);
            } else {
                await addCardLabel(card.id, labelId);
            }
        } catch (err) {
            console.error('[CardDetail] Toggle label failed:', err);
        }
    }, [cardLabelIds, card?.id, removeCardLabel, addCardLabel]);

    // ── handleSetDueDate ──
    const handleSetDueDate = useCallback(async (date) => {
        try {
            await updateCard(card.id, { due_date: date ? date.toISOString() : null });
            setShowDueDatePicker(false);
        } catch (err) {
            console.error('[CardDetail] Set due date failed:', err);
        }
    }, [updateCard, card?.id, setShowDueDatePicker]);

    // ── handleFileUpload ──
    const handleFileUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingFile(true);
        try {
            await addFileAttachment(card.id, file);
        } catch (err) {
            console.error('[CardDetail] File upload failed:', err);
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [addFileAttachment, card?.id, setIsUploadingFile, fileInputRef]);

    // ── handleAttachmentClick ──
    const handleAttachmentClick = useCallback((att) => {
        setPreviewAttachment(att);
        setIsPreviewVisible(true);
    }, [setPreviewAttachment, setIsPreviewVisible]);

    return {
        checkCanEdit,
        handleSaveName,
        handleSaveDesc,
        handleSaveIssue,
        handleCancelIssue,
        handleSaveMemo,
        handleSaveEstimatedHours,
        handleAddComment,
        handleDeleteCard,
        handleMoveCard,
        handleAddTaskList,
        handleSaveTaskListName,
        handleAddTask,
        handleToggleTask,
        handleEditTaskSave,
        handleEditLinkSave,
        handleToggleLabel,
        handleSetDueDate,
        handleFileUpload,
        handleAttachmentClick,
    };
};

export default useCardDetailHandlers;
