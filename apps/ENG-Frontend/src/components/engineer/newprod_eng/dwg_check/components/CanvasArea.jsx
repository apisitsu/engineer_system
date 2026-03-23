import React, { useRef, useState, useEffect } from 'react';
import { usePdf } from '../context/PdfContext';
import PdfPage from './PdfPage';
import DropZone from './DropZone';

export default function CanvasArea() {
    const { state } = usePdf();
    const { pdfDoc, currentPage, zoom, viewMode, totalPages } = state;
    const containerRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                setIsCtrlPressed(false);
                setIsPanning(false);
                document.body.style.cursor = '';
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const handleMouseDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && containerRef.current) {
            e.preventDefault();
            e.stopPropagation(); // Prevent children (like AnnotationLayer) from reacting
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            document.body.style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning && containerRef.current) {
            e.preventDefault();
            e.stopPropagation();
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;

            containerRef.current.scrollLeft -= dx;
            containerRef.current.scrollTop -= dy;

            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            document.body.style.cursor = '';
        }
    };

    if (!pdfDoc) {
        return (
            <div className="canvas-area">
                <DropZone />
            </div>
        );
    }

    return (
        <div
            className="canvas-area"
            ref={containerRef}
            onMouseDownCapture={handleMouseDown}
            onMouseMoveCapture={handleMouseMove} // Capture move to ensure smooth panning even if hovering over children
            onMouseUpCapture={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
                cursor: isCtrlPressed ? (isPanning ? 'grabbing' : 'grab') : 'default',
                overflow: 'auto'
            }}
        >
            {viewMode === 'single' ? (
                <PdfPage
                    key={currentPage}
                    pageNumber={currentPage}
                    scale={zoom}
                    pdfDoc={pdfDoc}
                />
            ) : (
                <div className="continuous-view">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                        <PdfPage
                            key={pageNum}
                            pageNumber={pageNum}
                            scale={zoom}
                            pdfDoc={pdfDoc}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
