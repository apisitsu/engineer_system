/**
 * Pixel Comparison Engine
 * Renders PDF pages to canvas and uses pixelmatch for pixel-by-pixel diffing.
 * Optimized for low memory footprint and on-demand rendering.
 */
import pixelmatch from 'pixelmatch';
import { detectRegions } from './regionDetector.js';

/**
 * Renders a single PDF page to an offscreen canvas and returns ImageData.
 * @param {PDFDocumentProxy} pdfDoc - pdfjs document
 * @param {number} pageNum - 1-indexed page number
 * @param {number} scale - render scale (e.g., 2.0 for high-DPI)
 * @returns {Promise<{imageData: ImageData, width: number, height: number, canvas: HTMLCanvasElement}>}
 */
export async function renderPageToImageData(pdfDoc, pageNum, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Fill with white to prevent transparent background alpha-noise
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    imageData,
    width: canvas.width,
    height: canvas.height,
    canvas,
  };
}

/**
 * Helper to render a page directly to an existing canvas element (used by ViewerArea).
 */
export async function renderPageToCanvas(pdfDoc, pageNum, scale, canvas) {
  if (!pdfDoc || !canvas) return null;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({ canvasContext: ctx, viewport });
  await renderTask.promise;

  return {
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Compares two PDF pages pixel-by-pixel and extracts bounding box regions.
 * Cleans up temporary canvas and image buffers immediately to prevent memory leaks.
 *
 * @param {PDFDocumentProxy} basePdf - base (Rev 1) document
 * @param {PDFDocumentProxy} comparePdf - comparison (Rev 2) document
 * @param {number} pageNum - 1-indexed page number
 * @param {object} options
 * @param {number} options.threshold - pixelmatch threshold (0.0 - 1.0, default 0.15)
 * @param {number} options.renderScale - render scale for canvas (default 2.0)
 * @returns {Promise<{mismatchCount: number, mismatchPercentage: number, regions: Array, width: number, height: number, renderScale: number}>}
 */
export async function comparePagePixels(basePdf, comparePdf, pageNum, options = {}) {
  const {
    threshold = 0.15,
    renderScale = 2.0,
  } = options;

  // Render both pages
  const [baseResult, compareResult] = await Promise.all([
    renderPageToImageData(basePdf, pageNum, renderScale),
    renderPageToImageData(comparePdf, pageNum, renderScale),
  ]);

  const width = Math.max(baseResult.width, compareResult.width);
  const height = Math.max(baseResult.height, compareResult.height);

  // Normalize image data to matching dimensions
  const baseData = normalizeImageData(baseResult.imageData, baseResult.width, baseResult.height, width, height);
  const compareData = normalizeImageData(compareResult.imageData, compareResult.width, compareResult.height, width, height);

  // Run pixelmatch
  const diffPixels = new Uint8ClampedArray(width * height * 4);
  const mismatchCount = pixelmatch(
    baseData.data,
    compareData.data,
    diffPixels,
    width,
    height,
    {
      threshold,
      includeAA: false,  // Skip anti-aliasing differences
      alpha: 0,          // Transparent background for unchanged pixels
    }
  );

  const totalPixels = width * height;
  const mismatchPercentage = totalPixels > 0 ? (mismatchCount / totalPixels) * 100 : 0;

  // Detect regions (bounding boxes) from the diff
  const regions = detectRegions(diffPixels, width, height, {
    minArea: 80,
    minPixels: 12,
    mergeMargin: 12,
    scale: renderScale,
    edgeIgnore: 4,
  });

  // Free memory immediately by resetting canvas dimensions
  baseResult.canvas.width = 0;
  baseResult.canvas.height = 0;
  compareResult.canvas.width = 0;
  compareResult.canvas.height = 0;

  return {
    mismatchCount,
    mismatchPercentage,
    regions,
    width,
    height,
    renderScale,
  };
}

/**
 * Normalize ImageData to a specific width/height (pad with white if smaller).
 */
function normalizeImageData(imageData, srcW, srcH, targetW, targetH) {
  if (srcW === targetW && srcH === targetH) {
    return imageData;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);

  // Draw the original image data aligned at (0, 0)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcW;
  tempCanvas.height = srcH;
  tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0);

  const result = ctx.getImageData(0, 0, targetW, targetH);

  // Clean up
  tempCanvas.width = 0;
  tempCanvas.height = 0;
  canvas.width = 0;
  canvas.height = 0;

  return result;
}

/**
 * Render visual diff on-demand for the current page (used by OverlayView).
 */
export async function renderDiffOnDemand(basePdf, comparePdf, pageNum, scale, targetCanvas, threshold = 0.15) {
  if (!basePdf || !comparePdf || !targetCanvas) return;

  const [baseResult, compareResult] = await Promise.all([
    renderPageToImageData(basePdf, pageNum, scale),
    renderPageToImageData(comparePdf, pageNum, scale),
  ]);

  const width = Math.max(baseResult.width, compareResult.width);
  const height = Math.max(baseResult.height, compareResult.height);

  targetCanvas.width = width;
  targetCanvas.height = height;

  const baseData = normalizeImageData(baseResult.imageData, baseResult.width, baseResult.height, width, height);
  const compareData = normalizeImageData(compareResult.imageData, compareResult.width, compareResult.height, width, height);

  const diffPixels = new Uint8ClampedArray(width * height * 4);
  pixelmatch(
    baseData.data,
    compareData.data,
    diffPixels,
    width,
    height,
    {
      threshold,
      includeAA: false,
      alpha: 0,
    }
  );

  const diffImageData = new ImageData(diffPixels, width, height);
  const ctx = targetCanvas.getContext('2d');
  ctx.putImageData(diffImageData, 0, 0);

  // Cleanup
  baseResult.canvas.width = 0;
  baseResult.canvas.height = 0;
  compareResult.canvas.width = 0;
  compareResult.canvas.height = 0;
}

