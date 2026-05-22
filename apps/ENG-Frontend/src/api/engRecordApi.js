// ============================================================
// Engineer Record API Client
// ============================================================
import { httpClient } from '../utils/HttpClient';

const BASE = '/api/engineer/eng-record';

const engRecordApi = {
    // Dashboard & Summary
    getDashboard: (year) =>
        httpClient.get(`${BASE}/dashboard`, { params: { year } }),

    getMonthlySummary: (year) =>
        httpClient.get(`${BASE}/monthly-summary`, { params: { year } }),

    getPermissions: () =>
        httpClient.get(`${BASE}/permissions`),

    getFilterOptions: (column) =>
        httpClient.get(`${BASE}/filter-options/${column}`),

    // Templates
    getTemplates: () =>
        httpClient.get(`${BASE}/templates`),

    getMrpInfo: (lot_no) =>
        httpClient.get(`${BASE}/mrp/${lot_no}`),

    computeCutoff: (head_dia, total_length) =>
        httpClient.post(`${BASE}/compute-cutoff`, { head_dia, total_length }),

    // CRUD
    getRecords: ({ page, pageSize, sortField, sortOrder, filters }) =>
        httpClient.get(BASE, {
            params: {
                page,
                pageSize,
                sortField,
                sortOrder,
                filters: filters ? JSON.stringify(filters) : undefined,
            },
        }),

    getRecordById: (id) =>
        httpClient.get(`${BASE}/${id}`),

    createRecord: (data) =>
        httpClient.post(BASE, data),

    updateRecord: (id, data) =>
        httpClient.put(`${BASE}/${id}`, data),

    finishRecord: (id) =>
        httpClient.put(`${BASE}/${id}/finish`),

    deleteRecord: (id) =>
        httpClient.delete(`${BASE}/${id}`),

    // Sync
    syncFromExcel: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return httpClient.post(`${BASE}/sync`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        });
    },

    getSyncStatus: () =>
        httpClient.get(`${BASE}/sync/status`),
};

export default engRecordApi;
