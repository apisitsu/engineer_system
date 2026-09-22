import { PDFDocument, rgb, degrees, BlendMode } from 'pdf-lib';
import axios from 'axios';
import { server } from '../../../../../../constance/constance.js';
import { hexToRgb, toPdf, toPdfY, getFont, embedImage, getEffectivePageSize, visualToRawPdfCoords, visualToRawSize, getRawPlacement, safeNum } from './commitHelpers.js';

/**
 * commitEngine.js — Serializes Fabric.js canvas objects into pdf-lib operations.
 *
 * This is the bridge that takes annotation/shape data from the interactive
 * Fabric.js overlay and burns it into the actual PDF file structure.
 */

/**
 * Commit all Fabric.js annotations into the PDF and return the final bytes.
 *
 * @param {Uint8Array} pdfBytes - Original PDF file bytes
 * @param {Object} pageAnnotations - { [pageNum]: { objects, _canvasWidth, _canvasHeight } }
 * @param {Object} formValues - Optional { [fieldName]: value } for AcroForm filling
 * @param {Object} pageHighlights - Optional { [pageNum]: [ { x, y, width, height, color } ] }
 * @returns {Promise<Uint8Array>} - Modified PDF bytes
 */
export async function commitAllToPdf(pdfBytes, pageAnnotations, formValues = null, pageHighlights = null) {
    let doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, throwOnInvalidObject: false });

    // Defensive Guard: If PDF is encrypted/permissions-protected, pdf-lib cannot decrypt streams
    // and saving it will output corrupted/blank ciphertext pages. Auto-unlock via backend before commit!
    if (doc.isEncrypted) {
        console.warn('commitAllToPdf: Encrypted PDF detected. Auto-unlocking before committing annotations...');
        try {
            const formData = new FormData();
            formData.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }), 'document.pdf');
            const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
            const unlockUrl = (typeof server !== 'undefined' && server?.PDF_UNLOCK) ? server.PDF_UNLOCK : '/api/engineer/pdf-hub/unlock';
            const res = await axios.post(unlockUrl, formData, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                proxy: false,
                responseType: 'arraybuffer'
            });
            if (res.data && res.data.byteLength > 0) {
                pdfBytes = new Uint8Array(res.data);
                doc = await PDFDocument.load(pdfBytes, { throwOnInvalidObject: false });
                console.log('commitAllToPdf: Successfully auto-unlocked document before commit!');
            }
        } catch (unlockErr) {
            console.error('commitAllToPdf: Auto-unlock failed, proceeding with original doc:', unlockErr);
        }
    }

    const pages = doc.getPages();

    // ── Commit highlights per page (drawn first so text stays on top) ──
    if (pageHighlights) {
        for (const [pageNumStr, highlights] of Object.entries(pageHighlights)) {
            const pageIdx = parseInt(pageNumStr) - 1;
            if (isNaN(pageIdx) || pageIdx < 0 || pageIdx >= pages.length || !highlights?.length) continue;

            const page = pages[pageIdx];
            const { width: effW, height: effH, rotation } = getEffectivePageSize(page);

            // Get canvas dimensions from the annotation data for this page, or use PDF dims
            const fabricData = pageAnnotations[pageNumStr];
            const cW = fabricData?._canvasWidth || effW;
            const cH = fabricData?._canvasHeight || effH;

            for (const hl of highlights) {
                const color = hexToRgb(hl.color || '#ffeb3b');
                if (!color) continue;

                let visX, visY, visW, visH;
                if (hl.normX !== undefined) {
                    visX = hl.normX * effW;
                    visY = effH - ((hl.normY + hl.normH) * effH);
                    visW = hl.normW * effW;
                    visH = hl.normH * effH;
                } else {
                    visX = toPdf(hl.x, cW, effW);
                    visY = toPdfY(hl.y + hl.height, cH, effH);
                    visW = toPdf(hl.width, cW, effW);
                    visH = toPdf(hl.height, cH, effH);
                }

                const rawPlacement = getRawPlacement(visX, visY, visW, visH, effW, effH, rotation);

                page.drawRectangle({
                    x: rawPlacement.x,
                    y: rawPlacement.y,
                    width: rawPlacement.width,
                    height: rawPlacement.height,
                    color,
                    opacity: 0.5,
                    blendMode: BlendMode.Multiply,
                    rotate: degrees(rawPlacement.rotateDegrees),
                });
            }
        }
    }

    // ── Commit Fabric.js annotations per page ──
    for (const [pageNumStr, fabricData] of Object.entries(pageAnnotations)) {
        const pageIdx = parseInt(pageNumStr) - 1;
        if (isNaN(pageIdx) || pageIdx < 0 || pageIdx >= pages.length) continue;

        const page = pages[pageIdx];
        const { width: effW, height: effH, rotation } = getEffectivePageSize(page);
        const cW = fabricData._canvasWidth || effW;
        const cH = fabricData._canvasHeight || effH;

        if (!fabricData.objects) continue;

        // Partition into underlay (background watermark) vs normal/overlay objects
        const underlayObjects = [];
        const normalAndOverlayObjects = [];

        for (const obj of fabricData.objects) {
            if (obj.customData?.type === 'watermark' && obj.customData?.layer === 'underlay') {
                underlayObjects.push(obj);
            } else {
                normalAndOverlayObjects.push(obj);
            }
        }

        // 1. Commit Underlay Watermarks first (drawn behind drawings & annotations)
        for (const obj of underlayObjects) {
            try {
                await commitObject(doc, page, obj, cW, cH, effW, effH, rotation, pageIdx + 1, pages.length);
            } catch (err) {
                console.warn('Commit underlay object error:', err, obj);
            }
        }

        // 2. Commit Normal Annotations & Overlay Watermarks
        for (const obj of normalAndOverlayObjects) {
            try {
                await commitObject(doc, page, obj, cW, cH, effW, effH, rotation, pageIdx + 1, pages.length);
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

    return await doc.save({ useObjectStreams: false });
}

/**
 * Wrap text to fit within a given maximum width using font metrics.
 * Handles existing newlines, space-delimited words, and grapheme/character overflow.
 */
export function wrapTextToWidth(text, font, fontSize, maxWidth) {
    if (!text || maxWidth <= 0) return [text || ''];

    const paragraphs = String(text).split('\n');
    const allLines = [];

    for (const para of paragraphs) {
        if (!para) {
            allLines.push('');
            continue;
        }

        let paraWidth = 0;
        try {
            paraWidth = font.widthOfTextAtSize(para, fontSize);
        } catch {
            paraWidth = para.length * fontSize * 0.6;
        }
        if (paraWidth <= maxWidth) {
            allLines.push(para);
            continue;
        }

        const words = para.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            let testWidth = 0;
            try {
                testWidth = font.widthOfTextAtSize(testLine, fontSize);
            } catch {
                testWidth = testLine.length * fontSize * 0.6;
            }

            if (testWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    allLines.push(currentLine);
                    currentLine = '';
                }

                let wordWidth = 0;
                try {
                    wordWidth = font.widthOfTextAtSize(word, fontSize);
                } catch {
                    wordWidth = word.length * fontSize * 0.6;
                }

                if (wordWidth > maxWidth) {
                    let charLine = '';
                    const chars = Array.from(word);
                    for (const ch of chars) {
                        let charLineWidth = 0;
                        try {
                            charLineWidth = font.widthOfTextAtSize(charLine + ch, fontSize);
                        } catch {
                            charLineWidth = (charLine.length + 1) * fontSize * 0.6;
                        }
                        if (charLineWidth <= maxWidth) {
                            charLine += ch;
                        } else {
                            if (charLine) allLines.push(charLine);
                            charLine = ch;
                        }
                    }
                    currentLine = charLine;
                } else {
                    currentLine = word;
                }
            }
        }
        if (currentLine) {
            allLines.push(currentLine);
        }
    }

    return allLines.length > 0 ? allLines : [text];
}

/**
 * Commit a single Fabric.js object into a PDF page.
 */
async function commitObject(doc, page, obj, cW, cH, effW, effH, rotation = 0, pageNumber = 1, totalPages = 1) {
    if (!obj) return;
    // eslint-disable-next-line no-unused-vars
    const type = obj.customData?.type || obj.type;

    // Scale factors
    const scaleObjX = obj.scaleX || 1;
    const scaleObjY = obj.scaleY || 1;
    const fabricType = (obj.type || '').toLowerCase();

    // 1. Calculate unrotated bounding box edges
    let leftEdge = obj.left || 0;
    let topEdge = obj.top || 0;
    const objW = (obj.width || 0) * scaleObjX;
    const objH = (obj.height || 0) * scaleObjY;

    if (obj.originX === 'center') leftEdge -= objW / 2;
    else if (obj.originX === 'right') leftEdge -= objW;

    if (obj.originY === 'center') topEdge -= objH / 2;
    else if (obj.originY === 'bottom') topEdge -= objH;
    
    // Helper to rotate a point (px, py) around (obj.left, obj.top)
    const rotatePoint = (px, py) => {
        if (!obj.angle) return { x: px, y: py };
        const rad = obj.angle * Math.PI / 180;
        const dx = px - (obj.left || 0);
        const dy = py - (obj.top || 0);
        return {
            x: (obj.left || 0) + dx * Math.cos(rad) - dy * Math.sin(rad),
            y: (obj.top || 0) + dx * Math.sin(rad) + dy * Math.cos(rad),
        };
    };

    switch (fabricType) {
        case 'rect': {
            const bl = rotatePoint(leftEdge, topEdge + objH);
            const visX = toPdf(bl.x, cW, effW);
            const visY = toPdfY(bl.y, cH, effH);
            const w = toPdf(objW, cW, effW);
            const h = toPdf(objH, cH, effH);
            const raw = visualToRawPdfCoords(visX, visY, effW, effH, rotation);

            const fillColor = hexToRgb(obj.fill);
            const strokeColor = hexToRgb(obj.stroke);

            page.drawRectangle({
                x: raw.rawX,
                y: raw.rawY,
                width: w,
                height: h,
                color: fillColor || undefined,
                opacity: obj.opacity ?? 1,
                borderColor: strokeColor || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth, cW, effW) : undefined,
                borderOpacity: obj.opacity ?? 1,
                rotate: degrees(rotation - (obj.angle || 0)),
            });
            break;
        }

        case 'circle':
        case 'ellipse': {
            const radius = obj.radius || 0;
            const rxRaw = obj.rx !== undefined ? obj.rx : radius;
            const ryRaw = obj.ry !== undefined ? obj.ry : radius;
            
            const rx = toPdf(rxRaw * scaleObjX, cW, effW);
            const ry = toPdf(ryRaw * scaleObjY, cH, effH);
            
            const cxUnrotated = leftEdge + rxRaw * scaleObjX;
            const cyUnrotated = topEdge + ryRaw * scaleObjY;
            const centerPoint = rotatePoint(cxUnrotated, cyUnrotated);

            const visX = toPdf(centerPoint.x, cW, effW);
            const visY = toPdfY(centerPoint.y, cH, effH);
            const rawCenter = visualToRawPdfCoords(visX, visY, effW, effH, rotation);
            const rawSize = visualToRawSize(rx, ry, rotation);

            page.drawEllipse({
                x: rawCenter.rawX,
                y: rawCenter.rawY,
                xScale: rawSize.rawW,
                yScale: rawSize.rawH,
                color: hexToRgb(obj.fill) || undefined,
                borderColor: hexToRgb(obj.stroke) || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth * Math.max(scaleObjX, scaleObjY), cW, effW) : undefined,
                opacity: obj.opacity ?? 1,
                rotate: degrees(rotation - (obj.angle || 0)),
            });
            break;
        }

        case 'triangle':
        case 'arrowhead': {
            const p1 = rotatePoint(leftEdge + objW / 2, topEdge);
            const p2 = rotatePoint(leftEdge, topEdge + objH);
            const p3 = rotatePoint(leftEdge + objW, topEdge + objH);

            const rawP1 = visualToRawPdfCoords(toPdf(p1.x, cW, effW), toPdfY(p1.y, cH, effH), effW, effH, rotation);
            const rawP2 = visualToRawPdfCoords(toPdf(p2.x, cW, effW), toPdfY(p2.y, cH, effH), effW, effH, rotation);
            const rawP3 = visualToRawPdfCoords(toPdf(p3.x, cW, effW), toPdfY(p3.y, cH, effH), effW, effH, rotation);

            const path = `M ${rawP1.rawX},${rawP1.rawY} L ${rawP2.rawX},${rawP2.rawY} L ${rawP3.rawX},${rawP3.rawY} Z`;

            page.drawSvgPath(path, {
                color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                borderColor: hexToRgb(obj.stroke) || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth * Math.max(scaleObjX, scaleObjY), cW, effW) : undefined,
                opacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'line': {
            const isReverseX = obj.x1 > obj.x2;
            const isReverseY = obj.y1 > obj.y2;
            
            const startX = isReverseX ? leftEdge + objW : leftEdge;
            const startY = isReverseY ? topEdge + objH : topEdge;
            const endX = isReverseX ? leftEdge : leftEdge + objW;
            const endY = isReverseY ? topEdge : topEdge + objH;

            const p1 = rotatePoint(startX, startY);
            const p2 = rotatePoint(endX, endY);

            const rawP1 = visualToRawPdfCoords(toPdf(p1.x, cW, effW), toPdfY(p1.y, cH, effH), effW, effH, rotation);
            const rawP2 = visualToRawPdfCoords(toPdf(p2.x, cW, effW), toPdfY(p2.y, cH, effH), effW, effH, rotation);

            page.drawLine({
                start: { x: rawP1.rawX, y: rawP1.rawY },
                end: { x: rawP2.rawX, y: rawP2.rawY },
                thickness: toPdf((obj.strokeWidth * scaleObjY) || 2, cW, effW),
                color: hexToRgb(obj.stroke) || rgb(0, 0, 0),
                opacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'i-text':
        case 'textbox':
        case 'text': {
            if (!obj.text) break;

            let textContent = String(obj.text);
            if (pageNumber) textContent = textContent.replace(/\{PAGE\}/g, String(pageNumber));
            if (totalPages) textContent = textContent.replace(/\{TOTAL_PAGES\}/g, String(totalPages));
            
            if (obj.backgroundColor) {
                const bgBl = rotatePoint(leftEdge, topEdge + objH);
                const bgVisX = toPdf(bgBl.x, cW, effW);
                const bgVisY = toPdfY(bgBl.y, cH, effH);
                const bgRaw = visualToRawPdfCoords(bgVisX, bgVisY, effW, effH, rotation);
                const bgW = toPdf(objW, cW, effW);
                const bgH = toPdf(objH, cH, effH);
                const bgColor = hexToRgb(obj.backgroundColor);
                if (bgColor) {
                    page.drawRectangle({
                        x: bgRaw.rawX, y: bgRaw.rawY, width: bgW, height: bgH,
                        color: bgColor, opacity: obj.opacity ?? 1,
                        rotate: degrees(rotation - (obj.angle || 0)),
                    });
                }
            }
            
            const font = await getFont(doc, obj.fontFamily, obj.fontWeight, obj.fontStyle, textContent);
            const size = safeNum(toPdf((obj.fontSize || 14) * scaleObjY, cH, effH), 12);
            const boxWidthPdf = safeNum(toPdf(objW, cW, effW), 0);

            const lines = [];
            if (obj.textLines && Array.isArray(obj.textLines) && obj.textLines.length > 0) {
                obj.textLines.forEach(l => {
                    let str = typeof l === 'string' ? l : (l?.text || '');
                    if (pageNumber) str = str.replace(/\{PAGE\}/g, String(pageNumber));
                    if (totalPages) str = str.replace(/\{TOTAL_PAGES\}/g, String(totalPages));
                    let w = 0;
                    try { w = font.widthOfTextAtSize(str, size); } catch { w = 0; }
                    if (boxWidthPdf > 0 && w > boxWidthPdf * 1.05) {
                        lines.push(...wrapTextToWidth(str, font, size, boxWidthPdf));
                    } else {
                        lines.push(str);
                    }
                });
            } else if (textContent) {
                if ((fabricType === 'textbox' || fabricType === 'text') && boxWidthPdf > 0) {
                    lines.push(...wrapTextToWidth(textContent, font, size, boxWidthPdf));
                } else {
                    lines.push(...textContent.split('\n'));
                }
            }

            const lineSpacingMult = (obj.lineHeight && obj.lineHeight > 0) ? obj.lineHeight : 1.2;

            lines.forEach((lineText, i) => {
                let textWidthPdf = 0;
                try {
                    textWidthPdf = font.widthOfTextAtSize(lineText, size);
                } catch {
                    textWidthPdf = lineText.length * size * 0.6;
                }
                textWidthPdf = safeNum(textWidthPdf, 0);

                let alignOffsetPdf = 0;
                if (obj.textAlign === 'center') {
                    alignOffsetPdf = boxWidthPdf > 0 ? (boxWidthPdf - textWidthPdf) / 2 : -textWidthPdf / 2;
                } else if (obj.textAlign === 'right') {
                    alignOffsetPdf = boxWidthPdf > 0 ? (boxWidthPdf - textWidthPdf) : -textWidthPdf;
                } else if (obj.originX === 'center' && boxWidthPdf <= 0) {
                    alignOffsetPdf = -textWidthPdf / 2;
                }

                const lineBaseY = topEdge + ((obj.fontSize || 14) * scaleObjY) + (i * ((obj.fontSize || 14) * scaleObjY * lineSpacingMult));
                const bl = rotatePoint(leftEdge, lineBaseY);
                const xPdf = toPdf(bl.x, cW, effW);
                const yPdf = toPdfY(bl.y, cH, effH);

                const rad = obj.angle ? obj.angle * Math.PI / 180 : 0;
                const finalVisX = xPdf + alignOffsetPdf * Math.cos(rad);
                const finalVisY = yPdf - alignOffsetPdf * Math.sin(rad);
                const rawTextPt = visualToRawPdfCoords(finalVisX, finalVisY, effW, effH, rotation);

                const finalX = safeNum(rawTextPt.rawX, 0);
                const finalY = safeNum(rawTextPt.rawY, 0);

                if (lineText) {
                    try {
                        page.drawText(lineText, {
                            x: finalX, 
                            y: finalY,
                            size, font,
                            color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                            opacity: safeNum(obj.opacity, 1),
                            rotate: degrees(rotation - (obj.angle || 0)),
                        });
                    } catch (fontErr) {
                        // eslint-disable-next-line no-control-regex
                        const sanitized = lineText.replace(/[^\x00-\x7F]/g, '?');
                        page.drawText(sanitized, {
                            x: finalX, 
                            y: finalY,
                            size, font,
                            color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                            opacity: safeNum(obj.opacity, 1),
                            rotate: degrees(rotation - (obj.angle || 0)),
                        });
                    }
                }

                if (obj.underline) {
                    const lineThick = Math.max(1, size * 0.08);
                    const dUnder = size * 0.15;
                    const underStartX = finalVisX - dUnder * Math.sin(rad);
                    const underStartY = finalVisY - dUnder * Math.cos(rad);
                    const underEndX = underStartX + textWidthPdf * Math.cos(rad);
                    const underEndY = underStartY - textWidthPdf * Math.sin(rad);

                    const rawUnderStart = visualToRawPdfCoords(underStartX, underStartY, effW, effH, rotation);
                    const rawUnderEnd = visualToRawPdfCoords(underEndX, underEndY, effW, effH, rotation);

                    page.drawLine({
                        start: { x: rawUnderStart.rawX, y: rawUnderStart.rawY },
                        end: { x: rawUnderEnd.rawX, y: rawUnderEnd.rawY },
                        thickness: lineThick,
                        color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                        opacity: obj.opacity ?? 1,
                    });
                }
            });
            break;
        }

        case 'image': {
            if (!obj.src) break;
            const img = await embedImage(doc, obj.src);
            const bl = rotatePoint(leftEdge, topEdge + objH);
            const visX = toPdf(bl.x, cW, effW);
            const visY = toPdfY(bl.y, cH, effH);
            const raw = visualToRawPdfCoords(visX, visY, effW, effH, rotation);
            const w = toPdf(objW, cW, effW);
            const h = toPdf(objH, cH, effH);

            page.drawImage(img, { 
                x: raw.rawX, y: raw.rawY, width: w, height: h, 
                opacity: obj.opacity ?? 1,
                rotate: degrees(rotation - (obj.angle || 0)),
            });
            break;
        }

        case 'path': {
            // Freehand drawing — parse Fabric.js SVG path commands properly
            if (obj.path) {
                const color = hexToRgb(obj.stroke) || rgb(0, 0, 0);
                const thickness = toPdf(obj.strokeWidth || 2, cW, effW);
                const pathOffsetX = obj.pathOffset ? obj.pathOffset.x : 0;
                const pathOffsetY = obj.pathOffset ? obj.pathOffset.y : 0;
                const scaleX = obj.scaleX || 1;
                const scaleY = obj.scaleY || 1;

                const mapToRaw = (px, py) => {
                    const canvasX = (obj.left || 0) + (px - pathOffsetX) * scaleX;
                    const canvasY = (obj.top || 0) + (py - pathOffsetY) * scaleY;
                    const pt = rotatePoint(canvasX, canvasY);
                    const visX = toPdf(pt.x, cW, effW);
                    const visY = toPdfY(pt.y, cH, effH);
                    return visualToRawPdfCoords(visX, visY, effW, effH, rotation);
                };

                let curX = 0, curY = 0;

                for (const seg of obj.path) {
                    const cmd = seg[0];

                    switch (cmd) {
                        case 'M': // MoveTo
                            curX = seg[1];
                            curY = seg[2];
                            break;

                        case 'L': { // LineTo
                            const p1 = mapToRaw(curX, curY);
                            const p2 = mapToRaw(seg[1], seg[2]);

                            page.drawLine({
                                start: { x: p1.rawX, y: p1.rawY },
                                end: { x: p2.rawX, y: p2.rawY },
                                thickness, color,
                                opacity: obj.opacity ?? 1,
                            });
                            curX = seg[1];
                            curY = seg[2];
                            break;
                        }

                        case 'Q': { // Quadratic Bézier
                            const cpX = seg[1], cpY = seg[2];
                            const endQX = seg[3], endQY = seg[4];

                            const distQ = Math.hypot(endQX - curX, endQY - curY);
                            const stepsQ = Math.max(4, Math.min(32, Math.ceil(distQ / 10)));

                            let prevPxQ = curX, prevPyQ = curY;
                            for (let t = 1; t <= stepsQ; t++) {
                                const s = t / stepsQ;
                                const inv = 1 - s;
                                const px = inv*inv*curX + 2*inv*s*cpX + s*s*endQX;
                                const py = inv*inv*curY + 2*inv*s*cpY + s*s*endQY;

                                const p1 = mapToRaw(prevPxQ, prevPyQ);
                                const p2 = mapToRaw(px, py);

                                page.drawLine({
                                    start: { x: p1.rawX, y: p1.rawY },
                                    end: { x: p2.rawX, y: p2.rawY },
                                    thickness, color, opacity: obj.opacity ?? 1,
                                });
                                prevPxQ = px;
                                prevPyQ = py;
                            }
                            curX = endQX;
                            curY = endQY;
                            break;
                        }

                        case 'C': { // Cubic Bézier
                            const cp1X = seg[1], cp1Y = seg[2];
                            const cp2X = seg[3], cp2Y = seg[4];
                            const endCX = seg[5], endCY = seg[6];

                            const distC = Math.hypot(endCX - curX, endCY - curY);
                            const stepsC = Math.max(6, Math.min(64, Math.ceil(distC / 10)));

                            let prevPxC = curX, prevPyC = curY;
                            for (let t = 1; t <= stepsC; t++) {
                                const s = t / stepsC;
                                const inv = 1 - s;
                                const px = inv*inv*inv*curX + 3*inv*inv*s*cp1X + 3*inv*s*s*cp2X + s*s*s*endCX;
                                const py = inv*inv*inv*curY + 3*inv*inv*s*cp1Y + 3*inv*s*s*cp2Y + s*s*s*endCY;

                                const p1 = mapToRaw(prevPxC, prevPyC);
                                const p2 = mapToRaw(px, py);

                                page.drawLine({
                                    start: { x: p1.rawX, y: p1.rawY },
                                    end: { x: p2.rawX, y: p2.rawY },
                                    thickness, color, opacity: obj.opacity ?? 1,
                                });
                                prevPxC = px;
                                prevPyC = py;
                            }
                            curX = endCX;
                            curY = endCY;
                            break;
                        }

                        case 'Z':
                        case 'z':
                            break;

                        default:
                            if (seg.length >= 3) {
                                const p1 = mapToRaw(curX, curY);
                                const p2 = mapToRaw(seg[seg.length - 2], seg[seg.length - 1]);
                                page.drawLine({
                                    start: { x: p1.rawX, y: p1.rawY },
                                    end: { x: p2.rawX, y: p2.rawY },
                                    thickness, color, opacity: obj.opacity ?? 1,
                                });
                                curX = seg[seg.length - 2];
                                curY = seg[seg.length - 1];
                            }
                            break;
                    }
                }
            }
            break;
        }

        case 'group': {
            if (obj.objects) {
                let cx = obj.left || 0;
                let cy = obj.top || 0;
                if (obj.originX === 'left') cx += objW / 2;
                else if (obj.originX === 'right') cx -= objW / 2;
                if (obj.originY === 'top') cy += objH / 2;
                else if (obj.originY === 'bottom') cy -= objH / 2;

                for (const child of obj.objects) {
                    const childRelX = (child.left || 0) * scaleObjX;
                    const childRelY = (child.top || 0) * scaleObjY;
                    
                    let finalChildX = cx + childRelX;
                    let finalChildY = cy + childRelY;
                    
                    if (obj.angle) {
                        const rad = obj.angle * Math.PI / 180;
                        finalChildX = cx + childRelX * Math.cos(rad) - childRelY * Math.sin(rad);
                        finalChildY = cy + childRelX * Math.sin(rad) + childRelY * Math.cos(rad);
                    }

                    const adjustedChild = {
                        ...child,
                        left: finalChildX,
                        top: finalChildY,
                        scaleX: (child.scaleX || 1) * scaleObjX,
                        scaleY: (child.scaleY || 1) * scaleObjY,
                        angle: (child.angle || 0) + (obj.angle || 0),
                    };
                    await commitObject(doc, page, adjustedChild, cW, cH, effW, effH, rotation);
                }
            }
            break;
        }

        default:
            // Skip unknown types (e.g., ruler labels are text in groups)
            break;
    }
}
