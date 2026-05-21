// ============================================================
// Engineer Record Zustand Store
// ============================================================
import { create } from 'zustand';
import engRecordApi from '../api/engRecordApi';

const useEngRecordStore = create((set, get) => ({
    // ─── State ────────────────────────────────────────────
    records: [],
    total: 0,
    page: 1,
    pageSize: 10,
    loading: false,
    filters: {},
    sorter: null,

    // Dashboard
    dashboard: null,
    dashboardYear: new Date().getFullYear(),
    dashboardLoading: false,

    // Permissions
    permissions: null,

    // Sync
    syncLogs: [],
    syncLoading: false,

    // Detail
    selectedRecord: null,
    drawerOpen: false,
    formModalOpen: false,
    editingRecord: null,

    // Quick Create
    quickCreateOpen: false,
    templates: [],
    templateData: null, // Pre-filled data from selected template

    // ─── Actions ──────────────────────────────────────────

    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    setFilters: (filters) => set({ filters, page: 1 }),
    setSorter: (sorter) => set({ sorter }),
    setDashboardYear: (year) => set({ dashboardYear: year }),

    // Table records
    fetchRecords: async () => {
        const { page, pageSize, sorter, filters } = get();
        set({ loading: true });
        try {
            const res = await engRecordApi.getRecords({
                page,
                pageSize,
                sortField: sorter?.field,
                sortOrder: sorter?.order,
                filters,
            });
            const result = res.data;
            set({
                records: result.data,
                total: result.total,
                page: result.page,
                pageSize: result.pageSize,
            });
        } catch (err) {
            console.error('Failed to fetch records:', err);
        } finally {
            set({ loading: false });
        }
    },

    // Dashboard
    fetchDashboard: async (year) => {
        const targetYear = year || get().dashboardYear;
        set({ dashboardLoading: true });
        try {
            const res = await engRecordApi.getDashboard(targetYear);
            set({ dashboard: res.data, dashboardYear: targetYear });
        } catch (err) {
            console.error('Failed to fetch dashboard:', err);
        } finally {
            set({ dashboardLoading: false });
        }
    },

    // Permissions
    fetchPermissions: async () => {
        try {
            const res = await engRecordApi.getPermissions();
            set({ permissions: res.data });
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        }
    },

    // Templates
    fetchTemplates: async () => {
        try {
            const res = await engRecordApi.getTemplates();
            set({ templates: res.data });
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        }
    },

    // Record CRUD
    createRecord: async (data) => {
        const res = await engRecordApi.createRecord(data);
        await get().fetchRecords();
        return res.data;
    },

    updateRecord: async (id, data) => {
        const res = await engRecordApi.updateRecord(id, data);
        await get().fetchRecords();
        return res.data;
    },

    finishRecord: async (id) => {
        const res = await engRecordApi.finishRecord(id);
        await get().fetchRecords();
        return res.data;
    },

    deleteRecord: async (id) => {
        await engRecordApi.deleteRecord(id);
        await get().fetchRecords();
    },

    // Detail drawer
    openDrawer: (record) => set({ selectedRecord: record, drawerOpen: true }),
    closeDrawer: () => set({ drawerOpen: false, selectedRecord: null }),

    // Form modal
    openFormModal: (record = null) => set({ editingRecord: record, formModalOpen: true }),
    closeFormModal: () => set({ formModalOpen: false, editingRecord: null, templateData: null }),

    // Quick create modal
    openQuickCreate: () => set({ quickCreateOpen: true }),
    closeQuickCreate: () => set({ quickCreateOpen: false }),
    applyTemplate: (template) => {
        // Pre-fill form data from template and open the form modal
        const prefill = {
            case_type: template.case_type,
            request_by: template.request_by,
            spec_problem: template.spec_problem,
            judge_revise: template.judge_revise,
            reason: template.reason,
        };
        set({
            quickCreateOpen: false,
            templateData: prefill,
            editingRecord: null,
            formModalOpen: true,
        });
    },

    // Sync
    syncFromExcel: async (file) => {
        set({ syncLoading: true });
        try {
            const res = await engRecordApi.syncFromExcel(file);
            await get().fetchSyncLogs();
            return res.data;
        } catch (err) {
            console.error('Sync failed:', err);
            throw err;
        } finally {
            set({ syncLoading: false });
        }
    },

    fetchSyncLogs: async () => {
        try {
            const res = await engRecordApi.getSyncStatus();
            set({ syncLogs: res.data });
        } catch (err) {
            console.error('Failed to fetch sync logs:', err);
        }
    },
}));

export default useEngRecordStore;
