/**
 * draftService.js — SQLite-backed service for managing temporary PDF drafts.
 *
 * Stores draft metadata in files/pdf_drafts.db (SQLite)
 * Stores draft binary files in files/pdf_temp_drafts/
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
        db.run(`
            CREATE TABLE IF NOT EXISTS pdf_temp_drafts (
                empno TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                original_filename TEXT,
                filepath TEXT NOT NULL,
                file_size INTEGER,
                project_data TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (createErr) => {
            if (createErr) {
                console.error('[DraftService] Error creating pdf_temp_drafts table:', createErr.message);
            } else {
                // Ensure project_data column exists on older DB files
                db.run(`ALTER TABLE pdf_temp_drafts ADD COLUMN project_data TEXT`, () => {
                    // Ignore column already exists error
                });
                console.log('[DraftService] SQLite draft database ready at:', DB_PATH);
            }
        });
    }
});

/**
 * Get draft metadata for a user
 * @param {string} empno
 * @returns {Promise<Object|null>}
 */
function getDraft(empno) {
    return new Promise((resolve, reject) => {
        if (!empno) return resolve(null);
        db.get(
            `SELECT empno, filename, original_filename, filepath, file_size, project_data, updated_at 
             FROM pdf_temp_drafts 
             WHERE empno = ?`,
            [empno],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // Verify file still exists on disk
                if (!fs.existsSync(row.filepath)) {
                    // Stale DB record, clean it up
                    deleteDraft(empno).catch(() => {});
                    return resolve(null);
                }

                resolve(row);
            }
        );
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
        const draftFileName = `${safeEmpNo}_draft.pdf`;
        const filePath = path.join(DRAFTS_DIR, draftFileName);

        fs.writeFile(filePath, buffer, (writeErr) => {
            if (writeErr) return reject(writeErr);

            const fileSize = buffer.length;
            const jsonStr = projectData ? (typeof projectData === 'object' ? JSON.stringify(projectData) : projectData) : null;
            const sql = `
                INSERT INTO pdf_temp_drafts (empno, filename, original_filename, filepath, file_size, project_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(empno) DO UPDATE SET
                    filename = excluded.filename,
                    original_filename = excluded.original_filename,
                    filepath = excluded.filepath,
                    file_size = excluded.file_size,
                    project_data = COALESCE(excluded.project_data, pdf_temp_drafts.project_data),
                    updated_at = CURRENT_TIMESTAMP
            `;

            db.run(sql, [empno, filename || draftFileName, originalFilename || filename, filePath, fileSize, jsonStr], function (dbErr) {
                if (dbErr) return reject(dbErr);
                resolve({
                    empno,
                    filename: filename || draftFileName,
                    original_filename: originalFilename || filename,
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
 * @param {Object} params - { empno, projectData }
 * @returns {Promise<Object>}
 */
function updateDraftAnnotations({ empno, projectData }) {
    return new Promise((resolve, reject) => {
        if (!empno) return reject(new Error('empno is required'));

        const jsonStr = typeof projectData === 'object' ? JSON.stringify(projectData) : (projectData || null);
        const sql = `
            UPDATE pdf_temp_drafts
            SET project_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE empno = ?
        `;

        db.run(sql, [jsonStr, empno], function (dbErr) {
            if (dbErr) return reject(dbErr);
            if (this.changes === 0) {
                return resolve({ updated: false, message: 'Draft not found to update' });
            }
            resolve({
                updated: true,
                empno,
                updated_at: new Date().toISOString()
            });
        });
    });
}

/**
 * Get assembled draft PDF for resumption download.
 * If project_data was modified via delta updates, Node.js embeds it into the PDF.
 * @param {string} empno
 * @returns {Promise<Object|null>} - { type: 'buffer'|'file', buffer, filePath, filename }
 */
async function getAssembledDraftPdf(empno) {
    const draft = await getDraft(empno);
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
        const finalPdfBytes = await doc.save();

        return {
            type: 'buffer',
            buffer: Buffer.from(finalPdfBytes),
            filename: downloadName
        };
    } catch (err) {
        console.error('[DraftService] Failed to assemble PDF with project_data:', err.message);
        // Fallback to sending base file
        return {
            type: 'file',
            filePath: draft.filepath,
            filename: downloadName
        };
    }
}

/**
 * Get the file path of a draft for streaming
 * @param {string} empno
 * @returns {Promise<string|null>}
 */
async function getDraftFilePath(empno) {
    const draft = await getDraft(empno);
    if (!draft || !fs.existsSync(draft.filepath)) return null;
    return draft.filepath;
}

/**
 * Delete a user's temporary draft from disk and SQLite
 * @param {string} empno
 * @returns {Promise<boolean>}
 */
function deleteDraft(empno) {
    return new Promise((resolve, reject) => {
        if (!empno) return resolve(false);

        db.get(`SELECT filepath FROM pdf_temp_drafts WHERE empno = ?`, [empno], (err, row) => {
            if (err) return reject(err);

            if (row && row.filepath && fs.existsSync(row.filepath)) {
                try {
                    fs.unlinkSync(row.filepath);
                } catch (unlinkErr) {
                    console.warn(`[DraftService] Could not unlink ${row.filepath}:`, unlinkErr.message);
                }
            }

            db.run(`DELETE FROM pdf_temp_drafts WHERE empno = ?`, [empno], function (delErr) {
                if (delErr) return reject(delErr);
                resolve(true);
            });
        });
    });
}

module.exports = {
    getDraft,
    saveDraft,
    updateDraftAnnotations,
    getAssembledDraftPdf,
    getDraftFilePath,
    deleteDraft
};
