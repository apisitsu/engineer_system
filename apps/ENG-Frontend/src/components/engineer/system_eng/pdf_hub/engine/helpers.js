import { PDFDocument } from 'pdf-lib';

/**
 * Converts a hex color string to {r, g, b} values in the range 0..1 (for pdf-lib)
 * @param {string} hex 
 * @returns {{r: number, g: number, b: number}}
 */
export function rgb01(hex) {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/**
 * Reads a File or Blob as a Uint8Array
 * @param {File|Blob} file 
 * @returns {Promise<Uint8Array>}
 */
export function fileBytes(file) {
    return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(new Uint8Array(fr.result));
        fr.onerror = rej;
        fr.readAsArrayBuffer(file);
    });
}

/**
 * Converts a data URL (e.g. from canvas.toDataURL) to a Uint8Array
 * @param {string} dataUrl 
 * @returns {Uint8Array}
 */
export function dataUrlBytes(dataUrl) {
    const b64 = dataUrl.split(',')[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

/**
 * Downloads a Uint8Array or Blob as a file
 * @param {Uint8Array|Blob} bytes 
 * @param {string} name 
 * @param {string} mime 
 */
export function download(bytes, name, mime = 'application/pdf') {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = name;
    document.body.appendChild(a); 
    a.click(); 
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Creates a blank PDF with a single page (A4 size by default)
 * @param {number} w Width in points
 * @param {number} h Height in points
 * @returns {Promise<Uint8Array>}
 */
export async function blankPdf(w = 595.28, h = 841.89) {
    const doc = await PDFDocument.create();
    doc.addPage([w, h]);
    return await doc.save();
}
