/**
 * kanbanStore.js
 * 
 * Hub file that composes all Kanban slices into a single Zustand store.
 * All existing imports of `useKanbanStore` from this file continue to work
 * without any changes in consuming components.
 * 
 * Slices:
 *   - projectSlice.js  → Projects, managers, background images, base custom fields
 *   - boardSlice.js    → Boards, lists, labels, members, WebSocket, custom fields, webhooks
 *   - cardSlice.js     → Cards, archive, comments, tasks, issues, attachments, notifications
 */
import { create } from 'zustand';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { createProjectSlice } from './projectSlice';
import { createBoardSlice } from './boardSlice';
import { createCardSlice } from './cardSlice';

export const useKanbanStore = create((set, get) => ({
    // ====================================================================
    //  SHARED STATE (used across slices)
    // ====================================================================

    // --- Loading & Error ---
    isLoading: false,
    error: null,

    // --- Global Users ---
    users: [],

    // --- System Settings ---
    systemSettings: [],

    // --- Card Index (F3-13: O(1) lookup) ---
    // Map<string(cardId), string(listId)> — maintained by card mutations
    cardIndex: new Map(),

    /**
     * Rebuild the full cardIndex from the current `cards` state.
     * Called after bulk replacements (board init, project switch, fetchCardsForList).
     */
    _rebuildCardIndex: () => {
        const cards = get().cards;
        const idx = new Map();
        for (const [listId, listCards] of Object.entries(cards)) {
            if (Array.isArray(listCards)) {
                for (const card of listCards) {
                    idx.set(String(card.id), String(listId));
                }
            }
        }
        set({ cardIndex: idx });
    },

    /**
     * O(1) lookup: returns { listId, idx } for a given cardId,
     * or null if the card is not in the current board's state.
     */
    _findCardList: (cardId) => {
        const strId = String(cardId);
        const listId = get().cardIndex.get(strId);
        if (!listId) return null;
        const listCards = get().cards[listId];
        if (!listCards) return null;
        const idx = listCards.findIndex(c => String(c.id) === strId);
        if (idx < 0) return null;
        return { listId, idx };
    },

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

    fetchSystemSettings: async () => {
        try {
            const res = await axios.get(server.KANBAN_SETTINGS);
            set({ systemSettings: res.data?.data || [] });
        } catch (err) {
            console.error("Failed to fetch system settings", err);
        }
    },

    // ====================================================================
    //  COMPOSE SLICES
    // ====================================================================
    ...createProjectSlice(set, get),
    ...createBoardSlice(set, get),
    ...createCardSlice(set, get),
}));
