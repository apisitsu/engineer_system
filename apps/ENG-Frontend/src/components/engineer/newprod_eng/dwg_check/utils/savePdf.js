import { PDFDocument, rgb, StandardFonts, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Save annotations into the PDF using pdf-lib
 * @param {ArrayBuffer} originalPdfData - original PDF bytes
 * @param {Array} annotations - all annotations
 * @returns {Uint8Array} modified PDF bytes
 */
export async function savePdfWithAnnotations(originalPdfData, annotations, embedEditableData = true) {
    // TopBar now guarantees a fresh ArrayBuffer created from the File/Blob
    const pdfDoc = await PDFDocument.load(originalPdfData);

    // Register fontkit to support custom fonts
    pdfDoc.registerFontkit(fontkit);

    let thaiFont = null;
    try {
        // Embed Thai Font (Sarabun) - Full TTF from Google Fonts repo includes both Latin and Thai
        const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf';
        const fontBytes = await fetch(fontUrl).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch font: ${res.statusText}`);
            return res.arrayBuffer();
        });
        thaiFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
        console.warn('Could not load Thai font, falling back to standard font. Thai characters may display incorrectly.', e);
    }

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const zapfFont = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);

    for (const ann of annotations) {
        const pageIndex = ann.pageIndex - 1; // convert from 1-indexed to 0-indexed
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        const rotationAngle = page.getRotation().angle;

        // Helper function to convert visual coordinates (top-left origin, y-down)
        // to native PDF coordinates (bottom-left origin, y-up), considering page rotation.
        const mapToNative = (vx, vy) => {
            let nx = 0, ny = 0;
            if (rotationAngle === 90 || rotationAngle === -270) {
                // Visual (0,0) is Native (0,0)
                // Visual X (right) -> Native Y (up)
                // Visual Y (down) -> Native X (right)
                nx = vy;
                ny = vx;
            } else if (rotationAngle === 180 || rotationAngle === -180) {
                // Visual (0,0) is Native (W,0)
                // Visual X (right) -> Native X (left)
                // Visual Y (down) -> Native Y (up)
                nx = pageWidth - vx;
                ny = vy;
            } else if (rotationAngle === 270 || rotationAngle === -90) {
                // Visual (0,0) is Native (W,H)
                // Visual X (right) -> Native Y (down)
                // Visual Y (down) -> Native X (left)
                nx = pageWidth - vy;
                ny = pageHeight - vx;
            } else { // 0 degrees
                // Visual (0,0) is Native (0,H)
                // Visual X (right) -> Native X (right)
                // Visual Y (down) -> Native Y (down)
                nx = vx;
                ny = pageHeight - vy;
            }
            return { x: nx, y: ny };
        };

        const annWidth = ann.width;
        const annHeight = ann.height;

        // Map the 4 bounding box corners to find native bounding box for shapes
        const pTL = mapToNative(ann.x, ann.y);
        const pTR = mapToNative(ann.x + annWidth, ann.y);
        const pBL = mapToNative(ann.x, ann.y + annHeight);
        const pBR = mapToNative(ann.x + annWidth, ann.y + annHeight);

        const nativeMinX = Math.min(pTL.x, pTR.x, pBL.x, pBR.x);
        const nativeMinY = Math.min(pTL.y, pTR.y, pBL.y, pBR.y);
        const nativeMaxX = Math.max(pTL.x, pTR.x, pBL.x, pBR.x);
        const nativeMaxY = Math.max(pTL.y, pTR.y, pBL.y, pBR.y);

        const rectW = nativeMaxX - nativeMinX;
        const rectH = nativeMaxY - nativeMinY;

        // Rotation needed to make elements visually upright.
        // If page is rotated 90CW (+90), we rotate elements 90CCW (-90) natively.
        const drawRotationObj = { type: 'degrees', angle: -rotationAngle };
        const drawRotationRad = -rotationAngle * (Math.PI / 180);

        switch (ann.type) {
            case 'highlight-rect': {
                const color = parseColor(ann.color);
                page.drawRectangle({
                    x: nativeMinX,
                    y: nativeMinY,
                    width: rectW,
                    height: rectH,
                    color: rgb(color.r, color.g, color.b),
                    opacity: color.a || 0.4,
                });
                break;
            }
            case 'highlight-ellipse': {
                const color = parseColor(ann.color);
                page.drawEllipse({
                    x: nativeMinX + rectW / 2,
                    y: nativeMinY + rectH / 2,
                    xScale: rectW / 2,
                    yScale: rectH / 2,
                    color: rgb(color.r, color.g, color.b),
                    opacity: color.a || 0.4,
                });
                break;
            }
            case 'shape-rect': {
                const color = parseColor(ann.color);
                const thickness = ann.thickness || 1;
                page.drawRectangle({
                    x: nativeMinX,
                    y: nativeMinY,
                    width: rectW,
                    height: rectH,
                    borderColor: rgb(color.r, color.g, color.b),
                    borderWidth: thickness,
                    opacity: 1,
                });
                break;
            }
            case 'shape-ellipse': {
                const color = parseColor(ann.color);
                const thickness = ann.thickness || 1;
                page.drawEllipse({
                    x: nativeMinX + rectW / 2,
                    y: nativeMinY + rectH / 2,
                    xScale: rectW / 2,
                    yScale: rectH / 2,
                    borderColor: rgb(color.r, color.g, color.b),
                    borderWidth: thickness,
                    opacity: 1,
                });
                break;
            }
            case 'text-box': {
                if (ann.text) {
                    const fontSize = ann.fontSize * 1.1 || 14;
                    const color = hexToRgb(ann.fontColor || '#333333');
                    const usedFont = thaiFont || font;

                    const lines = ann.text.split(/\r?\n/);
                    const lineHeight = fontSize * 1.5;

                    lines.forEach((line, index) => {
                        let textX = ann.x;
                        const textWidth = usedFont.widthOfTextAtSize(line, fontSize);

                        if (ann.textAlign === 'center') {
                            textX = ann.x + (ann.width / 2) - (textWidth / 2);
                        } else if (ann.textAlign === 'right') {
                            textX = ann.x + ann.width - textWidth;
                        }

                        // The visual Y coordinate for the baseline of this line
                        // Add a small padding offset so it aligns with the HTML rendering
                        const ptY = ann.y + (fontSize * 0.9) + (index * lineHeight);
                        const textVisualPt = mapToNative(textX, ptY + 7);

                        page.drawText(line, {
                            x: textVisualPt.x,
                            y: textVisualPt.y,
                            size: fontSize,
                            font: usedFont,
                            color: rgb(color.r, color.g, color.b),
                            rotate: drawRotationObj
                        });
                    });
                }
                break;
            }
            case 'arrow': {
                const color = parseColor(ann.color);
                const rgbColor = rgb(color.r, color.g, color.b);
                const thickness = ann.thickness || 1;

                // ใช้ points array เป็นหลัก, fallback เป็น 4 จุด orthogonal จาก x/y/width/height
                let points = ann.points;
                if (!points || points.length < 2) {
                    const sx = ann.x || 100, sy = ann.y || 100;
                    const w = ann.width || 200, h = ann.height || 100;
                    points = [
                        { x: sx, y: sy },
                        { x: sx + w / 2, y: sy },
                        { x: sx + w / 2, y: sy + h },
                        { x: sx + w, y: sy + h }
                    ];
                }

                // วาดท่อนเส้นทั้งหมดจาก points
                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = mapToNative(points[i].x, points[i].y);
                    const p2 = mapToNative(points[i + 1].x, points[i + 1].y);
                    page.drawLine({ start: p1, end: p2, thickness: thickness, color: rgbColor, opacity: color.a || 1 });
                }

                // คำนวณมุมหัวลูกศรจากท่อนแรกและท่อนสุดท้าย
                const firstPt = points[0], secondPt = points[1];
                const lastPt = points[points.length - 1], prevPt = points[points.length - 2];
                const startAngle = Math.atan2(secondPt.y - firstPt.y, secondPt.x - firstPt.x);
                const endAngle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x);

                const drawHead = (type, visualX, visualY, headAngle, isStart) => {
                    if (type === 'none') return;

                    const size = Math.max(10, thickness * 5);
                    const basePt = mapToNative(visualX, visualY);

                    if (type === 'circle') {
                        // วงกลมกลวง (ขอบสี + พื้นขาว) ให้ตรงกับ canvas preview
                        page.drawCircle({
                            x: basePt.x,
                            y: basePt.y,
                            size: thickness * 2.5,
                            borderColor: rgbColor,
                            borderWidth: thickness,
                            color: rgb(1, 1, 1),
                            opacity: color.a || 1,
                        });
                    } else if (type === 'arrow') {
                        const direction = isStart ? headAngle + Math.PI : headAngle;

                        const p1xVisual = visualX - size * Math.cos(direction - Math.PI / 6);
                        const p1yVisual = visualY - size * Math.sin(direction - Math.PI / 6);

                        const p2xVisual = visualX - size * Math.cos(direction + Math.PI / 6);
                        const p2yVisual = visualY - size * Math.sin(direction + Math.PI / 6);

                        const np1 = mapToNative(p1xVisual, p1yVisual);
                        const np2 = mapToNative(p2xVisual, p2yVisual);

                        // Rasterize filled triangle via dense lines
                        const steps = Math.ceil(size * 2);
                        for (let i = 0; i <= steps; i++) {
                            const frac = i / steps;
                            const mx = np1.x + (np2.x - np1.x) * frac;
                            const my = np1.y + (np2.y - np1.y) * frac;
                            page.drawLine({ start: basePt, end: { x: mx, y: my }, thickness: 1.5, color: rgbColor, opacity: color.a || 1 });
                        }
                    }
                };

                drawHead(ann.headStart || 'none', firstPt.x, firstPt.y, startAngle, true);
                drawHead(ann.headEnd || 'arrow', lastPt.x, lastPt.y, endAngle, false);

                break;
            }
            case 'stamp-check':
            case 'stamp-cross': {
                const isCheck = ann.type === 'stamp-check';
                const color = hexToRgb(ann.color || (isCheck ? '#27ae60' : '#e74c3c'));
                const size = ann.width || 30; // visual size
                const fontSize = size * 0.8;
                const text = isCheck ? '\u2713' : '\u2715';
                const textWidth = zapfFont.widthOfTextAtSize(text, fontSize);

                // Visual center of the stamp box
                const centerX = ann.x + size / 2;
                const centerY = ann.y + size / 2;

                // Visual text baseline is slightly below center
                // We want to visually offset it so it anchors properly
                const textVisualX = centerX - textWidth / 2;
                const textVisualY = centerY + size * 0.3; // Baseline is typically lower than center

                const textPt = mapToNative(textVisualX, textVisualY);

                page.drawText(text, {
                    x: textPt.x,
                    y: textPt.y,
                    size: fontSize,
                    font: zapfFont,
                    color: rgb(color.r, color.g, color.b),
                    rotate: drawRotationObj
                });
                break;
            }
            case 'stamp-circle': {
                const color = hexToRgb(ann.color || '#e74c3c');
                const size = ann.width || 30;
                const r = size / 2;
                const centerPt = mapToNative(ann.x + r, ann.y + r);

                page.drawCircle({
                    x: centerPt.x,
                    y: centerPt.y,
                    size: r,
                    borderColor: rgb(color.r, color.g, color.b),
                    borderWidth: 2,
                    opacity: 1,
                });
                break;
            }
            case 'stamp-ok': {
                const color = hexToRgb(ann.color || '#e74c3c');
                const size = ann.width || 30;
                const r = size / 2;
                const centerPt = mapToNative(ann.x + r, ann.y + r);
                const usedFont = thaiFont || font;

                // Draw circle border
                page.drawCircle({
                    x: centerPt.x,
                    y: centerPt.y,
                    size: r,
                    borderColor: rgb(color.r, color.g, color.b),
                    borderWidth: 2,
                    opacity: 1,
                });

                // Draw "OK" text centered
                const okFontSize = size * 0.45;
                const okText = 'OK';
                const okWidth = usedFont.widthOfTextAtSize(okText, okFontSize);
                const textVisualX = ann.x + r - okWidth / 2;
                const textVisualY = ann.y + r + okFontSize * 0.35;
                const textPt = mapToNative(textVisualX, textVisualY);

                page.drawText(okText, {
                    x: textPt.x,
                    y: textPt.y,
                    size: okFontSize,
                    font: usedFont,
                    color: rgb(color.r, color.g, color.b),
                    rotate: drawRotationObj,
                });
                break;
            }
            case 'stamp-userdate': {
                const name = ann.userName || 'Reviewer';
                const date = ann.date || '';
                const dept = ann.department || 'DEPT';

                const size = ann.width || 80;
                const r = size / 2;

                // Visual Center of the stamp circle
                const centerPt = mapToNative(ann.x + r, ann.y + r);
                const cx = centerPt.x;
                const cy = centerPt.y;

                const color = hexToRgb(ann.color || ann.fontColor || '#e74c3c');
                const usedFont = thaiFont || font;

                // Helper to draw curved text
                const drawTextCurved = (page, text, cx, cy, radius, centerAngle, isTop, font, fontSize, textColor) => {
                    if (!text) return;

                    const textWidth = font.widthOfTextAtSize(text, fontSize);
                    const totalAngle = textWidth / radius; // angle in radians

                    let currentAngle;
                    if (isTop) { // Top arc, traverse CW (angle decreases)
                        currentAngle = centerAngle + (totalAngle / 2);
                    } else { // Bottom arc, traverse CCW (angle increases)
                        currentAngle = centerAngle - (totalAngle / 2);
                    }

                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const charWidth = font.widthOfTextAtSize(char, fontSize);
                        const charAngle = charWidth / radius;

                        // Adjust currentAngle to be the start of the character's baseline
                        if (isTop) {
                            currentAngle -= charAngle;
                        }

                        // Apply base rotation to the position angle
                        const posAngle = currentAngle + drawRotationRad;
                        const x = cx + radius * Math.cos(posAngle);
                        const y = cy + radius * Math.sin(posAngle);

                        let rotation;
                        if (isTop) {
                            rotation = currentAngle - Math.PI / 2 + drawRotationRad;
                        } else {
                            rotation = currentAngle + Math.PI / 2 + drawRotationRad;
                        }

                        page.drawText(char, {
                            x,
                            y,
                            size: fontSize,
                            font: font,
                            color: textColor,
                            rotate: { type: 'radians', angle: rotation },
                        });

                        if (!isTop) {
                            currentAngle += charAngle;
                        }
                    }
                };

                // 1. Draw Circle (Background & Border)
                page.drawCircle({
                    x: cx,
                    y: cy,
                    size: r,
                    color: rgb(1, 1, 1), // White fill
                    opacity: 1,
                });
                page.drawCircle({
                    x: cx,
                    y: cy,
                    size: r,
                    borderColor: rgb(color.r, color.g, color.b),
                    borderWidth: 2,
                    opacity: 1,
                });

                // 2. Draw Dividers (rotated)
                const dyRaw = r * 0.36; // 36% of r matches y=32 and y=68 in 100x100 SVG
                const dxRaw = Math.sqrt(r * r - dyRaw * dyRaw);

                // Function to rotate a point around origin (0,0)
                const rotPt = (x, y, rad) => {
                    return {
                        x: x * Math.cos(rad) - y * Math.sin(rad),
                        y: x * Math.sin(rad) + y * Math.cos(rad)
                    };
                };

                // Top Line
                const tStart = rotPt(-dxRaw, dyRaw, drawRotationRad);
                const tEnd = rotPt(dxRaw, dyRaw, drawRotationRad);
                page.drawLine({
                    start: { x: cx + tStart.x, y: cy + tStart.y },
                    end: { x: cx + tEnd.x, y: cy + tEnd.y },
                    thickness: 1.5,
                    color: rgb(color.r, color.g, color.b),
                });

                // Bottom Line
                const bStart = rotPt(-dxRaw, -dyRaw, drawRotationRad);
                const bEnd = rotPt(dxRaw, -dyRaw, drawRotationRad);
                page.drawLine({
                    start: { x: cx + bStart.x, y: cy + bStart.y },
                    end: { x: cx + bEnd.x, y: cy + bEnd.y },
                    thickness: 1.5,
                    color: rgb(color.r, color.g, color.b),
                });

                // 3. Draw Text (Circular and Straight)
                const textColor = rgb(color.r, color.g, color.b);

                // Department (Top, Straight)
                const deptSize = size * 0.15;
                const deptWidth = usedFont.widthOfTextAtSize(dept, deptSize);
                const deptPt = rotPt(-(deptWidth / 2), (r * 0.50), drawRotationRad);
                page.drawText(dept, {
                    x: cx + deptPt.x,
                    y: cy + deptPt.y,
                    size: deptSize,
                    font: usedFont,
                    color: textColor,
                    rotate: drawRotationObj
                });

                // Date (Middle, Straight)
                const dateSize = size * 0.14;
                const dateWidth = usedFont.widthOfTextAtSize(date, dateSize);
                const datePt = rotPt(-(dateWidth / 2), -(r * 0.12), drawRotationRad);
                page.drawText(date, {
                    x: cx + datePt.x,
                    y: cy + datePt.y,
                    size: dateSize,
                    font: usedFont,
                    color: textColor,
                    rotate: drawRotationObj
                });

                // Name (Bottom, Center 270 deg)
                const textRadius = r * 0.86;
                const nameSize = size * 0.14;
                drawTextCurved(page, name, cx, cy - 1, textRadius, 3 * Math.PI / 2, false, usedFont, nameSize, textColor);

                break;
            }
        }
    }

    if (embedEditableData) {
        // --- EMBED METADATA FOR RE-EDITING ---
        // We attach the original Clean PDF and the Annotations JSON.
        // When this PDF is opened in our app, we can extract these to restore the full editable state.
        // 1. Attach Original PDF
        await pdfDoc.attach(originalPdfData, 'source.pdf', {
            mimeType: 'application/pdf',
            description: 'Original source PDF before annotations',
            creationDate: new Date(),
            modificationDate: new Date(),
        });

        // 2. Attach Annotations JSON
        const jsonString = JSON.stringify(annotations, null, 2);
        const jsonBytes = new TextEncoder().encode(jsonString);
        await pdfDoc.attach(jsonBytes, 'annotations.json', {
            mimeType: 'application/json',
            description: 'Editable annotation data',
            creationDate: new Date(),
            modificationDate: new Date(),
        });
    }

    return await pdfDoc.save();
}

/**
 * Manually extract attachments from a PDFDocument
 * pdf-lib v1.17.1 does not provide a high-level API for reading attachments.
 * @param {PDFDocument} pdfDoc
 * @returns {Object} Map of filename -> Uint8Array
 */
export function extractAttachments(pdfDoc) {
    const attachments = {};
    const catalog = pdfDoc.catalog;

    // 1. Get Names dictionary
    const names = catalog.lookup(PDFName.of('Names'));
    if (!names || !(names instanceof PDFDict)) return attachments;

    // 2. Get EmbeddedFiles dictionary
    const embeddedFiles = names.lookup(PDFName.of('EmbeddedFiles'));
    if (!embeddedFiles || !(embeddedFiles instanceof PDFDict)) return attachments;

    // 3. Get Names array (which contains the file mapping)
    const filesArray = embeddedFiles.lookup(PDFName.of('Names'));
    if (!filesArray || !(filesArray instanceof PDFArray)) return attachments;

    // Traverse the array: [name1, fileSpec1, name2, fileSpec2, ...]
    for (let i = 0; i < filesArray.size(); i += 2) {
        const nameObj = filesArray.lookup(i);
        const fileSpecObj = filesArray.lookup(i + 1);

        // Resolve name
        let name = null;
        if (nameObj instanceof PDFString || nameObj instanceof PDFHexString) {
            name = nameObj.decodeText();
        }

        if (!name) continue;

        // Resolve file spec
        const fileSpec = fileSpecObj;
        if (!(fileSpec instanceof PDFDict)) continue;

        // Get EF (EmbeddedFile) dictionary
        const ef = fileSpec.lookup(PDFName.of('EF'));
        if (!ef || !(ef instanceof PDFDict)) continue;

        // Get F (File Stream)
        const embeddedFileStream = ef.lookup(PDFName.of('F'));

        // pdf-lib handles references (PDFRef) automatically in lookup, returning the PDFStream object?
        // Sometimes it returns the Ref if not dereferenced? catalog.lookup matches context.

        if (!embeddedFileStream) continue;

        // Check for PDFStream specifically by instance check or method
        // Note: In some bundles, instanceof might fail if multiple versions of pdf-lib exist (rare here).
        // Safer to check for method.

        if (typeof embeddedFileStream.getContents === 'function') {
            try {
                const data = embeddedFileStream.getContents();
                attachments[name] = data;
            } catch (err) {
                console.warn(`Failed to read content for attachment ${name}`, err);
            }
        } else {
            console.warn(`Attachment ${name} stream found but does not have getContents()`, embeddedFileStream);
        }
    }

    return attachments;
}


function parseColor(colorStr) {
    if (!colorStr) return { r: 1, g: 0.92, b: 0.23, a: 0.4 };

    // rgba format
    const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1]) / 255,
            g: parseInt(rgbaMatch[2]) / 255,
            b: parseInt(rgbaMatch[3]) / 255,
            a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
        };
    }

    // hex format
    if (colorStr.startsWith('#')) {
        return hexToRgb(colorStr);
    }

    return { r: 1, g: 0.92, b: 0.23, a: 0.4 };
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}
