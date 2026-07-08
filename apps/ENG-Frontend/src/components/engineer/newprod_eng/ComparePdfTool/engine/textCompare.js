/**
 * Text Comparison Engine
 * Extracts text with positions from PDF pages using pdfjs-dist
 * and computes word-level diffs using the Myers diff algorithm.
 */

/**
 * Extracts text items with their positions from a PDF page.
 * @param {PDFDocumentProxy} pdfDoc
 * @param {number} pageNum - 1-indexed
 * @returns {Promise<Array<{text: string, x: number, y: number, width: number, height: number}>>}
 */
export async function extractPageText(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });

  const items = [];
  for (const item of textContent.items) {
    if (!item.str || item.str.trim() === '') continue;

    // pdfjs gives transform as [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const tx = item.transform;
    const x = tx[4];
    // PDF y-origin is bottom-left, convert to top-left
    const y = viewport.height - tx[5];
    const width = item.width;
    const height = item.height || Math.abs(tx[3]) || 12;

    items.push({
      text: item.str,
      x,
      y: y - height,  // Adjust so y is the top of the text
      width,
      height,
    });
  }

  return items;
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

  // Build full text strings and word mappings
  const baseWords = tokenizeItems(baseItems);
  const compareWords = tokenizeItems(compareItems);

  // Run Myers diff on the word sequences
  const diffs = myersDiff(
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
        // Words removed in Rev 2
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
        // Words added in Rev 2
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
    }
  }

  // Merge adjacent changes into "modified" where applicable
  return mergeAdjacentChanges(changes);
}

/**
 * Tokenize text items into individual words with positions.
 */
function tokenizeItems(items) {
  const words = [];
  for (const item of items) {
    const parts = item.text.split(/(\s+)/);
    let offsetX = 0;
    const charWidth = item.width / Math.max(item.text.length, 1);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        words.push({
          text: trimmed,
          x: item.x + offsetX,
          y: item.y,
          width: charWidth * part.length,
          height: item.height,
        });
      }
      offsetX += charWidth * part.length;
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
      Math.abs(changes[i].y - changes[i + 1].y) < 5
    ) {
      // Merge into modified
      merged.push({
        type: 'modified',
        text: changes[i].text,
        newText: changes[i + 1].newText,
        x: Math.min(changes[i].x, changes[i + 1].x),
        y: Math.min(changes[i].y, changes[i + 1].y),
        width: Math.max(changes[i].width, changes[i + 1].width),
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

// ═══════════════════════════════════════════════════════
// Myers Diff Algorithm — word-level
// ═══════════════════════════════════════════════════════

/**
 * Implementation of the Myers diff algorithm.
 * Returns an array of operations: { type: 'equal'|'delete'|'insert', count: number }
 *
 * @param {string[]} a - original sequence
 * @param {string[]} b - new sequence
 * @returns {Array<{type: string, count: number}>}
 */
function myersDiff(a, b) {
  const N = a.length;
  const M = b.length;
  const MAX = N + M;

  if (MAX === 0) return [];

  // For very large documents, fall back to a simpler LCS approach
  if (MAX > 10000) {
    return simpleDiff(a, b);
  }

  const V = new Array(2 * MAX + 1);
  V[MAX + 1] = 0;

  const trace = [];

  for (let d = 0; d <= MAX; d++) {
    const newV = [...V];
    trace.push([...V]);

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && V[MAX + k - 1] < V[MAX + k + 1])) {
        x = V[MAX + k + 1];
      } else {
        x = V[MAX + k - 1] + 1;
      }

      let y = x - k;

      while (x < N && y < M && a[x] === b[y]) {
        x++;
        y++;
      }

      newV[MAX + k] = x;

      if (x >= N && y >= M) {
        trace.push([...newV]);
        return backtrack(trace, a, b, MAX);
      }
    }

    for (let i = 0; i < newV.length; i++) {
      V[i] = newV[i];
    }
  }

  return simpleDiff(a, b);
}

function backtrack(trace, a, b, MAX) {
  const ops = [];
  let x = a.length;
  let y = b.length;

  for (let d = trace.length - 2; d >= 0; d--) {
    const V = trace[d];
    const k = x - y;

    let prevK;
    if (k === -d || (k !== d && V[MAX + k - 1] < V[MAX + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = V[MAX + prevK];
    const prevY = prevX - prevK;

    // Diagonal moves (equal)
    while (x > prevX && y > prevY) {
      ops.unshift({ type: 'equal', count: 1 });
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        // Insert
        ops.unshift({ type: 'insert', count: 1 });
        y--;
      } else {
        // Delete
        ops.unshift({ type: 'delete', count: 1 });
        x--;
      }
    }
  }

  // Compress consecutive ops of the same type
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

/**
 * Simple fallback diff for very large documents.
 */
function simpleDiff(a, b) {
  const ops = [];
  const setB = new Set(b);
  const setA = new Set(a);

  let ai = 0, bi = 0;

  while (ai < a.length && bi < b.length) {
    if (a[ai] === b[bi]) {
      ops.push({ type: 'equal', count: 1 });
      ai++;
      bi++;
    } else if (!setB.has(a[ai])) {
      ops.push({ type: 'delete', count: 1 });
      ai++;
    } else if (!setA.has(b[bi])) {
      ops.push({ type: 'insert', count: 1 });
      bi++;
    } else {
      ops.push({ type: 'delete', count: 1 });
      ai++;
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
