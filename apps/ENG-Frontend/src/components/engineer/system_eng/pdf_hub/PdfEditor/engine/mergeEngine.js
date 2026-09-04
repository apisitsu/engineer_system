import { PDFDocument, degrees } from 'pdf-lib';

/**
 * mergeEngine.js — Handles merging multiple PDF files.
 */

/**
 * Merge multiple PDF files into one.
 *
 * @param {Array<File|ArrayBuffer|Uint8Array>} files - Array of PDF files or ArrayBuffers
 * @param {Object} [pageRotations] - Optional map of `${fileUid}_${pageNum}` -> rotation degrees
 * @returns {Promise<Uint8Array>} - Merged PDF bytes
 */
export async function mergePdfFiles(files, pageRotations = {}) {
    if (!files || files.length === 0) {
        throw new Error('No PDF files provided to merge.');
    }

    const mergedDoc = await PDFDocument.create();

    for (const file of files) {
        let pdfData;
        if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
            pdfData = file;
        } else if (typeof file.arrayBuffer === 'function') {
            pdfData = await file.arrayBuffer();
        } else if (file?.originFileObj && typeof file.originFileObj.arrayBuffer === 'function') {
            pdfData = await file.originFileObj.arrayBuffer();
        } else {
            throw new Error(`Unsupported file type for merge: ${file?.name || typeof file}`);
        }

        const pdf = await PDFDocument.load(pdfData, { ignoreEncryption: true });
        const indices = pdf.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(pdf, indices);

        copiedPages.forEach((page, idx) => {
            const pageNum = idx + 1;
            const uid = file.uid || file.name;
            const extraRotation = pageRotations[`${uid}_${pageNum}`] || 0;
            if (extraRotation) {
                const currentRotation = page.getRotation().angle || 0;
                page.setRotation(degrees((currentRotation + extraRotation) % 360));
            }
            mergedDoc.addPage(page);
        });
    }

    return await mergedDoc.save();
}
