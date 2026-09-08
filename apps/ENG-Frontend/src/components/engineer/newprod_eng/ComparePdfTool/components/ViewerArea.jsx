import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useCompare } from '../context/CompareContext';
import { renderPageToCanvas, renderDiffOnDemand } from '../engine/pixelCompare';

/**
 * Custom Hook: Click-and-drag panning for scrollable containers.
 */
function usePanToScroll(containerRef, enabled = true) {
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback((e) => {
    if (!enabled || e.button !== 0) return;
    // Don't drag if clicking interactive elements or bounding boxes
    if (e.target.closest('.diff-bbox') || e.target.closest('button') || e.target.closest('input') || e.target.closest('.curtain-divider')) {
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    isDragging.current = true;
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    el.classList.add('is-panning');
  }, [containerRef, enabled]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const el = containerRef.current;
      if (!el) return;

      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      el.scrollLeft = startPos.current.scrollLeft - dx;
      el.scrollTop = startPos.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      containerRef.current?.classList.remove('is-panning');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef]);

  return { handleMouseDown };
}

/**
 * ViewerArea — renders the PDF comparison view.
 * Supports side-by-side, overlay, and curtain split modes.
 */
export default function ViewerArea() {
  const { state, dispatch } = useCompare();
  const { files, viewer, comparison, review } = state;
  const { currentPage, zoom, viewMode, overlayOpacity, diffLayerVisible, diffLayerOpacity, curtainPosition } = viewer;
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
        files={files}
        currentPage={currentPage}
        pageResult={pageResult}
        zoom={zoom}
        overlayOpacity={overlayOpacity}
        diffLayerVisible={diffLayerVisible}
        diffLayerOpacity={diffLayerOpacity}
        pageDiffs={pageDiffs}
        selectedDiffId={selectedDiffId}
        dispatch={dispatch}
      />
    );
  }

  if (viewMode === 'curtain') {
    return (
      <CurtainView
        files={files}
        currentPage={currentPage}
        pageResult={pageResult}
        zoom={zoom}
        curtainPosition={curtainPosition}
        pageDiffs={pageDiffs}
        selectedDiffId={selectedDiffId}
        dispatch={dispatch}
      />
    );
  }

  return (
    <SideBySideView
      files={files}
      currentPage={currentPage}
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

function SideBySideView({ files, currentPage, pageResult, zoom, pageDiffs, selectedDiffId, dispatch }) {
  const baseCanvasRef = useRef(null);
  const compareCanvasRef = useRef(null);
  const basePaneRef = useRef(null);
  const comparePaneRef = useRef(null);
  const activePaneRef = useRef(null); // track hovered pane to break scroll loop
  const isSyncing = useRef(false);

  const [baseDims, setBaseDims] = useState({ width: 0, height: 0 });
  const [compareDims, setCompareDims] = useState({ width: 0, height: 0 });

  const { handleMouseDown: onBasePan } = usePanToScroll(basePaneRef);
  const { handleMouseDown: onComparePan } = usePanToScroll(comparePaneRef);

  // On-demand rendering of Base Page
  useEffect(() => {
    let active = true;
    if (files.base?.pdfDoc && pageResult?.hasBasePage && baseCanvasRef.current) {
      renderPageToCanvas(files.base.pdfDoc, currentPage, zoom, baseCanvasRef.current).then(dims => {
        if (active && dims) setBaseDims(dims);
      });
    }
    return () => { active = false; };
  }, [files.base?.pdfDoc, currentPage, zoom, pageResult?.hasBasePage]);

  // On-demand rendering of Compare Page
  useEffect(() => {
    let active = true;
    if (files.compare?.pdfDoc && pageResult?.hasComparePage && compareCanvasRef.current) {
      renderPageToCanvas(files.compare.pdfDoc, currentPage, zoom, compareCanvasRef.current).then(dims => {
        if (active && dims) setCompareDims(dims);
      });
    }
    return () => { active = false; };
  }, [files.compare?.pdfDoc, currentPage, zoom, pageResult?.hasComparePage]);

  // Jitter-free scroll synchronization
  const syncScroll = useCallback((source, target, paneName) => {
    if (isSyncing.current) return;
    // Only allow syncing from the active/hovered pane
    if (activePaneRef.current && activePaneRef.current !== paneName) return;

    isSyncing.current = true;
    const sourceEl = source.current;
    const targetEl = target.current;

    if (sourceEl && targetEl) {
      targetEl.scrollTop = sourceEl.scrollTop;
      targetEl.scrollLeft = sourceEl.scrollLeft;
    }

    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

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
      {/* Base Pane (Rev 1) */}
      <div
        className="viewer-pane can-pan"
        ref={basePaneRef}
        onMouseDown={onBasePan}
        onMouseEnter={() => { activePaneRef.current = 'base'; }}
        onScroll={() => syncScroll(basePaneRef, comparePaneRef, 'base')}
      >
        <span className="viewer-pane-label base">Rev 1 — Base</span>
        {pageResult.hasBasePage ? (
          <div
            className="page-canvas-wrapper"
            style={{ width: baseDims.width || 'auto', height: baseDims.height || 'auto' }}
          >
            <canvas ref={baseCanvasRef} />
            <DiffOverlay
              diffs={pageDiffs}
              selectedDiffId={selectedDiffId}
              scale={zoom}
              side="base"
              scrollContainerRef={basePaneRef}
              dispatch={dispatch}
            />
          </div>
        ) : (
          <div className="diff-list-empty" style={{ marginTop: '100px' }}>
            <span className="empty-icon">📄−</span>
            <span className="empty-text">Page not present in Rev 1</span>
          </div>
        )}
      </div>

      {/* Compare Pane (Rev 2) */}
      <div
        className="viewer-pane can-pan"
        ref={comparePaneRef}
        onMouseDown={onComparePan}
        onMouseEnter={() => { activePaneRef.current = 'compare'; }}
        onScroll={() => syncScroll(comparePaneRef, basePaneRef, 'compare')}
      >
        <span className="viewer-pane-label compare">Rev 2 — Compare</span>
        {pageResult.hasComparePage ? (
          <div
            className="page-canvas-wrapper"
            style={{ width: compareDims.width || 'auto', height: compareDims.height || 'auto' }}
          >
            <canvas ref={compareCanvasRef} />
            <DiffOverlay
              diffs={pageDiffs}
              selectedDiffId={selectedDiffId}
              scale={zoom}
              side="compare"
              scrollContainerRef={comparePaneRef}
              dispatch={dispatch}
            />
          </div>
        ) : (
          <div className="diff-list-empty" style={{ marginTop: '100px' }}>
            <span className="empty-icon">📄+</span>
            <span className="empty-text">Page not present in Rev 2</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Overlay View
// ═══════════════════════════════════════════════════════

function OverlayView({ files, currentPage, pageResult, zoom, overlayOpacity, diffLayerVisible, diffLayerOpacity, pageDiffs, selectedDiffId, dispatch }) {
  const containerRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const compareCanvasRef = useRef(null);
  const diffCanvasRef = useRef(null);

  const [dims, setDims] = useState({ width: 0, height: 0 });
  const { handleMouseDown: onPan } = usePanToScroll(containerRef);

  useEffect(() => {
    let active = true;
    if (files.base?.pdfDoc && pageResult?.hasBasePage && baseCanvasRef.current) {
      renderPageToCanvas(files.base.pdfDoc, currentPage, zoom, baseCanvasRef.current).then(d => {
        if (active && d) setDims(d);
      });
    }
    if (files.compare?.pdfDoc && pageResult?.hasComparePage && compareCanvasRef.current) {
      renderPageToCanvas(files.compare.pdfDoc, currentPage, zoom, compareCanvasRef.current);
    }
    if (diffLayerVisible && files.base?.pdfDoc && files.compare?.pdfDoc && diffCanvasRef.current) {
      renderDiffOnDemand(files.base.pdfDoc, files.compare.pdfDoc, currentPage, zoom, diffCanvasRef.current);
    }
    return () => { active = false; };
  }, [files, currentPage, zoom, pageResult, diffLayerVisible]);

  return (
    <div className="viewer-area overlay can-pan" ref={containerRef} onMouseDown={onPan}>
      <div
        className="overlay-canvas-wrapper"
        style={{
          width: dims.width || 'auto',
          height: dims.height || 'auto',
          position: 'relative',
          backgroundColor: 'white',
        }}
      >
        {/* Base Layer */}
        <canvas ref={baseCanvasRef} style={{ display: 'block' }} />

        {/* Compare Layer Overlaid */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: overlayOpacity,
            mixBlendMode: 'multiply',
            pointerEvents: 'none',
          }}
        >
          <canvas ref={compareCanvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* Diff Mask Layer */}
        {diffLayerVisible && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: diffLayerOpacity,
              pointerEvents: 'none',
            }}
          >
            <canvas ref={diffCanvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
        )}

        <DiffOverlay
          diffs={pageDiffs}
          selectedDiffId={selectedDiffId}
          scale={zoom}
          side="overlay"
          scrollContainerRef={containerRef}
          dispatch={dispatch}
        />

        {/* Overlay Controls */}
        <div className="overlay-controls">
          <label>Rev 2 Opacity:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={overlayOpacity}
            onChange={(e) => dispatch({ type: 'SET_OVERLAY_OPACITY', payload: parseFloat(e.target.value) })}
          />
          <span style={{ fontSize: '12px', minWidth: '32px' }}>{Math.round(overlayOpacity * 100)}%</span>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-primary)', margin: '0 4px' }} />

          <button
            className={`layer-toggle-btn ${diffLayerVisible ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_DIFF_LAYER' })}
          >
            {diffLayerVisible ? 'Hide Visual Diff' : 'Show Visual Diff'}
          </button>

          {diffLayerVisible && (
            <>
              <label style={{ marginLeft: '6px' }}>Diff Alpha:</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={diffLayerOpacity}
                onChange={(e) => dispatch({ type: 'SET_DIFF_LAYER_OPACITY', payload: parseFloat(e.target.value) })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Curtain (Split-Slider) View
// ═══════════════════════════════════════════════════════

function CurtainView({ files, currentPage, pageResult, zoom, curtainPosition, pageDiffs, selectedDiffId, dispatch }) {
  const containerRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const compareCanvasRef = useRef(null);
  const isDraggingDivider = useRef(false);

  const [dims, setDims] = useState({ width: 0, height: 0 });
  const { handleMouseDown: onPan } = usePanToScroll(containerRef);

  useEffect(() => {
    let active = true;
    if (files.base?.pdfDoc && pageResult?.hasBasePage && baseCanvasRef.current) {
      renderPageToCanvas(files.base.pdfDoc, currentPage, zoom, baseCanvasRef.current).then(d => {
        if (active && d) setDims(d);
      });
    }
    if (files.compare?.pdfDoc && pageResult?.hasComparePage && compareCanvasRef.current) {
      renderPageToCanvas(files.compare.pdfDoc, currentPage, zoom, compareCanvasRef.current);
    }
    return () => { active = false; };
  }, [files, currentPage, zoom, pageResult]);

  // Divider drag listener
  const handleDividerMouseDown = (e) => {
    e.stopPropagation();
    isDraggingDivider.current = true;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDivider.current) return;
      const wrapper = baseCanvasRef.current?.parentElement;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      dispatch({ type: 'SET_CURTAIN_POSITION', payload: pos });
    };

    const handleMouseUp = () => {
      isDraggingDivider.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dispatch]);

  const splitPercent = curtainPosition * 100;

  return (
    <div className="viewer-area curtain can-pan" ref={containerRef} onMouseDown={onPan}>
      <div
        className="curtain-wrapper"
        style={{
          width: dims.width || 'auto',
          height: dims.height || 'auto',
          position: 'relative',
        }}
      >
        {/* Base Layer (Left side) */}
        <canvas ref={baseCanvasRef} style={{ display: 'block' }} />

        {/* Compare Layer (Right side clipped) */}
        <div
          className="curtain-layer compare"
          style={{
            left: `${splitPercent}%`,
            width: `${100 - splitPercent}%`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `-${(splitPercent / (100 - splitPercent)) * 100}%`,
              width: `${(100 / (100 - splitPercent)) * 100}%`,
              height: '100%',
            }}
          >
            <canvas ref={compareCanvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* Movable Divider Line */}
        <div
          className="curtain-divider"
          style={{ left: `${splitPercent}%` }}
          onMouseDown={handleDividerMouseDown}
        >
          <div className="curtain-handle">◧</div>
        </div>

        <DiffOverlay
          diffs={pageDiffs}
          selectedDiffId={selectedDiffId}
          scale={zoom}
          side="curtain"
          scrollContainerRef={containerRef}
          dispatch={dispatch}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Diff Overlay — Bounding boxes
// ═══════════════════════════════════════════════════════

function DiffOverlay({ diffs, selectedDiffId, scale, side, scrollContainerRef, dispatch }) {
  const selectedRef = useRef(null);

  // Smooth scroll to selected diff
  useEffect(() => {
    if (selectedRef.current && scrollContainerRef?.current) {
      const container = scrollContainerRef.current;
      const el = selectedRef.current;

      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();

      // Check if element is outside visible area
      const isVisible = (
        eRect.top >= cRect.top + 40 &&
        eRect.bottom <= cRect.bottom - 40 &&
        eRect.left >= cRect.left + 40 &&
        eRect.right <= cRect.right - 40
      );

      if (!isVisible) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }
    }
  }, [selectedDiffId, scrollContainerRef]);

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
              width: Math.max(12, diff.bbox.width * scale),
              height: Math.max(12, diff.bbox.height * scale),
            }}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SELECT_DIFF', payload: diff.id });
            }}
          >
            {isSelected && (
              <span className="diff-bbox-label">
                #{diff.id.split('-').pop()}
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
  if (type === 'text-modified') return 'pixel';
  return 'pixel';
}

