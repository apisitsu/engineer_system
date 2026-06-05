/**
 * bufferHelpers.js — Data conversion utilities for PDF Hub.
 *
 * Handles base64 ↔ Buffer conversions and numeric parsing with defaults.
 */

/**
 * Convert a base64 string to a Node.js Buffer.
 * Returns null if input is falsy.
 */
function base64ToBuffer(base64String) {
    if (!base64String) return null;
    return Buffer.from(base64String, 'base64');
}

/**
 * Convert a Buffer (BYTEA) to a base64 string.
 * Returns null if input is falsy.
 */
function bufferToBase64(buffer) {
    if (!buffer) return null;
    return buffer.toString('base64');
}

/**
 * Parse a numeric string to float with a fallback default.
 *
 * @param {*} value - The value to parse
 * @param {number} defaultValue - Fallback if parsing fails
 * @returns {number}
 */
function parseNumeric(value, defaultValue) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse stamp dimension fields with standard defaults.
 *
 * @param {Object} row - Database row with dimension fields
 * @returns {Object} Row with parsed numeric dimensions
 */
function parseStampDimensions(row) {
    return {
        ...row,
        stamp_width_mm: parseNumeric(row.stamp_width_mm, 40.0),
        stamp_height_mm: parseNumeric(row.stamp_height_mm, 40.0),
        sig_width_mm: parseNumeric(row.sig_width_mm, 50.0),
        sig_height_mm: parseNumeric(row.sig_height_mm, 20.0),
    };
}

module.exports = {
    base64ToBuffer,
    bufferToBase64,
    parseNumeric,
    parseStampDimensions,
};
