import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { useTheme } from '../../../../../theme';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';

/**
 * EditorCanvas — Dual-Layer rendering engine.
 *
 *   Layer 1: <canvas> rendered by PDF.js (read-only pixel buffer)
 *   Layer 2: Fabric.js interactive canvas (transparent overlay)
 *
 * Props:
 *   pdfDoc          — pdfjs-dist document for rendering
 *   currentPage     — 1-indexed page number
 *   zoom            — float zoom level
 *   pageAnnotations — { [pageNum]: fabricJSON }
 *   fabricCanvasRef — ref to set the Fabric.Canvas instance
 *   pushHistory     — callback to snapshot before mutations
 *   onPageRendered  — callback after PDF page renders (sends pageSize)
 */
const EditorCanvas = ({
    pdfDoc,
    currentPage,
    zoom,
    pageAnnotations,
    fabricCanvasRef,
    pushHistory,
    onPageRendered,
    overlayPdfDoc,
}) => {
    const { theme } = useTheme();
    const pdfCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const fabricElRef = useRef(null);
    const containerRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const store = usePdfEditorStore();

    // ── Constants ──
    const RENDER_SCALE = 1.5; // Super-sample for sharpness

    // ══════════════════════════════════════════════════════════════════
    // Initialize Fabric.js Canvas (once)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!fabricElRef.current || fabricCanvasRef.current) return;

        const canvas = new fabric.Canvas(fabricElRef.current, {
            selection: true,
            preserveObjectStacking: true,
            enableRetinaScaling: false,
            stopContextMenu: true,
            fireRightClick: true,
        });

        fabricCanvasRef.current = canvas;

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
            }
        });

        canvas.on('selection:cleared', () => {
            store.clearSelection();
        });

        // ── Modification tracking for undo ──
        canvas.on('object:modified', () => {
            if (pushHistory) pushHistory();
        });

        return () => {
            canvas.dispose();
            fabricCanvasRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ══════════════════════════════════════════════════════════════════
    // Render PDF Page (Layer 1)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!pdfDoc || !pdfCanvasRef.current) return;
        let cancelled = false;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(currentPage);
                const viewport = page.getViewport({ scale: zoom * RENDER_SCALE });

                const canvas = pdfCanvasRef.current;
                const ctx = canvas.getContext('2d');

                // Physical pixel size
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // CSS display size
                const displayW = viewport.width / RENDER_SCALE;
                const displayH = viewport.height / RENDER_SCALE;
                canvas.style.width = `${displayW}px`;
                canvas.style.height = `${displayH}px`;

                if (!cancelled) {
                    setCanvasSize({ width: displayW, height: displayH });

                    // Sync Fabric.js canvas size
                    if (fabricCanvasRef.current) {
                        fabricCanvasRef.current.setDimensions({
                            width: displayW,
                            height: displayH,
                        });
                    }

                    // Report page size
                    if (onPageRendered) {
                        const baseVp = page.getViewport({ scale: 1.0 });
                        onPageRendered({
                            width: baseVp.width,
                            height: baseVp.height,
                            displayWidth: displayW,
                            displayHeight: displayH,
                        });
                    }
                }

                await page.render({ canvasContext: ctx, viewport }).promise;

                // ── Load annotations for this page ──
                if (!cancelled && fabricCanvasRef.current) {
                    const fc = fabricCanvasRef.current;
                    const saved = pageAnnotations[currentPage];

                    fc.clear();

                    if (saved && saved.objects && saved.objects.length > 0) {
                        // Scale annotations if canvas size changed
                        const savedW = saved._canvasWidth || displayW;
                        const savedH = saved._canvasHeight || displayH;
                        const scaleX = displayW / savedW;
                        const scaleY = displayH / savedH;

                        await fc.loadFromJSON(saved);

                        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                            fc.getObjects().forEach(obj => {
                                obj.set({
                                    left: obj.left * scaleX,
                                    top: obj.top * scaleY,
                                    scaleX: (obj.scaleX || 1) * scaleX,
                                    scaleY: (obj.scaleY || 1) * scaleY,
                                });
                                obj.setCoords();
                            });
                        }
                    }

                    fc.renderAll();
                }
            } catch (err) {
                if (!cancelled) console.error('Page render error:', err);
            }
        };

        renderPage();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfDoc, currentPage, zoom]);

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
                const pageNum = Math.min(currentPage, overlayPdfDoc.numPages);
                const page = await overlayPdfDoc.getPage(pageNum);
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
    }, [overlayPdfDoc, currentPage, zoom, store.overlayEnabled]);

    // ══════════════════════════════════════════════════════════════════
    // Configure Fabric.js for active tool
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const fc = fabricCanvasRef.current;
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
            case 'rect':
            case 'circle':
            case 'arrow':
            case 'line':
            case 'ruler':
            case 'addText':
            case 'maskReplace':
            case 'sticky':
            case 'stamp':
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
    }, [store.activeTool, store.strokeColor, store.strokeWidth, fabricCanvasRef]);

    // ══════════════════════════════════════════════════════════════════
    // Mouse handlers for shape drawing
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const fc = fabricCanvasRef.current;
        if (!fc) return;

        let isDrawing = false;
        let startX = 0;
        let startY = 0;
        let tempObj = null;

        const createObject = (pointer) => {
            const tool = store.activeTool;
            startX = pointer.x;
            startY = pointer.y;

            const commonProps = {
                left: startX,
                top: startY,
                originX: 'left',
                originY: 'top',
                strokeUniform: true,
                customData: { type: tool, createdAt: Date.now() },
            };

            switch (tool) {
                case 'rect':
                case 'maskReplace':
                    tempObj = new fabric.Rect({
                        ...commonProps,
                        width: 0,
                        height: 0,
                        fill: tool === 'maskReplace' ? '#ffffff' : store.fillColor,
                        stroke: tool === 'maskReplace' ? '#cccccc' : store.strokeColor,
                        strokeWidth: tool === 'maskReplace' ? 1 : store.strokeWidth,
                        opacity: store.opacity,
                        rx: 2,
                        ry: 2,
                    });
                    break;

                case 'highlight':
                    tempObj = new fabric.Rect({
                        ...commonProps,
                        width: 0,
                        height: 20,
                        fill: store.highlightColor,
                        stroke: 'transparent',
                        strokeWidth: 0,
                        opacity: 0.35,
                        rx: 2,
                        ry: 2,
                        customData: { type: 'highlight' },
                    });
                    break;

                case 'underline':
                case 'strikethrough':
                    tempObj = new fabric.Line([startX, startY, startX, startY], {
                        stroke: store.strokeColor,
                        strokeWidth: 2,
                        opacity: store.opacity,
                        selectable: true,
                        customData: { type: tool },
                    });
                    break;

                case 'circle':
                    tempObj = new fabric.Ellipse({
                        ...commonProps,
                        rx: 0,
                        ry: 0,
                        fill: store.fillColor,
                        stroke: store.strokeColor,
                        strokeWidth: store.strokeWidth,
                        opacity: store.opacity,
                    });
                    break;

                case 'line':
                case 'arrow':
                case 'ruler':
                    tempObj = new fabric.Line([startX, startY, startX, startY], {
                        stroke: tool === 'ruler' ? '#2196f3' : store.strokeColor,
                        strokeWidth: tool === 'ruler' ? 2 : store.strokeWidth,
                        opacity: store.opacity,
                        selectable: true,
                        customData: { type: tool },
                    });
                    break;

                default:
                    return;
            }

            if (tempObj) {
                fc.add(tempObj);
                fc.renderAll();
            }
        };

        const onMouseDown = (opt) => {
            const tool = store.activeTool;
            if (!tool || tool === 'select' || tool === 'pan' || tool === 'freehand') return;

            // One-click placement tools
            if (['addText', 'sticky', 'stamp', 'signature', 'date'].includes(tool)) {
                handleOneClickTool(opt.pointer, tool);
                return;
            }

            isDrawing = true;
            pushHistory();
            createObject(opt.pointer);
        };

        const onMouseMove = (opt) => {
            if (!isDrawing || !tempObj) return;
            const pointer = opt.pointer;
            const tool = store.activeTool;

            switch (tool) {
                case 'rect':
                case 'maskReplace':
                case 'highlight':
                    const w = Math.abs(pointer.x - startX);
                    const h = tool === 'highlight' ? 20 : Math.abs(pointer.y - startY);
                    tempObj.set({
                        width: w,
                        height: h,
                        left: Math.min(startX, pointer.x),
                        top: tool === 'highlight' ? startY : Math.min(startY, pointer.y),
                    });
                    break;

                case 'circle':
                    const rx = Math.abs(pointer.x - startX) / 2;
                    const ry = Math.abs(pointer.y - startY) / 2;
                    tempObj.set({
                        rx, ry,
                        left: Math.min(startX, pointer.x),
                        top: Math.min(startY, pointer.y),
                    });
                    break;

                case 'underline':
                case 'strikethrough':
                case 'line':
                case 'arrow':
                case 'ruler':
                    tempObj.set({ x2: pointer.x, y2: pointer.y });
                    break;

                default:
                    break;
            }

            fc.renderAll();
        };

        const onMouseUp = (opt) => {
            if (!isDrawing) return;
            isDrawing = false;

            const tool = store.activeTool;

            // Add arrowhead for arrow tool
            if (tool === 'arrow' && tempObj) {
                const x1 = tempObj.x1, y1 = tempObj.y1;
                const x2 = tempObj.x2, y2 = tempObj.y2;
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLen = 12;

                const arrowHead = new fabric.Triangle({
                    left: x2,
                    top: y2,
                    originX: 'center',
                    originY: 'center',
                    width: headLen,
                    height: headLen,
                    angle: (angle * 180 / Math.PI) + 90,
                    fill: store.strokeColor,
                    selectable: false,
                    evented: false,
                    customData: { type: 'arrowhead' },
                });

                fc.add(arrowHead);

                // Group line + arrowhead
                const group = new fabric.Group([tempObj, arrowHead], {
                    customData: { type: 'arrow' },
                });
                fc.remove(tempObj);
                fc.remove(arrowHead);
                fc.add(group);
                tempObj = null;
            }

            // Add measurement label for ruler
            if (tool === 'ruler' && tempObj) {
                const x1 = tempObj.x1, y1 = tempObj.y1;
                const x2 = tempObj.x2, y2 = tempObj.y2;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const lengthPx = Math.sqrt(dx * dx + dy * dy);
                const lengthMm = (lengthPx / store.rulerScale).toFixed(1);
                const unit = store.rulerUnit;

                let displayVal = lengthMm;
                if (unit === 'cm') displayVal = (lengthMm / 10).toFixed(2);
                if (unit === 'in') displayVal = (lengthMm / 25.4).toFixed(2);

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                const label = new fabric.FabricText(`${displayVal} ${unit}`, {
                    left: midX,
                    top: midY - 14,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fill: '#2196f3',
                    originX: 'center',
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    padding: 3,
                    selectable: false,
                    evented: false,
                    customData: { type: 'rulerLabel' },
                });

                fc.add(label);

                const group = new fabric.Group([tempObj, label], {
                    customData: { type: 'ruler', lengthMm: parseFloat(lengthMm) },
                });
                fc.remove(tempObj);
                fc.remove(label);
                fc.add(group);
                tempObj = null;
            }

            // Add text box for mask & replace
            if (tool === 'maskReplace' && tempObj) {
                const textBox = new fabric.Textbox('Type here...', {
                    left: tempObj.left + 4,
                    top: tempObj.top + 4,
                    width: Math.max(tempObj.width - 8, 40),
                    fontSize: store.fontSize,
                    fontFamily: store.fontFamily,
                    fill: store.strokeColor,
                    editable: true,
                    customData: { type: 'maskText' },
                });
                fc.add(textBox);
                fc.setActiveObject(textBox);
                textBox.enterEditing();
            }

            tempObj = null;
            fc.renderAll();
        };

        // ── One-click tools ──
        const handleOneClickTool = (pointer, tool) => {
            pushHistory();
            switch (tool) {
                case 'addText': {
                    const text = new fabric.IText('Type here...', {
                        left: pointer.x,
                        top: pointer.y,
                        fontSize: store.fontSize,
                        fontFamily: store.fontFamily,
                        fill: store.strokeColor,
                        editable: true,
                        customData: { type: 'text-overlay' },
                    });
                    fc.add(text);
                    fc.setActiveObject(text);
                    text.enterEditing();
                    text.selectAll();
                    break;
                }

                case 'sticky': {
                    const noteSize = 28;
                    const bg = new fabric.Rect({
                        width: noteSize,
                        height: noteSize,
                        fill: '#fff3cd',
                        stroke: '#ffc107',
                        strokeWidth: 1.5,
                        rx: 4,
                        ry: 4,
                    });
                    const icon = new fabric.FabricText('📝', {
                        fontSize: 16,
                        left: 6,
                        top: 4,
                        selectable: false,
                        evented: false,
                    });
                    const group = new fabric.Group([bg, icon], {
                        left: pointer.x,
                        top: pointer.y,
                        customData: { type: 'sticky', note: '' },
                    });
                    fc.add(group);
                    fc.setActiveObject(group);
                    break;
                }

                case 'date': {
                    const today = new Date().toLocaleDateString('en-GB', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                    });
                    const dateText = new fabric.FabricText(today, {
                        left: pointer.x,
                        top: pointer.y,
                        fontSize: 14,
                        fontFamily: 'Helvetica',
                        fill: '#333',
                        customData: { type: 'date' },
                    });
                    fc.add(dateText);
                    fc.setActiveObject(dateText);
                    break;
                }

                default:
                    break;
            }
            fc.renderAll();
        };

        // ── Freehand path created ──
        const onPathCreated = (opt) => {
            if (opt.path) {
                opt.path.set('customData', { type: 'freehand' });
                pushHistory();
            }
        };

        fc.on('mouse:down', onMouseDown);
        fc.on('mouse:move', onMouseMove);
        fc.on('mouse:up', onMouseUp);
        fc.on('path:created', onPathCreated);

        return () => {
            fc.off('mouse:down', onMouseDown);
            fc.off('mouse:move', onMouseMove);
            fc.off('mouse:up', onMouseUp);
            fc.off('path:created', onPathCreated);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        store.activeTool, store.strokeColor, store.fillColor,
        store.strokeWidth, store.opacity, store.fontSize,
        store.fontFamily, store.highlightColor,
        store.rulerScale, store.rulerUnit,
    ]);

    return (
        <div
            ref={containerRef}
            className="pdf-ws-canvas-container"
        >
            {/* Layer 1: PDF Rendering */}
            <canvas
                ref={pdfCanvasRef}
                className="pdf-ws-pdf-layer"
                style={{ pointerEvents: 'none' }}
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
