import { PDFDocument, rgb, degrees, BlendMode } from 'pdf-lib';
import { hexToRgb, toPdf, toPdfY, getFont, embedImage } from './commitHelpers';

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
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = doc.getPages();

    // ══════════════════════════════════════════════════════════════════
    // PRE-PASS: Normalize page rotation
    //
    // Landscape PDFs are often stored as portrait MediaBox + /Rotate 90.
    // PDF.js viewport accounts for this → Fabric canvas is landscape.
    // But pdf-lib draws on raw MediaBox which is still portrait.
    //
    // FIX: For any rotated page, adjust the MediaBox to match the visual
    // dimensions and set rotation to 0.  This makes the raw coordinate
    // space identical to the visual space, so all existing coordinate
    // math (toPdf, toPdfY) works correctly without further changes.
    // ══════════════════════════════════════════════════════════════════
    for (const page of pages) {
        const rotation = page.getRotation().angle || 0;
        const normalizedRotation = ((rotation % 360) + 360) % 360;

        if (normalizedRotation !== 0) {
            const { width, height } = page.getSize(); // Raw MediaBox

            if (normalizedRotation === 90 || normalizedRotation === 270) {
                // Swap MediaBox dimensions to match the visual layout
                page.setSize(height, width);
            }
            // Remove rotation — the MediaBox now represents the visual layout directly
            page.setRotation(degrees(0));
        }
    }

    // ── Commit highlights per page (drawn first so text stays on top) ──
    if (pageHighlights) {
        for (const [pageNumStr, highlights] of Object.entries(pageHighlights)) {
            const pageIdx = parseInt(pageNumStr) - 1;
            if (isNaN(pageIdx) || pageIdx < 0 || pageIdx >= pages.length || !highlights?.length) continue;

            const page = pages[pageIdx];
            const { width: pW, height: pH } = page.getSize();

            // Get canvas dimensions from the annotation data for this page, or use PDF dims
            const fabricData = pageAnnotations[pageNumStr];
            const cW = fabricData?._canvasWidth || pW;
            const cH = fabricData?._canvasHeight || pH;

            for (const hl of highlights) {
                const color = hexToRgb(hl.color || '#ffeb3b');
                if (!color) continue;

                let x, y, w, h;
                if (hl.normX !== undefined) {
                    x = hl.normX * pW;
                    y = pH - ((hl.normY + hl.normH) * pH);
                    w = hl.normW * pW;
                    h = hl.normH * pH;
                } else {
                    x = toPdf(hl.x, cW, pW);
                    y = toPdfY(hl.y + hl.height, cH, pH);
                    w = toPdf(hl.width, cW, pW);
                    h = toPdf(hl.height, cH, pH);
                }

                page.drawRectangle({
                    x, y, width: w, height: h,
                    color,
                    opacity: 0.5,
                    blendMode: BlendMode.Multiply,
                });
            }
        }
    }

    // ── Commit Fabric.js annotations per page ──
    for (const [pageNumStr, fabricData] of Object.entries(pageAnnotations)) {
        const pageIdx = parseInt(pageNumStr) - 1;
        if (isNaN(pageIdx) || pageIdx < 0 || pageIdx >= pages.length) continue;

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
    if (!obj) return;
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
            const x = toPdf(bl.x, cW, pW);
            const y = toPdfY(bl.y, cH, pH);
            const w = toPdf(objW, cW, pW);
            const h = toPdf(objH, cH, pH);

            const fillColor = hexToRgb(obj.fill);
            const strokeColor = hexToRgb(obj.stroke);

            page.drawRectangle({
                x, y, width: w, height: h,
                color: fillColor || undefined,
                opacity: obj.opacity ?? 1,
                borderColor: strokeColor || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth, cW, pW) : undefined,
                borderOpacity: obj.opacity ?? 1,
                rotate: obj.angle ? degrees(-obj.angle) : undefined,
            });
            break;
        }

        case 'circle':
        case 'ellipse': {
            const radius = obj.radius || 0;
            const rxRaw = obj.rx !== undefined ? obj.rx : radius;
            const ryRaw = obj.ry !== undefined ? obj.ry : radius;
            
            const rx = toPdf(rxRaw * scaleObjX, cW, pW);
            const ry = toPdf(ryRaw * scaleObjY, cH, pH);
            
            const cxUnrotated = leftEdge + rxRaw * scaleObjX;
            const cyUnrotated = topEdge + ryRaw * scaleObjY;
            const centerPoint = rotatePoint(cxUnrotated, cyUnrotated);

            page.drawEllipse({
                x: toPdf(centerPoint.x, cW, pW),
                y: toPdfY(centerPoint.y, cH, pH),
                xScale: rx, yScale: ry,
                color: hexToRgb(obj.fill) || undefined,
                borderColor: hexToRgb(obj.stroke) || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth * Math.max(scaleObjX, scaleObjY), cW, pW) : undefined,
                opacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'triangle':
        case 'arrowhead': {
            const p1 = rotatePoint(leftEdge + objW / 2, topEdge);
            const p2 = rotatePoint(leftEdge, topEdge + objH);
            const p3 = rotatePoint(leftEdge + objW, topEdge + objH);

            const path = `M ${toPdf(p1.x, cW, pW)},${toPdfY(p1.y, cH, pH)} L ${toPdf(p2.x, cW, pW)},${toPdfY(p2.y, cH, pH)} L ${toPdf(p3.x, cW, pW)},${toPdfY(p3.y, cH, pH)} Z`;

            page.drawSvgPath(path, {
                color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                borderColor: hexToRgb(obj.stroke) || undefined,
                borderWidth: obj.strokeWidth ? toPdf(obj.strokeWidth * Math.max(scaleObjX, scaleObjY), cW, pW) : undefined,
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

            page.drawLine({
                start: { x: toPdf(p1.x, cW, pW), y: toPdfY(p1.y, cH, pH) },
                end: { x: toPdf(p2.x, cW, pW), y: toPdfY(p2.y, cH, pH) },
                thickness: toPdf((obj.strokeWidth * scaleObjY) || 2, cW, pW),
                color: hexToRgb(obj.stroke) || rgb(0, 0, 0),
                opacity: obj.opacity ?? 1,
            });
            break;
        }

        case 'i-text':
        case 'textbox':
        case 'text': {
            if (!obj.text) break;
            
            if (obj.backgroundColor) {
                const bgBl = rotatePoint(leftEdge, topEdge + objH);
                const bgX = toPdf(bgBl.x, cW, pW);
                const bgY = toPdfY(bgBl.y, cH, pH);
                const bgW = toPdf(objW, cW, pW);
                const bgH = toPdf(objH, cH, pH);
                const bgColor = hexToRgb(obj.backgroundColor);
                if (bgColor) {
                    page.drawRectangle({
                        x: bgX, y: bgY, width: bgW, height: bgH,
                        color: bgColor, opacity: obj.opacity ?? 1,
                        rotate: obj.angle ? degrees(-obj.angle) : undefined,
                    });
                }
            }
            
            const font = await getFont(doc, obj.fontFamily, obj.fontWeight, obj.fontStyle);
            const size = toPdf((obj.fontSize || 14) * scaleObjY, cH, pH);
            
            const lines = [];
            if (obj.textLines && Array.isArray(obj.textLines) && obj.textLines.length > 0) {
                obj.textLines.forEach(l => lines.push(typeof l === 'string' ? l : (l.text || '')));
            } else if (obj.text) {
                lines.push(...obj.text.split('\n'));
            }
            
            lines.forEach((lineText, i) => {
                const textWidthPdf = font.widthOfTextAtSize(lineText, size);
                const boxWidthPdf = toPdf(objW, cW, pW);

                let alignOffsetPdf = 0;
                if (obj.textAlign === 'center') {
                    alignOffsetPdf = (boxWidthPdf - textWidthPdf) / 2;
                } else if (obj.textAlign === 'right') {
                    alignOffsetPdf = boxWidthPdf - textWidthPdf;
                }

                const lineBaseY = topEdge + ((obj.fontSize || 14) * scaleObjY) + (i * ((obj.fontSize || 14) * scaleObjY * 1.2));
                const bl = rotatePoint(leftEdge, lineBaseY);
                const xPdf = toPdf(bl.x, cW, pW);
                const yPdf = toPdfY(bl.y, cH, pH);

                const rad = obj.angle ? obj.angle * Math.PI / 180 : 0;
                const finalX = xPdf + alignOffsetPdf * Math.cos(rad);
                const finalY = yPdf - alignOffsetPdf * Math.sin(rad);

                page.drawText(lineText, {
                    x: finalX, 
                    y: finalY,
                    size, font,
                    color: hexToRgb(obj.fill) || rgb(0, 0, 0),
                    opacity: obj.opacity ?? 1,
                    rotate: obj.angle ? degrees(-obj.angle) : undefined,
                });

                if (obj.underline) {
                    const lineThick = Math.max(1, size * 0.08);
                    const dUnder = size * 0.15;
                    const underStartX = finalX - dUnder * Math.sin(rad);
                    const underStartY = finalY - dUnder * Math.cos(rad);
                    const underEndX = underStartX + textWidthPdf * Math.cos(rad);
                    const underEndY = underStartY - textWidthPdf * Math.sin(rad);

                    page.drawLine({
                        start: { x: underStartX, y: underStartY },
                        end: { x: underEndX, y: underEndY },
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
            const x = toPdf(bl.x, cW, pW);
            const y = toPdfY(bl.y, cH, pH);
            const w = toPdf(objW, cW, pW);
            const h = toPdf(objH, cH, pH);

            page.drawImage(img, { 
                x, y, width: w, height: h, 
                opacity: obj.opacity ?? 1,
                rotate: obj.angle ? degrees(-obj.angle) : undefined,
            });
            break;
        }

        case 'path': {
            // Freehand drawing — parse Fabric.js SVG path commands properly
            if (obj.path) {
                const color = hexToRgb(obj.stroke) || rgb(0, 0, 0);
                const thickness = toPdf(obj.strokeWidth || 2, cW, pW);
                const offsetX = obj.left || 0;
                const offsetY = obj.top || 0;

                let curX = 0, curY = 0;

                for (const seg of obj.path) {
                    const cmd = seg[0];

                    switch (cmd) {
                        case 'M': // MoveTo
                            curX = seg[1];
                            curY = seg[2];
                            break;

                        case 'L': { // LineTo
                            const x1 = toPdf(curX + offsetX, cW, pW);
                            const y1 = toPdfY(curY + offsetY, cH, pH);
                            const x2 = toPdf(seg[1] + offsetX, cW, pW);
                            const y2 = toPdfY(seg[2] + offsetY, cH, pH);

                            page.drawLine({
                                start: { x: x1, y: y1 },
                                end: { x: x2, y: y2 },
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

                            // Dynamically calculate steps based on distance (#21)
                            const distQ = Math.hypot(endQX - curX, endQY - curY);
                            const stepsQ = Math.max(4, Math.min(32, Math.ceil(distQ / 10)));

                            let prevPxQ = curX, prevPyQ = curY;
                            for (let t = 1; t <= stepsQ; t++) {
                                const s = t / stepsQ;
                                const inv = 1 - s;
                                // Quadratic Bézier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
                                const px = inv*inv*curX + 2*inv*s*cpX + s*s*endQX;
                                const py = inv*inv*curY + 2*inv*s*cpY + s*s*endQY;

                                page.drawLine({
                                    start: { x: toPdf(prevPxQ + offsetX, cW, pW), y: toPdfY(prevPyQ + offsetY, cH, pH) },
                                    end: { x: toPdf(px + offsetX, cW, pW), y: toPdfY(py + offsetY, cH, pH) },
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

                            // Dynamically calculate steps based on distance (#21)
                            const distC = Math.hypot(endCX - curX, endCY - curY);
                            const stepsC = Math.max(6, Math.min(64, Math.ceil(distC / 10)));

                            let prevPxC = curX, prevPyC = curY;
                            for (let t = 1; t <= stepsC; t++) {
                                const s = t / stepsC;
                                const inv = 1 - s;
                                // Cubic Bézier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
                                const px = inv*inv*inv*curX + 3*inv*inv*s*cp1X + 3*inv*s*s*cp2X + s*s*s*endCX;
                                const py = inv*inv*inv*curY + 3*inv*inv*s*cp1Y + 3*inv*s*s*cp2Y + s*s*s*endCY;

                                page.drawLine({
                                    start: { x: toPdf(prevPxC + offsetX, cW, pW), y: toPdfY(prevPyC + offsetY, cH, pH) },
                                    end: { x: toPdf(px + offsetX, cW, pW), y: toPdfY(py + offsetY, cH, pH) },
                                    thickness, color, opacity: obj.opacity ?? 1,
                                });
                                prevPxC = px;
                                prevPyC = py;
                            }
                            curX = endCX;
                            curY = endCY;
                            break;
                        }

                        case 'Z': // ClosePath — line back to start (rarely used in freehand)
                        case 'z':
                            break;

                        default:
                            // Fallback: treat last two values as endpoint
                            if (seg.length >= 3) {
                                const fx1 = toPdf(curX + offsetX, cW, pW);
                                const fy1 = toPdfY(curY + offsetY, cH, pH);
                                const fx2 = toPdf(seg[seg.length - 2] + offsetX, cW, pW);
                                const fy2 = toPdfY(seg[seg.length - 1] + offsetY, cH, pH);
                                page.drawLine({
                                    start: { x: fx1, y: fy1 },
                                    end: { x: fx2, y: fy2 },
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
