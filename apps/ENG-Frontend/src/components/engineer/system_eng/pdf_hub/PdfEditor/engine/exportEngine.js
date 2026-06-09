/**
 * exportEngine.js — Handles exporting PDF pages to image blobs.
 */

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
