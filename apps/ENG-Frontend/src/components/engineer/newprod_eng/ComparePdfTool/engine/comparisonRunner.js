/**
 * Comparison Runner — orchestrates the full page-by-page comparison pipeline.
 * Runs on the main thread but yields to the event loop between pages for responsiveness.
 */
import { comparePagePixels, renderPageToImageData } from './pixelCompare.js';
import { comparePageText } from './textCompare.js';

/**
 * Run comparison across all pages of two PDFs.
 *
 * @param {PDFDocumentProxy} basePdf
 * @param {PDFDocumentProxy} comparePdf
 * @param {object} options
 * @param {string} options.mode - 'pixel' | 'text' | 'both'
 * @param {number} options.threshold - pixel sensitivity (0-1)
 * @param {function} options.onProgress - callback(progress, text)
 * @param {function} options.onCancel - returns true if cancelled
 * @returns {Promise<{results: Map, diffs: Array}>}
 */
export async function runComparison(basePdf, comparePdf, options = {}) {
  const {
    mode = 'pixel',
    threshold = 0.1,
    onProgress = () => {},
    isCancelled = () => false,
  } = options;

  const basePages = basePdf.numPages;
  const comparePages = comparePdf.numPages;
  const totalPages = Math.max(basePages, comparePages);

  const results = new Map();
  const allDiffs = [];

  for (let page = 1; page <= totalPages; page++) {
    if (isCancelled()) {
      throw new Error('Comparison cancelled');
    }

    const progress = Math.round(((page - 1) / totalPages) * 100);
    onProgress(progress, `Comparing page ${page} of ${totalPages}...`);

    // Yield to event loop
    await new Promise(resolve => setTimeout(resolve, 0));

    const pageResult = {
      pixelDiffs: null,
      textDiffs: null,
      diffImageData: null,
      baseCanvas: null,
      compareCanvas: null,
    };

    const hasBasePage = page <= basePages;
    const hasComparePage = page <= comparePages;

    // Pixel comparison
    if ((mode === 'pixel' || mode === 'both') && hasBasePage && hasComparePage) {
      try {
        const pixelResult = await comparePagePixels(basePdf, comparePdf, page, {
          threshold,
          renderScale: 2.0,
        });

        pageResult.pixelDiffs = pixelResult;
        pageResult.diffImageData = pixelResult.diffImageData;
        pageResult.baseCanvas = pixelResult.baseCanvas;
        pageResult.compareCanvas = pixelResult.compareCanvas;

        // Add pixel regions as diff items
        for (const region of pixelResult.regions) {
          allDiffs.push({
            type: 'pixel',
            page,
            bbox: { x: region.x, y: region.y, width: region.width, height: region.height },
            description: `Visual change detected (${region.pixelCount} pixels)`,
            pixelCount: region.pixelCount,
          });
        }
      } catch (err) {
        console.error(`Pixel comparison failed for page ${page}:`, err);
      }
    }

    // Text comparison
    if ((mode === 'text' || mode === 'both') && hasBasePage && hasComparePage) {
      try {
        const textDiffs = await comparePageText(basePdf, comparePdf, page);
        pageResult.textDiffs = textDiffs;

        // Render canvases if we don't have them from pixel compare
        if (!pageResult.baseCanvas && hasBasePage) {
          const r = await renderPageToImageData(basePdf, page, 2.0);
          pageResult.baseCanvas = r.canvas;
        }
        if (!pageResult.compareCanvas && hasComparePage) {
          const r = await renderPageToImageData(comparePdf, page, 2.0);
          pageResult.compareCanvas = r.canvas;
        }

        // Add text changes as diff items
        for (const change of textDiffs) {
          let description = '';
          if (change.type === 'added') {
            description = `Added: "${change.newText}"`;
          } else if (change.type === 'removed') {
            description = `Removed: "${change.text}"`;
          } else if (change.type === 'modified') {
            description = `Changed: "${change.text}" → "${change.newText}"`;
          }

          allDiffs.push({
            type: `text-${change.type}`,
            page,
            bbox: { x: change.x, y: change.y, width: change.width, height: change.height },
            description,
            textOld: change.text,
            textNew: change.newText,
          });
        }
      } catch (err) {
        console.error(`Text comparison failed for page ${page}:`, err);
      }
    }

    // Handle missing pages (page only in one doc)
    if (!hasBasePage && hasComparePage) {
      const r = await renderPageToImageData(comparePdf, page, 2.0);
      pageResult.compareCanvas = r.canvas;
      allDiffs.push({
        type: 'page-added',
        page,
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        description: `Page ${page} added in Rev 2 (not in Rev 1)`,
      });
    }

    if (hasBasePage && !hasComparePage) {
      const r = await renderPageToImageData(basePdf, page, 2.0);
      pageResult.baseCanvas = r.canvas;
      allDiffs.push({
        type: 'page-removed',
        page,
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        description: `Page ${page} removed in Rev 2 (was in Rev 1)`,
      });
    }

    results.set(page, pageResult);
  }

  onProgress(100, 'Comparison complete!');

  return { results, diffs: allDiffs };
}
