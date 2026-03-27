import React from 'react';
import { usePdf, } from '../context/PdfContext';
import { savePdfWithAnnotations } from '../utils/savePdf';
import dayjs from 'dayjs';

export default function TopBar() {
    const { state, dispatch } = usePdf();
    const { undoStack, redoStack, pdfFile, annotations, currentPage, totalPages, zoom, viewMode, stampMode } = state;

    const handleUndo = () => dispatch({ type: 'UNDO' });
    const handleRedo = () => dispatch({ type: 'REDO' });

    const goToPage = (page) => {
        const p = Math.max(1, Math.min(totalPages, page));
        dispatch({ type: 'SET_PAGE', payload: p });
    };

    const handlePageInput = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) goToPage(val);
    };

    const handleZoom = (val) => {
        dispatch({ type: 'SET_ZOOM', payload: parseFloat(val) });
    };

    const handleDownload = async (mode = 'editable') => {
        if (!pdfFile) return;
        try {
            // Always generate a fresh buffer from the immutable Blob
            const pdfBytesInput = await pdfFile.arrayBuffer();
            const bytes = await savePdfWithAnnotations(pdfBytesInput, annotations, mode === 'editable');
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            let today = dayjs().format('YYYYMMDD_HHmmss');
            let suffix = mode === 'editable' ? '_editable' : '_final';
            a.download = state.fileName ? `${state.fileName.replace('.pdf', '')}${suffix}_${stampMode}_${today}.pdf` : `annotated${suffix}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Save failed:', err);
        }
    };

    return (
        <div className="top-bar">
            {/* Left: Undo, Redo, Download */}
            <div className="top-bar-left">
                <button className="action-btn" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
                    ↩
                </button>
                <button className="action-btn" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
                    ↪
                </button>

                {/* <button className="action-btn" onClick={handleDownload} disabled={!pdfFile} title="Download">
                    ⬇
                </button> */}

            </div>

            {/* Center: Navigation & View Controls (Moved from NavBar) */}
            <div className="top-bar-center" style={{ flex: 1, justifyContent: 'center' }}>
                {pdfFile && (
                    <>
                        <div className="view-controls" style={{ display: 'flex', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '12px' }}>
                            <button
                                className={`action-btn ${viewMode === 'continuous' ? 'active' : ''}`}
                                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'continuous' })}
                                title="Scroll Mode"
                                style={{ background: viewMode === 'continuous' ? 'var(--bg-dark)' : 'transparent' }}
                            >
                                📜
                            </button>
                            <button
                                className={`action-btn ${viewMode === 'single' ? 'active' : ''}`}
                                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'single' })}
                                title="Single Page Mode"
                                style={{ background: viewMode === 'single' ? 'var(--bg-dark)' : 'transparent' }}
                            >
                                📄
                            </button>
                        </div>

                        <div className="page-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '12px' }}>
                            <button className="action-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || viewMode === 'continuous'}>◀</button>
                            <input
                                className="page-input"
                                type="number"
                                value={currentPage}
                                onChange={handlePageInput}
                                min={1}
                                max={totalPages}
                                disabled={viewMode === 'continuous'}
                                style={{
                                    width: '50px',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-darker)',
                                    color: 'var(--text-light)',
                                    textAlign: 'center',
                                    fontSize: '13px'
                                }}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ {totalPages}</span>
                            <button className="action-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || viewMode === 'continuous'}>▶</button>
                        </div>

                        <div className="zoom-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="action-btn" onClick={() => handleZoom(Math.max(0.25, zoom - 0.25))}>−</button>
                            <input
                                type="range"
                                min="0.25"
                                max="3"
                                step="0.25"
                                value={zoom}
                                onChange={(e) => handleZoom(e.target.value)}
                                style={{ width: '80px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                            />
                            <button className="action-btn" onClick={() => handleZoom(Math.min(3, zoom + 0.25))}>+</button>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '35px', textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
                        </div>
                    </>
                )}
            </div>

            {/* Right: Save PDF */}
            <div className="top-bar-right" style={{ display: 'flex', gap: '8px' }}>
                <button className="action-btn" onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} title="Settings">
                    ⚙️
                </button>
                <button className="action-btn secondary" onClick={() => handleDownload('editable')} disabled={!pdfFile} title="Save PDF with embedded data for future re-editing">
                    💾 Save (Editable)
                </button>
                <button className="action-btn primary" onClick={() => handleDownload('standard')} disabled={!pdfFile} title="Save strictly flattened PDF (cannot be re-edited here)">
                    📄 Save (Final)
                </button>
            </div>
        </div>
    );
}
