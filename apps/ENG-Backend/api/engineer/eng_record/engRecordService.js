// ============================================================
// Engineer Record Service — Business Logic & KPI Computation
// ============================================================
const model = require('./engRecordModel');
const { PERMISSIONS } = require('./engRecordConstants');

// ─── RBAC Permission Check ────────────────────────────────

/**
 * Determine user's permission level for the Eng Record module.
 * Returns: 'admin' | 'engineer' | 'submitter' | 'viewer'
 */
function getUserPermissionLevel(user) {
    if (!user) return 'viewer';

    const dept = user.department || user.u_department || '';
    const role = user.role || user.u_role || '';

    // Admin / Manager / Coordinator → full access
    if (PERMISSIONS.ADMIN.includes(role) || PERMISSIONS.ADMIN.includes(dept)) {
        return 'admin';
    }

    // Engineer → can update judge/revise fields
    if (PERMISSIONS.ENGINEER.includes(dept)) {
        return 'engineer';
    }

    // PC/MC → submit + read-only
    if (PERMISSIONS.SUBMITTER.includes(dept)) {
        return 'submitter';
    }

    return 'viewer';
}

/**
 * Filter the update payload based on permission level.
 * PC/MC users can only create, not update.
 * Engineers can update judge/revise/reason/judgment_by/finish_date/responsible/remark/comment.
 * Admin can update everything.
 */
function filterUpdatePayload(data, permissionLevel) {
    if (permissionLevel === 'admin') {
        return data; // full access
    }

    if (permissionLevel === 'engineer') {
        // Engineers can update engineering-specific fields
        const allowed = [
            'judge_revise', 'reason', 'judgment_by', 'finish_date',
            'responsible', 'confirm_codi', 'remark', 'comment', 'ts_flag',
            'plan_start_date', 'updated_by'
        ];
        const filtered = {};
        for (const key of allowed) {
            if (data[key] !== undefined) {
                filtered[key] = data[key];
            }
        }
        return filtered;
    }

    // submitter and viewer cannot update
    return null;
}

/**
 * Filter the create payload based on permission level.
 * PC/MC can submit: request_date, lot_no, cn, pn, plant, case_type, spec_problem
 */
function filterCreatePayload(data, permissionLevel) {
    if (permissionLevel === 'admin' || permissionLevel === 'engineer') {
        return data; // full access
    }

    if (permissionLevel === 'submitter') {
        // PC/MC can only fill request fields, not engineering judgment fields
        const allowed = [
            'request_date', 'request_by', 'lot_no', 'cn', 'pn', 'plant',
            'case_type', 'spec_problem', 'plan_start_date', 'created_by'
        ];
        const filtered = {};
        for (const key of allowed) {
            if (data[key] !== undefined) {
                filtered[key] = data[key];
            }
        }
        return filtered;
    }

    return null;
}

// ─── Dashboard Service ────────────────────────────────────

async function getDashboard(year) {
    const [stats, monthly, years] = await Promise.all([
        model.getDashboardStats(year),
        model.getMonthlyBreakdown(year),
        model.getAvailableYears(),
    ]);

    // Compute derived KPIs
    const totalRecords = parseInt(stats.total_records || 0);
    const finishedCount = parseInt(stats.finished_count || 0);
    const finishedRatio = totalRecords > 0 ? (finishedCount / totalRecords) : 0;

    return {
        summary: {
            total_records: totalRecords,
            waiting_count: parseInt(stats.waiting_count || 0),
            finished_count: finishedCount,
            finished_ratio: Math.round(finishedRatio * 10000) / 100, // percent with 2 decimals
            avg_finish_days: parseFloat(stats.avg_finish_days || 0),
            max_finish_days: parseInt(stats.max_finish_days || 0),
            max_waiting_days: parseInt(stats.max_waiting_days || 0),
            already_pass_due: parseInt(stats.already_pass_due || 0),
            waiting_on_due: parseInt(stats.waiting_on_due || 0),
            blue_tag_0_1_day: parseInt(stats.blue_tag_0_1_day || 0),
            blue_tag_lt_1_week: parseInt(stats.blue_tag_lt_1_week || 0),
            case_breakdown: {
                request_drawing: parseInt(stats.case_request_drawing || 0),
                judgment_spec: parseInt(stats.case_judgment_spec || 0),
                change_dwg: parseInt(stats.case_change_dwg || 0),
                dwg_problem: parseInt(stats.case_dwg_problem || 0),
                special: parseInt(stats.case_special || 0),
            },
        },
        monthly,
        available_years: years,
        year: year || new Date().getFullYear(),
    };
}

// ─── Finished Macro Logic (ts_flag computation) ───────────

/**
 * Compute the ts_flag value based on VBA Finished macro logic.
 * Module1.bas lines 17-55:
 *   - Request Drawing: compares finish_date vs plan_start_date → ALRD PASS DUE / ON DUE / PASS DUE
 *   - Judgment Spec: compares finish_date vs request_date+1 → fast/slow blue-tag
 */
function computeTsFlag(record) {
    const { case_type, request_date, finish_date, plan_start_date } = record;

    if (!finish_date || !request_date) return null;

    const fDate = new Date(finish_date);
    const rDate = new Date(request_date);

    if (case_type === 'Request Drawing' && plan_start_date) {
        const pDate = new Date(plan_start_date);
        if (pDate < rDate) {
            return 'ALRD PASS DUE';   // plan_start_date already passed before request
        } else if (fDate <= pDate) {
            return 'ON DUE';           // finished before or on due date
        } else {
            return 'PASS DUE';         // finished after due date
        }
    }

    if (case_type === 'Judgment Spec') {
        // VBA: If finish_date > receive_date + 1 Then "Too sad :(" Else "You're so fast! :D"
        const dayAfterRequest = new Date(rDate);
        dayAfterRequest.setDate(dayAfterRequest.getDate() + 1);

        if (fDate > dayAfterRequest) {
            return 'Too sad :(';
        } else {
            return "You're so fast! :D";
        }
    }

    return null;
}

/**
 * Compute the cut-off spec value for the "No Cut-off Spec" template.
 * VBA CommandButton3: If (head_dia * 3) > total_length → L = total_length + 0.5, else L = total_length + 2
 */
function computeCutoffSpec(headDia, totalLength) {
    const hd = parseFloat(headDia);
    const tl = parseFloat(totalLength);
    if (isNaN(hd) || isNaN(tl)) return null;

    const cutoffLength = (hd * 3) > tl ? (tl + 0.5) : (tl + 2);
    return `Revise by hand on D1 L=${cutoffLength}`;
}

// ─── Export Helpers ────────────────────────────────────────

module.exports = {
    getUserPermissionLevel,
    filterUpdatePayload,
    filterCreatePayload,
    getDashboard,
    computeTsFlag,
    computeCutoffSpec,
};
