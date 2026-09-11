import React, { useState } from 'react';
import { useCompare } from '../context/CompareContext';
import { exportToCsv } from '../utils/exportCsv';
import { exportToPdf } from '../utils/exportPdf';

export default function ExportDialog() {
  const { state, dispatch } = useCompare();
  const { showExportDialog, review, comparison, files } = state;
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);

  if (!showExportDialog) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const fileInfo = {
        baseName: files.base?.name || 'base.pdf',
        compareName: files.compare?.name || 'compare.pdf',
        baseDoc: files.base?.pdfDoc,
        compareDoc: files.compare?.pdfDoc,
      };

      if (selectedFormat === 'pdf') {
        await exportToPdf(review.diffs, comparison.results, fileInfo);
      } else {
        exportToCsv(review.diffs, fileInfo.baseName, fileInfo.compareName);
      }

      dispatch({ type: 'TOGGLE_EXPORT_DIALOG' });
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      dispatch({ type: 'TOGGLE_EXPORT_DIALOG' });
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card">
        <h2 className="modal-title">📥 Export Report</h2>

        <div className="modal-body">
          <div
            className={`export-option ${selectedFormat === 'pdf' ? 'selected' : ''}`}
            onClick={() => setSelectedFormat('pdf')}
          >
            <span className="export-icon">📄</span>
            <div className="export-info">
              <h4>PDF Report</h4>
              <p>Full report with summary, difference details, and statuses</p>
            </div>
          </div>

          <div
            className={`export-option ${selectedFormat === 'csv' ? 'selected' : ''}`}
            onClick={() => setSelectedFormat('csv')}
          >
            <span className="export-icon">📊</span>
            <div className="export-info">
              <h4>CSV Spreadsheet</h4>
              <p>Tabular data for import into Excel or Google Sheets</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'TOGGLE_EXPORT_DIALOG' })}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <span className="spinner" /> Exporting...
              </>
            ) : (
              `Export as ${selectedFormat.toUpperCase()}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
