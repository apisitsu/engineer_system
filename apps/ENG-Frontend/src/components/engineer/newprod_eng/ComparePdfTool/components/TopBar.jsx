import React from 'react';
import { useCompare } from '../context/CompareContext';

export default function TopBar() {
  const { state, dispatch } = useCompare();
  const { files, viewer, comparison } = state;

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="top-bar-logo">
          <div className="logo-icon">⚡</div>
          <span>PDF Compare</span>
        </div>

        {files.base && files.compare && comparison.hasResults && (
          <div className="top-bar-files">
            <span className="file-badge base" title={files.base.name}>
              📄 {files.base.name}
            </span>
            <span className="vs-separator">vs</span>
            <span className="file-badge compare" title={files.compare.name}>
              📄 {files.compare.name}
            </span>
          </div>
        )}
      </div>

      {comparison.hasResults && (
        <div className="top-bar-center">
          <div className="view-mode-toggle">
            <button
              className={`toggle-btn ${viewer.viewMode === 'side-by-side' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'side-by-side' })}
            >
              ◫ Side by Side
            </button>
            <button
              className={`toggle-btn ${viewer.viewMode === 'overlay' ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'overlay' })}
            >
              ◉ Overlay
            </button>
          </div>
        </div>
      )}

      <div className="top-bar-right">
        {comparison.hasResults && (
          <>
            <button
              className="btn btn-subtle"
              onClick={() => dispatch({ type: 'TOGGLE_EXPORT_DIALOG' })}
            >
              📥 Export
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'RESET' })}
            >
              ↻ New
            </button>
          </>
        )}
      </div>
    </div>
  );
}
