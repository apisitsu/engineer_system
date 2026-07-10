import React, { useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useCompare } from '../context/CompareContext';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export default function FileUploadPanel() {
  const { state, dispatch } = useCompare();
  const { files, comparison } = state;
  const baseInputRef = useRef(null);
  const compareInputRef = useRef(null);

  const loadPdf = useCallback(async (file, role) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const doc = await pdfjsLib.getDocument({ data }).promise;

      const payload = {
        pdfDoc: doc,
        data: arrayBuffer,
        name: file.name,
        pageCount: doc.numPages,
        fileSize: file.size,
      };

      dispatch({
        type: role === 'base' ? 'LOAD_BASE_PDF' : 'LOAD_COMPARE_PDF',
        payload,
      });
    } catch (err) {
      console.error(`Failed to load PDF (${role}):`, err);
      alert(`Failed to load PDF: ${err.message}`);
    }
  }, [dispatch]);

  const handleDrop = useCallback((e, role) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      loadPdf(file, role);
    }
    // Remove drag-over class
    e.currentTarget.classList.remove('drag-over');
  }, [loadPdf]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleFileInput = useCallback((e, role) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      loadPdf(file, role);
    }
    e.target.value = '';
  }, [loadPdf]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartComparison = useCallback(() => {
    if (files.base && files.compare) {
      dispatch({ type: 'START_COMPARISON' });
    }
  }, [files.base, files.compare, dispatch]);

  const renderZone = (role, file, inputRef) => {
    const isBase = role === 'base';
    const zoneClass = `upload-zone ${isBase ? 'base-zone' : 'compare-zone'} ${file ? 'has-file' : ''}`;

    return (
      <div
        className={zoneClass}
        onDrop={(e) => handleDrop(e, role)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          type="file"
          accept=".pdf"
          ref={inputRef}
          style={{ display: 'none' }}
          onChange={(e) => handleFileInput(e, role)}
        />

        <span className="upload-zone-label">
          {isBase ? 'Rev 1 — Base' : 'Rev 2 — Compare'}
        </span>

        {file ? (
          <div className="file-info">
            <span className="file-icon">📄</span>
            <span className="file-name" title={file.name}>{file.name}</span>
            <span className="file-meta">
              {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} · {formatFileSize(file.fileSize)}
            </span>
            <button
              className="change-file-btn"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Change File
            </button>
          </div>
        ) : (
          <>
            <span className="upload-zone-icon">📁</span>
            <span className="upload-zone-title">
              Drop {isBase ? 'Base' : 'Comparison'} PDF
            </span>
            <span className="upload-zone-subtitle">
              or click to browse
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="upload-screen">
      <div className="upload-header">
        <h1>PDF Compare & Review</h1>
        <p>Upload two PDF revisions to detect and review differences</p>
      </div>

      <div className="upload-zones">
        {renderZone('base', files.base, baseInputRef)}
        <div className="upload-vs">VS</div>
        {renderZone('compare', files.compare, compareInputRef)}
      </div>

      <div className="upload-options">
        <div className="upload-settings">
          <div className="upload-setting">
            <label htmlFor="compare-mode">Mode:</label>
            <select
              id="compare-mode"
              value={comparison.mode}
              onChange={(e) => dispatch({ type: 'SET_COMPARE_MODE', payload: e.target.value })}
            >
              <option value="pixel">Pixel (Visual)</option>
              <option value="text">Text</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="upload-threshold">
            <label htmlFor="threshold-slider">Sensitivity:</label>
            <input
              id="threshold-slider"
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
            <span className="threshold-val">%</span>
          </div>
        </div>

        <button
          className="start-compare-btn"
          disabled={!files.base || !files.compare}
          onClick={handleStartComparison}
        >
          🔍 Start Comparison
        </button>
      </div>
    </div>
  );
}
