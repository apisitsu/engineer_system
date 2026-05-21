import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * PdfCommitEngine — Serializes Fabric.js canvas objects into pdf-lib operations.
 *
 * This is the bridge that takes annotation/shape data from the interactive
 * Fabric.js overlay and burns it into the actual PDF file structure.
 */

// ── Color conversion ──
function hexToRgb(hex) {
    if (!hex || hex === 'transparent') return null;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 8) hex = hex.substring(0, 6); // Strip alpha
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
}

// ── Coordinate conversion: Fabric.js → PDF ──
function toPdf(val, canvasSize, pdfSize) {
    return val * (pdfSize / canvasSize);
}

function toPdfY(val, canvasH, pdfH) {
    return pdfH - val * (pdfH / canvasH);
}

// ── Map font family to pdf-lib StandardFonts ──
const FONT_MAP = {
    'Helvetica': StandardFonts.Helvetica,
    'Arial': StandardFonts.Helvetica,
    'Times New Roman': StandardFonts.TimesRoman,
    'Times': StandardFonts.TimesRoman,
    'Courier New': StandardFonts.Courier,
    'Courier': StandardFonts.Courier,
    'Georgia': StandardFonts.TimesRoman,
    'monospace': StandardFonts.Courier,
};

async function getFont(doc, fontFamily) {
    const stdFont = FONT_MAP[fontFamily] || StandardFonts.Helvetica;
    return await doc.embedFont(stdFont);
}

// ── Embed image (try PNG first, fallback to JPG) ──
async function embedImage(doc, base64Data) {
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    try {
        return await doc.embedPng(bytes);
    } catch {
        return await doc.embedJpg(bytes);
    }
}

// ══════════════════════════════════════════════════════════════════════
// Main Commit Function
// ══════════════════════════════════════════════════════════════════════

/**
 * Commit all Fabric.js annotations into the PDF and return the final bytes.
 *
 * @param {Uint8Array} pdfBytes - Original PDF file bytes
 * @param {Object} pageAnnotations - { [pageNum]: { objects, _canvasWidth, _canvasHeight } }
 * @param {Object} formValues - Optional { [fieldName]: value } for AcroForm filling
 * @returns {Promise<Uint8Array>} - Modified PDF bytes
 */
export async function commitAllToPdf(pdfBytes, pageAnnotations, formValues = null) {
    const doc = await PDFDocument.load(pdfBytes);
    const pages = doc.getPages();

    // ── Commit annotations per page ──
    for (const [pageNumStr, fabricData] of Object.entries(pageAnnotations)) {
        const pageIdx = parseInt(pageNumStr) - 1;
        if (pageIdx < 0 || pageIdx >= pages.length) continue;

        const page = pages[pageIdx];
        const { width: pW, height: pH } = page.getSize();
        const cW = fabricData._canvasWidth || pW;
        const cH = fabricData._canvasHeight || pH;

        if (!fabricData.objects) continue;

        for (const obj of fabricData.objects) {
            try {
                await commitObject(doc, page, obj, cW, cH, pW, pH);
            } catch (err) {
                console.warn('Commit object error:', err, obj);
            }
        }
    }

    // ── Commit form field values ──
    if (formValues && Object.keys(formValues).length > 0) {
        try {
            const form = doc.getForm();
            for (const [name, value] of Object.entries(formValues)) {
                try {
                    const field = form.getField(name);
                    const typeName = field.constructor.name;
                    if (typeName === 'PDFTextField') field.setText(String(value));
                    else if (typeName === 'PDFCheckBox') value ? field.check() : field.uncheck();
                    else if (typeName === 'PDFDropdown') field.select(String(value));
                    else if (typeName === 'PDFRadioGroup') field.select(String(value));
                } catch (e) {
                    console.warn(`Form field "${name}" commit error:`, e);
                }
            }
        } catch (e) {
            console.warn('No form in PDF or form error:', e);
        }
    }

    return await doc.save();
}

/**
 * Commit a single Fabric.js object into a PDF page.
 */
async function commitObject(doc, page, obj, cW, cH, pW, pH) {
    const type = obj.customData?.type || obj.type;

    // Scale factors
    const scaleObjX = obj.scaleX || 1;
    const scaleObjY = obj.scaleY || 1;

    switch (obj.type) {
        case 'rect': {
            const x = toPdf(obj.left, cW, pW);
            const y = toPdfY(obj.top + obj.height * scaleObjY, cH, pH);
            const w = toPdf(obj.width * scaleObjX, cW, pW);
            const h = toPdf(obj.height * scaleObjY, cH, pH);

            const fillColor = hexToRgb(obj.fill);
            const strokeColor = hexToRgb(obj.stroke);

            page.drawRectangle({
                x, y, width: w, height: h,
                color: fillColor || undefined,
                opacity: obj.opacity ?? 1,
                borderColor: strokeColor || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth, cW, pW) : undefined,
                borderOpacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'ellipse': {
            const cx = toPdf(obj.left + obj.rx * scaleObjX, cW, pW);
            const cy = toPdfY(obj.top + obj.ry * scaleObjY, cH, pH);
            const rx = toPdf(obj.rx * scaleObjX, cW, pW);
            const ry = toPdf(obj.ry * scaleObjY, cH, pH);

            page.drawEllipse({
                x: cx, y: cy,
                xScale: rx, yScale: ry,
                color: hexToRgb(obj.fill) || undefined,
                borderColor: hexToRgb(obj.stroke) || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth, cW, pW) : undefined,
                opacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'line': {
            const x1 = toPdf(obj.x1 + (obj.left || 0), cW, pW);
            const y1 = toPdfY(obj.y1 + (obj.top || 0), cH, pH);
            const x2 = toPdf(obj.x2 + (obj.left || 0), cW, pW);
            const y2 = toPdfY(obj.y2 + (obj.top || 0), cH, pH);

            page.drawLine({
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
                thickness: toPdf(obj.strokeWidth || 2, cW, pW),
                color: hexToRgb(obj.stroke) || rgb(0, 0, 0),
                opacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'i-text':
        case 'textbox':
        case 'text': {
            if (!obj.text) break;
            const font = await getFont(doc, obj.fontFamily);
            const size = toPdf((obj.fontSize || 14) * scaleObjY, cH, pH);
            const x = toPdf(obj.left, cW, pW);
            const y = toPdfY(obj.top + (obj.fontSize || 14) * scaleObjY, cH, pH);

            // Handle multi-line text
            const lines = obj.text.split('\n');
            const lineHeight = size * 1.2;

            lines.forEach((line, i) => {
                page.drawText(line, {
                    x,
                    y: y - (i * lineHeight),
                    size,
                    font,
                    color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                    opacity: obj.opacity ?? 1,
                });
            });
            break;
        }

        case 'image': {
            if (!obj.src) break;
            const img = await embedImage(doc, obj.src);
            const x = toPdf(obj.left, cW, pW);
            const y = toPdfY(obj.top + obj.height * scaleObjY, cH, pH);
            const w = toPdf(obj.width * scaleObjX, cW, pW);
            const h = toPdf(obj.height * scaleObjY, cH, pH);

            page.drawImage(img, { x, y, width: w, height: h, opacity: obj.opacity ?? 1 });
            break;
        }

        case 'path': {
            // Freehand drawing — convert Fabric.js path to PDF
            // Simplified: draw each segment as lines
            if (obj.path) {
                const color = hexToRgb(obj.stroke) || rgb(0, 0, 0);
                const thickness = toPdf(obj.strokeWidth || 2, cW, pW);
                const offsetX = obj.left || 0;
                const offsetY = obj.top || 0;

                for (let i = 0; i < obj.path.length - 1; i++) {
                    const curr = obj.path[i];
                    const next = obj.path[i + 1];
                    if (curr.length >= 3 && next.length >= 3) {
                        const x1 = toPdf(curr[curr.length - 2] + offsetX, cW, pW);
                        const y1 = toPdfY(curr[curr.length - 1] + offsetY, cH, pH);
                        const x2 = toPdf(next[next.length - 2] + offsetX, cW, pW);
                        const y2 = toPdfY(next[next.length - 1] + offsetY, cH, pH);

                        page.drawLine({
                            start: { x: x1, y: y1 },
                            end: { x: x2, y: y2 },
                            thickness,
                            color,
                            opacity: obj.opacity ?? 1,
                        });
                    }
                }
            }
            break;
        }

        case 'group': {
            // Recursively commit grouped objects (arrows, rulers, etc.)
            if (obj.objects) {
                for (const child of obj.objects) {
                    // Adjust child positions relative to group
                    const adjustedChild = {
                        ...child,
                        left: (child.left || 0) + (obj.left || 0) + (obj.width || 0) / 2,
                        top: (child.top || 0) + (obj.top || 0) + (obj.height || 0) / 2,
                    };
                    await commitObject(doc, page, adjustedChild, cW, cH, pW, pH);
                }
            }
            break;
        }

        default:
            // Skip unknown types (e.g., ruler labels are text in groups)
            break;
    }
}

/**
 * Export a PDF page to an image blob (client-side).
 *
 * @param {Object} pdfDoc - pdfjs-dist document
 * @param {number} pageNum - 1-indexed
 * @param {Object} fabricData - Fabric.js JSON for this page
 * @param {string} format - 'jpg' | 'png'
 * @param {number} scale - render scale (1.0, 1.5, 2.0)
 * @returns {Promise<Blob>}
 */
export async function exportPageToImage(pdfDoc, pageNum, fabricData, format = 'jpg', scale = 2.0) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    // Render PDF
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Composite Fabric.js annotations on top
    if (fabricData && fabricData.objects && fabricData.objects.length > 0) {
        // Dynamically import fabric for static canvas
        const fabricModule = await import('fabric');
        const fabric = fabricModule;

        const tempCanvas = new fabric.StaticCanvas(null, {
            width: viewport.width,
            height: viewport.height,
        });

        // Scale annotations to match export resolution
        const cW = fabricData._canvasWidth || viewport.width / scale;
        const cH = fabricData._canvasHeight || viewport.height / scale;
        const sx = viewport.width / cW;
        const sy = viewport.height / cH;

        await tempCanvas.loadFromJSON(fabricData);

        tempCanvas.getObjects().forEach(obj => {
            obj.set({
                left: (obj.left || 0) * sx,
                top: (obj.top || 0) * sy,
                scaleX: (obj.scaleX || 1) * sx,
                scaleY: (obj.scaleY || 1) * sy,
            });
            obj.setCoords();
        });

        tempCanvas.renderAll();
        ctx.drawImage(tempCanvas.toCanvasElement(), 0, 0);
        tempCanvas.dispose();
    }

    // Convert to blob
    return new Promise((resolve) => {
        canvas.toBlob(
            resolve,
            format === 'png' ? 'image/png' : 'image/jpeg',
            format === 'png' ? undefined : 0.92
        );
    });
}

/**
 * Merge multiple PDF files into one.
 *
 * @param {Array<File|ArrayBuffer>} files - Array of PDF files or ArrayBuffers
 * @returns {Promise<Uint8Array>} - Merged PDF bytes
 */
export async function mergePdfFiles(files) {
    const mergedDoc = await PDFDocument.create();

    for (const file of files) {
        const arrayBuffer = file instanceof ArrayBuffer
            ? file
            : await file.arrayBuffer();

        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedDoc.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedDoc.addPage(page));
    }

    return await mergedDoc.save();
}
