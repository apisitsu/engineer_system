/**
 * pdfToolsService.js — Business logic for PDF manipulation tools.
 *
 * Wraps Python-based PDF operations (unlock, repair) with proper
 * temp file management and cleanup.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runPythonScript } = require('../utils/pythonRunner');

const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

/**
 * Unlock an encrypted or permissions-locked PDF document.
 *
 * @param {string} inputPath - Path to the uploaded encrypted PDF
 * @returns {Promise<Buffer>} - Unlocked and decrypted PDF data
 */
async function unlockPdf(inputPath) {
    const outputPath = path.join(os.tmpdir(), `unlocked_${Date.now()}_${path.basename(inputPath)}.pdf`);
    const scriptPath = path.join(SCRIPTS_DIR, 'pdf_unlocker.py');

    try {
        await runPythonScript(scriptPath, [inputPath, outputPath]);
        const data = fs.readFileSync(outputPath);
        return data;
    } finally {
        // Cleanup temp files safely
        safeUnlink(inputPath);
        safeUnlink(outputPath);
    }
}

/**
 * Repair/rebuild a PDF using the Python PyMuPDF script.
 *
 * @param {string} inputPath - Path to the uploaded PDF
 * @returns {Promise<Buffer>} - Repaired PDF data
 */
async function repairPdf(inputPath) {
    const outputPath = path.join(os.tmpdir(), `repaired_${Date.now()}_${path.basename(inputPath)}.pdf`);
    const scriptPath = path.join(SCRIPTS_DIR, 'pdf_rebuilder.py');

    try {
        await runPythonScript(scriptPath, [inputPath, outputPath]);
        const data = fs.readFileSync(outputPath);
        return data;
    } finally {
        // Cleanup temp files safely
        safeUnlink(inputPath);
        safeUnlink(outputPath);
    }
}

/**
 * Safely delete a temporary file.
 * Guard with os.tmpdir() to guarantee workspace files are never deleted.
 */
function safeUnlink(filePath) {
    try {
        if (filePath && filePath.includes(os.tmpdir()) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        // Silently ignore cleanup errors
    }
}

module.exports = { unlockPdf, repairPdf };
