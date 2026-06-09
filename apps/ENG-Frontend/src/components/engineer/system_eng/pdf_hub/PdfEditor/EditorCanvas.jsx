import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { useTheme } from '../../../../../theme';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';
import { useAuthStore } from '../../../../../stores/authStore';
import ToolPreview from './canvas/ToolPreview';
import useFabricTools from './canvas/hooks/useFabricTools';
import useHighlightTools from './canvas/hooks/useHighlightTools';

/**
 * EditorCanvas — Multi-Layer rendering engine.
 *
 *   Layer 1:    <canvas> rendered by PDF.js (read-only pixel buffer)
 *   Layer 1.5h: <canvas> highlight layer (mix-blend-mode: multiply)
 *   Layer 1.5:  <canvas> overlay compare PDF
 *   Layer 2:    Fabric.js interactive canvas (transparent overlay)
 *
 * Props:
 *   pdfDoc          — pdfjs-dist document for rendering
 *   pageNum         — 1-indexed page number for this specific canvas
 *   zoom            — float zoom level
 *   pageAnnotations — { [pageNum]: fabricJSON }
 *   pageHighlights  — { [pageNum]: [ { id, x, y, width, height, color } ] }
 *   setPageHighlights — setter for highlight state
 *   fabricCanvasRefs— ref object to store Fabric.Canvas instances by pageNum
 *   pushHistory     — callback to snapshot before mutations
 *   onPageRendered  — callback after PDF page renders (sends pageSize)
 */
const EditorCanvas = ({
    pageNum,
    pdfDoc,
    zoom,
    pageAnnotations,
    pageHighlights,
    setPageHighlights,
    fabricCanvasRefs,
    pushHistory,
    onPageRendered,
    overlayPdfDoc,
    stampData,
}) => {
    const { theme } = useTheme();
    const pdfCanvasRef = useRef(null);
    const highlightCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const fabricElRef = useRef(null);
    const containerRef = useRef(null);
    const previewRef = useRef(null); // Ref for the floating preview
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // Hybrid drawing state (for freehand highlight fallback)
    const hlDrawRef = useRef({ isDrawing: false, startX: 0, startY: 0 });

    // Render task ref for proper cancellation
    const renderTaskRef = useRef(null);

    const store = usePdfEditorStore();
    const { userName, userDepartment } = useAuthStore();

    // ── Constants ──
    const RENDER_SCALE = Math.max(window.devicePixelRatio || 1, 1.5); // DPR-aware super-sample

    // ══════════════════════════════════════════════════════════════════
    // Initialize Fabric.js Canvas (once)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!fabricElRef.current || fabricCanvasRefs.current[pageNum]) return;

        const canvas = new fabric.Canvas(fabricElRef.current, {
            selection: true,
            preserveObjectStacking: true,
            enableRetinaScaling: true, // DPR-aware: crisp annotations on Retina displays
            stopContextMenu: true,
            fireRightClick: true,
        });

        fabricCanvasRefs.current[pageNum] = canvas;

        // ── Object selection events ──
        canvas.on('selection:created', (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                store.setSelectedObject(obj.id || obj.__uid, {
                    type: obj.type,
                    fill: obj.fill,
                    stroke: obj.stroke,
                    strokeWidth: obj.strokeWidth,
                    opacity: obj.opacity,
                    fontSize: obj.fontSize,
                    fontFamily: obj.fontFamily,
                    text: obj.text,
                    customData: obj.customData,
                });
                
                // Sync back to global store to update PropertiesPanel
                if (obj.stroke) store.setStrokeColor(obj.stroke);
                if (obj.fill && obj.fill !== 'transparent' && obj.fill !== '#ffffff') {
                    // Stamps often have transparent fill
                    store.setFillColor(obj.fill);
                }
                if (obj.strokeWidth) store.setStrokeWidth(obj.strokeWidth);
                if (obj.fontSize) store.setFontSize(obj.fontSize);
                if (obj.opacity) store.setOpacity(obj.opacity);
                if (obj.fontFamily) store.setFontFamily(obj.fontFamily);
            }
        });

        canvas.on('selection:updated', (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                store.setSelectedObject(obj.id || obj.__uid, {
                    type: obj.type,
                    fill: obj.fill,
                    stroke: obj.stroke,
                    strokeWidth: obj.strokeWidth,
                    opacity: obj.opacity,
                    fontSize: obj.fontSize,
                    fontFamily: obj.fontFamily,
                    text: obj.text,
                    customData: obj.customData,
                });

                // Sync back to global store to update PropertiesPanel
                if (obj.stroke) store.setStrokeColor(obj.stroke);
                if (obj.fill && obj.fill !== 'transparent' && obj.fill !== '#ffffff') {
                    store.setFillColor(obj.fill);
                }
                if (obj.strokeWidth) store.setStrokeWidth(obj.strokeWidth);
                if (obj.fontSize) store.setFontSize(obj.fontSize);
                if (obj.opacity) store.setOpacity(obj.opacity);
                if (obj.fontFamily) store.setFontFamily(obj.fontFamily);
            }
        });

        canvas.on('selection:cleared', () => {
            store.clearSelection();
        });

        // ── Modification tracking for undo ──
        canvas.on('object:modified', () => {
            if (pushHistory) pushHistory(pageNum);
        });

        const updateObjectCount = () => {
            store.setCanvasObjectCount(pageNum, canvas.getObjects().length);
        };
        canvas.on('object:added', updateObjectCount);
        canvas.on('object:removed', updateObjectCount);

        return () => {
            canvas.dispose();
            delete fabricCanvasRefs.current[pageNum];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageNum]);

    // ══════════════════════════════════════════════════════════════════
    // Render PDF Page (Layer 1)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!pdfDoc || !pdfCanvasRef.current) return;
        let cancelled = false;
        let renderTimeoutId;

        const initCanvasSizeAndRender = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                if (cancelled) return;

                const viewport = page.getViewport({ scale: zoom * RENDER_SCALE });
                const displayW = viewport.width / RENDER_SCALE;
                const displayH = viewport.height / RENDER_SCALE;

                // ── 1. Immediate CSS Size Updates ──
                const canvas = pdfCanvasRef.current;
                canvas.style.width = `${displayW}px`;
                canvas.style.height = `${displayH}px`;
                
                setCanvasSize({ width: displayW, height: displayH });

                const fc = fabricCanvasRefs.current[pageNum];
                if (fc) {
                    const oldW = fc.width || displayW;
                    const scaleX = displayW / oldW;
                    const scaleY = displayH / (fc.height || displayH);
                    
                    fc.setDimensions({ width: displayW, height: displayH });
                    
                    if (fc.getObjects().length === 0 && pageAnnotations[pageNum] && pageAnnotations[pageNum].objects?.length > 0) {
                        // Initial load
                        await fc.loadFromJSON(pageAnnotations[pageNum]);
                        const savedW = pageAnnotations[pageNum]._canvasWidth || displayW;
                        const savedH = pageAnnotations[pageNum]._canvasHeight || displayH;
                        const initScaleX = displayW / savedW;
                        const initScaleY = displayH / savedH;
                        if (Math.abs(initScaleX - 1) > 0.01 || Math.abs(initScaleY - 1) > 0.01) {
                            fc.getObjects().forEach(obj => {
                                obj.set({
                                    left: obj.left * initScaleX, top: obj.top * initScaleY,
                                    scaleX: (obj.scaleX || 1) * initScaleX, scaleY: (obj.scaleY || 1) * initScaleY,
                                });
                                obj.setCoords();
                            });
                        }
                    } else if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                        // Scale existing objects on zoom
                        fc.getObjects().forEach(obj => {
                            obj.set({
                                left: obj.left * scaleX, top: obj.top * scaleY,
                                scaleX: (obj.scaleX || 1) * scaleX, scaleY: (obj.scaleY || 1) * scaleY,
                            });
                            obj.setCoords();
                        });
                    }
                    fc.renderAll();
                }

                const textLayerDiv = textLayerRef.current;
                if (textLayerDiv) {
                    textLayerDiv.style.width = `${displayW}px`;
                    textLayerDiv.style.height = `${displayH}px`;
                }

                if (onPageRendered) {
                    const baseVp = page.getViewport({ scale: 1.0 });
                    onPageRendered({
                        width: baseVp.width, height: baseVp.height,
                        displayWidth: displayW, displayHeight: displayH,
                    });
                }

                // ── 2. Debounced High-Res PDF Rendering ──
                clearTimeout(renderTimeoutId);
                renderTimeoutId = setTimeout(async () => {
                    if (cancelled) return;
                    
                    try {
                        const ctx = canvas.getContext('2d');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        
                        const renderTask = page.render({ canvasContext: ctx, viewport });
                        renderTaskRef.current = renderTask;
                        await renderTask.promise;

                        if (cancelled) return;

                        // Render Text Layer
                        const textContent = await page.getTextContent();
                        if (cancelled) return;
                        
                        if (textLayerDiv) {
                            textLayerDiv.innerHTML = ''; 
                            const textViewport = page.getViewport({ scale: zoom });
                            textLayerDiv.style.setProperty('--scale-factor', textViewport.scale);

                            pdfjsLib.renderTextLayer({
                                textContentSource: textContent,
                                container: textLayerDiv,
                                viewport: textViewport,
                                textDivs: []
                            });
                        }
                    } catch (renderErr) {
                        if (!cancelled) console.error('Render error:', renderErr);
                    }
                }, 250); // 250ms debounce for smooth zooming
                
            } catch (err) {
                if (!cancelled) console.error('Page init error:', err);
            }
        };

        initCanvasSizeAndRender();

        return () => {
            cancelled = true;
            clearTimeout(renderTimeoutId);
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfDoc, pageNum, zoom]);

    // ══════════════════════════════════════════════════════════════════
    // Render Overlay PDF (Layer 1.5)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!overlayPdfDoc || !overlayCanvasRef.current || !store.overlayEnabled) {
            // Clear overlay canvas if disabled
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }
            return;
        }

        let cancelled = false;

        const renderOverlay = async () => {
            try {
                const overlayPageNum = Math.min(pageNum, overlayPdfDoc.numPages);
                const page = await overlayPdfDoc.getPage(overlayPageNum);
                const viewport = page.getViewport({ scale: zoom * RENDER_SCALE });

                const canvas = overlayCanvasRef.current;
                const ctx = canvas.getContext('2d');

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const displayW = viewport.width / RENDER_SCALE;
                const displayH = viewport.height / RENDER_SCALE;
                canvas.style.width = `${displayW}px`;
                canvas.style.height = `${displayH}px`;

                if (!cancelled) {
                    await page.render({ canvasContext: ctx, viewport }).promise;
                }
            } catch (err) {
                if (!cancelled) console.error('Overlay render error:', err);
            }
        };

        renderOverlay();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overlayPdfDoc, pageNum, zoom, store.overlayEnabled]);

    // ══════════════════════════════════════════════════════════════════
    // Configure Fabric.js for active tool
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const fc = fabricCanvasRefs.current[pageNum];
        if (!fc) return;

        const tool = store.activeTool;

        // Reset
        fc.isDrawingMode = false;
        fc.selection = true;
        fc.defaultCursor = 'default';
        fc.hoverCursor = 'move';

        switch (tool) {
            case 'select':
                fc.selection = true;
                break;

            case 'pan':
                fc.selection = false;
                fc.defaultCursor = 'grab';
                fc.hoverCursor = 'grab';
                break;

            case 'freehand':
                fc.isDrawingMode = true;
                fc.freeDrawingBrush = new fabric.PencilBrush(fc);
                fc.freeDrawingBrush.color = store.strokeColor;
                fc.freeDrawingBrush.width = store.strokeWidth;
                fc.freeDrawingBrush.decimate = 4;
                break;

            case 'highlight':
            case 'underline':
            case 'strikethrough':
            case 'eraser':
            case 'rect':
            case 'circle':
            case 'arrow':
            case 'line':
            case 'ruler':
            case 'addText':
            case 'maskReplace':
            case 'sticky':
            case 'stamp':
            case 'stampCheckmark':
            case 'stampCross':
            case 'stampCircle':
            case 'stampOk':
            case 'stampUserDate':
            case 'signature':
            case 'date':
                fc.selection = false;
                fc.defaultCursor = 'crosshair';
                fc.hoverCursor = 'crosshair';
                break;

            default:
                break;
        }

        fc.renderAll();
    }, [store.activeTool, store.strokeColor, store.strokeWidth, pageNum, fabricCanvasRefs]);

    // ══════════════════════════════════════════════════════════════════
    // Mouse handlers for shape drawing (Extracted to useFabricTools)
    // ══════════════════════════════════════════════════════════════════
    useFabricTools({
        pageNum,
        store,
        pushHistory,
        userName,
        stampData,
        fabricCanvasRefs,
    });

    // ══════════════════════════════════════════════════════════════════
    // Live update active object when store properties change
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const fc = fabricCanvasRefs.current[pageNum];
        if (!fc) return;
        const activeObj = fc.getActiveObject();
        if (!activeObj) return;

        let changed = false;

        // Skip highlights as they are not standard Fabric objects
        if (activeObj.customData?.type !== 'highlight') {
            const isText = activeObj.type === 'i-text' || activeObj.type === 'textbox' || activeObj.type === 'text';
            const isSticky = activeObj.customData?.type === 'sticky';
            const isStamp = activeObj.customData?.type && activeObj.customData.type.startsWith('stamp');

            // --- Color Update ---
            if (!isSticky) {
                if (isText) {
                    if (activeObj.fill !== store.strokeColor) {
                        activeObj.set('fill', store.strokeColor);
                        changed = true;
                    }
                } else if (!isStamp) {
                    // Regular shapes
                    if (activeObj.type === 'group') {
                        activeObj.getObjects().forEach(child => {
                            if (child.stroke) child.set('stroke', store.strokeColor);
                            if (child.type === 'triangle' && child.fill) child.set('fill', store.strokeColor);
                            if (child.type === 'text' || child.type === 'i-text') {
                                child.set('fill', store.strokeColor);
                            }
                        });
                        changed = true;
                    } else {
                        if (activeObj.stroke !== undefined && activeObj.stroke !== store.strokeColor) {
                            activeObj.set('stroke', store.strokeColor);
                            changed = true;
                        }
                        if (activeObj.fill !== undefined && activeObj.fill !== store.fillColor) {
                            activeObj.set('fill', store.fillColor);
                            changed = true;
                        }
                    }
                } else {
                    // Stamps: change all child objects if it's a group, or just the object
                    if (activeObj.type === 'group') {
                        activeObj.getObjects().forEach(child => {
                            if (child.stroke) child.set('stroke', store.strokeColor);
                            if (child.fill && child.fill !== 'transparent' && child.fill !== '#ffffff') {
                                child.set('fill', store.strokeColor);
                            }
                        });
                        changed = true;
                    } else {
                        if (activeObj.fill && activeObj.fill !== 'transparent') {
                            activeObj.set('fill', store.strokeColor);
                        }
                        if (activeObj.stroke) {
                            activeObj.set('stroke', store.strokeColor);
                        }
                        changed = true;
                    }
                }
            }

            // --- Stroke Width ---
            if (activeObj.type === 'group' && !isStamp) {
                activeObj.getObjects().forEach(child => {
                    if (['line', 'rect', 'circle', 'ellipse', 'path'].includes(child.type)) {
                        if (child.strokeWidth !== store.strokeWidth) {
                            child.set('strokeWidth', store.strokeWidth);
                            changed = true;
                        }
                    }
                    if (child.type === 'triangle') {
                        if (child.width !== store.fontSize || child.height !== store.fontSize) {
                            child.set({ width: store.fontSize, height: store.fontSize });
                            changed = true;
                        }
                    }
                });
                if (changed) activeObj.addWithUpdate();
            } else if (activeObj.strokeWidth !== undefined && activeObj.strokeWidth !== store.strokeWidth) {
                if (!isText && !isSticky) {
                    activeObj.set('strokeWidth', store.strokeWidth);
                    changed = true;
                }
            }

            // --- Opacity ---
            if (activeObj.opacity !== undefined && activeObj.opacity !== store.opacity) {
                activeObj.set('opacity', store.opacity);
                changed = true;
            }

            // --- Font Size (and Stamp Size) ---
            if (isText || isSticky) {
                if (activeObj.fontSize !== store.fontSize) {
                    activeObj.set('fontSize', store.fontSize);
                    changed = true;
                }
                if (activeObj.fontFamily !== store.fontFamily) {
                    activeObj.set('fontFamily', store.fontFamily);
                    changed = true;
                }
            } else if (activeObj.type === 'group' && !isStamp) {
                let textChanged = false;
                activeObj.getObjects().forEach(child => {
                    if (child.type === 'i-text' || child.type === 'text') {
                        if (child.fontSize !== store.fontSize) {
                            child.set('fontSize', store.fontSize);
                            textChanged = true;
                        }
                    }
                });
                if (textChanged) {
                    activeObj.addWithUpdate();
                    changed = true;
                }
            } else if (isStamp) {
                // Resize stamps dynamically
                if (activeObj.customData.type === 'stampCheckmark' || activeObj.customData.type === 'stampCross') {
                    activeObj.set('fontSize', store.fontSize * 2.5);
                    changed = true;
                } else if (activeObj.customData.type === 'stampCircle') {
                    activeObj.set('radius', store.fontSize);
                    changed = true;
                } else if (activeObj.customData.type === 'stampOk') {
                    activeObj.getObjects()[0].set('radius', store.fontSize * 1.2);
                    activeObj.getObjects()[1].set('fontSize', store.fontSize * 1.1);
                    activeObj.addWithUpdate(); // Recalculate group bounds
                    changed = true;
                } else if (activeObj.customData.type === 'stampUserDate') {
                    const scale = (store.fontSize / 16) * 0.75;
                    activeObj.set({ scaleX: scale, scaleY: scale });
                    changed = true;
                }
            }
        }

        if (changed) {
            fc.renderAll();
        }
    }, [
        store.strokeColor, store.fillColor, store.strokeWidth, 
        store.opacity, store.fontSize, store.fontFamily, pageNum
    ]);

    // ══════════════════════════════════════════════════════════════════
    // Highlight Layer — Drawing, Rendering, Deletion
    // ══════════════════════════════════════════════════════════════════

    // Sync highlight canvas size with PDF canvas size (DPR-aware) AND Redraw highlights
    useEffect(() => {
        const hlCanvas = highlightCanvasRef.current;
        if (!hlCanvas || canvasSize.width === 0) return;
        const dpr = window.devicePixelRatio || 1;
        
        // 1. Resize canvas (Note: resizing a canvas automatically clears its content)
        hlCanvas.width = canvasSize.width * dpr;
        hlCanvas.height = canvasSize.height * dpr;
        hlCanvas.style.width = `${canvasSize.width}px`;
        hlCanvas.style.height = `${canvasSize.height}px`;

        // 2. Render highlights
        const ctx = hlCanvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);

        // Apply DPR scale so all drawing ops use CSS coordinates
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cssW = canvasSize.width;
        const cssH = canvasSize.height;

        const highlights = (pageHighlights || {})[pageNum] || [];
        highlights.forEach(hl => {
            // Convert normalized ratios → CSS pixels
            const hx = hl.normX * cssW;
            const hy = hl.normY * cssH;
            const hw = hl.normW * cssW;
            const hh = hl.normH * cssH;
            ctx.fillStyle = hl.color || '#ffeb3b';
            ctx.fillRect(hx, hy, hw, hh);
        });
    }, [pageHighlights, pageNum, canvasSize]);

    // ── Hybrid Selection Handlers (Extracted to useHighlightTools) ──
    const {
        handleHybridMouseDown,
        handleHybridMouseMove,
        handleHybridMouseUp,
        handleHighlightCanvasContextMenu,
    } = useHighlightTools({
        pageNum,
        store,
        canvasSize,
        pageHighlights,
        setPageHighlights,
        pushHistory,
        fabricCanvasRefs,
        highlightCanvasRef,
        textLayerRef,
        hlDrawRef,
    });

    // Determine if a text-selection drag tool is active
    const isDragTool = ['highlight', 'underline', 'strikethrough', 'eraser'].includes(store.activeTool);

    // ── Mouse tracking for tool preview ──
    const handleContainerMouseMove = useCallback((e) => {
        if (!previewRef.current || !containerRef.current) return;
        
        const tool = store.activeTool;
        const activeTools = ['stamp', 'signature', 'date', 'stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate'];
        
        if (!activeTools.includes(tool)) {
            previewRef.current.style.display = 'none';
            return;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        previewRef.current.style.display = 'block';
        previewRef.current.style.left = `${x}px`;
        previewRef.current.style.top = `${y}px`;
    }, [store.activeTool]);

    const handleContainerMouseLeave = useCallback(() => {
        if (previewRef.current) {
            previewRef.current.style.display = 'none';
        }
    }, []);


    return (
        <div
            ref={containerRef}
            className="pdf-ws-canvas-container"
            style={{ position: 'relative', margin: '0 auto' }}
            onContextMenu={(e) => { if (isDragTool) e.preventDefault(); }}
            onMouseMove={handleContainerMouseMove}
            onMouseLeave={handleContainerMouseLeave}
        >
            <ToolPreview
                ref={previewRef}
                tool={store.activeTool}
                color={store.strokeColor || '#333'}
                size={store.fontSize || 16}
                strokeWidth={store.strokeWidth}
                stampData={stampData}
            />

            {/* Layer 1: PDF Rendering */}
            <canvas
                ref={pdfCanvasRef}
                className="pdf-ws-pdf-layer"
                style={{ pointerEvents: 'none' }}
            />

            {/* Layer 1.5h: Highlight Blend Layer (mix-blend-mode: multiply) */}
            <canvas
                ref={highlightCanvasRef}
                className="pdf-ws-highlight-layer"
                style={{ pointerEvents: 'none' }}
            />

            {/* Layer 1.75: Native Text Layer for Selection / Freehand Fallback */}
            <div
                ref={textLayerRef}
                className="pdf-ws-text-layer"
                style={{
                    pointerEvents: isDragTool ? 'auto' : 'none',
                    cursor: isDragTool ? 'text' : 'default',
                    userSelect: isDragTool ? 'text' : 'none', // Allow DOM text selection explicitly
                }}
                onMouseDown={handleHybridMouseDown}
                onMouseMove={handleHybridMouseMove}
                onMouseUp={handleHybridMouseUp}
                onContextMenu={handleHighlightCanvasContextMenu}
            />

            {/* Layer 1.5: Overlay Compare PDF */}
            {overlayPdfDoc && store.overlayEnabled && (
                <canvas
                    ref={overlayCanvasRef}
                    className="pdf-ws-overlay-layer"
                    style={{
                        pointerEvents: 'none',
                        opacity: store.overlayOpacity,
                        mixBlendMode: store.overlayBlend,
                    }}
                />
            )}

            {/* Layer 2: Fabric.js Interactive Overlay */}
            <canvas
                ref={fabricElRef}
                className="pdf-ws-fabric-layer"
            />
        </div>
    );
};

export default EditorCanvas;
