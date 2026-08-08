import React, { useEffect, useRef } from 'react';
import { CompareProvider, useCompare } from './context/CompareContext';
import TopBar from './components/TopBar';
import NavBar from './components/NavBar';
import FileUploadPanel from './components/FileUploadPanel';
import ProgressOverlay from './components/ProgressOverlay';
import DiffPanel from './components/DiffPanel';
import ViewerArea from './components/ViewerArea';
import ExportDialog from './components/ExportDialog';
import { runComparison } from './engine/comparisonRunner';
import './ComparePdfTool.css';

function AppContent() {
  const { state, dispatch } = useCompare();
  const { files, comparison } = state;
  const cancelRef = useRef(false);

  // ── Run comparison when triggered ──
  useEffect(() => {
    if (!comparison.isComparing) return;
    if (!files.base?.pdfDoc || !files.compare?.pdfDoc) return;

    cancelRef.current = false;

    const run = async () => {
      try {
        const { results, diffs } = await runComparison(
          files.base.pdfDoc,
          files.compare.pdfDoc,
          {
            mode: comparison.mode,
            threshold: comparison.threshold,
            onProgress: (progress, text) => {
              dispatch({
                type: 'SET_COMPARISON_PROGRESS',
                payload: { progress, text },
              });
            },
            isCancelled: () => cancelRef.current,
          }
        );

        if (!cancelRef.current) {
          dispatch({
            type: 'SET_COMPARISON_RESULTS',
            payload: { results, diffs },
          });
        }
      } catch (err) {
        if (err.message !== 'Comparison cancelled') {
          console.error('Comparison failed:', err);
          alert(`Comparison failed: ${err.message}`);
        }
        dispatch({ type: 'CANCEL_COMPARISON' });
      }
    };

    run();

    return () => {
      cancelRef.current = true;
    };
  }, [comparison.isComparing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Determine app state ──
  const showUpload = !comparison.hasResults && !comparison.isComparing;
  const showViewer = comparison.hasResults;

  return (
    <div className="compare-pdf-tool-container">
      <div className="app-container">
        <TopBar />
        <NavBar />

        <div className="app-body">
          {showUpload && <FileUploadPanel />}

          {showViewer && (
            <>
              <DiffPanel />
              <ViewerArea />
            </>
          )}
        </div>

        <ProgressOverlay />
        <ExportDialog />
      </div>
    </div>
  )
}
export default function ComparePdfTool() {
  return (
    <CompareProvider>
      <AppContent />
    </CompareProvider>
  );
}
