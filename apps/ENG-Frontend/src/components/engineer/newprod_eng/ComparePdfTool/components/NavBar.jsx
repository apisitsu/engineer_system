import React from 'react';
import { useCompare } from '../context/CompareContext';

export default function NavBar() {
  const { state, dispatch } = useCompare();
  const { viewer, comparison } = state;
  const { currentPage, totalPages, zoom } = viewer;

  if (!comparison.hasResults) return null;

  const goToPage = (page) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  };

  const handlePageInput = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) goToPage(val);
  };

  const handleZoom = (val) => {
    dispatch({ type: 'SET_ZOOM', payload: parseFloat(val) });
  };

  return (
    <div className="nav-bar">
      <div className="page-nav">
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          data-tooltip="Previous page"
        >
          ◀
        </button>
        <input
          className="page-input"
          type="number"
          value={currentPage}
          onChange={handlePageInput}
          min={1}
          max={totalPages}
        />
        <span className="page-total">/ {totalPages}</span>
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          data-tooltip="Next page"
        >
          ▶
        </button>
      </div>

      <div className="nav-separator" />

      <div className="zoom-control">
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => handleZoom(Math.max(0.25, zoom - 0.25))}
          data-tooltip="Zoom out"
        >
          −
        </button>
        <input
          className="zoom-slider"
          type="range"
          min="0.25"
          max="3"
          step="0.25"
          value={zoom}
          onChange={(e) => handleZoom(e.target.value)}
        />
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => handleZoom(Math.min(3, zoom + 0.25))}
          data-tooltip="Zoom in"
        >
          +
        </button>
        <input
          type="number"
          className="zoom-input"
          min="25"
          max="300"
          step="25"
          value={Math.round(zoom * 100)}
          onChange={(e) => {
            let z = parseInt(e.target.value, 10);
            if (isNaN(z)) return;
            z = Math.max(25, Math.min(300, z));
            handleZoom(z / 100);
          }}
          style={{ width: '60px', marginLeft: '8px', textAlign: 'right' }}
        />
        <span className="zoom-label">%</span>
      </div>

      <div className="nav-separator" />

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
          value={Math.round((1 - comparison.threshold * 2) * 100)}
          onChange={(e) => {
            let p = parseInt(e.target.value, 10);
            if (isNaN(p)) return;
            p = Math.max(0, Math.min(100, p));
            const t = (100 - p) / 200;
            dispatch({ type: 'SET_THRESHOLD', payload: t });
          }}
          style={{ width: '60px', marginLeft: '8px', textAlign: 'right' }}
        />
        <span className="threshold-value">%</span>
        <button
          className="btn btn-sm btn-primary"
          style={{ marginLeft: '12px' }}
          onClick={() => dispatch({ type: 'START_COMPARISON' })}
          title="Apply new sensitivity and re-compare"
        >
          Re-analyze
        </button>
      </div>
    </div>
  );
}
