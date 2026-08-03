/**
 * Pixel Comparison Engine
 * Renders PDF pages to canvas and uses pixelmatch for pixel-by-pixel diffing.
 */
import pixelmatch from 'pixelmatch';
import { detectRegions } from './regionDetector.js';

/**
 * Renders a single PDF page to an ImageData at the given scale.
 * @param {PDFDocumentProxy} pdfDoc - pdfjs document
 * @param {number} pageNum - 1-indexed page number
 * @param {number} scale - render scale (e.g., 2.0 for high-DPI)
 * @returns {Promise<{imageData: ImageData, width: number, height: number, canvas: HTMLCanvasElement}>}
 */
export async function renderPageToImageData(pdfDoc, pageNum, scale = 2.0) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

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
 * Compares two PDF pages pixel-by-pixel.
 *
 * @param {PDFDocumentProxy} basePdf - base (Rev 1) document
 * @param {PDFDocumentProxy} comparePdf - comparison (Rev 2) document
 * @param {number} pageNum - 1-indexed page number
 * @param {object} options
 * @param {number} options.threshold - pixelmatch threshold (0.0 - 1.0, default 0.1)
 * @param {number} options.renderScale - render scale for canvas (default 2.0)
 * @returns {Promise<{diffImageData: ImageData, mismatchCount: number, mismatchPercentage: number, regions: Array, width: number, height: number}>}
 */
export async function comparePagePixels(basePdf, comparePdf, pageNum, options = {}) {
  const {
    threshold = 0.1,
    renderScale = 2.0,
  } = options;

  // Render both pages
  const [baseResult, compareResult] = await Promise.all([
    renderPageToImageData(basePdf, pageNum, renderScale),
    renderPageToImageData(comparePdf, pageNum, renderScale),
  ]);

  // Ensure same dimensions by using the larger of the two
  const width = Math.max(baseResult.width, compareResult.width);
  const height = Math.max(baseResult.height, compareResult.height);

  // If dimensions differ, re-render onto canvases of the same size
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
  const mismatchPercentage = (mismatchCount / totalPixels) * 100;

  // Create diff ImageData
  const diffImageData = new ImageData(diffPixels, width, height);
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  diffCanvas.getContext('2d').putImageData(diffImageData, 0, 0);

  // Detect regions (bounding boxes) from the diff
  const regions = detectRegions(diffPixels, width, height, {
    minArea: 100,       // Minimum area (width * height)
    minPixels: 15,      // Minimum actual changed pixels
    mergeMargin: 10,    // Merge regions within 10 pixels
    scale: renderScale,
    edgeIgnore: 4,      // Ignore differences within 4 pixels of the canvas edge
  });

  return {
    diffImageData,
    diffCanvas,
    mismatchCount,
    mismatchPercentage,
    regions,
    width,
    height,
    renderScale,
    baseCanvas: baseResult.canvas,
    compareCanvas: compareResult.canvas,
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

  // Draw the original image data
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcW;
  tempCanvas.height = srcH;
  tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0);

  return ctx.getImageData(0, 0, targetW, targetH);
}
