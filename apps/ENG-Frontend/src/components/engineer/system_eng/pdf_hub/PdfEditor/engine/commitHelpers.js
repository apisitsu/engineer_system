import { StandardFonts, rgb } from 'pdf-lib';

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

export async function getFont(doc, fontFamily) {
    const stdFont = FONT_MAP[fontFamily] || StandardFonts.Helvetica;
    return await doc.embedFont(stdFont);
}

// ── Embed image (try PNG first, fallback to JPG) ──
export async function embedImage(doc, base64Data) {
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
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

