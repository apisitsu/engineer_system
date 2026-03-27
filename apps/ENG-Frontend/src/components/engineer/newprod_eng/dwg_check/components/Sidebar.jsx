import React, { useRef } from 'react';
import { usePdf } from '../context/PdfContext';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import Swal from 'sweetalert2';
import { extractAttachments } from '../utils/savePdf';

// Configure worker (CDN-based for CRA compatibility)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export default function Sidebar() {
    const { state, setTool, dispatch } = usePdf();
    const { activeTool } = state;
    const fileInputRef = useRef(null);

    const stampTools = [
        {
            id: 'stamp-check',
            title: 'Checkmark',
            icon: <text x="15" y="15" dy=".35em" textAnchor="middle" fontSize="25" fill="currentColor" fontFamily="Arial, sans-serif">✓</text>
        },
        {
            id: 'stamp-cross',
            title: 'Cross',
            icon: <text x="15" y="15" dy=".35em" textAnchor="middle" fontSize="25" fill="currentColor" fontFamily="Arial, sans-serif">✕</text>
        },
        {
            id: 'stamp-circle',
            title: 'Circle',
            icon: <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
        },
        {
            id: 'stamp-ok',
            title: 'OK Stamp',
            icon: (
                <>
                    <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
                    <text x="15" y="15" dy=".35em" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor" fontFamily="Arial, sans-serif">OK</text>
                </>
            )
        }
    ];

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') return;
        await loadPdf(file);
        e.target.value = '';
    };

    const loadPdf = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);

            // Extract attachments using manual helper
            const attachments = extractAttachments(pdfDoc);

            let sourcePdfData = null;
            let restoredAnnotations = null;

            if (attachments['source.pdf'] && attachments['annotations.json']) {
                console.log('Found embedded editable data. Restoring...');

                // Helper to decompress if needed
                const decompress = async (bytes) => {
                    if (bytes && bytes.length > 0 && bytes[0] === 0x78) {
                        try {
                            const ds = new DecompressionStream('deflate');
                            const writer = ds.writable.getWriter();
                            writer.write(bytes);
                            writer.close();
                            const output = [];
                            const reader = ds.readable.getReader();
                            let totalSize = 0;
                            while (true) {
                                const { value, done } = await reader.read();
                                if (done) break;
                                output.push(value);
                                totalSize += value.length;
                            }
                            const result = new Uint8Array(totalSize);
                            let offset = 0;
                            for (const chunk of output) {
                                result.set(chunk, offset);
                                offset += chunk.length;
                            }
                            return result;
                        } catch (e) {
                            console.warn('Decompression failed, returning original bytes', e);
                            return bytes;
                        }
                    }
                    return bytes;
                };

                // Extract and decompress Source PDF
                // source.pdf is also likely compressed by pdf-lib when attached
                sourcePdfData = await decompress(attachments['source.pdf']);

                // Extract and decompress Annotations JSON
                const jsonBytes = await decompress(attachments['annotations.json']);

                const jsonString = new TextDecoder().decode(jsonBytes);
                // Basic cleanup
                const cleanJsonString = jsonString.replace(/\0/g, '');

                try {
                    restoredAnnotations = JSON.parse(cleanJsonString);
                } catch (e) {
                    console.error('Failed to parse restored annotations:', e);
                }
            }

            // Decide which file to render
            // If restoration found, use sourcePdfData (clean file) for rendering background
            // Otherwise use the original file (flattened)

            const fileToLoad = sourcePdfData ? new Blob([sourcePdfData], { type: 'application/pdf' }) : file;
            const url = URL.createObjectURL(fileToLoad);

            const doc = await pdfjsLib.getDocument({
                url,
                cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;

            dispatch({
                type: 'SET_PDF',
                payload: {
                    file: fileToLoad, // Store the CLEAN source if available, or original
                    doc,
                    totalPages: doc.numPages,
                    fileName: file.name,
                },
            });

            // Restore annotations if found
            if (restoredAnnotations) {
                // We need to add them one by one or dispatch a bulk add?
                // Our reducer supports ADD_ANNOTATION (single).
                // Let's dispatch a bulk action or loop.
                // Since we don't have BULK_ADD, let's just loop for now or add a new action.
                // Loop is fine for < 100 items.
                // Better: Create a RESTORE_ANNOTATIONS action.
                dispatch({ type: 'RESTORE_ANNOTATIONS', payload: restoredAnnotations });

                Swal.fire({
                    title: 'Restored!',
                    text: 'Editable annotations found and restored.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }

        } catch (error) {
            console.error('Error loading PDF:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to load PDF file.',
                icon: 'error',
            });
        }
    };

    const handleClearPage = () => {
        Swal.fire({
            title: 'Clear Page?',
            text: `Remove all annotations from page ${state.currentPage}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, clear it!'
        }).then((result) => {
            if (result.isConfirmed) {
                dispatch({ type: 'CLEAR_PAGE_ANNOTATIONS', payload: state.currentPage });
                Swal.fire({
                    title: 'Cleared!',
                    text: 'Page annotations have been removed.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };

    const handleClosePdf = () => {
        Swal.fire({
            title: 'Close PDF?',
            text: "Unsaved changes will be lost!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, close it!'
        }).then((result) => {
            if (result.isConfirmed) {
                dispatch({ type: 'RESET_PDF' });
            }
        });
    };

    const tools = [
        { key: 'highlight-rect', label: 'Rectangle Highlight', icon: '▭' },
        { key: 'highlight-ellipse', label: 'Ellipse Highlight', icon: '◯' },
        { key: 'text-box', label: 'Add Text', icon: '✎' },
        { key: 'arrow', label: 'Draw Arrow', icon: '↗' },
        { key: 'shape-rect', label: 'Rectangle Shape', icon: '□' },
        { key: 'shape-ellipse', label: 'Ellipse Shape', icon: '○' },
    ];

    const stamps = [
        { key: 'stamp-check', label: '✓', className: 'checkmark' },
        { key: 'stamp-cross', label: '✕', className: 'cross' },
        { key: 'stamp-cross-red', label: '✕', className: 'cross' },
        { key: 'stamp-circle', label: '◯', className: 'circle' },
        { key: 'stamp-ok', label: 'OK', className: 'ok' },
    ];

    return (
        <div className="sidebar" style={{ height: '100%' }}>
            <div className="sidebar-section">
                <div className="sidebar-section-title">Tools</div>
                {tools.map(t => (
                    <button
                        key={t.key}
                        className={`tool-btn ${activeTool === t.key ? 'active' : ''}`}
                        onClick={() => setTool(t.key)}
                    >
                        <span className="tool-icon">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="sidebar-section">
                <div className="sidebar-section-title">Role</div>
                <div className="role-selector">
                    <button
                        className={`role-btn maker ${state.stampColor === '#3498db' ? 'active' : ''}`}
                        onClick={() => dispatch({ type: 'SET_STAMP_COLOR', payload: 'drawer' })}
                        title="Drawer (Blue)"
                    >
                        Drawer
                    </button>
                    <button
                        className={`role-btn checker ${state.stampColor === '#e74c3c' ? 'active' : ''}`}
                        onClick={() => dispatch({ type: 'SET_STAMP_COLOR', payload: 'checker' })}
                        title="Checker (Red)"
                    >
                        Checker
                    </button>
                    <button
                        className={`role-btn approver ${state.stampColor === '#000000' ? 'active' : ''}`}
                        onClick={() => dispatch({ type: 'SET_STAMP_COLOR', payload: 'approver' })}
                        title="Approver (Black)"
                    >
                        Approve
                    </button>
                </div>
            </div>

            <div className="sidebar-section">
                <div className="sidebar-section-title">Stamps</div>
                <div className="stamp-grid">
                    {stampTools.map(({ id, title, icon }) => (
                        <button
                            key={id}
                            className={`stamp-btn ${activeTool === id ? 'active' : ''}`}
                            onClick={() => setTool(id)}
                            title={title}
                            style={{ color: state.stampColor }}
                        >
                            <svg viewBox="0 0 30 30" width="20" height="20">
                                {icon}
                            </svg>
                        </button>
                    ))}
                </div>
                <button
                    className={`tool-btn ${activeTool === 'stamp-userdate' ? 'active' : ''}`}
                    onClick={() => setTool('stamp-userdate')}
                    style={{ marginTop: 8 }}
                >
                    <span className="tool-icon">👤</span>
                    User/Date Stamp
                </button>
            </div>

            <div className="sidebar-bottom">
                {state.pdfFile && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                        <button
                            className="open-pdf-btn"
                            style={{ background: 'var(--accent-red)', marginTop: 0 }}
                            onClick={handleClearPage}
                        >
                            🗑️ Clear Page
                        </button>
                        <button
                            className="open-pdf-btn"
                            style={{ background: 'var(--text-muted)', marginTop: 0 }}
                            onClick={handleClosePdf}
                        >
                            ❌ Close PDF
                        </button>
                    </div>
                )}

                <input
                    type="file"
                    accept=".pdf"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <button className="open-pdf-btn" onClick={() => fileInputRef.current.click()}>
                    {state.pdfFile ? '📂 Open Another PDF' : '📄 Open PDF'}
                </button>
            </div>
        </div>
    );
}
