import React, { useRef, useEffect, useState } from 'react';
import { usePdf } from '../context/PdfContext';
import AnnotationLayer from './AnnotationLayer';

export default function PdfPage({ pageNumber, scale, pdfDoc }) {
    const { dispatch } = usePdf();
    const canvasRef = useRef(null);
    const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
    const renderTaskRef = useRef(null);

    useEffect(() => {
        if (!pdfDoc) return;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNumber);
                const viewport = page.getViewport({ scale: scale * 1.5 }); // High DPI
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width / 1.5}px`;
                canvas.style.height = `${viewport.height / 1.5}px`;

                setPageSize({
                    width: viewport.width / 1.5,
                    height: viewport.height / 1.5,
                });

                // Cancel previous render
                if (renderTaskRef.current) {
                    try { renderTaskRef.current.cancel(); } catch { }
                }

                const renderTask = page.render({ canvasContext: ctx, viewport });
                renderTaskRef.current = renderTask;

                await renderTask.promise;
            } catch (err) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error(`Error rendering page ${pageNumber}:`, err);
                }
            }
        };

        renderPage();

        return () => {
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch { }
            }
        };
    }, [pdfDoc, pageNumber, scale]);

    const handleBackgroundClick = (e) => {
        // Only deselect if the click is directly on the wrapper or canvas
        // valid background targets: the wrapper div, the canvas, or the page number indicator
        if (
            e.target.classList.contains('pdf-page-wrapper') ||
            e.target.tagName === 'CANVAS' ||
            e.target.classList.contains('page-number-indicator')
        ) {
            dispatch({ type: 'DESELECT_ANNOTATION' });
        }
    };

    return (
        <div
            className="pdf-page-wrapper"
            style={{ width: pageSize.width, height: pageSize.height, marginBottom: 20 }}
            onClick={handleBackgroundClick}
        >
            <canvas ref={canvasRef} />
            <AnnotationLayer pageSize={pageSize} pageIndex={pageNumber} />
            <div className="page-number-indicator">Page {pageNumber}</div>
        </div>
    );
}
