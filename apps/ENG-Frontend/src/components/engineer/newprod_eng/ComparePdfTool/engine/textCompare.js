/**
 * Text Comparison Engine
 * Extracts text with positions from PDF pages using pdfjs-dist,
 * sorts them in visual reading order, and computes diffs reliably.
 */

/**
 * Extracts text items with their positions from a PDF page and sorts geometrically.
 * @param {PDFDocumentProxy} pdfDoc
 * @param {number} pageNum - 1-indexed
 * @returns {Promise<Array<{text: string, x: number, y: number, width: number, height: number}>>}
 */
export async function extractPageText(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });

  const rawItems = [];
  for (const item of textContent.items) {
    if (!item.str || item.str.trim() === '') continue;

    // pdfjs gives transform as [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const tx = item.transform;
    const x = tx[4];
    // PDF y-origin is bottom-left, convert to top-left
    const y = viewport.height - tx[5];
    const width = item.width || 10;
    const height = item.height || Math.abs(tx[3]) || 12;

    rawItems.push({
      text: item.str,
      x: Math.round(x * 10) / 10,
      y: Math.round((y - height) * 10) / 10,  // y is the top of the text
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
    });
  }

  // Geometric sort: Group by line (tolerance 4px), then sort left-to-right by x
  rawItems.sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 4) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  return rawItems;
}

/**
 * Compare text content between two PDF pages.
 * @param {PDFDocumentProxy} basePdf
 * @param {PDFDocumentProxy} comparePdf
 * @param {number} pageNum
 * @returns {Promise<Array<{type: string, text: string, newText: string, x: number, y: number, width: number, height: number, page: number}>>}
 */
export async function comparePageText(basePdf, comparePdf, pageNum) {
  const [baseItems, compareItems] = await Promise.all([
    extractPageText(basePdf, pageNum),
    extractPageText(comparePdf, pageNum),
  ]);

  // Build word mappings
  const baseWords = tokenizeItems(baseItems);
  const compareWords = tokenizeItems(compareItems);

  // Run fast token diff
  const diffs = computeTokenDiff(
    baseWords.map(w => w.text),
    compareWords.map(w => w.text)
  );

  // Convert diff results to positioned changes
  const changes = [];
  let baseIdx = 0;
  let compIdx = 0;

  for (const op of diffs) {
    switch (op.type) {
      case 'equal':
        baseIdx += op.count;
        compIdx += op.count;
        break;

      case 'delete': {
        for (let i = 0; i < op.count; i++) {
          const word = baseWords[baseIdx + i];
          if (word) {
            changes.push({
              type: 'removed',
              text: word.text,
              newText: '',
              x: word.x,
              y: word.y,
              width: word.width,
              height: word.height,
              page: pageNum,
            });
          }
        }
        baseIdx += op.count;
        break;
      }

      case 'insert': {
        for (let i = 0; i < op.count; i++) {
          const word = compareWords[compIdx + i];
          if (word) {
            changes.push({
              type: 'added',
              text: '',
              newText: word.text,
              x: word.x,
              y: word.y,
              width: word.width,
              height: word.height,
              page: pageNum,
            });
          }
        }
        compIdx += op.count;
        break;
      }

      default:
        break;
    }
  }

  // Merge adjacent changes into "modified"
  return mergeAdjacentChanges(changes);
}

/**
 * Tokenize text items into individual words with accurate proportional bounding boxes.
 */
function tokenizeItems(items) {
  const words = [];

  for (const item of items) {
    const text = item.text;
    const parts = text.split(/(\s+)/);

    if (parts.length <= 1) {
      const trimmed = text.trim();
      if (trimmed) {
        words.push({
          text: trimmed,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        });
      }
      continue;
    }

    let offsetX = 0;
    const totalChars = Math.max(text.length, 1);

    for (const part of parts) {
      const partLen = part.length;
      const partW = (item.width * partLen) / totalChars;
      const trimmed = part.trim();

      if (trimmed) {
        words.push({
          text: trimmed,
          x: Math.round((item.x + offsetX) * 10) / 10,
          y: item.y,
          width: Math.round(partW * 10) / 10,
          height: item.height,
        });
      }
      offsetX += partW;
    }
  }

  return words;
}

/**
 * Merge adjacent 'removed' + 'added' at similar positions into 'modified'.
 */
function mergeAdjacentChanges(changes) {
  const merged = [];
  let i = 0;

  while (i < changes.length) {
    if (
      i + 1 < changes.length &&
      changes[i].type === 'removed' &&
      changes[i + 1].type === 'added' &&
      Math.abs(changes[i].y - changes[i + 1].y) <= 8
    ) {
      merged.push({
        type: 'modified',
        text: changes[i].text,
        newText: changes[i + 1].newText,
        x: Math.min(changes[i].x, changes[i + 1].x),
        y: Math.min(changes[i].y, changes[i + 1].y),
        width: Math.max(changes[i].x + changes[i].width, changes[i + 1].x + changes[i + 1].width) - Math.min(changes[i].x, changes[i + 1].x),
        height: Math.max(changes[i].height, changes[i + 1].height),
        page: changes[i].page,
      });
      i += 2;
    } else {
      merged.push(changes[i]);
      i++;
    }
  }

  return merged;
}

/**
 * High-performance lookahead token diff algorithm.
 * Guarantees no stack overflow and handles common words without deleting them.
 */
function computeTokenDiff(a, b) {
  const ops = [];
  let ai = 0;
  let bi = 0;

  while (ai < a.length && bi < b.length) {
    if (a[ai] === b[bi]) {
      ops.push({ type: 'equal', count: 1 });
      ai++;
      bi++;
      continue;
    }

    // Lookahead search window up to 40 tokens
    const maxLookahead = 40;
    let foundA = -1;
    let foundB = -1;

    const limitA = Math.min(ai + maxLookahead, a.length);
    const limitB = Math.min(bi + maxLookahead, b.length);

    for (let k = 1; ai + k < limitA; k++) {
      if (a[ai + k] === b[bi]) {
        foundA = k;
        break;
      }
    }

    for (let k = 1; bi + k < limitB; k++) {
      if (b[bi + k] === a[ai]) {
        foundB = k;
        break;
      }
    }

    if (foundA !== -1 && (foundB === -1 || foundA <= foundB)) {
      for (let k = 0; k < foundA; k++) {
        ops.push({ type: 'delete', count: 1 });
        ai++;
      }
    } else if (foundB !== -1) {
      for (let k = 0; k < foundB; k++) {
        ops.push({ type: 'insert', count: 1 });
        bi++;
      }
    } else {
      ops.push({ type: 'delete', count: 1 });
      ops.push({ type: 'insert', count: 1 });
      ai++;
      bi++;
    }
  }

  while (ai < a.length) {
    ops.push({ type: 'delete', count: 1 });
    ai++;
  }

  while (bi < b.length) {
    ops.push({ type: 'insert', count: 1 });
    bi++;
  }

  return compressOps(ops);
}

function compressOps(ops) {
  if (ops.length === 0) return ops;

  const compressed = [ops[0]];
  for (let i = 1; i < ops.length; i++) {
    if (ops[i].type === compressed[compressed.length - 1].type) {
      compressed[compressed.length - 1].count += ops[i].count;
    } else {
      compressed.push({ ...ops[i] });
    }
  }
  return compressed;
}

