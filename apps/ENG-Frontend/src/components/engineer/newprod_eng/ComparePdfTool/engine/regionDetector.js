/**
 * Region Detector — Groups changed pixels into discrete bounding boxes.
 * Uses connected-component labeling with 8-connectivity and spatial box clustering.
 */

/**
 * Analyzes a diff image (from pixelmatch) and extracts rectangular bounding boxes
 * around clusters of changed pixels.
 *
 * @param {Uint8ClampedArray} diffData - RGBA pixel data from the diff image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} options
 * @param {number} options.minArea - Minimum area in pixels to consider a region
 * @param {number} options.minPixels - Minimum actual changed pixels
 * @param {number} options.mergeMargin - Merge regions within this pixel distance
 * @param {number} options.scale - Scale factor to convert pixel coords back to PDF coords
 * @param {number} options.edgeIgnore - Ignore pixels at border
 * @returns {Array<{x, y, width, height, pixelCount, id}>}
 */
export function detectRegions(diffData, width, height, options = {}) {
  const {
    minArea = 50,
    minPixels = 12,
    mergeMargin = 12,
    edgeIgnore = 4,
    scale = 1,
  } = options;

  // Step 1: Create binary mask — changed pixels (red in pixelmatch)
  const mask = new Uint8Array(width * height);
  for (let y = edgeIgnore; y < height - edgeIgnore; y++) {
    const rowOffset = y * width;
    for (let x = edgeIgnore; x < width - edgeIgnore; x++) {
      const idx = (rowOffset + x) * 4;
      const r = diffData[idx];
      const g = diffData[idx + 1];
      const b = diffData[idx + 2];
      const a = diffData[idx + 3];

      // pixelmatch diff color: pure red [255, 0, 0, >0]
      if (r === 255 && g === 0 && b === 0 && a > 0) {
        mask[rowOffset + x] = 1;
      }
    }
  }

  // Step 2: Connected component labeling with 8-connectivity using union-find
  const labels = new Int32Array(width * height).fill(-1);
  const parent = [];
  let nextLabel = 0;

  function find(x) {
    let root = x;
    while (parent[root] !== root) {
      root = parent[root];
    }
    let curr = x;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
    }
  }

  // First pass — 8-connectivity checks (top-left, top, top-right, left)
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      if (!mask[idx]) continue;

      const neighbors = [];

      // 8-connectivity neighbors:
      if (mask[idx - 1]) neighbors.push(labels[idx - 1]); // left
      if (mask[prevRowOffset + x - 1]) neighbors.push(labels[prevRowOffset + x - 1]); // top-left
      if (mask[prevRowOffset + x]) neighbors.push(labels[prevRowOffset + x]); // top
      if (mask[prevRowOffset + x + 1]) neighbors.push(labels[prevRowOffset + x + 1]); // top-right

      if (neighbors.length === 0) {
        labels[idx] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else {
        const minLabel = Math.min(...neighbors.map(find));
        labels[idx] = minLabel;
        for (const n of neighbors) {
          union(minLabel, n);
        }
      }
    }
  }

  // Second pass — collect bounding boxes per connected component
  const componentMap = new Map();

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      if (labels[idx] < 0) continue;

      const root = find(labels[idx]);
      let comp = componentMap.get(root);
      if (!comp) {
        comp = { minX: x, minY: y, maxX: x, maxY: y, count: 0 };
        componentMap.set(root, comp);
      }
      if (x < comp.minX) comp.minX = x;
      if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y;
      if (y > comp.maxY) comp.maxY = y;
      comp.count++;
    }
  }

  // Step 3: Convert to bounding boxes and filter noise
  let regions = [];
  for (const [, comp] of componentMap) {
    const w = comp.maxX - comp.minX + 1;
    const h = comp.maxY - comp.minY + 1;
    if (w * h >= minArea && comp.count >= minPixels) {
      regions.push({
        x: comp.minX,
        y: comp.minY,
        width: w,
        height: h,
        pixelCount: comp.count,
      });
    }
  }

  // Step 4: Fast spatial cluster merge
  regions = clusterNearbyRegions(regions, mergeMargin);

  // Step 5: Convert to PDF scale
  return regions.map((r, i) => ({
    id: `pixel-region-${i}`,
    x: Math.round((r.x / scale) * 10) / 10,
    y: Math.round((r.y / scale) * 10) / 10,
    width: Math.round((r.width / scale) * 10) / 10,
    height: Math.round((r.height / scale) * 10) / 10,
    pixelCount: r.pixelCount,
  }));
}

/**
 * Merges bounding boxes that overlap or are within `margin` pixels.
 * Uses sorted intervals for high performance.
 */
function clusterNearbyRegions(regions, margin) {
  if (regions.length <= 1) return regions;

  // Max span prevents accidental merging into a single giant box covering the entire page
  const MAX_SPAN = 600;

  let currentList = regions;
  let hasMerged = true;
  let iterations = 0;

  while (hasMerged && iterations < 5) {
    hasMerged = false;
    iterations++;

    // Sort primarily by X, then Y
    currentList.sort((a, b) => a.x - b.x || a.y - b.y);

    const merged = [];
    const used = new Uint8Array(currentList.length);

    for (let i = 0; i < currentList.length; i++) {
      if (used[i]) continue;

      let a = { ...currentList[i] };

      for (let j = i + 1; j < currentList.length; j++) {
        if (used[j]) continue;
        const b = currentList[j];

        // If b is beyond margin in X, cannot overlap with a
        if (b.x > a.x + a.width + margin) {
          break;
        }

        if (boxesIntersectOrNear(a, b, margin)) {
          const newW = Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x);
          const newH = Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y);

          // Only merge if resulting box is within acceptable span
          if (newW <= MAX_SPAN && newH <= MAX_SPAN) {
            a = {
              x: Math.min(a.x, b.x),
              y: Math.min(a.y, b.y),
              width: newW,
              height: newH,
              pixelCount: a.pixelCount + b.pixelCount,
            };
            used[j] = 1;
            hasMerged = true;
          }
        }
      }

      merged.push(a);
    }

    currentList = merged;
  }

  return currentList;
}

function boxesIntersectOrNear(a, b, margin) {
  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

