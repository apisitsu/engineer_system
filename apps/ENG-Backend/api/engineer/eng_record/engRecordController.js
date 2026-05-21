// ============================================================
// Engineer Record Controller — HTTP Handlers
// ============================================================
const model = require('./engRecordModel');
const service = require('./engRecordService');
const syncService = require('./engRecordSync');
const { QUICK_TEMPLATES } = require('./engRecordConstants');

// ─── GET /api/engineer/eng-record ──────────────────────────

const getRecords = async (req, res) => {
    try {
        const { page = 1, pageSize = 50, sortField, sortOrder, ...filterParams } = req.query;

        let filters = {};
        if (filterParams.filters) {
            try {
                filters = JSON.parse(filterParams.filters);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid filters JSON' });
            }
        }

        const sorter = sortField ? { field: sortField, order: sortOrder || 'descend' } : null;

        const result = await model.getRecords({
            filters,
            sorter,
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
        });

        res.json(result);
    } catch (err) {
        console.error('Error in engRecordController.getRecords:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/dashboard ────────────────

const getDashboard = async (req, res) => {
    try {
        const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
        const result = await service.getDashboard(year);
        res.json(result);
    } catch (err) {
        console.error('Error in engRecordController.getDashboard:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/monthly-summary ──────────

const getMonthlySummary = async (req, res) => {
    try {
        const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
        const result = await model.getMonthlyBreakdown(year);
        res.json(result);
    } catch (err) {
        console.error('Error in engRecordController.getMonthlySummary:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/filter-options/:column ───

const getFilterOptions = async (req, res) => {
    try {
        const { column } = req.params;
        const result = await model.getFilterOptions(column);
        res.json(result);
    } catch (err) {
        console.error('Error in engRecordController.getFilterOptions:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/templates ────────────────

const getTemplates = async (req, res) => {
    try {
        res.json(QUICK_TEMPLATES);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/engineer/eng-record/compute-cutoff ──────────

const computeCutoff = async (req, res) => {
    try {
        const { head_dia, total_length } = req.body;
        const result = service.computeCutoffSpec(head_dia, total_length);
        if (!result) return res.status(400).json({ error: 'Invalid input values' });
        res.json({ judge_revise: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/:id ──────────────────────

const getMrpInfo = async (req, res) => {
    try {
        const { lot_no } = req.params;
        const result = await model.getMrpInfo(lot_no);
        if (!result) return res.json({ cn: '', pn: '' });
        res.json(result);
    } catch (err) {
        console.error('Error in engRecordController.getMrpInfo:', err.message);
        res.status(500).json({ error: err.message });
    }
};

const getRecordById = async (req, res) => {
    try {
        const record = await model.getRecordById(parseInt(req.params.id, 10));
        if (!record) return res.status(404).json({ error: 'Record not found' });
        res.json(record);
    } catch (err) {
        console.error('Error in engRecordController.getRecordById:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/engineer/eng-record ─────────────────────────

const createRecord = async (req, res) => {
    try {
        const user = req.user || {};
        const permLevel = service.getUserPermissionLevel(user);

        if (permLevel === 'viewer') {
            return res.status(403).json({ error: 'Insufficient permissions to create records' });
        }

        const payload = service.filterCreatePayload(req.body, permLevel);
        if (!payload) {
            return res.status(403).json({ error: 'Insufficient permissions for this operation' });
        }

        if (!payload.record_no) {
            payload.record_no = await model.getNextRecordNo();
        }

        payload.created_by = user.empno || user.id || 'unknown';
        payload.updated_by = payload.created_by;

        if (permLevel === 'submitter' && !payload.request_by) {
            payload.request_by = 'PC/MC';
        }

        const record = await model.createRecord(payload);
        res.status(201).json(record);
    } catch (err) {
        console.error('Error in engRecordController.createRecord:', err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Record number already exists' });
        }
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/engineer/eng-record/:id ──────────────────────

const updateRecord = async (req, res) => {
    try {
        const user = req.user || {};
        const permLevel = service.getUserPermissionLevel(user);

        if (permLevel === 'viewer' || permLevel === 'submitter') {
            return res.status(403).json({ error: 'Insufficient permissions to update records' });
        }

        const payload = service.filterUpdatePayload(req.body, permLevel);
        if (!payload) {
            return res.status(403).json({ error: 'Insufficient permissions for this operation' });
        }

        payload.updated_by = user.empno || user.id || 'unknown';

        const record = await model.updateRecord(parseInt(req.params.id, 10), payload);
        if (!record) return res.status(404).json({ error: 'Record not found' });

        res.json(record);
    } catch (err) {
        console.error('Error in engRecordController.updateRecord:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /api/engineer/eng-record/:id/finish ───────────────

const finishRecord = async (req, res) => {
    try {
        const user = req.user || {};
        const permLevel = service.getUserPermissionLevel(user);

        if (permLevel === 'viewer' || permLevel === 'submitter') {
            return res.status(403).json({ error: 'Only engineers and admins can finish records' });
        }

        const id = parseInt(req.params.id, 10);
        const existing = await model.getRecordById(id);
        if (!existing) return res.status(404).json({ error: 'Record not found' });

        if (existing.finish_date) {
            return res.status(400).json({ error: 'Record is already finished' });
        }

        // VBA: sFirst = Left(sName, InStr(1, sName, " ") - 1)
        const userName = user.u_name || user.full_name || user.u_code || user.empno || 'unknown';
        const firstName = userName.includes(' ') ? userName.split(' ')[0] : userName;
        const today = new Date().toISOString().split('T')[0];

        const tsFlag = service.computeTsFlag({
            ...existing,
            finish_date: today,
        });

        const payload = {
            judgment_by: firstName,
            finish_date: today,
            ts_flag: tsFlag,
            updated_by: user.empno || user.id || 'unknown',
        };

        const record = await model.updateRecord(id, payload);
        res.json(record);
    } catch (err) {
        console.error('Error in engRecordController.finishRecord:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/engineer/eng-record/:id ───────────────────

const deleteRecord = async (req, res) => {
    try {
        const user = req.user || {};
        const permLevel = service.getUserPermissionLevel(user);

        if (permLevel !== 'admin') {
            return res.status(403).json({ error: 'Only administrators can delete records' });
        }

        const success = await model.deleteRecord(parseInt(req.params.id, 10));
        if (!success) return res.status(404).json({ error: 'Record not found' });

        res.json({ success: true });
    } catch (err) {
        console.error('Error in engRecordController.deleteRecord:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/engineer/eng-record/sync ────────────────────

const syncFromExcel = async (req, res) => {
    try {
        const user = req.user || {};
        const permLevel = service.getUserPermissionLevel(user);

        if (permLevel !== 'admin' && permLevel !== 'engineer') {
            return res.status(403).json({ error: 'Only engineers and admins can trigger sync' });
        }

        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded. Please upload an Excel file.' });
        }

        const file = req.files.file;
        const userId = user.empno || user.id || 'sync';

        const result = await syncService.syncFromExcel(file.data, file.name, userId);
        res.json(result);
    } catch (err) {
        console.error('Error in engRecordController.syncFromExcel:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/sync/status ──────────────

const getSyncStatus = async (req, res) => {
    try {
        const logs = await model.getSyncLogs(20);
        res.json(logs);
    } catch (err) {
        console.error('Error in engRecordController.getSyncStatus:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/engineer/eng-record/permissions ──────────────

const getPermissions = async (req, res) => {
    try {
        const user = req.user || {};
        const permLevel = service.getUserPermissionLevel(user);
        res.json({
            level: permLevel,
            canCreate: ['admin', 'engineer', 'submitter'].includes(permLevel),
            canUpdate: ['admin', 'engineer'].includes(permLevel),
            canDelete: permLevel === 'admin',
            canSync: ['admin', 'engineer'].includes(permLevel),
            canFinish: ['admin', 'engineer'].includes(permLevel),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getRecords,
    getDashboard,
    getMonthlySummary,
    getFilterOptions,
    getMrpInfo,
    getTemplates,
    computeCutoff,
    getRecordById,
    createRecord,
    updateRecord,
    finishRecord,
    deleteRecord,
    syncFromExcel,
    getSyncStatus,
    getPermissions,
};
