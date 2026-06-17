/**
 * cardSlice.js
 * Zustand slice for Kanban Card-level state and actions.
 * 
 * Manages: cards, archivedCards, activeCardDetail, card CRUD,
 *          comments, memberships, task lists/tasks, issues,
 *          attachments, custom field values, notifications,
 *          archive, auto-join, card detail UI
 */
import axios from 'axios';
import { server, GAS_DRIVE_URL } from '../../../../constance/constance';
import Swal from 'sweetalert2';
// import { message } from 'antd';
import { useAuthStore } from '../../../../stores/authStore';
import { sendErrorReport } from '../../../../utils/sendEmailViaGAS';
import { uploadFileToDrive, deleteFileFromDrive } from '../../../../utils/uploadFileToDrive';

export const createCardSlice = (set, get) => ({
    // --- Card Data State ---
    cards: {},       // { [listId]: [card1, card2, ...] }
    archivedCards: [],
    activeCardDetail: null,

    // --- Card Detail UI ---
    isCardDetailOpen: false,
    activeCardId: null,

    // --- Notifications (In-App) ---
    notifications: [],
    unreadNotificationCount: 0,
    isFetchingNotifications: false,

    // ====================================================================
    //  CARD CRUD
    // ====================================================================

    fetchCardsForList: async (listId) => {
        try {
            const res = await axios.get(`${server.KANBAN_LISTS}/${listId}/cards`);
            const cardsData = res.data?.data || [];
            set((state) => ({
                cards: { ...state.cards, [listId]: cardsData }
            }));
            // F3-13: Rebuild index after bulk card replacement
            get()._rebuildCardIndex();
        } catch (err) {
            console.error(`Failed to fetch cards for list ${listId}`, err);
        }
    },

    createCard: async (listId, name, isPrivate = false) => {
        try {
            const res = await axios.post(`${server.KANBAN_LISTS}/${listId}/cards`, { name, is_private: isPrivate });
            if (res.data?.data) {
                get().fetchCardsForList(listId);
                get().checkAndAutoJoin('list', listId);
            }
            return res.data?.data;
        } catch (err) {
            console.error('Failed to create card', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to create card', 'error');
            return null;
        }
    },

    fetchCardDetail: async (cardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_CARDS}/${cardId}`);
            if (res.data?.data) {
                const refreshedCard = res.data.data;

                if (refreshedCard.memberships) {
                    refreshedCard.assignees = refreshedCard.memberships.map(m => m.u_code);
                }
                if (refreshedCard.labels) {
                    refreshedCard.label_ids = refreshedCard.labels.map(l => l.id);
                }

                set(state => {
                    const newCards = { ...state.cards };
                    // F3-13: O(1) lookup via cardIndex
                    const loc = get()._findCardList(cardId);
                    if (loc) {
                        newCards[loc.listId] = [...newCards[loc.listId]];
                        newCards[loc.listId][loc.idx] = { ...newCards[loc.listId][loc.idx], ...refreshedCard };
                    }
                    return { activeCardDetail: refreshedCard, cards: newCards };
                });
                return refreshedCard;
            }
        } catch (err) {
            console.error('Failed to fetch card detail', err);
        }
        return null;
    },

    updateCard: async (cardId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_CARDS}/${cardId}`, data);
            if (res.data?.data) {
                const updatedCard = res.data.data;
                set(state => {
                    const newCards = { ...state.cards };
                    // F3-13: O(1) lookup via cardIndex
                    const loc = get()._findCardList(cardId);
                    if (loc) {
                        newCards[loc.listId] = [...newCards[loc.listId]];
                        newCards[loc.listId][loc.idx] = { ...newCards[loc.listId][loc.idx], ...updatedCard };
                    }
                    return {
                        cards: newCards,
                        activeCardDetail: state.activeCardDetail?.id === cardId
                            ? { ...state.activeCardDetail, ...updatedCard }
                            : state.activeCardDetail
                    };
                });
                get().checkAndAutoJoin('card', cardId);
                return updatedCard;
            }
        } catch (err) {
            console.error('Failed to update card', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update card', 'error');
        }
        return null;
    },

    moveCard: async (cardId, newListId) => {
        try {
            const res = await axios.patch(`${server.KANBAN_CARDS}/${cardId}`, { list_id: newListId });
            if (res.data?.data) {
                set(state => {
                    const newCards = { ...state.cards };
                    // F3-13: O(1) lookup via cardIndex
                    const loc = get()._findCardList(cardId);
                    let movedCard = null;
                    if (loc) {
                        movedCard = { ...newCards[loc.listId][loc.idx], ...res.data.data };
                        newCards[loc.listId] = newCards[loc.listId].filter(c => c.id !== cardId);
                    }
                    if (movedCard) {
                        newCards[newListId] = [...(newCards[newListId] || []), movedCard];
                    }
                    // F3-13: Update index — old listId removed, new listId added
                    const newIndex = new Map(state.cardIndex);
                    newIndex.set(String(cardId), String(newListId));
                    return { cards: newCards, cardIndex: newIndex };
                });
                get().checkAndAutoJoin('card', cardId);
                return true;
            }
        } catch (err) {
            console.error('Failed to move card', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to move card', 'error');
        }
        return false;
    },

    duplicateCard: async (cardId, listId) => {
        try {
            const res = await axios.post(`${server.KANBAN_CARDS}/${cardId}/duplicate`, { list_id: listId });
            if (res.data?.data) {
                const targetListId = listId || (get().activeCardDetail ? get().activeCardDetail.list_id : null);
                if (targetListId) {
                    get().fetchCardsForList(targetListId);
                } else if (get().activeBoard) {
                    get().fetchBoardDetails(get().activeBoard.id);
                }
                get().checkAndAutoJoin('card', res.data.data.id);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to duplicate card', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to duplicate card', 'error');
        }
        return null;
    },

    deleteCard: async (cardId) => {
        try {
            // First, delete Google Drive attachments from the frontend to ensure auth context
            const loc = get()._findCardList(cardId);
            const card = loc ? get().cards[loc.listId][loc.idx] : get().activeCardDetail;
            if (card && card.attachments) {
                // deleteFileFromDrive is imported statically at the top
                for (const att of card.attachments) {
                    if (att.drive_file_id) {
                        try {
                            await deleteFileFromDrive(att.drive_file_id);
                        } catch (err) {
                            console.warn('Failed to delete Drive file from frontend:', att.drive_file_id, err);
                        }
                    }
                }
            }

            await axios.delete(`${server.KANBAN_CARDS}/${cardId}`);
            set(state => {
                const newCards = { ...state.cards };
                // F3-13: O(1) lookup via cardIndex
                const loc = get()._findCardList(cardId);
                if (loc) {
                    newCards[loc.listId] = newCards[loc.listId].filter(c => c.id !== cardId);
                }
                // F3-13: Remove from index
                const newIndex = new Map(state.cardIndex);
                newIndex.delete(String(cardId));
                return {
                    cards: newCards,
                    cardIndex: newIndex,
                    isCardDetailOpen: state.activeCardId === cardId ? false : state.isCardDetailOpen,
                    activeCardId: state.activeCardId === cardId ? null : state.activeCardId,
                    activeCardDetail: state.activeCardDetail?.id === cardId ? null : state.activeCardDetail
                };
            });
            return true;
        } catch (err) {
            console.error('Failed to delete card', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete card', 'error');
            return false;
        }
    },

    reorderCard: async (cardId, targetListId, position, sourceListId) => {
        try {
            const res = await axios.patch(
                `${server.KANBAN_CARDS}/${cardId}/reorder`,
                { list_id: targetListId, position }
            );
            if (res.data?.data) {
                get().fetchCardsForList(targetListId);
                if (sourceListId && String(sourceListId) !== String(targetListId)) {
                    get().fetchCardsForList(sourceListId);
                }
                get().checkAndAutoJoin('card', cardId);
            }
        } catch (err) {
            console.error('Failed to reorder card', err);
            if (err.response?.status === 400 || err.response?.status === 403) {
                Swal.fire('การดำเนินการถูกปฏิเสธ', err.response?.data?.error || 'Validation failed. Action not allowed.', 'error');
            } else {
                Swal.fire('เกิดข้อผิดพลาด', 'Failed to move card', 'error');
            }
            get().fetchCardsForList(targetListId);
            if (sourceListId) get().fetchCardsForList(sourceListId);
        }
    },

    // ====================================================================
    //  ARCHIVE ACTIONS
    // ====================================================================

    archiveCard: async (cardId) => {
        const board = get().activeBoard;
        if (!board) return false;
        const archiveList = get().lists.find(l => l.list_type === 'archive');
        if (!archiveList) {
            Swal.fire('Error', 'Archive list not found for this board', 'error');
            return false;
        }

        return await get().moveCard(cardId, archiveList.id);
    },

    archiveListCards: async (listId) => {
        const board = get().activeBoard;
        if (!board) return false;
        const archiveList = get().lists.find(l => l.list_type === 'archive');
        if (!archiveList) return false;

        const listCards = get().cards[listId] || [];
        if (listCards.length === 0) return true;

        try {
            await Promise.all(listCards.map(c =>
                axios.patch(`${server.KANBAN_CARDS}/${c.id}`, { list_id: archiveList.id })
            ));

            set(state => {
                const newCards = { ...state.cards };
                newCards[listId] = [];
                return { cards: newCards };
            });

            if (get().archivedCards?.length > 0) {
                get().fetchArchivedCards();
            }
            return true;
        } catch (err) {
            console.error('Failed to archive list cards', err);
            Swal.fire('Error', 'Failed to archive cards', 'error');
            return false;
        }
    },

    fetchArchivedCards: async () => {
        const board = get().activeBoard;
        if (!board) return;
        const archiveList = get().lists.find(l => l.list_type === 'archive');
        if (!archiveList) return;

        try {
            const res = await axios.get(`${server.KANBAN_LISTS}/${archiveList.id}/cards`);
            const archivedCards = res.data?.data || [];
            set({ archivedCards });
        } catch (err) {
            console.error(`Failed to fetch archived cards`, err);
        }
    },

    // ====================================================================
    //  CARD LABELS
    // ====================================================================

    addCardLabel: async (cardId, labelId) => {
        try {
            await axios.post(`${server.KANBAN_CARDS}/${cardId}/labels`, { label_id: labelId });
            get().fetchCardDetail(cardId);
            set(state => {
                const newCards = { ...state.cards };
                // F3-13: O(1) lookup via cardIndex
                const loc = get()._findCardList(cardId);
                if (loc) {
                    const ids = newCards[loc.listId][loc.idx].label_ids || [];
                    if (!ids.includes(labelId) && !ids.includes(String(labelId))) {
                        newCards[loc.listId] = [...newCards[loc.listId]];
                        newCards[loc.listId][loc.idx] = { ...newCards[loc.listId][loc.idx], label_ids: [...ids, labelId] };
                    }
                }
                return { cards: newCards };
            });
            get().checkAndAutoJoin('card', cardId);
            return true;
        } catch (err) {
            console.error('Failed to add card label', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถเพิ่ม label ได้', 'error');
            return false;
        }
    },

    removeCardLabel: async (cardId, labelId) => {
        try {
            await axios.delete(`${server.KANBAN_CARDS}/${cardId}/labels/${labelId}`);
            get().fetchCardDetail(cardId);
            set(state => {
                const newCards = { ...state.cards };
                // F3-13: O(1) lookup via cardIndex
                const loc = get()._findCardList(cardId);
                if (loc) {
                    const ids = newCards[loc.listId][loc.idx].label_ids || [];
                    newCards[loc.listId] = [...newCards[loc.listId]];
                    newCards[loc.listId][loc.idx] = {
                        ...newCards[loc.listId][loc.idx],
                        label_ids: ids.filter(id => id !== labelId && String(id) !== String(labelId))
                    };
                }
                return { cards: newCards };
            });
            return true;
        } catch (err) {
            console.error('Failed to remove card label', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถลบ label ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  COMMENT ACTIONS
    // ====================================================================

    addComment: async (cardId, text, ownerUCode) => {
        try {
            const res = await axios.post(`${server.KANBAN_CARDS}/${cardId}/comments`, { content: text, owner_u_code: ownerUCode });
            if (res.data?.data) {
                get().fetchCardDetail(cardId);
                get().checkAndAutoJoin('card', cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to add comment', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถเพิ่มคอมเมนต์ได้', 'error');
        }
        return null;
    },

    deleteComment: async (commentId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_COMMENTS}/${commentId}`);
            if (cardId) get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete comment', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถลบคอมเมนต์ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  CARD MEMBERSHIPS
    // ====================================================================

    addCardMember: async (cardId, uCode, ownerUCode) => {
        try {
            await axios.post(`${server.KANBAN_CARDS}/${cardId}/memberships`, { target_u_code: uCode, owner_u_code: ownerUCode });
            get().fetchCardDetail(cardId);
            get().checkAndAutoJoin('card', cardId);
            return true;
        } catch (err) {
            console.error('Failed to add card member', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถเพิ่มสมาชิกได้', 'error');
            return false;
        }
    },

    removeCardMember: async (cardId, uCode, ownerUCode) => {
        try {
            await axios.delete(`${server.KANBAN_CARDS}/${cardId}/memberships`, { data: { target_u_code: uCode, owner_u_code: ownerUCode } });
            get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to remove card member', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถลบสมาชิกได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  TASK LIST / TASK ACTIONS
    // ====================================================================

    createTaskList: async (cardId, name) => {
        try {
            const res = await axios.post(`${server.KANBAN_CARDS}/${cardId}/task-lists`, { name });
            if (res.data?.data) {
                get().fetchCardDetail(cardId);
                get().checkAndAutoJoin('card', cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create task list', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถสร้าง checklist ได้', 'error');
        }
        return null;
    },

    updateTaskList: async (taskListId, data, cardId) => {
        try {
            const res = await axios.patch(`${server.KANBAN_TASK_LISTS}/${taskListId}`, data);
            if (res.data?.data) {
                if (cardId) get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update task list', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถแก้ไข checklist ได้', 'error');
        }
        return null;
    },

    deleteTaskList: async (taskListId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_TASK_LISTS}/${taskListId}`);
            if (cardId) get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete task list', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถลบ checklist ได้', 'error');
            return false;
        }
    },

    createTask: async (taskListId, name, cardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_TASK_LISTS}/${taskListId}/tasks`, { name });
            if (res.data?.data) {
                if (cardId) await get().fetchCardDetail(cardId);
                get().checkAndAutoJoin('card', cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create task', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถสร้าง task ได้', 'error');
        }
        return null;
    },

    updateTask: async (taskId, data, cardId) => {
        try {
            const res = await axios.patch(`${server.KANBAN_TASKS}/${taskId}`, data);
            if (res.data?.data) {
                if (cardId) await get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update task', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถแก้ไข task ได้', 'error');
        }
        return null;
    },

    deleteTask: async (taskId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_TASKS}/${taskId}`);
            if (cardId) await get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete task', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถลบ task ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  CARD ISSUE ACTIONS
    // ====================================================================

    createCardIssue: async (cardId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_CARDS}/${cardId}/issues`, data);
            if (res.data?.data) {
                get().fetchCardDetail(cardId);
                get().checkAndAutoJoin('card', cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create card issue', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to create issue', 'error');
        }
        return null;
    },

    updateCardIssue: async (issueId, data, cardId) => {
        try {
            const res = await axios.patch(`${server.KANBAN_ISSUES}/${issueId}`, data);
            if (res.data?.data) {
                get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update card issue', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update issue', 'error');
        }
        return null;
    },

    deleteCardIssue: async (issueId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_ISSUES}/${issueId}`);
            get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete card issue', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete issue', 'error');
            return false;
        }
    },

    // ====================================================================
    //  ATTACHMENT ACTIONS
    // ====================================================================

    addLinkAttachment: async (cardId, url, name) => {
        try {
            const res = await axios.post(
                `${server.KANBAN_CARDS}/${cardId}/attachments`,
                { attachment_type: 'link', url, name: name || url },
                { headers: { 'Content-Type': 'application/json' } }
            );
            if (res.data?.data) {
                get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to add link attachment', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถเพิ่มลิงก์ได้', 'error');
        }
        return null;
    },

    addFileAttachment: async (cardId, file, popup) => {
        try {
            // ── Step 1: Upload to Google Drive via GAS popup ──
            if (GAS_DRIVE_URL) {
                const { activeProject, activeBoard } = get();
                const projectId = activeProject?.id || 0;
                const boardId = activeBoard?.id || 0;

                const gasResult = await uploadFileToDrive(file, {
                    projectId, boardId, cardId,
                }, { popup });

                // ── Step 2: Send Drive metadata to backend for DB storage ──
                const res = await axios.post(
                    `${server.KANBAN_CARDS}/${cardId}/attachments`,
                    {
                        drive_file_id: gasResult.fileId,
                        drive_folder_path: gasResult.folderPath,
                        file_name: file.name,
                        file_size: file.size,
                        mime_type: file.type || 'application/octet-stream',
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                if (res.data?.data) {
                    get().fetchCardDetail(cardId);
                    return res.data.data;
                }
            } else {
                // Fallback: legacy multipart upload to local storage
                const formData = new FormData();
                formData.append('file', file);
                const res = await axios.post(
                    `${server.KANBAN_CARDS}/${cardId}/attachments`,
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                );
                if (res.data?.data) {
                    get().fetchCardDetail(cardId);
                    return res.data.data;
                }
            }
        } catch (err) {
            console.error('Failed to upload file attachment', err);
            Swal.fire('Error', err?.message || err?.response?.data?.error || 'ไม่สามารถอัปโหลดไฟล์ได้', 'error');
        }
        return null;
    },

    updateAttachment: async (attachmentId, data, cardId) => {
        try {
            const res = await axios.patch(`${server.KANBAN_ATTACHMENTS}/${attachmentId}`, data);
            if (res.data?.data) {
                if (cardId) get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update attachment', err);
            Swal.fire('Error', err.response?.data?.error || 'ไม่สามารถแก้ไข attachment ได้', 'error');
        }
        return null;
    },

    deleteAttachment: async (attachmentId, cardId) => {
        try {
            // Find the attachment to get drive_file_id
            const loc = get()._findCardList(cardId);
            const card = loc ? get().cards[loc.listId][loc.idx] : get().activeCardDetail;
            let driveFileId = null;
            if (card && card.attachments) {
                const att = card.attachments.find(a => a.id === attachmentId);
                if (att && att.drive_file_id) {
                    driveFileId = att.drive_file_id;
                }
            }

            // Show loading state
            Swal.fire({
                title: 'Deleting attachment...',
                text: 'Waiting for Google Drive confirmation',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // 1. Delete from Google Drive if it's a Drive file
            if (driveFileId) {
                // deleteFileFromDrive is imported statically at the top
                await deleteFileFromDrive(driveFileId);
            }

            // 2. Delete from Database
            await axios.delete(`${server.KANBAN_ATTACHMENTS}/${attachmentId}`);
            if (cardId) get().fetchCardDetail(cardId);
            Swal.close();
            return true;
        } catch (err) {
            Swal.close();
            console.error('Failed to delete attachment', err);
            const status = err.response?.status;
            const errMsg = err.response?.data?.error || 'ไม่สามารถลบ attachment ได้';
            Swal.fire('Error', errMsg, 'error');
            // Send error report for 403 (permission) errors
            if (status === 403) {
                const auth = useAuthStore.getState();
                sendErrorReport('deleteAttachment', err, {
                    attachmentId, cardId,
                    user: auth.empNo,
                });
            }
            return false;
        }
    },

    // ====================================================================
    //  CUSTOM FIELD VALUES (per card)
    // ====================================================================

    fetchCustomFieldValues: async (cardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_CARDS}/${cardId}/custom-field-values`);
            return res.data?.data || [];
        } catch (err) {
            console.error('Failed to fetch custom field values', err);
            return [];
        }
    },

    upsertCustomFieldValue: async (cardId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_CARDS}/${cardId}/custom-field-values`, data);
            if (res.data?.data) {
                await get().fetchCardDetail(cardId);
            }
            return res.data?.data;
        } catch (err) {
            console.error('Failed to upsert custom field value', err);
            Swal.fire('Error', 'ไม่สามารถบันทึกค่า custom field ได้', 'error');
            return null;
        }
    },

    // ====================================================================
    //  ACTIVITY LOG
    // ====================================================================

    fetchCardActions: async (cardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_CARDS}/${cardId}/actions`);
            return res.data?.data || [];
        } catch (err) {
            console.error('Failed to fetch card actions', err);
            return [];
        }
    },

    // ====================================================================
    //  NOTIFICATIONS (In-App)
    // ====================================================================

    fetchNotifications: async () => {
        try {
            const empNo = useAuthStore.getState().empNo;
            if (!empNo || get().isFetchingNotifications) {
                console.warn('[Auth/Guard] Skipping notification fetch (No user or already fetching)');
                return [];
            }
            set({ isFetchingNotifications: true });
            const res = await axios.get(server.KANBAN_NOTIFICATIONS, {
                params: { owner_u_code: empNo }
            });
            const data = res.data?.data || [];
            const unread = data.filter(n => !n.is_read).length;
            set({ notifications: data, unreadNotificationCount: unread });
            return data;
        } catch (err) {
            console.error('Failed to fetch notifications', err);
            return [];
        } finally {
            set({ isFetchingNotifications: false });
        }
    },

    markAllNotificationsRead: async () => {
        try {
            const empNo = useAuthStore.getState().empNo;
            if (!empNo) {
                console.warn('[Auth] No authenticated user — skipping mark-all-read');
                return false;
            }
            await axios.patch(`${server.KANBAN_NOTIFICATIONS}/read-all`, { owner_u_code: empNo });
            set(state => ({
                notifications: state.notifications.map(n => ({ ...n, is_read: true })),
                unreadNotificationCount: 0
            }));
            return true;
        } catch (err) {
            console.error('Failed to mark notifications as read', err);
            return false;
        }
    },

    markNotificationRead: async (id) => {
        try {
            const empNo = useAuthStore.getState().empNo;
            if (!empNo) {
                console.warn('[Auth] No authenticated user — skipping mark-read');
                return false;
            }
            const res = await axios.patch(`${server.KANBAN_NOTIFICATIONS}/${id}/read`, { owner_u_code: empNo });
            if (res.data?.data) {
                set(state => {
                    const nextNotifs = state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
                    return {
                        notifications: nextNotifs,
                        unreadNotificationCount: nextNotifs.filter(n => !n.is_read).length
                    };
                });
                return true;
            }
        } catch (err) {
            console.error('Failed to mark notification as read', err);
            return false;
        }
    },

    // ====================================================================
    //  CARD UI ACTIONS
    // ====================================================================

    openCardDetail: (cardId) => {
        set({ isCardDetailOpen: true, activeCardId: cardId, activeCardDetail: null });
        get().fetchCardDetail(cardId);
    },
    closeCardDetail: () => set({ isCardDetailOpen: false, activeCardId: null, activeCardDetail: null }),

    // ====================================================================
    //  AUTO-MEMBERSHIP FOR ADMINS (Elevated tracking)
    // ====================================================================

    checkAndAutoJoin: async (type, targetId) => {
        const auth = useAuthStore.getState();
        const uCode = auth.empNo;
        if (!uCode) return;

        const role = (auth.userRole || '').toUpperCase();
        const dept = (auth.userDepartment || '').toUpperCase();
        const isAD = role === 'AD' || dept === 'AD';
        const isMgr = ['MGR', 'COORD'].includes(role);

        const { activeProject, projectManagers, activeBoard, activeBoardMembers, activeCardDetail } = get();

        const isProjectOwner = projectManagers.some(m => m.u_code === uCode && m.role === 'owner');
        const isProjectEditor = projectManagers.some(m => m.u_code === uCode && m.role === 'editor');

        // Only for AD, MGR, and Project Managers (Owner/Editor)
        if (!isAD && !isMgr && !isProjectOwner && !isProjectEditor) return;

        // MGR/COORD only auto-joins Public projects. AD joins everything.
        if (isMgr && activeProject?.is_private) return;

        try {
            // Level 1: Hierarchy -> Ensure Project Membership
            if (activeProject && projectManagers && projectManagers.length > 0 && !projectManagers.some(m => m.u_code === uCode)) {
                await axios.post(`${server.KANBAN_PROJECTS}/${activeProject.id}/managers`, { target_u_code: uCode, role: 'editor' });
                get().fetchProjectManagers(activeProject.id);
            }

            // Level 2: Hierarchy -> Ensure Board Membership (if doing board/list/card actions)
            if (['board', 'list', 'card'].includes(type) && activeBoard && activeBoardMembers && activeBoardMembers.length > 0) {
                if (!activeBoardMembers.some(m => m.u_code === uCode)) {
                    await axios.post(`${server.KANBAN_BOARDS}/${activeBoard.id}/members`, { target_u_code: uCode, role: 'editor' });
                    get().fetchBoardMembers(activeBoard.id);
                }
            }

            // Level 3: Hierarchy -> Ensure Card Membership (only for card actions)
            if (type === 'card' && targetId) {
                const members = activeCardDetail?.id === targetId ? (activeCardDetail.memberships || []) : [];
                const isMember = members.some(m => (m.u_code || m) === uCode);
                if (!isMember) {
                    await axios.post(`${server.KANBAN_CARDS}/${targetId}/memberships`, { target_u_code: uCode, owner_u_code: uCode });
                }
            }
        } catch (err) {
            console.warn(`[AutoJoin] Failed for ${type}:`, err.response?.data?.error || err.message);
        }
    },
});
