import React, { useRef, useCallback } from 'react';
import { usePdf } from '../context/PdfContext';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { extractAttachments } from '../utils/savePdf';

// Configure worker (CDN-based for CRA compatibility)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export default function DropZone() {
    const { dispatch } = usePdf();
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = React.useState(false);

    const loadPdf = useCallback(async (file) => {
        if (!file || file.type !== 'application/pdf') return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);

            const attachments = extractAttachments(pdfDoc);
            let sourcePdfData = null;
            let restoredAnnotations = null;

            if (attachments['source.pdf'] && attachments['annotations.json']) {
                console.log('Found embedded editable data. Restoring...');

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

                sourcePdfData = await decompress(attachments['source.pdf']);
                const jsonBytes = await decompress(attachments['annotations.json']);

                const jsonString = new TextDecoder().decode(jsonBytes);
                const cleanJsonString = jsonString.replace(/\0/g, '');

                try {
                    restoredAnnotations = JSON.parse(cleanJsonString);
                } catch (e) {
                    console.error('Failed to parse restored annotations:', e);
                }
            }

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
                    file: fileToLoad,
                    doc,
                    totalPages: doc.numPages,
                    fileName: file.name,
                },
            });

            if (restoredAnnotations) {
                dispatch({ type: 'RESTORE_ANNOTATIONS', payload: restoredAnnotations });
            }

        } catch (error) {
            console.error('Error loading PDF:', error);
        }
    }, [dispatch]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        loadPdf(file);
    }, [loadPdf]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        loadPdf(file);
        e.target.value = '';
    };

    return (
        <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <div className="drop-zone-content">
                <div className="drop-zone-icon">📄</div>
                <div className="drop-zone-title">Drop PDF Here</div>
                <div className="drop-zone-subtitle">or click the button below to browse</div>
                <input
                    type="file"
                    accept=".pdf"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <button className="drop-zone-btn" onClick={() => fileInputRef.current.click()}>
                    Open PDF File
                </button>
            </div>
        </div>
    );
}
