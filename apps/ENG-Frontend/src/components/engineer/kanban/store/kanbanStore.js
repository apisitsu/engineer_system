import { create } from 'zustand';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import { useAuthStore } from '../../../../stores/authStore';

export const useKanbanStore = create((set, get) => ({
    // --- Data State ---
    users: [], // System users from m_user_profile
    projects: [],
    activeProject: null,
    projectManagers: [],
    boards: [],
    activeBoard: null,
    activeBoardMembers: [],

    lists: [],
    cards: {},       // { [listId]: [card1, card2, ...] }
    labels: [],
    activeCardDetail: null, // Full card detail for drawer

    // --- UI State ---
    isLoading: false,
    error: null,
    isCardDetailOpen: false,
    activeCardId: null,
    isProjectSettingsOpen: false,
    isBoardSettingsOpen: false,

    // --- Board Toolbar State ---
    searchQuery: '',
    filterMembers: [],
    filterLabels: [],
    viewMode: 'board', // 'board' | 'list'
    setSearchQuery: (q) => set({ searchQuery: q }),
    toggleFilterMember: (uCode) => set((state) => {
        const current = state.filterMembers;
        if (current.includes(uCode)) {
            return { filterMembers: current.filter(c => c !== uCode) };
        }
        return { filterMembers: [...current, uCode] };
    }),
    setFilterMembers: (arr) => set({ filterMembers: arr }),
    toggleFilterLabel: (labelId) => set((state) => {
        const idStr = String(labelId);
        const current = state.filterLabels;
        if (current.includes(idStr)) {
            return { filterLabels: current.filter(id => id !== idStr) };
        }
        return { filterLabels: [...current, idStr] };
    }),
    setViewMode: (mode) => set({ viewMode: mode }),
    clearFilters: () => set({ searchQuery: '', filterMembers: [], filterLabels: [] }),

    // ====================================================================
    //  GLOBAL USERS
    // ====================================================================
    fetchUsers: async () => {
        try {
            const res = await axios.get(server.KANBAN_USERS);
            set({ users: res.data?.data || [] });
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    },

    // ====================================================================
    //  PROJECT ACTIONS
    // ====================================================================

    fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await axios.get(server.KANBAN_PROJECTS);
            const prjs = res.data?.data || [];
            set({ projects: prjs });
            const currentActive = get().activeProject;
            if (prjs.length > 0) {
                if (!currentActive || !prjs.find(p => p.id === currentActive.id)) {
                    get().setActiveProject(prjs[0]);
                }
            } else {
                set({ activeProject: null, boards: [], activeBoard: null, lists: [], cards: {} });
            }
        } catch (err) {
            set({ error: err.message });
            console.error("Failed to fetch projects", err);
        } finally {
            set({ isLoading: false });
        }
    },

    setActiveProject: (project) => {
        set({ activeProject: project, activeBoard: null, boards: [], lists: [], cards: {}, searchQuery: '', filterMembers: [], filterLabels: [] });
        if (project) {
            get().fetchBoards(project.id);
        }
    },

    createProject: async (data) => {
        try {
            const res = await axios.post(server.KANBAN_PROJECTS, data);
            if (res.data?.data) {
                set(state => ({ projects: [...state.projects, res.data.data] }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create project', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to create project', 'error');
        }
        return null;
    },

    updateProject: async (projectId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_PROJECTS}/${projectId}`, data);
            if (res.data?.data) {
                // Update in local projects list
                set(state => ({
                    projects: state.projects.map(p => p.id === projectId ? { ...p, ...res.data.data } : p),
                    activeProject: state.activeProject?.id === projectId
                        ? { ...state.activeProject, ...res.data.data }
                        : state.activeProject
                }));
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update project', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to update project', 'error');
        }
        return null;
    },

    deleteProject: async (projectId) => {
        try {
            await axios.delete(`${server.KANBAN_PROJECTS}/${projectId}`);
            const projects = get().projects.filter(p => p.id !== projectId);
            set({ projects });
            // If deleted project was active, switch to next
            if (get().activeProject?.id === projectId) {
                if (projects.length > 0) {
                    get().setActiveProject(projects[0]);
                } else {
                    set({ activeProject: null, boards: [], activeBoard: null, lists: [], cards: {} });
                }
            }
            return true;
        } catch (err) {
            console.error('Failed to delete project', err);
            Swal.fire('Error', err.response?.data?.error || 'Failed to delete project', 'error');
            return false;
        }
    },

    toggleFavorite: async (projectId) => {
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/favorite`);
            const isFav = res.data?.is_favorite;
            set(state => ({
                projects: state.projects.map(p =>
                    p.id === projectId ? { ...p, is_favorite: isFav } : p
                ),
                activeProject: state.activeProject?.id === projectId
                    ? { ...state.activeProject, is_favorite: isFav }
                    : state.activeProject
            }));
            return isFav;
        } catch (err) {
            console.error('Failed to toggle favorite', err);
            return null;
        }
    },


    fetchProjectManagers: async (projectId) => {
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/managers`);
            set({ projectManagers: res.data?.data || [] });
        } catch (err) {
            console.error('Failed to fetch project managers', err);
        }
    },

    addProjectManager: async (projectId, uCode) => {
        try {
            await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/managers`, { target_u_code: uCode });
            get().fetchProjectManagers(projectId);
        } catch (err) {
            console.error('Failed to add manager', err);
            Swal.fire('Error', err.response?.data?.error || 'Cannot add manager', 'error');
        }
    },

    removeProjectManager: async (projectId, uCode, force = false) => {
        try {
            const res = await axios.delete(`${server.KANBAN_PROJECTS}/${projectId}/managers`, { data: { target_u_code: uCode, force } });

            if (res.data?.requires_confirmation) {
                const boardNames = res.data.boards.map(b => b.name).join(', ');
                const cardNames = res.data.cards.map(c => c.name).join(', ');

                let htmlMsg = `<div style="text-align: left; font-size: 14px;">สมาชิกคนนี้รับผิดชอบงานอยู่ ดังนี้:<br/>`;
                if (res.data.boards.length > 0) {
                    htmlMsg += `<br/><b>บอร์ด (${res.data.boards.length}):</b> ${boardNames}`;
                }
                if (res.data.cards.length > 0) {
                    htmlMsg += `<br/><b>การ์ด (${res.data.cards.length}):</b> ${cardNames}`;
                }
                htmlMsg += `<br/><br/>หากยืนยัน สมาชิกจะถูกลบออกจากบอร์ดและการ์ดทั้งหมดที่เกี่ยวข้องด้วย</div>`;

                const result = await Swal.fire({
                    title: 'ยืนยันการลบสมาชิกออกจากโปรเจค?',
                    html: htmlMsg,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#aaa',
                    confirmButtonText: 'ยืนยัน ลบทั้งหมด',
                    cancelButtonText: 'ยกเลิก'
                });

                if (result.isConfirmed) {
                    return get().removeProjectManager(projectId, uCode, true);
                }
                return; // User cancelled
            }

            get().fetchProjectManagers(projectId);

            const activeBoard = get().activeBoard;
            if (activeBoard && activeBoard.project_id === projectId) {
                get().fetchBoardMembers(activeBoard.id);
                get().fetchBoardDetails(activeBoard.id);
            }
        } catch (err) {
            console.error('Failed to remove manager', err);
            Swal.fire('Error', err.response?.data?.error || 'Cannot remove manager', 'error');
        }
    },

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
                // Keep active board if it belongs to this project
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
        } finally {
            set({ isLoading: false });
        }
    },

    setActiveBoard: (board) => {
        set({ activeBoard: board, activeBoardMembers: [], lists: [], cards: {} });
        if (board) {
            get().fetchBoardDetails(board.id);
            get().fetchBoardMembers(board.id); // Also fetch members when setting active board
        }
    },

    fetchBoardMembers: async (boardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_BOARDS}/${boardId}/members`);
            set({ activeBoardMembers: res.data?.data || [] });
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

            // Fetch cards for visible lists only (not archive/trash)
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

    fetchBoardMembers: async (boardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_BOARDS}/${boardId}/members`);
            set({ activeBoardMembers: res.data?.data || [] });
        } catch (err) {
            console.error('Failed to fetch board members', err);
        }
    },

    addBoardMember: async (boardId, uCode) => {
        try {
            await axios.post(`${server.KANBAN_BOARDS}/${boardId}/members`, { target_u_code: uCode });
            get().fetchBoardMembers(boardId);
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

    fetchCardsForList: async (listId) => {
        try {
            const res = await axios.get(`${server.KANBAN_LISTS}/${listId}/cards`);
            const cardsData = res.data?.data || [];
            set((state) => ({
                cards: { ...state.cards, [listId]: cardsData }
            }));
        } catch (err) {
            console.error(`Failed to fetch cards for list ${listId}`, err);
        }
    },

    createList: async (boardId, name) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/lists`, { name });
            if (res.data?.data) {
                get().fetchBoardDetails(boardId);
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
    //  CARD ACTIONS
    // ====================================================================

    createCard: async (listId, name, isPrivate = false) => {
        try {
            const res = await axios.post(`${server.KANBAN_LISTS}/${listId}/cards`, { name, is_private: isPrivate });
            if (res.data?.data) {
                get().fetchCardsForList(listId);
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
                set(state => {
                    const newCards = { ...state.cards };
                    // Apply update to board's card list too to keep progress/badges in sync
                    for (const listId in newCards) {
                        const idx = newCards[listId].findIndex(c => c.id === cardId);
                        if (idx >= 0) {
                            newCards[listId] = [...newCards[listId]];
                            newCards[listId][idx] = { ...newCards[listId][idx], ...refreshedCard };
                            break;
                        }
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
                // Update in cards dictionary
                set(state => {
                    const newCards = { ...state.cards };
                    for (const [listId, listCards] of Object.entries(newCards)) {
                        const idx = listCards.findIndex(c => c.id === cardId);
                        if (idx >= 0) {
                            newCards[listId] = [...listCards];
                            newCards[listId][idx] = { ...newCards[listId][idx], ...updatedCard };
                            break;
                        }
                    }
                    return {
                        cards: newCards,
                        activeCardDetail: state.activeCardDetail?.id === cardId
                            ? { ...state.activeCardDetail, ...updatedCard }
                            : state.activeCardDetail
                    };
                });
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
                // Remove card from old list, add to new list
                set(state => {
                    const newCards = { ...state.cards };
                    let movedCard = null;
                    // Remove from old list
                    for (const [listId, listCards] of Object.entries(newCards)) {
                        const idx = listCards.findIndex(c => c.id === cardId);
                        if (idx >= 0) {
                            movedCard = { ...listCards[idx], ...res.data.data };
                            newCards[listId] = listCards.filter(c => c.id !== cardId);
                            break;
                        }
                    }
                    // Add to new list
                    if (movedCard) {
                        newCards[newListId] = [...(newCards[newListId] || []), movedCard];
                    }
                    return { cards: newCards };
                });
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
                // Refresh list to show the new card
                const targetListId = listId || (get().activeCardDetail ? get().activeCardDetail.list_id : null);
                if (targetListId) {
                    get().fetchCardsForList(targetListId);
                } else if (get().activeBoard) {
                    get().fetchBoardDetails(get().activeBoard.id); // fallback
                }
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
            await axios.delete(`${server.KANBAN_CARDS}/${cardId}`);
            set(state => {
                const newCards = { ...state.cards };
                for (const [listId, listCards] of Object.entries(newCards)) {
                    const idx = listCards.findIndex(c => c.id === cardId);
                    if (idx >= 0) {
                        newCards[listId] = listCards.filter(c => c.id !== cardId);
                        break;
                    }
                }
                return {
                    cards: newCards,
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
            return false;
        }
    },

    addCardLabel: async (cardId, labelId) => {
        try {
            await axios.post(`${server.KANBAN_CARDS}/${cardId}/labels`, { label_id: labelId });
            // Refresh card detail
            get().fetchCardDetail(cardId);
            // Also update board state
            set(state => {
                const newCards = { ...state.cards };
                for (const listId in newCards) {
                    const idx = newCards[listId].findIndex(c => c.id === cardId);
                    if (idx >= 0) {
                        const ids = newCards[listId][idx].label_ids || [];
                        if (!ids.includes(labelId) && !ids.includes(String(labelId))) {
                            const updatedCard = { ...newCards[listId][idx], label_ids: [...ids, labelId] };
                            newCards[listId] = [...newCards[listId]];
                            newCards[listId][idx] = updatedCard;
                        }
                        break;
                    }
                }
                return { cards: newCards };
            });
            return true;
        } catch (err) {
            console.error('Failed to add card label', err);
            return false;
        }
    },

    removeCardLabel: async (cardId, labelId) => {
        try {
            await axios.delete(`${server.KANBAN_CARDS}/${cardId}/labels/${labelId}`);
            get().fetchCardDetail(cardId);
            // Also update board state
            set(state => {
                const newCards = { ...state.cards };
                for (const listId in newCards) {
                    const idx = newCards[listId].findIndex(c => c.id === cardId);
                    if (idx >= 0) {
                        const ids = newCards[listId][idx].label_ids || [];
                        const updatedCard = {
                            ...newCards[listId][idx],
                            label_ids: ids.filter(id => id !== labelId && String(id) !== String(labelId))
                        };
                        newCards[listId] = [...newCards[listId]];
                        newCards[listId][idx] = updatedCard;
                        break;
                    }
                }
                return { cards: newCards };
            });
            return true;
        } catch (err) {
            console.error('Failed to remove card label', err);
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
                // Refresh card detail to get updated comments
                get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to add comment', err);
            Swal.fire('Error', 'Failed to add comment', 'error');
        }
        return null;
    },

    // ====================================================================
    //  CARD MEMBERSHIPS
    // ====================================================================

    addCardMember: async (cardId, uCode, ownerUCode) => {
        try {
            await axios.post(`${server.KANBAN_CARDS}/${cardId}/memberships`, { target_u_code: uCode, owner_u_code: ownerUCode });
            get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to add card member', err);
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
            return false;
        }
    },

    deleteComment: async (commentId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_COMMENTS}/${commentId}`);
            if (cardId) get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete comment', err);
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
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create task list', err);
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
        }
        return null;
    },

    createTask: async (taskListId, name, cardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_TASK_LISTS}/${taskListId}/tasks`, { name });
            if (res.data?.data) {
                if (cardId) get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to create task', err);
        }
        return null;
    },

    updateTask: async (taskId, data, cardId) => {
        try {
            const res = await axios.patch(`${server.KANBAN_TASKS}/${taskId}`, data);
            if (res.data?.data) {
                if (cardId) get().fetchCardDetail(cardId);
                return res.data.data;
            }
        } catch (err) {
            console.error('Failed to update task', err);
        }
        return null;
    },

    deleteTask: async (taskId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_TASKS}/${taskId}`);
            if (cardId) get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete task', err);
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
    //  DRAG & DROP REORDER ACTIONS
    // ====================================================================

    reorderList: async (boardId, listId, position) => {
        // Optimistic: will rely on API response to update
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
            // Rollback: re-fetch
            get().fetchBoardDetails(boardId);
        }
    },

    reorderCard: async (cardId, targetListId, position, sourceListId) => {
        try {
            const res = await axios.patch(
                `${server.KANBAN_CARDS}/${cardId}/reorder`,
                { list_id: targetListId, position }
            );
            if (res.data?.data) {
                // Refresh cards for affected lists
                get().fetchCardsForList(targetListId);
                if (sourceListId && String(sourceListId) !== String(targetListId)) {
                    get().fetchCardsForList(sourceListId);
                }
            }
        } catch (err) {
            console.error('Failed to reorder card', err);
            // Rollback: re-fetch both lists
            get().fetchCardsForList(targetListId);
            if (sourceListId) get().fetchCardsForList(sourceListId);
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
    //  WEBSOCKET
    // ====================================================================

    wsSocket: null,

    connectWebSocket: (boardId, uCode) => {
        const existing = get().wsSocket;
        if (existing) {
            existing.emit('board:leave', existing._boardId);
            existing.emit('board:join', boardId);
            existing._boardId = boardId;
            // Optionally join user room again if uCode changed
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
                    // Update active card if it's currently open
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
            socket.on('commentDelete', (data) => {
                // We might just re-fetch the open card detail
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
    //  BOARD SUBSCRIPTION (Feature 6)
    // ====================================================================

    toggleBoardSubscription: async (boardId) => {
        try {
            const res = await axios.post(`${server.KANBAN_BOARDS}/${boardId}/subscription`);
            return res.data;
        } catch (err) {
            console.error('Failed to toggle board subscription', err);
            return null;
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
            return null;
        }
    },

    // ====================================================================
    //  LINK ATTACHMENT (Feature 4)
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
        }
        return null;
    },

    addFileAttachment: async (cardId, file) => {
        try {
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
        } catch (err) {
            console.error('Failed to upload file attachment', err);
            Swal.fire('Error', 'Failed to upload file', 'error');
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
            Swal.fire('Error', err.response?.data?.error || 'Failed to update attachment', 'error');
        }
        return null;
    },

    deleteAttachment: async (attachmentId, cardId) => {
        try {
            await axios.delete(`${server.KANBAN_ATTACHMENTS}/${attachmentId}`);
            if (cardId) get().fetchCardDetail(cardId);
            return true;
        } catch (err) {
            console.error('Failed to delete attachment', err);
            return false;
        }
    },

    // ====================================================================
    //  USER PREFERENCES (Feature 9)
    // ====================================================================

    userPreferences: null,

    fetchUserPreferences: async () => {
        try {
            const res = await axios.get(server.KANBAN_USER_PREFERENCES);
            if (res.data?.data) set({ userPreferences: res.data.data });
            return res.data?.data;
        } catch (err) {
            console.error('Failed to fetch user preferences', err);
            return null;
        }
    },

    updateUserPreferences: async (data) => {
        try {
            const res = await axios.patch(server.KANBAN_USER_PREFERENCES, data);
            if (res.data?.data) set({ userPreferences: res.data.data });
            return res.data?.data;
        } catch (err) {
            console.error('Failed to update user preferences', err);
            return null;
        }
    },

    // ====================================================================
    //  CUSTOM FIELDS (Feature 12)
    // ====================================================================

    customFieldGroups: [],
    baseCustomFieldGroups: [],
    customFields: {},  // { [groupId]: [field1, field2, ...] }

    fetchBaseCustomFieldGroups: async (projectId) => {
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/custom-field-groups`);
            set({ baseCustomFieldGroups: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch base custom field groups', err); }
    },

    createBaseCustomFieldGroup: async (projectId, name) => {
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/custom-field-groups`, { name });
            if (res.data?.data) {
                set(state => ({ baseCustomFieldGroups: [...state.baseCustomFieldGroups, res.data.data] }));
                return res.data.data;
            }
        } catch (err) { console.error('Failed to create base custom field group', err); }
        return null;
    },

    deleteBaseCustomFieldGroup: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_BASE_CUSTOM_FIELD_GROUPS}/${id}`);
            set(state => ({ baseCustomFieldGroups: state.baseCustomFieldGroups.filter(g => g.id !== id) }));
            return true;
        } catch (err) { console.error('Failed to delete group', err); return false; }
    },

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
        } catch (err) { console.error('Failed to create custom field group', err); }
        return null;
    },

    deleteCustomFieldGroup: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_CUSTOM_FIELD_GROUPS}/${id}`);
            set(state => ({ customFieldGroups: state.customFieldGroups.filter(g => g.id !== id) }));
            return true;
        } catch (err) { console.error('Failed to delete custom field group', err); return false; }
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
        } catch (err) { console.error('Failed to create custom field', err); }
        return null;
    },

    updateCustomField: async (fieldId, data) => {
        try {
            const res = await axios.patch(`${server.KANBAN_CUSTOM_FIELDS}/${fieldId}`, data);
            return res.data?.data;
        } catch (err) { console.error('Failed to update custom field', err); return null; }
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
        } catch (err) { console.error('Failed to delete custom field', err); return false; }
    },

    fetchCustomFieldValues: async (cardId) => {
        try {
            const res = await axios.get(`${server.KANBAN_CARDS}/${cardId}/custom-field-values`);
            return res.data?.data || [];
        } catch (err) { console.error('Failed to fetch custom field values', err); return []; }
    },

    upsertCustomFieldValue: async (cardId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_CARDS}/${cardId}/custom-field-values`, data);
            return res.data?.data;
        } catch (err) { console.error('Failed to upsert custom field value', err); return null; }
    },

    // ====================================================================
    //  WEBHOOKS (Feature 13)
    // ====================================================================

    webhooks: [],

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
        } catch (err) { console.error('Failed to create webhook', err); }
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
        } catch (err) { console.error('Failed to update webhook', err); }
        return null;
    },

    deleteWebhook: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_WEBHOOKS}/${id}`);
            set(state => ({ webhooks: state.webhooks.filter(w => w.id !== id) }));
            return true;
        } catch (err) { console.error('Failed to delete webhook', err); return false; }
    },

    // ====================================================================
    //  NOTIFICATION SERVICE (Feature 11)
    // ====================================================================

    notificationServices: [],

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
        } catch (err) { console.error('Failed to create notification service', err); }
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
        } catch (err) { console.error('Failed to update notification service', err); }
        return null;
    },

    deleteNotificationService: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_NOTIFICATION_SERVICES}/${id}`);
            set(state => ({ notificationServices: state.notificationServices.filter(n => n.id !== id) }));
            return true;
        } catch (err) { console.error('Failed to delete notification service', err); return false; }
    },

    // ====================================================================
    //  BACKGROUND IMAGES (Feature 10)
    // ====================================================================

    backgroundImages: [],

    fetchBackgroundImages: async (projectId) => {
        try {
            const res = await axios.get(`${server.KANBAN_PROJECTS}/${projectId}/background-images`);
            set({ backgroundImages: res.data?.data || [] });
        } catch (err) { console.error('Failed to fetch background images', err); }
    },

    uploadBackgroundImage: async (projectId, data) => {
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${projectId}/background-images`, data);
            if (res.data?.data) {
                set(state => ({ backgroundImages: [...state.backgroundImages, res.data.data] }));
                return res.data.data;
            }
        } catch (err) { console.error('Failed to upload background image', err); }
        return null;
    },

    deleteBackgroundImage: async (id) => {
        try {
            await axios.delete(`${server.KANBAN_BACKGROUND_IMAGES}/${id}`);
            set(state => ({ backgroundImages: state.backgroundImages.filter(b => b.id !== id) }));
            return true;
        } catch (err) { console.error('Failed to delete background image', err); return false; }
    },

    // ====================================================================
    //  NOTIFICATIONS (In-App)
    // ====================================================================

    notifications: [],
    unreadNotificationCount: 0,

    fetchNotifications: async () => {
        try {
            const empNo = useAuthStore.getState().empNo || 'LE131';
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
        }
    },

    markAllNotificationsRead: async () => {
        try {
            const empNo = useAuthStore.getState().empNo || 'LE131';
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
            const empNo = useAuthStore.getState().empNo || 'LE131';
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
    //  UI ACTIONS
    // ====================================================================

    openCardDetail: (cardId) => {
        set({ isCardDetailOpen: true, activeCardId: cardId, activeCardDetail: null });
        get().fetchCardDetail(cardId);
    },
    closeCardDetail: () => set({ isCardDetailOpen: false, activeCardId: null, activeCardDetail: null }),

    openProjectSettings: (projectId = null) => set({ isProjectSettingsOpen: true, projectSettingsTargetId: projectId }),
    closeProjectSettings: () => set({ isProjectSettingsOpen: false, projectSettingsTargetId: null }),

    openBoardSettings: () => set({ isBoardSettingsOpen: true }),
    closeBoardSettings: () => set({ isBoardSettingsOpen: false }),

}));
