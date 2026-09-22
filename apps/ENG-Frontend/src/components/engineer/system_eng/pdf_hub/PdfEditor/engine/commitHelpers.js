import { StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * commitHelpers.js — Utilities for PDF manipulation.
 */

export const FABRIC_SERIALIZE_PROPS = [
    'id', 'customData', 'textLines', 'arrowHeadSize', 'lineCoords',
    'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
    'underline', 'textAlign', 'fill', 'stroke', 'strokeWidth',
    'opacity', 'strokeDashArray', 'rx', 'ry', 'angle', 'scaleX', 'scaleY',
    'selectable', 'evented'
];

export function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function base64ToUtf8(b64) {
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

// ── Safe number guard to prevent NaN / Infinity in PDF byte streams ──
export function safeNum(val, fallback = 0) {
    return Number.isFinite(val) ? val : fallback;
}

// ── Color conversion ──
export function hexToRgb(color) {
    if (!color || color === 'transparent') return null;
    
    let c = color;
    if (typeof c !== 'string') {
        if (typeof c.toHexString === 'function') c = c.toHexString();
        else if (typeof c.toRgbString === 'function') c = c.toRgbString();
        else return null;
    }
    if (typeof c !== 'string') return null;
    c = c.trim();
    
    // Handle rgb() and rgba()
    if (c.startsWith('rgb')) {
        const matches = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (matches) {
            return rgb(parseInt(matches[1], 10) / 255, parseInt(matches[2], 10) / 255, parseInt(matches[3], 10) / 255);
        }
    }
    
    // Handle hex
    let hex = c.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
    if (hex.length === 8) hex = hex.substring(0, 6); // Strip alpha
    
    if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return rgb(r, g, b);
    }
    
    return null;
}

// ── Coordinate conversion: Fabric.js → PDF ──
export function toPdf(val, canvasSize, pdfSize) {
    const cSize = safeNum(canvasSize, 0);
    const pSize = safeNum(pdfSize, 0);
    if (cSize <= 0) return safeNum(val, 0);
    return safeNum(val * (pSize / cSize), 0);
}

export function toPdfY(val, canvasH, pdfH) {
    const cH = safeNum(canvasH, 0);
    const pH = safeNum(pdfH, 0);
    if (cH <= 0) return safeNum(val, 0);
    return safeNum(pH - val * (pH / cH), 0);
}

// ── Map font family to pdf-lib StandardFonts ──
export const FONT_MAP = {
    'Helvetica': StandardFonts.Helvetica,
    'Arial': StandardFonts.Helvetica,
    'Times New Roman': StandardFonts.TimesRoman,
    'Times': StandardFonts.TimesRoman,
    'Courier New': StandardFonts.Courier,
    'Courier': StandardFonts.Courier,
    'Georgia': StandardFonts.TimesRoman,
    'monospace': StandardFonts.Courier,
};

// Global memory buffer cache for raw TTF array buffers across documents
const rawFontBufferCache = {};

/**
 * Get or embed font into document.
 * Implements single-instance caching per PDFDocument so fonts are embedded
 * at most once per document, preventing memory bloat and corrupted xref tables.
 */
export async function getFont(doc, fontFamily, fontWeight, fontStyle, sampleText = '') {
    if (!doc._fontCache) {
        doc._fontCache = new Map();
    }

    const isBold = fontWeight === 'bold' || fontWeight >= 700;
    const isItalic = fontStyle === 'italic';

    // Check if sample text contains non-ASCII characters (e.g. Thai, Unicode)
    // eslint-disable-next-line no-control-regex
    const isPureAscii = !sampleText || /^[\x00-\x7F]*$/.test(sampleText);

    // 1. Standard Fonts Path (0ms, 0 network requests, pure standard PDF)
    if (isPureAscii) {
        const familyKey = (fontFamily || 'Helvetica').toLowerCase();
        let stdFontKey = StandardFonts.Helvetica;

        if (familyKey.includes('times') || familyKey.includes('georgia')) {
            if (isBold && isItalic) stdFontKey = StandardFonts.TimesRomanBoldItalic;
            else if (isBold) stdFontKey = StandardFonts.TimesRomanBold;
            else if (isItalic) stdFontKey = StandardFonts.TimesRomanItalic;
            else stdFontKey = StandardFonts.TimesRoman;
        } else if (familyKey.includes('courier') || familyKey.includes('mono')) {
            if (isBold && isItalic) stdFontKey = StandardFonts.CourierBoldOblique;
            else if (isBold) stdFontKey = StandardFonts.CourierBold;
            else if (isItalic) stdFontKey = StandardFonts.CourierOblique;
            else stdFontKey = StandardFonts.Courier;
        } else {
            // Default Helvetica / Arial
            if (isBold && isItalic) stdFontKey = StandardFonts.HelveticaBoldOblique;
            else if (isBold) stdFontKey = StandardFonts.HelveticaBold;
            else if (isItalic) stdFontKey = StandardFonts.HelveticaOblique;
            else stdFontKey = StandardFonts.Helvetica;
        }

        const cacheKey = `std_${stdFontKey}`;
        if (doc._fontCache.has(cacheKey)) {
            return doc._fontCache.get(cacheKey);
        }

        const embedded = await doc.embedFont(stdFontKey);
        doc._fontCache.set(cacheKey, embedded);
        return embedded;
    }

    // 2. Unicode / Thai Font Path
    const ttfCacheKey = `ttf_${isBold ? 'b' : 'n'}_${isItalic ? 'i' : 'n'}`;
    if (doc._fontCache.has(ttfCacheKey)) {
        return doc._fontCache.get(ttfCacheKey);
    }

    if (!doc.defaultFontLoaded) {
        try {
            doc.registerFontkit(fontkit);
            doc.defaultFontLoaded = true;
        } catch (fkErr) {
            console.warn('[commitHelpers] Failed to register fontkit:', fkErr);
        }
    }

    try {
        if (!rawFontBufferCache['tahoma']) {
            let res = null;
            // First check local static assets in public/fonts/sarabun/
            try {
                if (typeof window !== 'undefined' && window.location?.origin) {
                    const localRes = await fetch('/fonts/sarabun/tahoma.ttf');
                    if (localRes.ok) res = localRes;
                }
            } catch {
                // Ignore local fetch error, proceed to fallback
            }

            // Secondary intranet fallback
            if (!res) {
                try {
                    const altRes = await fetch('/fonts/sarabun/Sarabun-Regular.ttf');
                    if (altRes.ok) res = altRes;
                } catch {
                    // Ignore
                }
            }

            if (res && res.ok) {
                rawFontBufferCache['tahoma'] = await res.arrayBuffer();
            }
        }

        if (rawFontBufferCache['tahoma']) {
            const customFont = await doc.embedFont(rawFontBufferCache['tahoma']);
            doc._fontCache.set(ttfCacheKey, customFont);
            return customFont;
        }
    } catch (e) {
        console.warn('[commitHelpers] Custom font loading failed, falling back to StandardFonts:', e.message);
    }

    // Fallback to StandardFonts
    const fallbackFontKey = isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
    const fallbackStd = await doc.embedFont(fallbackFontKey);
    doc._fontCache.set(ttfCacheKey, fallbackStd);
    return fallbackStd;
}

// ── Embed image (handles data URLs, blob URLs, and HTTP URLs; tries PNG first, then JPG) ──
export async function embedImage(doc, imageSrc) {
    if (!imageSrc) throw new Error('No image source provided');
    let bytes;

    if (typeof imageSrc === 'string' && imageSrc.startsWith('data:')) {
        const raw = imageSrc.replace(/^data:image\/\w+;base64,/, '');
        bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    } else if (typeof imageSrc === 'string' && (imageSrc.startsWith('blob:') || imageSrc.startsWith('http') || imageSrc.startsWith('/'))) {
        const res = await fetch(imageSrc);
        const buf = await res.arrayBuffer();
        bytes = new Uint8Array(buf);
    } else if (imageSrc instanceof Uint8Array) {
        bytes = imageSrc;
    } else {
        const raw = String(imageSrc).replace(/^data:image\/\w+;base64,/, '');
        bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    }

    try {
        return await doc.embedPng(bytes);
    } catch {
        return await doc.embedJpg(bytes);
    }
}

// ── Shared Math Constants ──
const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;
export const MM_TO_POINTS = POINTS_PER_INCH / MM_PER_INCH; // 1mm ≈ 2.835pt

export function mmToPoints(mm) {
    return mm * MM_TO_POINTS;
}

/**
 * Convert Fabric.js screen coords → PDF point coords.
 * PDF: origin bottom-left, Y↑.  Screen: origin top-left, Y↓.
 */
export function screenToPdfCoords(sx, sy, canvasW, canvasH, pageW, pageH) {
    const scaleX = pageW / canvasW;
    const scaleY = pageH / canvasH;
    return {
        pdfX: sx * scaleX,
        pdfY: pageH - sy * scaleY,
    };
}

// ══════════════════════════════════════════════════════════════════
// Rotation-Aware Helpers
// ══════════════════════════════════════════════════════════════════

/**
 * Get the effective (visual) page size, accounting for /Rotate.
 *
 * pdf-lib's `page.getSize()` returns the raw MediaBox dimensions WITHOUT
 * considering the page's /Rotate attribute.  A landscape PDF that is stored
 * as a portrait MediaBox + /Rotate 90 will report {width:595, height:842}
 * even though it renders as 842×595.
 *
 * This helper swaps width/height when rotation is 90° or 270° so that
 * the returned dimensions match what PDF.js viewport (and the Fabric canvas)
 * actually display.
 *
 * @param {import('pdf-lib').PDFPage} page
 * @returns {{ width: number, height: number, rotation: number }}
 */
export function getEffectivePageSize(page) {
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle || 0;
    const normalizedRotation = ((rotation % 360) + 360) % 360;

    if (normalizedRotation === 90 || normalizedRotation === 270) {
        return { width: height, height: width, rotation: normalizedRotation };
    }
    return { width, height, rotation: normalizedRotation };
}

/**
 * Transform Fabric.js canvas coordinates into the RAW pdf-lib coordinate space,
 * accounting for page rotation.
 *
 * The Fabric canvas uses the EFFECTIVE (visual) coordinate system (same as PDF.js viewport).
 * But pdf-lib draws onto the RAW MediaBox.  When there is a /Rotate, the raw coordinate
 * system is rotated relative to the visual one.  We must "un-rotate" the visual coordinates
 * back into the raw MediaBox space.
 *
 * Visual vs Raw coordinate mapping:
 *   Rotation 0:   rawX = visX,          rawY = visY        (identity)
 *   Rotation 90:  rawX = visY,          rawY = effW - visX  (CW 90)
 *   Rotation 180: rawX = effW - visX,   rawY = effH - visY  (flip both)
 *   Rotation 270: rawX = effH - visY,   rawY = visX          (CW 270)
 *
 * Where effW/effH are the EFFECTIVE (visual) page dimensions in PDF points,
 * and visX/visY are already mapped from canvas → effective PDF coords.
 *
 * @param {number} visX - X in effective (visual) PDF space
 * @param {number} visY - Y in effective (visual) PDF space (origin bottom-left, Y↑)
 * @param {number} effW - Effective page width (visual)
 * @param {number} effH - Effective page height (visual)
 * @param {number} rotation - Page rotation in degrees (0, 90, 180, 270)
 * @returns {{ rawX: number, rawY: number }}
 */
export function visualToRawPdfCoords(visX, visY, effW, effH, rotation) {
    const rot = ((rotation % 360) + 360) % 360;
    switch (rot) {
        case 90:
            return { rawX: effH - visY, rawY: visX };
        case 180:
            return { rawX: effW - visX, rawY: effH - visY };
        case 270:
            return { rawX: visY, rawY: effW - visX };
        default: // 0 or unrecognized
            return { rawX: visX, rawY: visY };
    }
}

/**
 * Transform a width/height in effective PDF space into raw MediaBox space.
 * Rotation 90/270 swaps width↔height.
 */
export function visualToRawSize(w, h, rotation) {
    const rot = ((rotation % 360) + 360) % 360;
    if (rot === 90 || rot === 270) {
        return { rawW: h, rawH: w };
    }
    return { rawW: w, rawH: h };
}

/**
 * Get placement (x, y, rotation) for drawing an upright or rotated element (image/rectangle)
 * onto a PDF page that may have /Rotate set.
 *
 * @param {number} visX - Visual bottom-left X
 * @param {number} visY - Visual bottom-left Y
 * @param {number} visW - Visual width
 * @param {number} visH - Visual height
 * @param {number} effW - Effective visual page width
 * @param {number} effH - Effective visual page height
 * @param {number} pageRotation - Page /Rotate angle in degrees
 * @param {number} [objAngle=0] - Additional clockwise rotation angle of the object in degrees
 * @returns {{ x: number, y: number, width: number, height: number, rotate: import('pdf-lib').Rotation }}
 */
export function getRawPlacement(visX, visY, visW, visH, effW, effH, pageRotation, objAngle = 0) {
    const rot = ((pageRotation % 360) + 360) % 360;
    const combinedAngle = (rot - (objAngle || 0));

    let x = visX;
    let y = visY;

    switch (rot) {
        case 90:
            x = effH - visY;
            y = visX;
            break;
        case 180:
            x = effW - visX;
            y = effH - visY;
            break;
        case 270:
            x = visY;
            y = effW - visX;
            break;
        default:
            x = visX;
            y = visY;
            break;
    }

    return {
        x,
        y,
        width: visW,
        height: visH,
        rotateDegrees: combinedAngle,
    };
}

