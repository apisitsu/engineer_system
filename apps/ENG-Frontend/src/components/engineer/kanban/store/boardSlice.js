/**
 * boardSlice.js
 * Zustand slice for Kanban Board-level state and actions.
 * 
 * Manages: boards, activeBoard, activeBoardMembers, lists, labels,
 *          customFieldGroups, webhooks, notificationServices,
 *          userPreferences, WebSocket, boardSettings UI
 */
import axios from 'axios';
import { server } from '../../../../constance/constance';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import { useAuthStore } from '../../../../stores/authStore';

export const createBoardSlice = (set, get) => ({
    // --- Board Data State ---
    boards: [],
    activeBoard: null,
    activeBoardMembers: [],
    lists: [],
    labels: [],

    // --- Board Settings UI ---
    isBoardSettingsOpen: false,

    // --- User Preferences (Feature 9) ---
    userPreferences: null,
    kanbanTabOrder: ['dashboard', 'projects', 'reports', 'workload'],
    boardTabOrders: {}, // { [projectId]: [boardId1, boardId2] }
    cfGroupPreferences: {}, // { [projectId]: { order: [], hidden: [] } }
    boardGroups: {}, // { [projectId]: [{ id: string, name: string, boardIds: number[] }] }
    activeBoardGroup: {}, // { [projectId]: groupId | null }



    // --- Custom Field Groups (Board-level, Feature 12) ---
    customFieldGroups: [],
    customFields: {},  // { [groupId]: [field1, field2, ...] }

    // --- Webhooks (Feature 13) ---
    webhooks: [],

    // --- Notification Services (Feature 11) ---
    notificationServices: [],

    // --- WebSocket ---
    wsSocket: null,

    // ====================================================================
    //  BOARD ACTIONS
    // ====================================================================

    fetchBoards: async (projectId) => {
        set({ isLoading: true, error: null });
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/boards`);
            const boards = res.data?.data || [];
            set({ boards });
            if (boards.length > 0) {
                const currentActive = get().activeBoard;
                if (!currentActive || !boards.find(b => b.id === currentActive.id)) {
                    get().setActiveBoard(boards[0]);
                } else {
                    get().fetchBoardMembers(currentActive.id);
                }
            } else {
                set({ activeBoard: null, activeBoardMembers: [], lists: [], cards: {} });
            }
        } catch (err) {
            set({ error: err.message });
            console.error('Failed to fetch boards', err);
            Swal.fire('Error', 'ไม่สามารถโหลดรายการบอร์ดได้', 'error');
        } finally {
            set({ isLoading: false });
        }
    },

    setActiveBoard: (board) => {
        const current = get().activeBoard;
        if (current && board && current.id === board.id) {
            if (get().lists.length === 0) {
                get().fetchBoardDetails(board.id);
                get().fetchBoardMembers(board.id);
            }
            return;
        }

        set({ activeBoard: board, activeBoardMembers: [], lists: [], cards: {} });
        if (board) {
            get().fetchBoardDetails(board.id);
            get().fetchBoardMembers(board.id);
        }
    },

    fetchBoardMembers: async (boardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_BOARDS}/${boardId}/members`);
            const members = res.data?.data || [];
            set({ activeBoardMembers: members });
        } catch (err) {
            console.error('Failed to fetch board members', err);
            set({ activeBoardMembers: [] });
        }
    },

    updateBoard: async (boardId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_BOARDS}/${boardId}`, data);
            if (res.data?.data) {
                set(state => ({
                    boards: state.boards.map(b => b.id === boardId ? { ...b, ...res.data.data } : b),
                    activeBoard: state.activeBoard?.id === boardId
                        ? { ...state.activeBoard, ...res.data.data }
                        : state.activeBoard
                }));
                get().checkAndAutoJoin('board', boardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update board', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update board', 'error');
        }
        return null;
    },

    deleteBoard: async (boardId) => {
        try {
            await axios.delete(`${server.KANBAN_BOARDS}/${boardId}`);
            const projectId = get().activeProject?.id;
            if (projectId) {
                get().fetchBoards(projectId);
                get().checkAndAutoJoin('project', projectId);
            }
            return true;
        } catch (err) {
            console.error('Failed to delete board', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete board', 'error');
            return false;
        }
    },

    // ====================================================================
    //  BOARD DETAILS (Lists, Labels)
    // ====================================================================

    fetchBoardDetails: async (boardId) => {
        set({ isLoading: true });
        try {
            // eslint-disable-next-line no-unused-vars
            const [_boardRes, listsRes, labelsRes] = await Promise.all([
                axios.get(`${server.KANBAN_BOARDS}/${boardId}`),
                axios.get(`${server.KANBAN_BOARDS}/${boardId}/lists`),
                axios.get(`${server.KANBAN_BOARDS}/${boardId}/labels`)
            ]);

            const fetchedLists = listsRes.data?.data || [];
            set({ lists: fetchedLists, labels: labelsRes.data?.data || [] });

            const visibleLists = fetchedLists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
            visibleLists.forEach(list => get().fetchCardsForList(list.id));
        } catch (err) {
            console.error("Failed to fetch board details", err);
            Swal.fire('Error', 'Failed to load board details', 'error');
        } finally {
            set({ isLoading: false });
        }
    },

    // ====================================================================
    //  BOARD MEMBERSHIPS
    // ====================================================================

    addBoardMember: async (boardId, uCode, role) => {
        try {
            const payload = { target_u_code: uCode };
            if (role) payload.role = role;
            await axios.post(`${server.KANBAN_BOARDS}/${boardId}/members`, payload);
            get().fetchBoardMembers(boardId);
            get().checkAndAutoJoin('board', boardId);
        } catch (err) {
            console.error('Failed to add board member', err);
            Swal.fire('Error', err.response?.data?.error || 'Cannot add board member', 'error');
        }
    },

    removeBoardMember: async (boardId, uCode) => {
        try {
            await axios.delete(`${server.KANBAN_BOARDS}/${boardId}/members`, { data: { target_u_code: uCode } });
            get().fetchBoardMembers(boardId);
        } catch (err) {
            console.error('Failed to remove board member', err);
            Swal.fire('Error', err.response?.data?.error || 'Cannot remove board member', 'error');
        }
    },

    // ====================================================================
    //  LIST ACTIONS
    // ====================================================================

    createList: async (boardId, name) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/lists`, { name });
            if (res.data?.data) {
                get().fetchBoardDetails(boardId);
                get().checkAndAutoJoin('board', boardId);
            }
            return res.data?.data;
        } catch (err) {
            console.error('Failed to create list', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to create list', 'error');
            return null;
        }
    },

    updateList: async (listId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_LISTS}/${listId}`, data);
            if (res.data?.data) {
                set(state => ({
                    lists: state.lists.map(l => l.id === listId ? { ...l, ...res.data.data } : l)
                }));
                get().checkAndAutoJoin('list', listId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update list', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update list', 'error');
        }
        return null;
    },

    deleteList: async (listId) => {
        try {
            await axios.delete(`${server.KANBAN_LISTS}/${listId}`);
            set(state => ({
                lists: state.lists.filter(l => l.id !== listId),
                cards: (() => { const c = { ...state.cards }; delete c[listId]; return c; })()
            }));
            return true;
        } catch (err) {
            console.error('Failed to delete list', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete list', 'error');
            return false;
        }
    },

    // ====================================================================
    //  LABEL ACTIONS
    // ====================================================================

    createLabel: async (boardId, name, color) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/labels`, { name, color });
            if (res.data?.data) {
                set(state => ({ labels: [...state.labels, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create label', err);
            Swal.fire('Error', 'ไม่สามารถสร้าง label ได้', 'error');
        }
        return null;
    },

    updateLabel: async (labelId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_LABELS}/${labelId}`, data);
            if (res.data?.data) {
                set(state => ({
                    labels: state.labels.map(l => l.id === labelId ? { ...l, ...res.data.data } : l)
                }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update label', err);
            Swal.fire('Error', 'ไม่สามารถแก้ไข label ได้', 'error');
        }
        return null;
    },

    deleteLabel: async (labelId) => {
        try {
            await axios.delete(`${server.KANBAN_LABELS}/${labelId}`);
            set(state => ({
                labels: state.labels.filter(l => l.id !== labelId)
            }));
            return true;
        } catch (err) {
            console.error('Failed to delete label', err);
            Swal.fire('Error', 'ไม่สามารถลบ label ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  DRAG & DROP REORDER ACTIONS
    // ====================================================================

    reorderList: async (boardId, listId, position) => {
        try {
            const res = await axios.patch(
                `${server.KANBAN_BOARDS}/${boardId}/lists/reorder`,
                { list_id: listId, position }
            );
            if (res.data?.data) {
                set({ lists: res.data.data });
            }
        } catch (err) {
            console.error('Failed to reorder list', err);
            get().fetchBoardDetails(boardId);
        }
    },

    // ====================================================================
    //  LIST SORT (Feature 7)
    // ====================================================================

    sortListCards: async (listId, sortBy, sortOrder) => {
        try {
            const res = await axios.post(`${server.KANBAN_LISTS}/${listId}/sort`, { sort_by: sortBy, sort_order: sortOrder });
            if (res.data?.data) {
                set(state => ({
                    cards: { ...state.cards, [listId]: res.data.data }
                }));
            }
            return res.data?.data;
        } catch (err) {
            console.error('Failed to sort list cards', err);
            Swal.fire('Error', 'ไม่สามารถเรียงลำดับการ์ดได้', 'error');
            return null;
        }
    },

    // ====================================================================
    //  BOARD SUBSCRIPTION (Feature 6)
    // ====================================================================

    toggleBoardSubscription: async (boardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/subscription`);
            return res.data;
        } catch (err) {
            console.error('Failed to toggle board subscription', err);
            Swal.fire('Error', 'ไม่สามารถเปลี่ยนสถานะการติดตามบอร์ดได้', 'error');
            return null;
        }
    },

    // ====================================================================
    //  USER PREFERENCES (Feature 9)
    // ====================================================================

    fetchUserPreferences: async () => {
        try {
            const res = await axios.get(server.KANBAN_USER_PREFERENCES);
            if (res.data?.data) {
                const prefs = res.data.data;
                set({ userPreferences: prefs });
                if (prefs.kanban_tab_order) {
                    set({ kanbanTabOrder: prefs.kanban_tab_order });
                }
                if (prefs.board_tab_orders) {
                    set({ boardTabOrders: prefs.board_tab_orders });
                }
                if (prefs.cf_group_preferences) {
                    set({ cfGroupPreferences: prefs.cf_group_preferences });
                }
                if (prefs.board_groups) {
                    set({ boardGroups: prefs.board_groups });
                }
                if (prefs.active_board_group) {
                    set({ activeBoardGroup: prefs.active_board_group });
                }
            }
            return res.data?.data;
        } catch (err) {
            console.error('Failed to fetch user preferences', err);
            return null;
        }
    },

    updateUserPreferences: async (data) => {
        try {
            const res = await axios.patch(server.KANBAN_USER_PREFERENCES, data);
            if (res.data?.data) {
                const prefs = res.data.data;
                set({ userPreferences: prefs });
                if (prefs.kanban_tab_order) {
                    set({ kanbanTabOrder: prefs.kanban_tab_order });
                }
                if (prefs.board_tab_orders) {
                    set({ boardTabOrders: prefs.board_tab_orders });
                }
                if (prefs.cf_group_preferences) {
                    set({ cfGroupPreferences: prefs.cf_group_preferences });
                }
                if (prefs.board_groups) {
                    set({ boardGroups: prefs.board_groups });
                }
                if (prefs.active_board_group) {
                    set({ activeBoardGroup: prefs.active_board_group });
                }

            }
            return res.data?.data;
        } catch (err) {
            console.error('Failed to update user preferences', err);
            Swal.fire('Error', 'ไม่สามารถบันทึกการตั้งค่าได้', 'error');
            return null;
        }
    },

    setKanbanTabOrder: async (newOrder) => {
        set({ kanbanTabOrder: newOrder });
        await get().updateUserPreferences({ kanban_tab_order: newOrder });
    },

    setBoardTabOrder: async (projectId, newOrder) => {
        const current = get().boardTabOrders;
        const updated = { ...current, [projectId]: newOrder };
        set({ boardTabOrders: updated });
        await get().updateUserPreferences({ board_tab_orders: updated });
    },

    setCfGroupPreference: async (projectId, data) => {
        const current = get().cfGroupPreferences || {};
        const updated = { ...current, [projectId]: { ...(current[projectId] || {}), ...data } };
        set({ cfGroupPreferences: updated });
        await get().updateUserPreferences({ cf_group_preferences: updated });
    },

    setBoardGroups: async (projectId, groups) => {
        const current = get().boardGroups || {};
        const updated = { ...current, [projectId]: groups };
        set({ boardGroups: updated });
        await get().updateUserPreferences({ board_groups: updated });
    },

    setActiveBoardGroup: async (projectId, groupId) => {
        const current = get().activeBoardGroup || {};
        const updated = { ...current, [projectId]: groupId };
        set({ activeBoardGroup: updated });
        await get().updateUserPreferences({ active_board_group: updated });
    },




    // ====================================================================
    //  CUSTOM FIELD GROUPS (Board-level, Feature 12)
    // ====================================================================

    fetchCustomFieldGroups: async (boardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_BOARDS}/${boardId}/custom-field-groups`);
            set({ customFieldGroups: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch custom field groups', err); }
    },

    createCustomFieldGroup: async (boardId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/custom-field-groups`, data);
            if (res.data?.data) {
                set(state => ({ customFieldGroups: [...state.customFieldGroups, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create custom field group', err);
            Swal.fire('Error', 'ไม่สามารถสร้างกลุ่ม custom field ได้', 'error');
        }
        return null;
    },

    deleteCustomFieldGroup: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_CUSTOM_FIELD_GROUPS}/${id}`);
            set(state => ({ customFieldGroups: state.customFieldGroups.filter(g => g.id !== id) }));
            return true;
        } catch (err) {
            console.error('Failed to delete custom field group', err);
            Swal.fire('Error', 'ไม่สามารถลบกลุ่ม custom field ได้', 'error');
            return false;
        }
    },

    fetchCustomFields: async (groupId) => {
        try {
            const res = await axios.get(`${server.KANBAN_BASE_CUSTOM_FIELD_GROUPS}/${groupId}/custom-fields`);
            set(state => ({
                customFields: { ...state.customFields, [groupId]: res.data?.data || [] }
            }));
        } catch (err) { console.error('Failed to fetch custom fields', err); }
    },

    createCustomField: async (groupId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_BASE_CUSTOM_FIELD_GROUPS}/${groupId}/custom-fields`, data);
            if (res.data?.data) {
                set(state => ({
                    customFields: {
                        ...state.customFields,
                        [groupId]: [...(state.customFields[groupId] || []), res.data.data]
                    }
                }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create custom field', err);
            Swal.fire('Error', 'ไม่สามารถสร้าง custom field ได้', 'error');
        }
        return null;
    },

    updateCustomField: async (fieldId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_CUSTOM_FIELDS}/${fieldId}`, data);
            return res.data?.data;
        } catch (err) {
            console.error('Failed to update custom field', err);
            Swal.fire('Error', 'ไม่สามารถแก้ไข custom field ได้', 'error');
            return null;
        }
    },

    deleteCustomField: async (fieldId, groupId) => {
        try {
            await axios.delete(`${server.KANBAN_CUSTOM_FIELDS}/${fieldId}`);
            set(state => ({
                customFields: {
                    ...state.customFields,
                    [groupId]: (state.customFields[groupId] || []).filter(f => f.id !== fieldId)
                }
            }));
            return true;
        } catch (err) {
            console.error('Failed to delete custom field', err);
            Swal.fire('Error', 'ไม่สามารถลบ custom field ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  WEBHOOKS (Feature 13)
    // ====================================================================

    fetchWebhooks: async (boardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_BOARDS}/${boardId}/webhooks`);
            set({ webhooks: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch webhooks', err); }
    },

    createWebhook: async (boardId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/webhooks`, data);
            if (res.data?.data) {
                set(state => ({ webhooks: [...state.webhooks, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create webhook', err);
            Swal.fire('Error', 'ไม่สามารถสร้าง webhook ได้', 'error');
        }
        return null;
    },

    updateWebhook: async (id, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_WEBHOOKS}/${id}`, data);
            if (res.data?.data) {
                set(state => ({
                    webhooks: state.webhooks.map(w => w.id === id ? { ...w, ...res.data.data } : w)
                }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update webhook', err);
            Swal.fire('Error', 'ไม่สามารถแก้ไข webhook ได้', 'error');
        }
        return null;
    },

    deleteWebhook: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_WEBHOOKS}/${id}`);
            set(state => ({ webhooks: state.webhooks.filter(w => w.id !== id) }));
            return true;
        } catch (err) {
            console.error('Failed to delete webhook', err);
            Swal.fire('Error', 'ไม่สามารถลบ webhook ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  NOTIFICATION SERVICE (Feature 11)
    // ====================================================================

    fetchNotificationServices: async () => {
        try {
            const res = await axios.get(server.KANBAN_NOTIFICATION_SERVICES);
            set({ notificationServices: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch notification services', err); }
    },

    createNotificationService: async (data) => {
        try {
            const res = await axios.post(server.KANBAN_NOTIFICATION_SERVICES, data);
            if (res.data?.data) {
                set(state => ({ notificationServices: [...state.notificationServices, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create notification service', err);
            Swal.fire('Error', 'ไม่สามารถสร้าง notification service ได้', 'error');
        }
        return null;
    },

    updateNotificationService: async (id, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_NOTIFICATION_SERVICES}/${id}`, data);
            if (res.data?.data) {
                set(state => ({
                    notificationServices: state.notificationServices.map(n => n.id === id ? { ...n, ...res.data.data } : n)
                }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update notification service', err);
            Swal.fire('Error', 'ไม่สามารถแก้ไข notification service ได้', 'error');
        }
        return null;
    },

    deleteNotificationService: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_NOTIFICATION_SERVICES}/${id}`);
            set(state => ({ notificationServices: state.notificationServices.filter(n => n.id !== id) }));
            return true;
        } catch (err) {
            console.error('Failed to delete notification service', err);
            Swal.fire('Error', 'ไม่สามารถลบ notification service ได้', 'error');
            return false;
        }
    },

    // ====================================================================
    //  WEBSOCKET
    // ====================================================================

    connectWebSocket: (boardId, uCode) => {
        const existing = get().wsSocket;
        if (existing) {
            existing.emit('board:leave', existing._boardId);
            existing.emit('board:join', boardId);
            existing._boardId = boardId;
            if (uCode && existing._uCode !== uCode) {
                if (existing._uCode) existing.emit('user:leave', existing._uCode);
                existing.emit('user:join', uCode);
                existing._uCode = uCode;
            }
            return;
        }

        try {
            const wsUrl = server.KANBAN_PROJECTS.replace('/api/kanban/projects', '');
            const socket = io(wsUrl, { path: '/ws', transports: ['websocket', 'polling'] });

            socket._boardId = boardId;
            socket._uCode = uCode;
            socket.on('connect', () => {
                socket.emit('board:join', boardId);
                if (uCode) socket.emit('user:join', uCode);
            });

            // Real-time event handlers
            socket.on('cardUpdate', (data) => {
                const lists = get().lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
                lists.forEach(list => get().fetchCardsForList(list.id));
                if (data?.id && get().activeCardDetail?.id === data.id) {
                    get().fetchCardDetail(data.id);
                }
            });
            socket.on('cardCreate', () => {
                const lists = get().lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
                lists.forEach(list => get().fetchCardsForList(list.id));
            });
            socket.on('cardDelete', () => {
                const lists = get().lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
                lists.forEach(list => get().fetchCardsForList(list.id));
            });
            socket.on('listUpdate', (data) => {
                if (data?.lists) set({ lists: data.lists });
            });
            // Comment WebSockets
            socket.on('commentCreate', (data) => {
                if (data?.item?.card_id) {
                    if (get().activeCardDetail?.id === data.item.card_id) {
                        get().fetchCardDetail(data.item.card_id);
                    }
                }
            });
            socket.on('commentUpdate', (data) => {
                if (data?.item?.card_id) {
                    if (get().activeCardDetail?.id === data.item.card_id) {
                        get().fetchCardDetail(data.item.card_id);
                    }
                }
            });
            socket.on('commentDelete', () => {
                if (get().activeCardDetail) {
                    get().fetchCardDetail(get().activeCardDetail.id);
                }
            });
            // Notification WebSockets
            socket.on('notificationCreate', (notif) => {
                set(state => {
                    const newNotifs = [notif, ...state.notifications];
                    const count = newNotifs.filter(n => !n.is_read).length;
                    return { notifications: newNotifs, unreadNotificationCount: count };
                });
            });

            set({ wsSocket: socket });
        } catch (err) {
            console.warn('[WS] Failed to connect WebSocket:', err.message);
        }
    },

    disconnectWebSocket: () => {
        const socket = get().wsSocket;
        if (socket) {
            socket.disconnect();
            set({ wsSocket: null });
        }
    },

    // ====================================================================
    //  BOARD UI ACTIONS
    // ====================================================================

    openBoardSettings: () => set({ isBoardSettingsOpen: true }),
    closeBoardSettings: () => set({ isBoardSettingsOpen: false }),
});
