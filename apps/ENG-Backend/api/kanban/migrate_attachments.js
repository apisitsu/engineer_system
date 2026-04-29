/**
 * ═══════════════════════════════════════════════════════════════════════
 * migrate_attachments.js
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Standalone CLI script to migrate existing local Kanban file attachments
 * to Google Drive via the GAS Web App.
 *
 * Usage:
 *   cd apps/ENG-Backend
 *   node api/kanban/migrate_attachments.js
 *
 * What it does:
 *   1. Connects to PostgreSQL and fetches all attachments with drive_file_id IS NULL
 *   2. Loops through each record sequentially (to avoid GAS rate limits)
 *   3. Reads the local file, converts to base64, POSTs to GAS
 *   4. Updates the DB record with drive_file_id + drive_folder_path
 *   5. Moves the local file to ./archive_migrated/ for safety
 *   6. Adds a 500ms delay between uploads
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// ─── CONFIG ──────────────────────────────────────────────────────────
const GAS_DRIVE_URL = process.env.GAS_DRIVE_URL || '';
const DELAY_MS = 500; // Delay between uploads to avoid GAS rate limits
const ARCHIVE_DIR = path.resolve(__dirname, '../../archive_migrated');

// ─── Database connection (same as eng_db instance) ───────────────────
const pool = new Pool({
    host: process.env.PG_NEW_HOST,
    port: parseInt(process.env.PG_NEW_PORT) || 6543,
    database: process.env.PG_NEW_DB,
    user: process.env.PG_NEW_USER,
    password: process.env.PG_NEW_PASS,
});

// ─── Proxy Agent (corporate McAfee Web Gateway — CONNECT method) ────
function getProxyAgent() {
    if (process.env.PROXY_HOST) {
        const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT || 8080}`;
        return new HttpsProxyAgent(proxyUrl);
    }
    return undefined;
}

// ─── POST to GAS ────────────────────────────────────────────────────
async function postToGAS(payload) {
    if (!GAS_DRIVE_URL) throw new Error('GAS_DRIVE_URL is not configured in .env');
    const agent = getProxyAgent();
    const response = await axios.post(GAS_DRIVE_URL, payload, {
        httpsAgent: agent,
        proxy: false,
        maxRedirects: 5,
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
    });
    return response.data;
}

// ─── Delay helper ───────────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Archive helper: move file to archive_migrated ──────────────────
function archiveFile(originalRelPath) {
    const srcPath = path.resolve(__dirname, '../../', originalRelPath);
    if (!fs.existsSync(srcPath)) {
        console.log(`     ⚠️  Source file not found on disk: ${srcPath}`);
        return;
    }

    // Preserve directory structure inside archive
    const destPath = path.join(ARCHIVE_DIR, originalRelPath);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    fs.renameSync(srcPath, destPath);
    console.log(`     📦 Archived → ${destPath}`);
}

// ─── MAIN ───────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Kanban Attachment Migration → Google Drive');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  GAS URL: ${GAS_DRIVE_URL ? GAS_DRIVE_URL.substring(0, 60) + '...' : '❌ NOT SET'}`);
    console.log(`  DB Host: ${process.env.PG_NEW_HOST}:${process.env.PG_NEW_PORT}`);
    console.log(`  Archive: ${ARCHIVE_DIR}`);
    console.log('');

    if (!GAS_DRIVE_URL) {
        console.error('❌ GAS_DRIVE_URL is not set in .env. Aborting.');
        process.exit(1);
    }

    // Ensure archive directory exists
    if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

    // Fetch un-migrated attachments with project/board context
    const { rows: attachments } = await pool.query(`
        SELECT 
            a.id, a.card_id, a.file_name, a.file_path, a.mime_type,
            c.board_id, b.project_id
        FROM kb_attachment a
        JOIN kb_card c ON c.id = a.card_id
        JOIN kb_board b ON b.id = c.board_id
        WHERE a.drive_file_id IS NULL
          AND a.attachment_type = 'file'
        ORDER BY a.id ASC
    `);

    const total = attachments.length;
    console.log(`📋 Found ${total} un-migrated file attachment(s).\n`);

    if (total === 0) {
        console.log('✅ Nothing to migrate. All attachments are already on Google Drive.');
        await pool.end();
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const [index, att] of attachments.entries()) {
        const progress = `[${index + 1}/${total}]`;

        try {
            console.log(`${progress} Processing attachment #${att.id}: "${att.file_name}"`);

            // Read the physical file from the local server path
            const filePath = path.resolve(__dirname, '../../', att.file_path);
            if (!fs.existsSync(filePath)) {
                console.log(`${progress} ⚠️  SKIP — File not found on disk: ${filePath}`);
                failCount++;
                continue;
            }

            const fileBuffer = fs.readFileSync(filePath);
            const base64Data = fileBuffer.toString('base64');
            const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);

            console.log(`     📄 Size: ${fileSizeMB} MB | MIME: ${att.mime_type || 'unknown'}`);
            console.log(`     🚀 Uploading to GAS...`);

            // POST to GAS Web App
            const gasResult = await postToGAS({
                action: 'upload',
                fileName: att.file_name,
                mimeType: att.mime_type || 'application/octet-stream',
                base64Data,
                projectId: String(att.project_id),
                boardId: String(att.board_id),
                cardId: String(att.card_id),
            });

            if (!gasResult.success) {
                console.error(`${progress} ❌ GAS Error: ${gasResult.error}`);
                failCount++;
                await delay(DELAY_MS);
                continue;
            }

            // Update DB record with Drive metadata
            const driveViewUrl = `https://drive.google.com/file/d/${gasResult.fileId}/view`;
            await pool.query(`
                UPDATE kb_attachment 
                SET drive_file_id = $1, drive_folder_path = $2, file_path = $3
                WHERE id = $4
            `, [gasResult.fileId, gasResult.folderPath, driveViewUrl, att.id]);

            console.log(`     ✅ Migrated → fileId: ${gasResult.fileId} | path: ${gasResult.folderPath}`);

            // Archive the local file
            archiveFile(att.file_path);

            successCount++;

        } catch (err) {
            console.error(`${progress} ❌ ERROR: ${err.message}`);
            failCount++;
        }

        // Delay between uploads to prevent rate limiting
        if (index < total - 1) {
            await delay(DELAY_MS);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  Migration Complete!`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed:  ${failCount}`);
    console.log(`  📊 Total:   ${total}`);
    console.log('═══════════════════════════════════════════════════════\n');

    await pool.end();
}

// Run
main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
