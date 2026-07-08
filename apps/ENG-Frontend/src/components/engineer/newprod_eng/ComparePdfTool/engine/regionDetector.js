/**
 * Region Detector — Groups changed pixels into discrete bounding boxes.
 * Uses a simple flood-fill / connected-component labeling approach
 * on the binary diff mask from pixelmatch.
 */

/**
 * Analyzes a diff image (from pixelmatch) and extracts rectangular bounding boxes
 * around clusters of changed pixels.
 *
 * @param {Uint8ClampedArray} diffData - RGBA pixel data from the diff image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {object} options
 * @param {number} options.minArea - Minimum area in pixels to consider a region (filters noise)
 * @param {number} options.mergeMargin - Merge regions within this pixel distance
 * @param {number} options.scale - Scale factor to convert pixel coords back to PDF coords
 * @returns {Array<{x, y, width, height, pixelCount, id}>}
 */
export function detectRegions(diffData, width, height, options = {}) {
  const {
    minArea = 25,
    minPixels = 15,
    mergeMargin = 15,
    edgeIgnore = 4,
    scale = 1,
  } = options;

  // Step 1: Create binary mask — any non-black pixel in the diff = changed
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Ignore extreme edges to prevent page-sized bounding boxes from alignment artifacts
      if (x < edgeIgnore || x >= width - edgeIgnore || y < edgeIgnore || y >= height - edgeIgnore) {
        continue;
      }

      const idx = (y * width + x) * 4;
      const r = diffData[idx];
      const g = diffData[idx + 1];
      const b = diffData[idx + 2];
      const a = diffData[idx + 3];

      // pixelmatch outputs changed pixels in pure red [255, 0, 0]
      // It outputs anti-aliasing differences in yellow [255, 255, 0]
      // We only want to flag actual differences
      if (r === 255 && g === 0 && b === 0 && a > 0) {
        mask[y * width + x] = 1;
      }
    }
  }

  // Step 2: Connected component labeling using union-find
  const labels = new Int32Array(width * height).fill(-1);
  const parent = [];
  let nextLabel = 0;

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[rb] = ra;
    }
  }

  // First pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;

      const neighbors = [];
      if (x > 0 && mask[idx - 1]) neighbors.push(labels[idx - 1]);
      if (y > 0 && mask[idx - width]) neighbors.push(labels[idx - width]);

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

  // Second pass — collect bounding boxes per component
  const componentMap = new Map(); // root label -> {minX, minY, maxX, maxY, count}

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] < 0) continue;

      const root = find(labels[idx]);
      if (!componentMap.has(root)) {
        componentMap.set(root, { minX: x, minY: y, maxX: x, maxY: y, count: 0 });
      }
      const comp = componentMap.get(root);
      comp.minX = Math.min(comp.minX, x);
      comp.minY = Math.min(comp.minY, y);
      comp.maxX = Math.max(comp.maxX, x);
      comp.maxY = Math.max(comp.maxY, y);
      comp.count++;
    }
  }

  // Step 3: Convert to bounding boxes and filter by minimum area and pixel count
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

  // Step 4: Merge nearby regions
  regions = mergeNearbyRegions(regions, mergeMargin);

  // Step 5: Apply scale factor and assign IDs
  return regions.map((r, i) => ({
    id: `pixel-region-${i}`,
    x: r.x / scale,
    y: r.y / scale,
    width: r.width / scale,
    height: r.height / scale,
    pixelCount: r.pixelCount,
  }));
}

/**
 * Merges regions whose bounding boxes are within `margin` pixels of each other.
 */
function mergeNearbyRegions(regions, margin) {
  if (regions.length <= 1) return regions;

  let merged = true;
  let result = [...regions];

  while (merged) {
    merged = false;
    const next = [];
    const used = new Set();

    for (let i = 0; i < result.length; i++) {
      if (used.has(i)) continue;

      let current = { ...result[i] };

      for (let j = i + 1; j < result.length; j++) {
        if (used.has(j)) continue;

        if (regionsOverlap(current, result[j], margin)) {
          current = mergeBoxes(current, result[j]);
          used.add(j);
          merged = true;
        }
      }

      next.push(current);
    }

    result = next;
  }

  return result;
}

function regionsOverlap(a, b, margin) {
  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

function mergeBoxes(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
    pixelCount: a.pixelCount + b.pixelCount,
  };
}
