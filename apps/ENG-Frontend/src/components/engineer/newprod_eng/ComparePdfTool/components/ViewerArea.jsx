import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useCompare } from '../context/CompareContext';

/**
 * ViewerArea — renders the PDF comparison view.
 * Supports side-by-side and overlay modes.
 */
export default function ViewerArea() {
  const { state, dispatch } = useCompare();
  const { viewer, comparison, review } = state;
  const { currentPage, zoom, viewMode, overlayOpacity } = viewer;
  const { results } = comparison;
  const { diffs, selectedDiffId } = review;

  const pageResult = results.get(currentPage);

  // Diffs for current page, filtered by visibility
  const pageDiffs = useMemo(() =>
    diffs.filter(d => d.page === currentPage && d.visible !== false),
    [diffs, currentPage]
  );

  if (viewMode === 'overlay') {
    return (
      <OverlayView
        pageResult={pageResult}
        zoom={zoom}
        overlayOpacity={overlayOpacity}
        pageDiffs={pageDiffs}
        selectedDiffId={selectedDiffId}
        dispatch={dispatch}
      />
    );
  }

  return (
    <SideBySideView
      pageResult={pageResult}
      zoom={zoom}
      pageDiffs={pageDiffs}
      selectedDiffId={selectedDiffId}
      dispatch={dispatch}
    />
  );
}

// ═══════════════════════════════════════════════════════
// Side-by-Side View
// ═══════════════════════════════════════════════════════

function SideBySideView({ pageResult, zoom, pageDiffs, selectedDiffId, dispatch }) {
  const baseContainerRef = useRef(null);
  const compareContainerRef = useRef(null);
  const basePaneRef = useRef(null);
  const comparePaneRef = useRef(null);
  const isSyncing = useRef(false);

  // Render base canvas
  useEffect(() => {
    if (!pageResult?.baseCanvas || !baseContainerRef.current) return;
    const container = baseContainerRef.current;
    const canvas = pageResult.baseCanvas;
    container.innerHTML = '';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
  }, [pageResult]);

  // Render compare canvas
  useEffect(() => {
    if (!pageResult?.compareCanvas || !compareContainerRef.current) return;
    const container = compareContainerRef.current;
    const canvas = pageResult.compareCanvas;
    container.innerHTML = '';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
  }, [pageResult]);

  // Scroll sync
  const syncScroll = useCallback((source, target) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sourceEl = source.current;
    const targetEl = target.current;
    if (sourceEl && targetEl) {
      targetEl.scrollTop = sourceEl.scrollTop;
      targetEl.scrollLeft = sourceEl.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  // Calculate display dimensions
  const renderScale = pageResult?.pixelDiffs?.renderScale || 2.0;
  const displayScale = zoom / renderScale;

  const baseWidth = pageResult?.baseCanvas?.width || 0;
  const baseHeight = pageResult?.baseCanvas?.height || 0;
  const compareWidth = pageResult?.compareCanvas?.width || 0;
  const compareHeight = pageResult?.compareCanvas?.height || 0;

  if (!pageResult) {
    return (
      <div className="viewer-area side-by-side">
        <div className="viewer-pane">
          <div className="diff-list-empty">
            <span className="empty-icon">📄</span>
            <span className="empty-text">No comparison data for this page</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-area side-by-side">
      {/* Base (Rev 1) Pane */}
      <div
        className="viewer-pane"
        ref={basePaneRef}
        onScroll={() => syncScroll(basePaneRef, comparePaneRef)}
      >
        <span className="viewer-pane-label base">Rev 1 — Base</span>
        {pageResult.baseCanvas && (
          <div
            className="page-canvas-wrapper"
            style={{
              width: baseWidth * displayScale,
              height: baseHeight * displayScale,
            }}
          >
            <div ref={baseContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
            <DiffOverlay
              diffs={pageDiffs}
              selectedDiffId={selectedDiffId}
              scale={zoom}
              side="base"
              dispatch={dispatch}
            />
          </div>
        )}
      </div>

      {/* Compare (Rev 2) Pane */}
      <div
        className="viewer-pane"
        ref={comparePaneRef}
        onScroll={() => syncScroll(comparePaneRef, basePaneRef)}
      >
        <span className="viewer-pane-label compare">Rev 2 — Compare</span>
        {pageResult.compareCanvas && (
          <div
            className="page-canvas-wrapper"
            style={{
              width: compareWidth * displayScale,
              height: compareHeight * displayScale,
            }}
          >
            <div ref={compareContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
            <DiffOverlay
              diffs={pageDiffs}
              selectedDiffId={selectedDiffId}
              scale={zoom}
              side="compare"
              dispatch={dispatch}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Overlay View
// ═══════════════════════════════════════════════════════

function OverlayView({ pageResult, zoom, overlayOpacity, pageDiffs, selectedDiffId, dispatch }) {
  const baseContainerRef = useRef(null);
  const compareContainerRef = useRef(null);
  const diffContainerRef = useRef(null);

  useEffect(() => {
    if (!pageResult || !baseContainerRef.current) return;
    if (pageResult.baseCanvas) {
      baseContainerRef.current.innerHTML = '';
      pageResult.baseCanvas.style.width = '100%';
      pageResult.baseCanvas.style.height = '100%';
      baseContainerRef.current.appendChild(pageResult.baseCanvas);
    }
  }, [pageResult]);

  useEffect(() => {
    if (!pageResult || !compareContainerRef.current) return;
    if (pageResult.compareCanvas) {
      compareContainerRef.current.innerHTML = '';
      pageResult.compareCanvas.style.width = '100%';
      pageResult.compareCanvas.style.height = '100%';
      compareContainerRef.current.appendChild(pageResult.compareCanvas);
    }
  }, [pageResult]);

  useEffect(() => {
    if (!pageResult || !diffContainerRef.current) return;
    if (pageResult.diffCanvas) {
      diffContainerRef.current.innerHTML = '';
      pageResult.diffCanvas.style.width = '100%';
      pageResult.diffCanvas.style.height = '100%';
      diffContainerRef.current.appendChild(pageResult.diffCanvas);
    } else if (pageResult.diffImageData) {
      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = pageResult.diffImageData.width;
      diffCanvas.height = pageResult.diffImageData.height;
      diffCanvas.getContext('2d').putImageData(pageResult.diffImageData, 0, 0);
      diffCanvas.style.width = '100%';
      diffCanvas.style.height = '100%';
      diffContainerRef.current.innerHTML = '';
      diffContainerRef.current.appendChild(diffCanvas);
    }
  }, [pageResult]);

  const renderScale = pageResult?.pixelDiffs?.renderScale || 2.0;
  const displayScale = zoom / renderScale;

  const width = Math.max(
    pageResult?.baseCanvas?.width || 0,
    pageResult?.compareCanvas?.width || 0
  );
  const height = Math.max(
    pageResult?.baseCanvas?.height || 0,
    pageResult?.compareCanvas?.height || 0
  );

  if (!pageResult) {
    return (
      <div className="viewer-area overlay">
        <div className="diff-list-empty">
          <span className="empty-icon">📄</span>
          <span className="empty-text">No comparison data for this page</span>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-area overlay">
      <div
        className="overlay-canvas-wrapper"
        style={{
          width: width * displayScale,
          height: height * displayScale,
          position: 'relative',
          backgroundColor: 'white',
        }}
      >
        <div ref={baseContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
        <div 
          ref={compareContainerRef} 
          style={{ 
            width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
            opacity: overlayOpacity,
            mixBlendMode: 'multiply',
            pointerEvents: 'none'
          }} 
        />
        <div 
          ref={diffContainerRef} 
          style={{ 
            width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
            opacity: 0.8,
            pointerEvents: 'none'
          }} 
        />
        <DiffOverlay
          diffs={pageDiffs}
          selectedDiffId={selectedDiffId}
          scale={zoom}
          side="overlay"
          dispatch={dispatch}
        />
        <div className="overlay-controls">
          <label>Base</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={1 - (dispatch ? 0 : 0)}
            onChange={() => {}}
            style={{ display: 'none' }}
          />
          <label>Opacity:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={overlayOpacity}
            onChange={(e) => dispatch({ type: 'SET_OVERLAY_OPACITY', payload: parseFloat(e.target.value) })}
          />
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(overlayOpacity * 100)}
            onChange={(e) => {
              let val = parseInt(e.target.value, 10);
              if (isNaN(val)) return;
              val = Math.max(0, Math.min(100, val));
              dispatch({ type: 'SET_OVERLAY_OPACITY', payload: val / 100 });
            }}
            style={{ width: '60px', marginLeft: '8px', textAlign: 'right' }}
          />
          <span>%</span>
          <label style={{ marginLeft: '8px' }}>Rev 2</label>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Diff Overlay — draws bounding boxes on the PDF
// ═══════════════════════════════════════════════════════

function DiffOverlay({ diffs, selectedDiffId, scale, side, dispatch }) {
  const selectedRef = useRef(null);

  // Auto-scroll to selected diff
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'center',
      });
    }
  }, [selectedDiffId]);

  return (
    <div className="diff-overlay">
      {diffs.map(diff => {
        const isSelected = diff.id === selectedDiffId;
        const bboxClass = getBboxClass(diff.type);

        return (
          <div
            key={`${diff.id}-${side}`}
            ref={isSelected ? selectedRef : null}
            className={`diff-bbox ${bboxClass} ${isSelected ? 'selected' : ''}`}
            style={{
              left: diff.bbox.x * scale,
              top: diff.bbox.y * scale,
              width: diff.bbox.width * scale,
              height: diff.bbox.height * scale,
            }}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SELECT_DIFF', payload: diff.id });
            }}
          >
            {isSelected && (
              <span className="diff-bbox-label">
                #{diff.id.replace('diff-', '')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getBboxClass(type) {
  if (type === 'pixel') return 'pixel';
  if (type === 'text-added' || type === 'page-added') return 'text-added';
  if (type === 'text-removed' || type === 'page-removed') return 'text-removed';
  if (type === 'text-modified') return 'pixel'; // Use amber for modified
  return 'pixel';
}
