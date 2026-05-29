/**
 * TextLayerHelper — PDF text extraction and spatial intersection utilities.
 *
 * Uses PDF.js getTextContent() to extract text item bounding boxes,
 * then provides spatial queries for snap-to-text functionality.
 *
 * Design: Pure spatial intersection — no linguistic word segmentation.
 * Works universally with English, Thai, CJK, and any script.
 */

/**
 * Extract text item bounding boxes from a PDF page.
 *
 * Each text item from PDF.js has a `transform` array [scaleX, skewY, skewX, scaleY, tx, ty]
 * in PDF coordinate space (origin bottom-left, Y↑). We convert these to canvas coordinates
 * (origin top-left, Y↓) using the viewport transform.
 *
 * @param {Object} page - pdfjs-dist page object
 * @param {Object} viewport - pdfjs-dist viewport (already scaled)
 * @param {number} renderScale - the RENDER_SCALE used for super-sampling (CSS size = canvas size / renderScale)
 * @returns {Promise<Array<{ str: string, x: number, y: number, width: number, height: number }>>}
 *          Bounding boxes in CSS (display) pixel coordinates
 */
export async function extractTextItems(page, viewport, renderScale = 1.5) {
    const textContent = await page.getTextContent();
    const items = [];

    for (const item of textContent.items) {
        if (!item.str || item.str.trim() === '') continue;

        // item.transform = [scaleX, skewY, skewX, scaleY, tx, ty] in PDF coords
        const tx = item.transform;

        // Convert PDF coords → viewport (canvas pixel) coords using the viewport transform
        // viewport.transform is a 6-element transform matrix [a, b, c, d, e, f]
        const vt = viewport.transform;

        // Apply viewport transform to the text origin point (tx[4], tx[5])
        const canvasX = vt[0] * tx[4] + vt[2] * tx[5] + vt[4];
        const canvasY = vt[1] * tx[4] + vt[3] * tx[5] + vt[5];

        // Scale width/height from PDF units to canvas pixels
        const fontHeight = Math.abs(tx[3]) * viewport.scale;
        const textWidth = item.width * viewport.scale;

        // Convert from render-canvas coords to CSS display coords
        const displayX = canvasX / renderScale;
        const displayY = canvasY / renderScale;
        const displayW = textWidth / renderScale;
        const displayH = fontHeight / renderScale;

        // PDF text Y is at the baseline; adjust to get top-left corner
        // canvasY after viewport transform points to the baseline position in canvas coords
        items.push({
            str: item.str,
            x: displayX,
            y: displayY - displayH, // Move from baseline to top
            width: displayW,
            height: displayH,
        });
    }

    return items;
}

/**
 * Find all text items whose bounding box intersects the given rect.
 * Uses AABB (Axis-Aligned Bounding Box) intersection test.
 *
 * @param {Array<{ x, y, width, height }>} textItems - extracted text items
 * @param {{ x: number, y: number, width: number, height: number }} rect - query rectangle
 * @returns {Array<{ x, y, width, height, str }>} - intersecting text items
 */
export function findTextItemsInRect(textItems, rect) {
    if (!textItems || !rect) return [];

    return textItems.filter(item => {
        // AABB intersection test
        const itemRight = item.x + item.width;
        const itemBottom = item.y + item.height;
        const rectRight = rect.x + rect.width;
        const rectBottom = rect.y + rect.height;

        return !(
            item.x >= rectRight ||
            itemRight <= rect.x ||
            item.y >= rectBottom ||
            itemBottom <= rect.y
        );
    });
}

/**
 * Compute the union bounding box of multiple text items.
 *
 * @param {Array<{ x, y, width, height }>} items - text items to union
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function computeUnionBounds(items) {
    if (!items || items.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of items) {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}
