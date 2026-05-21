// ============================================================
// Engineer Record Sync — Excel Parser & Upsert Logic
// ============================================================
const XLSX = require('xlsx');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const model = require('./engRecordModel');
const { EXCEL_COL_MAP } = require('./engRecordConstants');

/**
 * Parse an Excel file buffer and sync records to PostgreSQL.
 * Filters out empty rows, generates row hashes for dedup, and upserts.
 *
 * @param {Buffer} fileBuffer - The Excel file content
 * @param {string} fileName - Original file name
 * @param {string} userId - User triggering the sync
 * @returns {Object} Sync result summary
 */
async function syncFromExcel(fileBuffer, fileName, userId) {
    const batchId = uuidv4();
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Create sync log entry
    await model.createSyncLog({ batch_id: batchId, file_name: fileName, file_hash: fileHash });

    const counters = { total: 0, created: 0, updated: 0, skipped: 0 };

    try {
        // Parse Excel
        const wb = XLSX.read(fileBuffer, { type: 'buffer' });
        const ws = wb.Sheets['Detail'];
        if (!ws) {
            throw new Error('Sheet "Detail" not found in workbook');
        }

        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Process rows (skip header at index 0)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows — must have record_no and at least one other field
            const recordNo = row[0];
            if (recordNo === '' || recordNo === null || recordNo === undefined) continue;
            if (typeof recordNo !== 'number') continue;

            const hasData = row.slice(1, 22).some(
                cell => cell !== '' && cell !== null && cell !== undefined
            );
            if (!hasData) continue;

            counters.total++;

            // Map Excel columns to DB fields
            const record = mapExcelRow(row, batchId, userId);
            if (!record) {
                counters.skipped++;
                continue;
            }

            // Upsert
            const result = await model.upsertRecord(record);
            if (result) {
                if (result.is_insert) {
                    counters.created++;
                } else {
                    counters.updated++;
                }
            } else {
                // Hash matched — no change needed
                counters.skipped++;
            }
        }

        // Update sync log
        await model.updateSyncLog(batchId, {
            records_total: counters.total,
            records_created: counters.created,
            records_updated: counters.updated,
            records_skipped: counters.skipped,
            status: 'completed',
            error_message: null,
        });

        return { batchId, ...counters, status: 'completed' };

    } catch (err) {
        await model.updateSyncLog(batchId, {
            records_total: counters.total,
            records_created: counters.created,
            records_updated: counters.updated,
            records_skipped: counters.skipped,
            status: 'failed',
            error_message: err.message,
        });
        throw err;
    }
}

/**
 * Map a single Excel row array to a database record object.
 */
function mapExcelRow(row, batchId, userId) {
    try {
        const record = {
            sync_batch_id: batchId,
            created_by: userId || 'sync',
        };

        for (const [colIdx, dbField] of Object.entries(EXCEL_COL_MAP)) {
            const idx = parseInt(colIdx, 10);
            let value = row[idx];

            // Handle Excel date serial numbers
            if ((dbField === 'request_date' || dbField === 'finish_date' || dbField === 'plan_start_date')) {
                value = parseExcelDate(value);
            }

            // Handle record_no as integer
            if (dbField === 'record_no') {
                value = typeof value === 'number' ? Math.round(value) : parseInt(value, 10);
                if (isNaN(value)) return null;
            }

            // Convert everything else to trimmed string (except null/empty)
            if (typeof value === 'string') {
                value = value.trim();
            }

            record[dbField] = value === '' ? null : value;
        }

        // Must have at minimum record_no and case_type
        if (!record.record_no || !record.case_type) return null;

        // Generate source hash for change detection
        record.source_hash = generateRowHash(record);

        return record;

    } catch (err) {
        console.error('Error mapping row:', err.message);
        return null;
    }
}

/**
 * Convert Excel serial date number to ISO date string.
 */
function parseExcelDate(value) {
    if (value === null || value === undefined || value === '' || value === '?') {
        return null;
    }
    if (typeof value === 'number' && value > 10000) {
        // Excel date serial number → JS Date
        const date = new Date((value - 25569) * 86400000);
        // Validate
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return null;
}

/**
 * Generate a SHA-256 hash from key fields for change detection.
 */
function generateRowHash(record) {
    const hashFields = [
        record.request_date, record.request_by, record.lot_no, record.cn,
        record.pn, record.plant, record.case_type, record.spec_problem,
        record.judge_revise, record.reason, record.judgment_by, record.finish_date,
        record.plan_start_date, record.remark, record.responsible, record.confirm_codi,
        record.comment, record.ts_flag,
    ];
    const str = hashFields.map(v => v === null || v === undefined ? '' : String(v)).join('|');
    return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
    syncFromExcel,
};
