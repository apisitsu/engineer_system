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
    //  COMPOSE SLICES
    // ====================================================================
    ...createProjectSlice(set, get),
    ...createBoardSlice(set, get),
    ...createCardSlice(set, get),
}));
