/**
 * Comparison Runner — orchestrates page-by-page comparison pipeline.
 * Keeps memory footprint minimal by storing metadata only, releasing canvas buffers immediately.
 */
import { comparePagePixels } from './pixelCompare.js';
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
 * @param {function} options.isCancelled - returns true if cancelled
 * @returns {Promise<{results: Map, diffs: Array}>}
 */
export async function runComparison(basePdf, comparePdf, options = {}) {
  const {
    mode = 'both',
    threshold = 0.15,
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

    // Yield to event loop to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));

    const hasBasePage = page <= basePages;
    const hasComparePage = page <= comparePages;

    const pageResult = {
      page,
      hasBasePage,
      hasComparePage,
      pixelDiffs: null,
      textDiffs: null,
    };

    let pagePixelRegions = [];
    let pageTextChanges = [];

    // 1. Pixel comparison
    if ((mode === 'pixel' || mode === 'both') && hasBasePage && hasComparePage) {
      try {
        const pixelResult = await comparePagePixels(basePdf, comparePdf, page, {
          threshold,
          renderScale: 2.0,
        });

        pageResult.pixelDiffs = pixelResult;
        pagePixelRegions = pixelResult.regions || [];
      } catch (err) {
        console.error(`Pixel comparison failed for page ${page}:`, err);
      }
    }

    // 2. Text comparison
    if ((mode === 'text' || mode === 'both') && hasBasePage && hasComparePage) {
      try {
        const textDiffs = await comparePageText(basePdf, comparePdf, page);
        pageResult.textDiffs = textDiffs;
        pageTextChanges = textDiffs || [];
      } catch (err) {
        console.error(`Text comparison failed for page ${page}:`, err);
      }
    }

    // 3. Reconcile & Deduplicate diffs for this page
    if (mode === 'both') {
      const { mergedDiffs } = deduplicateDiffs(page, pagePixelRegions, pageTextChanges);
      allDiffs.push(...mergedDiffs);
    } else if (mode === 'pixel') {
      for (const region of pagePixelRegions) {
        allDiffs.push({
          type: 'pixel',
          page,
          bbox: { x: region.x, y: region.y, width: region.width, height: region.height },
          description: `Visual change detected (${region.pixelCount} pixels)`,
          pixelCount: region.pixelCount,
        });
      }
    } else if (mode === 'text') {
      for (const change of pageTextChanges) {
        allDiffs.push({
          type: `text-${change.type}`,
          page,
          bbox: { x: change.x, y: change.y, width: change.width, height: change.height },
          description: formatTextDescription(change),
          textOld: change.text,
          textNew: change.newText,
        });
      }
    }

    // 4. Handle pages present in only one document
    if (!hasBasePage && hasComparePage) {
      try {
        const p = await comparePdf.getPage(page);
        const vp = p.getViewport({ scale: 1.0 });
        allDiffs.push({
          type: 'page-added',
          page,
          bbox: { x: 0, y: 0, width: Math.round(vp.width), height: Math.round(vp.height) },
          description: `Page ${page} added in Rev 2 (not in Rev 1)`,
        });
      } catch {
        allDiffs.push({
          type: 'page-added',
          page,
          bbox: { x: 0, y: 0, width: 595, height: 842 },
          description: `Page ${page} added in Rev 2 (not in Rev 1)`,
        });
      }
    }

    if (hasBasePage && !hasComparePage) {
      try {
        const p = await basePdf.getPage(page);
        const vp = p.getViewport({ scale: 1.0 });
        allDiffs.push({
          type: 'page-removed',
          page,
          bbox: { x: 0, y: 0, width: Math.round(vp.width), height: Math.round(vp.height) },
          description: `Page ${page} removed in Rev 2 (was in Rev 1)`,
        });
      } catch {
        allDiffs.push({
          type: 'page-removed',
          page,
          bbox: { x: 0, y: 0, width: 595, height: 842 },
          description: `Page ${page} removed in Rev 2 (was in Rev 1)`,
        });
      }
    }

    results.set(page, pageResult);
  }

  onProgress(100, 'Comparison complete!');
  return { results, diffs: allDiffs };
}

/**
 * Format user-friendly description for text changes.
 */
function formatTextDescription(change) {
  if (change.type === 'added') {
    return `Added: "${change.newText}"`;
  }
  if (change.type === 'removed') {
    return `Removed: "${change.text}"`;
  }
  if (change.type === 'modified') {
    return `Changed: "${change.text}" → "${change.newText}"`;
  }
  return 'Text difference';
}

/**
 * Deduplicates overlapping pixel and text diffs on a single page.
 */
function deduplicateDiffs(page, pixelRegions, textChanges) {
  const mergedDiffs = [];
  const claimedPixelIndices = new Set();

  // First pass: Match text changes to any overlapping pixel regions
  for (const textChange of textChanges) {
    const textBbox = {
      x: textChange.x,
      y: textChange.y,
      width: textChange.width,
      height: textChange.height,
    };

    let matchedPixel = null;

    for (let i = 0; i < pixelRegions.length; i++) {
      if (claimedPixelIndices.has(i)) continue;
      const pix = pixelRegions[i];

      if (bboxesOverlapOrNear(textBbox, pix, 10)) {
        claimedPixelIndices.add(i);
        matchedPixel = pix;
        break;
      }
    }

    // Expand bounding box if pixel region was larger
    const finalBbox = matchedPixel ? {
      x: Math.min(textBbox.x, matchedPixel.x),
      y: Math.min(textBbox.y, matchedPixel.y),
      width: Math.max(textBbox.x + textBbox.width, matchedPixel.x + matchedPixel.width) - Math.min(textBbox.x, matchedPixel.x),
      height: Math.max(textBbox.y + textBbox.height, matchedPixel.y + matchedPixel.height) - Math.min(textBbox.y, matchedPixel.y),
    } : textBbox;

    mergedDiffs.push({
      type: `text-${textChange.type}`,
      page,
      bbox: finalBbox,
      description: formatTextDescription(textChange),
      textOld: textChange.text,
      textNew: textChange.newText,
      pixelCount: matchedPixel?.pixelCount || 0,
    });
  }

  // Second pass: Add remaining unclaimed pixel regions (graphic/drawing changes)
  for (let i = 0; i < pixelRegions.length; i++) {
    if (!claimedPixelIndices.has(i)) {
      const region = pixelRegions[i];
      mergedDiffs.push({
        type: 'pixel',
        page,
        bbox: { x: region.x, y: region.y, width: region.width, height: region.height },
        description: `Visual change detected (${region.pixelCount} pixels)`,
        pixelCount: region.pixelCount,
      });
    }
  }

  return { mergedDiffs };
}

function bboxesOverlapOrNear(a, b, margin) {
  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

