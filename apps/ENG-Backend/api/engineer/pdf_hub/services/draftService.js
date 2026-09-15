/**
 * draftService.js — SQLite-backed service for managing temporary PDF drafts.
 *
 * Stores draft metadata in files/pdf_drafts.db (SQLite)
 * Stores draft binary files in files/pdf_temp_drafts/
 * Supports multiple distinct document drafts per user.
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { PDFDocument, PDFString } = require('pdf-lib');

const DRAFTS_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'files', 'pdf_temp_drafts');
const DB_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'files', 'pdf_drafts.db');

// Ensure directories exist
if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
}
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[DraftService] Failed to connect to SQLite draft DB:', err.message);
    } else {
        initSchema();
    }
});

/**
 * Initialize SQLite table schema and automatically migrate if upgrading from legacy single-draft schema
 */
function initSchema() {
    db.serialize(() => {
        db.all(`PRAGMA table_info(pdf_temp_drafts)`, (err, cols) => {
            if (err) {
                console.error('[DraftService] PRAGMA table_info error:', err);
                return;
            }

            const hasTable = cols && cols.length > 0;
            const hasId = cols && cols.some(c => c.name === 'id');

            if (!hasTable) {
                // Table doesn't exist yet: create new schema supporting multiple drafts per user
                db.run(`
                    CREATE TABLE IF NOT EXISTS pdf_temp_drafts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        empno TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        original_filename TEXT,
                        filepath TEXT NOT NULL,
                        file_size INTEGER,
                        project_data TEXT,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(empno, filename)
                    )
                `, (createErr) => {
                    if (createErr) {
                        console.error('[DraftService] Error creating pdf_temp_drafts table:', createErr.message);
                    } else {
                        console.log('[DraftService] SQLite draft database ready (Multi-Draft Schema) at:', DB_PATH);
                    }
                });
            } else if (!hasId) {
                // Legacy schema with empno PRIMARY KEY: Migrate to multi-draft schema with UNIQUE(empno, filename)
                console.log('[DraftService] Migrating pdf_temp_drafts table to support multiple drafts...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS pdf_temp_drafts_v2 (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        empno TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        original_filename TEXT,
                        filepath TEXT NOT NULL,
                        file_size INTEGER,
                        project_data TEXT,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(empno, filename)
                    )
                `, (v2Err) => {
                    if (v2Err) return console.error('[DraftService] Migration v2 table error:', v2Err);
                    db.run(`
                        INSERT OR IGNORE INTO pdf_temp_drafts_v2 (empno, filename, original_filename, filepath, file_size, project_data, updated_at)
                        SELECT empno, filename, original_filename, filepath, file_size, project_data, updated_at FROM pdf_temp_drafts
                    `, (insErr) => {
                        if (insErr) return console.error('[DraftService] Migration copy error:', insErr);
                        db.run(`DROP TABLE pdf_temp_drafts`, (dropErr) => {
                            if (dropErr) return console.error('[DraftService] Migration drop error:', dropErr);
                            db.run(`ALTER TABLE pdf_temp_drafts_v2 RENAME TO pdf_temp_drafts`, (renameErr) => {
                                if (renameErr) return console.error('[DraftService] Migration rename error:', renameErr);
                                console.log('[DraftService] Multi-Draft migration completed successfully.');
                            });
                        });
                    });
                });
            } else {
                console.log('[DraftService] SQLite draft database ready at:', DB_PATH);
            }
        });
    });
}

/**
 * List all active drafts for a user
 * @param {string} empno
 * @returns {Promise<Array>}
 */
function listDrafts(empno) {
    return new Promise((resolve, reject) => {
        if (!empno) return resolve([]);
        db.all(
            `SELECT id, empno, filename, original_filename, filepath, file_size, updated_at 
             FROM pdf_temp_drafts 
             WHERE empno = ? 
             ORDER BY updated_at DESC`,
            [empno],
            (err, rows) => {
                if (err) return reject(err);
                if (!rows || rows.length === 0) return resolve([]);

                // Verify files still exist on disk
                const validRows = [];
                for (const row of rows) {
                    if (fs.existsSync(row.filepath)) {
                        validRows.push(row);
                    } else {
                        // Stale DB record, clean it up asynchronously
                        deleteDraft(empno, row.filename).catch(() => {});
                    }
                }
                resolve(validRows);
            }
        );
    });
}

/**
 * Get draft metadata for a user and specific document (or most recent)
 * @param {string} empno
 * @param {string} [filename]
 * @returns {Promise<Object|null>}
 */
function getDraft(empno, filename) {
    return new Promise((resolve, reject) => {
        if (!empno) return resolve(null);

        let sql = `SELECT id, empno, filename, original_filename, filepath, file_size, project_data, updated_at 
                   FROM pdf_temp_drafts 
                   WHERE empno = ?`;
        const params = [empno];

        if (filename) {
            sql += ` AND filename = ?`;
            params.push(filename);
        } else {
            sql += ` ORDER BY updated_at DESC LIMIT 1`;
        }

        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(null);

            // Verify file still exists on disk
            if (!fs.existsSync(row.filepath)) {
                deleteDraft(empno, row.filename).catch(() => {});
                return resolve(null);
            }

            resolve(row);
        });
    });
}

/**
 * Save / Upsert a draft PDF file and DB record
 * @param {Object} params - { empno, filename, originalFilename, buffer, projectData }
 * @returns {Promise<Object>}
 */
function saveDraft({ empno, filename, originalFilename, buffer, projectData }) {
    return new Promise((resolve, reject) => {
        if (!empno || !buffer) {
            return reject(new Error('empno and file buffer are required'));
        }

        const safeEmpNo = empno.replace(/[^a-zA-Z0-9_-]/g, '_');
        const targetFilename = filename || 'draft.pdf';
        const safeFileName = targetFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const draftDiskFileName = `${safeEmpNo}_${safeFileName}`;
        const filePath = path.join(DRAFTS_DIR, draftDiskFileName);

        fs.writeFile(filePath, buffer, (writeErr) => {
            if (writeErr) return reject(writeErr);

            const fileSize = buffer.length;
            const jsonStr = projectData ? (typeof projectData === 'object' ? JSON.stringify(projectData) : projectData) : null;
            const sql = `
                INSERT INTO pdf_temp_drafts (empno, filename, original_filename, filepath, file_size, project_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(empno, filename) DO UPDATE SET
                    original_filename = excluded.original_filename,
                    filepath = excluded.filepath,
                    file_size = excluded.file_size,
                    project_data = COALESCE(excluded.project_data, pdf_temp_drafts.project_data),
                    updated_at = CURRENT_TIMESTAMP
            `;

            db.run(sql, [empno, targetFilename, originalFilename || targetFilename, filePath, fileSize, jsonStr], function (dbErr) {
                if (dbErr) return reject(dbErr);
                resolve({
                    empno,
                    filename: targetFilename,
                    original_filename: originalFilename || targetFilename,
                    filepath: filePath,
                    file_size: fileSize,
                    updated_at: new Date().toISOString()
                });
            });
        });
    });
}

/**
 * Lightweight delta update of draft annotations JSON.
 * Takes ~1ms with zero file re-writing.
 * @param {Object} params - { empno, filename, projectData }
 * @returns {Promise<Object>}
 */
function updateDraftAnnotations({ empno, filename, projectData }) {
    return new Promise((resolve, reject) => {
        if (!empno) return reject(new Error('empno is required'));

        const jsonStr = typeof projectData === 'object' ? JSON.stringify(projectData) : (projectData || null);
        let sql = `
            UPDATE pdf_temp_drafts
            SET project_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE empno = ?
        `;
        const params = [jsonStr, empno];

        if (filename) {
            sql += ` AND filename = ?`;
            params.push(filename);
        }

        db.run(sql, params, function (dbErr) {
            if (dbErr) return reject(dbErr);
            if (this.changes === 0) {
                return resolve({ updated: false, message: 'Draft not found to update' });
            }
            resolve({
                updated: true,
                empno,
                filename,
                updated_at: new Date().toISOString()
            });
        });
    });
}

/**
 * Get assembled draft PDF for resumption download.
 * If project_data was modified via delta updates, Node.js embeds it into the PDF.
 * @param {string} empno
 * @param {string} [filename]
 * @returns {Promise<Object|null>} - { type: 'buffer'|'file', buffer, filePath, filename }
 */
async function getAssembledDraftPdf(empno, filename) {
    const draft = await getDraft(empno, filename);
    if (!draft || !fs.existsSync(draft.filepath)) return null;

    const downloadName = draft.original_filename || draft.filename || 'draft.pdf';

    // If no project_data exists in DB, stream raw file directly
    if (!draft.project_data) {
        return {
            type: 'file',
            filePath: draft.filepath,
            filename: downloadName
        };
    }

    // Embed project_data into base PDF using pdf-lib on server
    try {
        const basePdfBytes = fs.readFileSync(draft.filepath);
        const doc = await PDFDocument.load(basePdfBytes, { ignoreEncryption: true });
        const base64Str = Buffer.from(draft.project_data, 'utf8').toString('base64');
        doc.getInfoDict().set(doc.context.obj('EngProjectData'), PDFString.of(base64Str));
        
        // Save with useObjectStreams: false so info dict is uncompressed in PDF objects
        const finalPdfBytes = await doc.save({ useObjectStreams: false });

        // Append %ENG_PROJECT_DATA: comment trailer for instant sub-millisecond detection
        const marker = Buffer.from('\n%ENG_PROJECT_DATA:' + base64Str + '\n');
        const combined = Buffer.concat([Buffer.from(finalPdfBytes), marker]);

        return {
            type: 'buffer',
            buffer: combined,
            projectData: draft.project_data,
            filename: downloadName
        };
    } catch (err) {
        console.error('[DraftService] Failed to assemble PDF with project_data:', err.message);
        // Fallback to sending base file
        return {
            type: 'file',
            filePath: draft.filepath,
            projectData: draft.project_data,
            filename: downloadName
        };
    }
}

/**
 * Get the file path of a draft for streaming
 * @param {string} empno
 * @param {string} [filename]
 * @returns {Promise<string|null>}
 */
async function getDraftFilePath(empno, filename) {
    const draft = await getDraft(empno, filename);
    if (!draft || !fs.existsSync(draft.filepath)) return null;
    return draft.filepath;
}

/**
 * Delete a user's temporary draft (specific file or all files) from disk and SQLite
 * @param {string} empno
 * @param {string} [filename] - If omitted or '__ALL__', deletes all drafts for user
 * @returns {Promise<boolean>}
 */
function deleteDraft(empno, filename) {
    return new Promise((resolve, reject) => {
        if (!empno) return resolve(false);

        const isDeleteAll = !filename || filename === '__ALL__' || filename === 'all';

        let selectSql = `SELECT filepath FROM pdf_temp_drafts WHERE empno = ?`;
        const selectParams = [empno];
        if (!isDeleteAll) {
            selectSql += ` AND filename = ?`;
            selectParams.push(filename);
        }

        db.all(selectSql, selectParams, (err, rows) => {
            if (err) return reject(err);

            if (rows && rows.length > 0) {
                rows.forEach(row => {
                    if (row && row.filepath && fs.existsSync(row.filepath)) {
                        try {
                            fs.unlinkSync(row.filepath);
                        } catch (unlinkErr) {
                            console.warn(`[DraftService] Could not unlink ${row.filepath}:`, unlinkErr.message);
                        }
                    }
                });
            }

            let delSql = `DELETE FROM pdf_temp_drafts WHERE empno = ?`;
            const delParams = [empno];
            if (!isDeleteAll) {
                delSql += ` AND filename = ?`;
                delParams.push(filename);
            }

            db.run(delSql, delParams, function (delErr) {
                if (delErr) return reject(delErr);
                resolve(true);
            });
        });
    });
}

module.exports = {
    listDrafts,
    getDraft,
    saveDraft,
    updateDraftAnnotations,
    getAssembledDraftPdf,
    getDraftFilePath,
    deleteDraft
};
