import React from 'react';
import { useCompare } from '../context/CompareContext';

export default function ProgressOverlay() {
  const { state, dispatch } = useCompare();
  const { comparison } = state;

  if (!comparison.isComparing) return null;

  return (
    <div className="progress-overlay">
      <div className="progress-card">
        <div className="progress-icon">🔬</div>
        <h2 className="progress-title">Analyzing Documents</h2>
        <p className="progress-status">{comparison.progressText}</p>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${comparison.progress}%` }}
          />
        </div>
        <div className="progress-percentage">{comparison.progress}%</div>
        <div className="progress-cancel">
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'CANCEL_COMPARISON' })}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
