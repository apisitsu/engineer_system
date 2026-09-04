import { StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * commitHelpers.js — Utilities for PDF manipulation.
 */

// ── Color conversion ──
export function hexToRgb(color) {
    if (!color || color === 'transparent') return null;
    
    // Handle rgb() and rgba()
    if (color.startsWith('rgb')) {
        const matches = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (matches) {
            return rgb(parseInt(matches[1], 10) / 255, parseInt(matches[2], 10) / 255, parseInt(matches[3], 10) / 255);
        }
    }
    
    // Handle hex
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
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
    return val * (pdfSize / canvasSize);
}

export function toPdfY(val, canvasH, pdfH) {
    return pdfH - val * (pdfH / canvasH);
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

const fontCache = {};

export async function getFont(doc, fontFamily, fontWeight, fontStyle) {
    if (!doc.defaultFontLoaded) {
        doc.registerFontkit(fontkit);
        doc.defaultFontLoaded = true;
    }

    let fontName = 'Sarabun-Regular.ttf';
    const isBold = fontWeight === 'bold' || fontWeight >= 700;
    const isItalic = fontStyle === 'italic';

    if (isBold && isItalic) fontName = 'Sarabun-BoldItalic.ttf';
    else if (isBold) fontName = 'Sarabun-Bold.ttf';
    else if (isItalic) fontName = 'Sarabun-Italic.ttf';

    const cacheKey = fontName;

    try {
        if (!fontCache[cacheKey]) {
            let res = null;
            // 1. Try local/intranet static assets first
            try {
                if (typeof window !== 'undefined' && window.location?.origin) {
                    const localRes = await fetch(`/fonts/sarabun/${fontName}`);
                    if (localRes.ok) res = localRes;
                }
            } catch {
                // Ignore local fetch error, try CDN fallback
            }

            // 2. Fallback to public CDN
            if (!res) {
                const fontUrl = `https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/${fontName}`;
                res = await fetch(fontUrl);
            }

            if (!res || !res.ok) throw new Error('Font fetch failed');
            fontCache[cacheKey] = await res.arrayBuffer();
        }
        return await doc.embedFont(fontCache[cacheKey]);
    } catch (e) {
        console.warn('Failed to load custom font, falling back to StandardFonts', e);
        const stdFont = FONT_MAP[fontFamily] || StandardFonts.Helvetica;
        return await doc.embedFont(stdFont);
    }
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
    switch (rotation) {
        case 90:
            return { rawX: visY, rawY: effW - visX };
        case 180:
            return { rawX: effW - visX, rawY: effH - visY };
        case 270:
            return { rawX: effH - visY, rawY: visX };
        default: // 0 or unrecognized
            return { rawX: visX, rawY: visY };
    }
}

/**
 * Transform a width/height in effective PDF space into raw MediaBox space.
 * Rotation 90/270 swaps width↔height.
 */
export function visualToRawSize(w, h, rotation) {
    if (rotation === 90 || rotation === 270) {
        return { rawW: h, rawH: w };
    }
    return { rawW: w, rawH: h };
}

