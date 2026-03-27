import React from 'react';
import { usePdf } from '../context/PdfContext';

export default function NavBar() {
    const { state, dispatch } = usePdf();
    const { currentPage, totalPages, zoom, pdfFile } = state;

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

    // Check pdfFile instead of pdfData (Schema Change)
    if (!state.pdfFile) return null;

    return (
        <div className="nav-bar">
            <div className="view-controls">
                <button
                    className={state.viewMode === 'continuous' ? 'active' : ''}
                    onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'continuous' })}
                    title="Continuous Scroll"
                >
                    📜 Scroll
                </button>
                <button
                    className={state.viewMode === 'single' ? 'active' : ''}
                    onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'single' })}
                    title="Single Page"
                >
                    📄 Single
                </button>
            </div>

            <div className="page-controls">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || state.viewMode === 'continuous'}>◀</button>
                <input
                    className="page-input"
                    type="number"
                    value={currentPage}
                    onChange={handlePageInput}
                    min={1}
                    max={totalPages}
                    disabled={state.viewMode === 'continuous'}
                />
                <span className="page-total">/ {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || state.viewMode === 'continuous'}>▶</button>
            </div>

            <div className="zoom-control">
                <button onClick={() => handleZoom(Math.max(0.25, zoom - 0.25))}>−</button>
                <input
                    className="zoom-slider"
                    type="range"
                    min="0.25"
                    max="3"
                    step="0.25"
                    value={zoom}
                    onChange={(e) => handleZoom(e.target.value)}
                />
                <button onClick={() => handleZoom(Math.min(3, zoom + 0.25))}>+</button>
                <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            </div>
        </div>
    );
}
