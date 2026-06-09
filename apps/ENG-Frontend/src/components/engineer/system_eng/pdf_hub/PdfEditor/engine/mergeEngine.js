import { PDFDocument } from 'pdf-lib';

/**
 * mergeEngine.js — Handles merging multiple PDF files.
 */

/**
 * Merge multiple PDF files into one.
 *
 * @param {Array<File|ArrayBuffer>} files - Array of PDF files or ArrayBuffers
 * @returns {Promise<Uint8Array>} - Merged PDF bytes
 */
export async function mergePdfFiles(files) {
    const mergedDoc = await PDFDocument.create();

    for (const file of files) {
        let arrayBuffer;
        if (file instanceof ArrayBuffer) {
            arrayBuffer = file;
        } else if (file instanceof Uint8Array) {
            arrayBuffer = file.buffer;
        } else if (typeof file.arrayBuffer === 'function') {
            arrayBuffer = await file.arrayBuffer();
        } else {
            throw new Error('Unsupported file type for merge');
        }

        const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pages = await mergedDoc.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedDoc.addPage(page));
    }

    return await mergedDoc.save();
}
