import React, { useState, useEffect } from 'react';
import { useCompare } from '../context/CompareContext';

export default function NavBar() {
  const { state, dispatch } = useCompare();
  const { viewer, comparison } = state;
  const { currentPage, totalPages, zoom } = viewer;

  // Local draft states for editable inputs
  const [pageText, setPageText] = useState(currentPage.toString());
  const [zoomText, setZoomText] = useState(Math.round(zoom * 100).toString());
  const [sensText, setSensText] = useState(
    Math.round((1 - comparison.threshold * 2) * 100).toString()
  );

  useEffect(() => {
    setPageText(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setZoomText(Math.round(zoom * 100).toString());
  }, [zoom]);

  useEffect(() => {
    setSensText(Math.round((1 - comparison.threshold * 2) * 100).toString());
  }, [comparison.threshold]);

  if (!comparison.hasResults) return null;

  const goToPage = (page) => {
    const valid = Math.max(1, Math.min(totalPages, page));
    dispatch({ type: 'SET_PAGE', payload: valid });
    setPageText(valid.toString());
  };

  const handlePageCommit = () => {
    const val = parseInt(pageText, 10);
    if (!isNaN(val)) {
      goToPage(val);
    } else {
      setPageText(currentPage.toString());
    }
  };

  const handleZoomCommit = () => {
    let val = parseInt(zoomText, 10);
    if (!isNaN(val)) {
      val = Math.max(25, Math.min(400, val));
      dispatch({ type: 'SET_ZOOM', payload: val / 100 });
      setZoomText(val.toString());
    } else {
      setZoomText(Math.round(zoom * 100).toString());
    }
  };

  const handleSensCommit = () => {
    let val = parseInt(sensText, 10);
    if (!isNaN(val)) {
      val = Math.max(0, Math.min(100, val));
      const t = (100 - val) / 200;
      dispatch({ type: 'SET_THRESHOLD', payload: t });
      setSensText(val.toString());
    } else {
      setSensText(Math.round((1 - comparison.threshold * 2) * 100).toString());
    }
  };

  return (
    <div className="nav-bar">
      {/* Page Navigation */}
      <div className="page-nav">
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          data-tooltip="Previous page ([)"
        >
          ◀
        </button>
        <input
          className="page-input"
          type="number"
          value={pageText}
          onChange={(e) => setPageText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePageCommit()}
          onBlur={handlePageCommit}
          min={1}
          max={totalPages}
        />
        <span className="page-total">/ {totalPages}</span>
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          data-tooltip="Next page (])"
        >
          ▶
        </button>
      </div>

      <div className="nav-separator" />

      {/* Zoom Controls */}
      <div className="zoom-control">
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(0.25, zoom - 0.25) })}
          data-tooltip="Zoom out"
        >
          −
        </button>
        <input
          className="zoom-slider"
          type="range"
          min="0.25"
          max="3.0"
          step="0.25"
          value={zoom}
          onChange={(e) => dispatch({ type: 'SET_ZOOM', payload: parseFloat(e.target.value) })}
        />
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(3.0, zoom + 0.25) })}
          data-tooltip="Zoom in"
        >
          +
        </button>
        <input
          type="number"
          className="zoom-input"
          min="25"
          max="400"
          step="25"
          value={zoomText}
          onChange={(e) => setZoomText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleZoomCommit()}
          onBlur={handleZoomCommit}
          style={{ width: '58px', marginLeft: '6px', textAlign: 'right' }}
        />
        <span className="zoom-label">%</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1.0 })}
          title="Reset Zoom to 100%"
          style={{ marginLeft: '4px', fontSize: '11px' }}
        >
          100%
        </button>
      </div>

      <div className="nav-separator" />

      {/* Threshold / Sensitivity */}
      <div className="threshold-control">
        <span className="threshold-label">Sensitivity</span>
        <input
          className="threshold-slider"
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={comparison.threshold}
          onChange={(e) =>
            dispatch({ type: 'SET_THRESHOLD', payload: parseFloat(e.target.value) })
          }
        />
        <input
          type="number"
          className="threshold-input"
          min="0"
          max="100"
          value={sensText}
          onChange={(e) => setSensText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSensCommit()}
          onBlur={handleSensCommit}
          style={{ width: '56px', marginLeft: '6px', textAlign: 'right' }}
        />
        <span className="threshold-value">%</span>
        <button
          className="btn btn-sm btn-primary"
          style={{ marginLeft: '10px' }}
          onClick={() => dispatch({ type: 'START_COMPARISON' })}
          title="Re-run comparison across document with new sensitivity"
        >
          Re-analyze
        </button>
      </div>
    </div>
  );
}

