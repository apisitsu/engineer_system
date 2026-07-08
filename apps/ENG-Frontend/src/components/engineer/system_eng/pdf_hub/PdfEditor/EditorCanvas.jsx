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
    const { userName } = useAuthStore();

    // ── Constants ──
    const RENDER_SCALE = Math.max(window.devicePixelRatio || 1, 1.5); // DPR-aware super-sample

    // ══════════════════════════════════════════════════════════════════
    // Initialize Fabric.js Canvas (once)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!fabricElRef.current || fabricCanvasRefs.current[pageNum]) return;

        const canvas = new fabric.Canvas(fabricElRef.current, {
            selection: true,
            selectionKey: ['shiftKey', 'ctrlKey'],
            preserveObjectStacking: true,
            enableRetinaScaling: true, // DPR-aware: crisp annotations on Retina displays
            stopContextMenu: true,
            fireRightClick: true,
        });

        fabricCanvasRefs.current[pageNum] = canvas;

        canvas.on('object:added', (e) => {
            if (e.target && !e.target.id) {
                e.target.id = `shape_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            }
        });

        const handleSelection = (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                if (!obj.id) obj.id = `shape_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                
                store.setSelectedObject(obj.id, {
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

                // Sync selected object's properties to the PropertiesPanel.
                // Target the object's OWN tool type so we don't pollute 'select'/'pan' settings
                // which would cause stale colors to be force-applied on re-selection.
                const objToolType = obj.customData?.type || obj.type;
                const isText = obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text';
                const isStamp = obj.customData?.type && obj.customData.type.startsWith('stamp');

                // Determine the target tool to update settings for
                let targetTool = store.activeTool;
                if (['select', 'pan'].includes(store.activeTool)) {
                    // Map fabric type back to the drawing tool that created it
                    if (isText) targetTool = 'addText';
                    else if (isStamp) targetTool = objToolType;
                    else if (obj.type === 'ellipse') targetTool = 'circle';
                    else if (obj.type === 'rect') targetTool = 'rect';
                    else if (obj.type === 'line') targetTool = 'line';
                    else if (obj.type === 'path') targetTool = 'freehand';
                    else if (obj.type === 'group') {
                        const cdType = obj.customData?.type;
                        if (cdType === 'arrow') targetTool = 'arrow';
                        else if (cdType === 'ruler') targetTool = 'ruler';
                        else targetTool = 'rect'; // fallback
                    }
                }

                if (isText) {
                    if (obj.fill) {
                        store.setToolSetting(targetTool, 'strokeColor', obj.fill);
                        store.setToolSetting('select', 'strokeColor', obj.fill);
                    }
                } else if (isStamp) {
                    if (obj.type === 'group') {
                        let mainColor = '#e74c3c';
                        obj.getObjects().forEach(child => {
                            if (child.stroke) mainColor = child.stroke;
                            else if (child.fill && child.fill !== 'transparent' && child.fill !== '#ffffff') mainColor = child.fill;
                        });
                        store.setToolSetting(targetTool, 'strokeColor', mainColor);
                        store.setToolSetting('select', 'strokeColor', mainColor);
                    } else {
                        if (obj.stroke) {
                            store.setToolSetting(targetTool, 'strokeColor', obj.stroke);
                            store.setToolSetting('select', 'strokeColor', obj.stroke);
                        } else if (obj.fill && obj.fill !== 'transparent' && obj.fill !== '#ffffff') {
                            store.setToolSetting(targetTool, 'strokeColor', obj.fill);
                            store.setToolSetting('select', 'strokeColor', obj.fill);
                        }
                    }
                } else {
                    if (obj.stroke) {
                        store.setToolSetting(targetTool, 'strokeColor', obj.stroke);
                        store.setToolSetting('select', 'strokeColor', obj.stroke);
                    }
                    if (obj.fill && obj.fill !== 'transparent' && obj.fill !== '#ffffff') {
                        store.setToolSetting(targetTool, 'fillColor', obj.fill);
                        store.setToolSetting('select', 'fillColor', obj.fill);
                    }
                }

                if (obj.strokeWidth) {
                    store.setToolSetting(targetTool, 'strokeWidth', obj.strokeWidth);
                    store.setToolSetting('select', 'strokeWidth', obj.strokeWidth);
                }
                if (obj.fontSize) {
                    store.setToolSetting(targetTool, 'fontSize', obj.fontSize);
                    store.setToolSetting('select', 'fontSize', obj.fontSize);
                }
                if (obj.opacity) {
                    store.setToolSetting(targetTool, 'opacity', obj.opacity);
                    store.setToolSetting('select', 'opacity', obj.opacity);
                }
                if (obj.fontFamily) {
                    store.setToolSetting(targetTool, 'fontFamily', obj.fontFamily);
                    store.setToolSetting('select', 'fontFamily', obj.fontFamily);
                }
            }
        };

        canvas.on('selection:created', handleSelection);
        canvas.on('selection:updated', handleSelection);

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

        const refs = fabricCanvasRefs.current;
        return () => {
            canvas.dispose();
            delete refs[pageNum];
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

                    if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
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
    // Re-hydrate Annotations (Layer 2) when data arrives
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const fc = fabricCanvasRefs.current[pageNum];
        if (!fc || !pageAnnotations[pageNum] || !pageAnnotations[pageNum].objects?.length) return;

        // Only load if canvas is currently empty (initial load)
        if (fc.getObjects().length === 0 && canvasSize.width > 0) {
            let isMounted = true;
            fc.loadFromJSON(pageAnnotations[pageNum]).then(() => {
                if (!isMounted) return;
                const savedW = pageAnnotations[pageNum]._canvasWidth || canvasSize.width;
                const savedH = pageAnnotations[pageNum]._canvasHeight || canvasSize.height;
                const initScaleX = canvasSize.width / savedW;
                const initScaleY = canvasSize.height / savedH;
                if (Math.abs(initScaleX - 1) > 0.01 || Math.abs(initScaleY - 1) > 0.01) {
                    fc.getObjects().forEach(obj => {
                        obj.set({
                            left: obj.left * initScaleX, top: obj.top * initScaleY,
                            scaleX: (obj.scaleX || 1) * initScaleX, scaleY: (obj.scaleY || 1) * initScaleY,
                        });
                        obj.setCoords();
                    });
                }
                fc.renderAll();
            }).catch(e => console.error("loadFromJSON Error:", e));
            return () => { isMounted = false; };
        }
    }, [pageAnnotations, pageNum, canvasSize, fabricCanvasRefs]);

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
    // Highlight Layer — Drawing, Rendering, Deletion
    // ══════════════════════════════════════════════════════════════════

    // Sync highlight canvas size with PDF canvas size (DPR-aware) AND Redraw highlights
    const redrawHighlights = useCallback(() => {
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

    useEffect(() => {
        redrawHighlights();
    }, [redrawHighlights]);

    // ══════════════════════════════════════════════════════════════════
    // Restore Canvas on Tab Resume (Browser Context Loss Fix)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const fc = fabricCanvasRefs.current[pageNum];
                if (fc) fc.renderAll();
                redrawHighlights();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [pageNum, fabricCanvasRefs, redrawHighlights]);

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
                color={store.toolSettings?.[store.activeTool]?.strokeColor || '#333'}
                size={store.toolSettings?.[store.activeTool]?.fontSize || 16}
                strokeWidth={store.toolSettings?.[store.activeTool]?.strokeWidth}
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
