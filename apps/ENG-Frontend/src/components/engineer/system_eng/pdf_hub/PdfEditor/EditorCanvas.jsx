import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { useTheme } from '../../../../../theme';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';
import { useAuthStore } from '../../../../../stores/authStore';

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
            if (pushHistory) pushHistory(pageNum);
        });

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

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
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
                    if (fabricCanvasRefs.current[pageNum]) {
                        fabricCanvasRefs.current[pageNum].setDimensions({
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

                const renderTask = page.render({ canvasContext: ctx, viewport });
                renderTaskRef.current = renderTask;
                await renderTask.promise;

                // ── Extract text items for snap-to-text & render Native Text Layer ──
                if (!cancelled) {
                    try {
                        const textContent = await page.getTextContent();
                        
                        // Render native TextLayer
                        const textLayerDiv = textLayerRef.current;
                        if (textLayerDiv) {
                            textLayerDiv.innerHTML = ''; // clear previous
                            
                            // Scale text layer to match CSS display size
                            // The viewport used for textLayer should be scaled down by RENDER_SCALE
                            const textViewport = page.getViewport({ scale: zoom });
                            
                            // Adjust size
                            textLayerDiv.style.width = `${displayW}px`;
                            textLayerDiv.style.height = `${displayH}px`;
                            textLayerDiv.style.setProperty('--scale-factor', textViewport.scale);

                            pdfjsLib.renderTextLayer({
                                textContentSource: textContent,
                                container: textLayerDiv,
                                viewport: textViewport,
                                textDivs: []
                            });
                        }
                    } catch (textErr) {
                        console.warn('Text extraction failed:', textErr);
                    }
                }

                // ── Load annotations for this page ──
                if (!cancelled && fabricCanvasRefs.current[pageNum]) {
                    const fc = fabricCanvasRefs.current[pageNum];
                    const saved = pageAnnotations[pageNum];

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
        return () => {
            cancelled = true;
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
    // Mouse handlers for shape drawing
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const fc = fabricCanvasRefs.current[pageNum];
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
                objectCaching: false, // Prevents blurriness when scaled
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
                    
                case 'addText':
                    // Transparent box just to show the drag bounds
                    tempObj = new fabric.Rect({
                        ...commonProps,
                        width: 0,
                        height: 0,
                        fill: 'transparent',
                        stroke: '#999999',
                        strokeDashArray: [5, 5],
                        strokeWidth: 1,
                        opacity: store.opacity,
                    });
                    break;
                    
                case 'sticky':
                    // Preview box for sticky note
                    tempObj = new fabric.Rect({
                        ...commonProps,
                        width: 0,
                        height: 0,
                        fill: '#fff3cd',
                        stroke: '#ffc107',
                        strokeWidth: 1,
                        opacity: 0.8,
                    });
                    break;

                // Highlight, Underline, and Strikethrough are handled on the dedicated blend layer
                // See highlight mouseDown handler below

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

            // Highlight/Underline/Strikethrough are handled on the dedicated blend layer, skip Fabric.js flow
            if (['highlight', 'underline', 'strikethrough'].includes(tool)) return;

            // One-click placement tools
            if (['stamp', 'signature', 'date', 'stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate'].includes(tool)) {
                handleOneClickTool(opt.pointer, tool);
                return;
            }

            isDrawing = true;
            pushHistory(pageNum);
            createObject(opt.pointer);
        };

        const onMouseMove = (opt) => {
            if (!isDrawing || !tempObj) return;
            const pointer = opt.pointer;
            const tool = store.activeTool;

            switch (tool) {
                case 'rect':
                case 'maskReplace':
                case 'addText':
                case 'sticky': {
                    const w = Math.abs(pointer.x - startX);
                    const h = Math.abs(pointer.y - startY);
                    tempObj.set({
                        width: w,
                        height: h,
                        left: Math.min(startX, pointer.x),
                        top: Math.min(startY, pointer.y),
                    });
                    break;
                }
                // highlight case removed — handled on blend layer

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

            // Add Text / Sticky Note (Drag to define width)
            if ((tool === 'addText' || tool === 'sticky') && tempObj) {
                const finalX = tempObj.left;
                const finalY = tempObj.top;
                const drawnWidth = tempObj.width;
                const finalWidth = Math.max(drawnWidth, 150); // Minimum 150px
                
                fc.remove(tempObj);

                let textObj;
                if (tool === 'addText') {
                    textObj = new fabric.Textbox(' ', { // Space prevents auto-deletion while keeping it empty visually
                        left: finalX,
                        top: finalY,
                        width: finalWidth,
                        fontSize: store.fontSize,
                        fontFamily: store.fontFamily,
                        fill: store.strokeColor,
                        editable: true,
                        customData: { type: 'text-overlay' },
                    });
                } else {
                    textObj = new fabric.Textbox(' ', {
                        left: finalX,
                        top: finalY,
                        width: finalWidth,
                        fontSize: 16,
                        lineHeight: 1.2,
                        fontFamily: store.fontFamily || 'Helvetica',
                        fill: '#333333',
                        backgroundColor: '#fff3cd',
                        borderColor: '#ffc107',
                        editingBorderColor: '#ffc107',
                        padding: 12,
                        editable: true,
                        angle: (Math.random() * 2) - 1, // Random tilt between -1 and +1 deg
                        shadow: new fabric.Shadow({
                            color: 'rgba(0,0,0,0.15)',
                            blur: 10,
                            offsetX: 2,
                            offsetY: 4
                        }),
                        customData: { type: 'sticky' },
                    });
                }

                fc.add(textObj);
                fc.setActiveObject(textObj);
                fc.renderAll();

                store.setActiveTool('select');
                
                requestAnimationFrame(() => {
                    textObj.enterEditing();
                    textObj.selectAll();
                });

                tempObj = null;
            }

            tempObj = null;
            fc.renderAll();
        };

        // ── One-click tools ──
        const handleOneClickTool = (pointer, tool) => {
            pushHistory(pageNum);
            switch (tool) {

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

                case 'stampCheckmark': {
                    const color = store.strokeColor || '#27ae60';
                    const scale = store.fontSize / 16;
                    const w = (store.strokeWidth || 3) / scale;
                    const l1 = new fabric.Line([-10, 0, -3, 10], { stroke: color, strokeWidth: w, strokeLineCap: 'round' });
                    const l2 = new fabric.Line([-3, 10, 15, -15], { stroke: color, strokeWidth: w, strokeLineCap: 'round' });
                    const checkGroup = new fabric.Group([l1, l2], {
                        left: pointer.x,
                        top: pointer.y,
                        originX: 'center',
                        originY: 'center',
                        scaleX: scale,
                        scaleY: scale,
                        customData: { type: 'stampCheckmark' }
                    });
                    fc.add(checkGroup);
                    fc.setActiveObject(checkGroup);
                    break;
                }

                case 'stampCross': {
                    const color = store.strokeColor || '#e74c3c';
                    const scale = store.fontSize / 16;
                    const w = (store.strokeWidth || 3) / scale;
                    const l1 = new fabric.Line([-12, -12, 12, 12], { stroke: color, strokeWidth: w, strokeLineCap: 'round' });
                    const l2 = new fabric.Line([12, -12, -12, 12], { stroke: color, strokeWidth: w, strokeLineCap: 'round' });
                    const crossGroup = new fabric.Group([l1, l2], {
                        left: pointer.x,
                        top: pointer.y,
                        originX: 'center',
                        originY: 'center',
                        scaleX: scale,
                        scaleY: scale,
                        customData: { type: 'stampCross' }
                    });
                    fc.add(crossGroup);
                    fc.setActiveObject(crossGroup);
                    break;
                }

                case 'stampCircle': {
                    const circleShape = new fabric.Circle({
                        left: pointer.x,
                        top: pointer.y,
                        radius: store.fontSize,
                        fill: 'transparent',
                        stroke: store.strokeColor || '#3498db',
                        strokeWidth: store.strokeWidth || 3,
                        originX: 'center',
                        originY: 'center',
                        customData: { type: 'stampCircle' },
                    });
                    fc.add(circleShape);
                    fc.setActiveObject(circleShape);
                    break;
                }

                case 'stampOk': {
                    const okCircle = new fabric.Circle({
                        radius: store.fontSize,
                        fill: 'transparent',
                        stroke: store.strokeColor || '#3498db',
                        strokeWidth: store.strokeWidth || 3,
                        originX: 'center',
                        originY: 'center',
                    });
                    const okText = new fabric.FabricText('OK', {
                        fontSize: store.fontSize * 0.9,
                        fontWeight: 'bold',
                        fontFamily: 'Arial',
                        fill: store.strokeColor || '#3498db',
                        originX: 'center',
                        originY: 'center',
                    });
                    const okGroup = new fabric.Group([okCircle, okText], {
                        left: pointer.x,
                        top: pointer.y,
                        originX: 'center',
                        originY: 'center',
                        customData: { type: 'stampOk' },
                    });
                    fc.add(okGroup);
                    fc.setActiveObject(okGroup);
                    break;
                }

                case 'stampUserDate': {
                    const dept = 'ROD ENG';
                    const name = userName || 'USER';

                    // Format Name: Last name initial + dot + first name (no space)
                    let formattedName = name;
                    const nameParts = name.trim().split(/\s+/);
                    if (nameParts.length > 1) {
                        formattedName = `${nameParts[1].charAt(0).toUpperCase()}.${nameParts[0].toUpperCase()}`;
                    } else {
                        formattedName = name.toUpperCase();
                    }

                    // Format Date: DD MMM YYYY
                    const d = new Date();
                    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                    const dateVal = `${d.getDate().toString().padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

                    const color = store.strokeColor || '#e74c3c';

                    const bgCircle = new fabric.Circle({
                        radius: 48, fill: 'transparent', stroke: color, strokeWidth: 3,
                        originX: 'center', originY: 'center',
                        left: 0, top: 0, objectCaching: false
                    });
                    const line1 = new fabric.Line([-46, -14, 46, -14], { stroke: color, strokeWidth: 2, objectCaching: false });
                    const line2 = new fabric.Line([-46, 14, 46, 14], { stroke: color, strokeWidth: 2, objectCaching: false });

                    // Remove scaleX to avoid pdf-lib text overflow
                    const baseScale = (store.fontSize / 16) * 0.85;
                    const fontProps = {
                        fontWeight: 'bold', fill: color, fontFamily: 'Arial',
                        originX: 'center', originY: 'center',
                        objectCaching: false
                    };

                    const deptText = new fabric.FabricText(dept, {
                        ...fontProps,
                        fontSize: 13, top: -27, left: 0
                    });
                    
                    const dateTextObj = new fabric.FabricText(dateVal, {
                        ...fontProps,
                        fontSize: 13, top: 0, left: 0
                    });

                    // Curved Name Text: Fixed max sweep angle to prevent overflowing
                    const nameChars = formattedName.split('');
                    const maxSweep = 110; // Max allowed degrees (e.g. from 145 to 35)
                    const charAngle = Math.min(13, maxSweep / (nameChars.length - 1 || 1));
                    const actualSweep = charAngle * (nameChars.length - 1);
                    const startA = 90 + (actualSweep / 2); // Center around bottom (90 deg)
                    const nameRadius = 38; // Radius for text path
                    
                    const nameObjects = nameChars.map((char, i) => {
                        const a = startA - (i * charAngle);
                        const rad = a * (Math.PI / 180);
                        return new fabric.FabricText(char, {
                            ...fontProps,
                            fontSize: 11,
                            left: nameRadius * Math.cos(rad),
                            top: nameRadius * Math.sin(rad),
                            angle: a - 90
                        });
                    });

                    const userDateGroup = new fabric.Group([bgCircle, line1, line2, deptText, dateTextObj, ...nameObjects], {
                        left: pointer.x,
                        top: pointer.y,
                        originX: 'center',
                        originY: 'center',
                        scaleX: baseScale, // Stamp scale relative to canvas
                        scaleY: baseScale,
                        objectCaching: false,
                        customData: { type: 'stampUserDate' },
                    });
                    fc.add(userDateGroup);
                    fc.setActiveObject(userDateGroup);
                    break;
                }

                case 'stamp':
                case 'signature': {
                    const isStamp = tool === 'stamp';
                    const imgSrc = isStamp ? stampData?.stamp_image : stampData?.signature_image;
                    if (!imgSrc) break;
                    
                    const imgEl = new Image();
                    imgEl.src = `data:image/png;base64,${imgSrc}`;
                    imgEl.onload = () => {
                        const fImg = new fabric.FabricImage(imgEl, {
                            left: pointer.x,
                            top: pointer.y,
                            scaleX: 0.5,
                            scaleY: 0.5,
                            opacity: 0.85,
                            originX: 'center',
                            originY: 'center',
                            customData: {
                                type: tool,
                                widthMm: isStamp ? stampData?.stamp_width_mm : stampData?.sig_width_mm,
                                heightMm: isStamp ? stampData?.stamp_height_mm : stampData?.sig_height_mm,
                            },
                        });
                        fc.add(fImg);
                        fc.setActiveObject(fImg);
                        fc.renderAll();
                    };
                    break;
                }

                default:
                    break;
            }
            fc.renderAll();
        };

        const onPathCreated = (opt) => {
            if (opt.path) {
                opt.path.set('customData', { type: 'freehand' });
                pushHistory(pageNum);
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
                    if (activeObj.stroke !== undefined && activeObj.stroke !== store.strokeColor) {
                        activeObj.set('stroke', store.strokeColor);
                        changed = true;
                    }
                    if (activeObj.fill !== undefined && activeObj.fill !== store.fillColor) {
                        activeObj.set('fill', store.fillColor);
                        changed = true;
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
            if (activeObj.strokeWidth !== undefined && activeObj.strokeWidth !== store.strokeWidth) {
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

    // ── Hybrid Selection Handlers ──
    const handleHybridMouseDown = useCallback((e) => {
        const isDragTool = ['highlight', 'underline', 'strikethrough'].includes(store.activeTool);
        if (!isDragTool) return;
        
        const rect = textLayerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Mouse position in CSS coordinate space
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Note: right click is handled by handleHighlightCanvasContextMenu on the highlight layer
        if (e.button === 2) return;

        hlDrawRef.current = { isDrawing: true, startX: x, startY: y };
    }, [store.activeTool]);

    const handleHybridMouseMove = useCallback((e) => {
        if (!hlDrawRef.current.isDrawing) return;
        
        // If the user is actively making a native text selection, we don't need to draw a preview box!
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;

        const hlCanvas = highlightCanvasRef.current;
        if (!hlCanvas) return;
        const rect = hlCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const ctx = hlCanvas.getContext('2d');

        const currentX = e.clientX - rect.left;
        const { startX, startY } = hlDrawRef.current;

        const cssW = canvasSize.width;
        const cssH = canvasSize.height;

        // Reset + apply DPR transform so we draw in CSS space
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Redraw existing highlights
        const highlights = (pageHighlights || {})[pageNum] || [];
        highlights.forEach(hl => {
            const hx = hl.normX * cssW;
            const hy = hl.normY * cssH;
            const hw = hl.normW * cssW;
            const hh = hl.normH * cssH;
            ctx.fillStyle = hl.color || '#ffeb3b';
            ctx.fillRect(hx, hy, hw, hh);
        });

        // Draw live preview for freehand drag
        if (store.activeTool === 'highlight') {
            const previewX = Math.min(startX, currentX);
            const previewW = Math.abs(currentX - startX);
            const previewY = startY - 10;
            const previewH = 20;
            ctx.fillStyle = store.highlightColor || '#ffeb3b';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(previewX, previewY, previewW, previewH);
            ctx.globalAlpha = 1.0;
        } else {
            // Underline/Strikethrough preview line
            const previewX = Math.min(startX, currentX);
            const previewW = Math.abs(currentX - startX);
            const previewY = store.activeTool === 'underline' ? startY + 5 : startY;
            ctx.strokeStyle = store.strokeColor || '#000000';
            ctx.lineWidth = store.strokeWidth || 2;
            ctx.beginPath();
            ctx.moveTo(previewX, previewY);
            ctx.lineTo(previewX + previewW, previewY);
            ctx.stroke();
        }
    }, [pageHighlights, pageNum, store.highlightColor, store.activeTool, store.strokeColor, store.strokeWidth, canvasSize]);

    const handleHybridMouseUp = useCallback((e) => {
        const activeTool = store.activeTool;
        if (!['highlight', 'underline', 'strikethrough'].includes(activeTool)) return;
        
        const isDrawing = hlDrawRef.current.isDrawing;
        hlDrawRef.current.isDrawing = false; // Reset

        const textLayerDiv = textLayerRef.current;
        if (!textLayerDiv) return;

        const cssW = canvasSize.width;
        const cssH = canvasSize.height;
        if (cssW === 0 || cssH === 0) return;

        const containerRect = textLayerDiv.getBoundingClientRect();
        const selection = window.getSelection();

        // ── CONDITION A: Native Text Selection Exists ──
        if (selection && !selection.isCollapsed && textLayerDiv.contains(selection.anchorNode)) {
            pushHistory(pageNum);
            const rects = selection.getRangeAt(0).getClientRects();
            const newHighlights = [];
            const fc = fabricCanvasRefs.current[pageNum];
            
            for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                const x = rect.left - containerRect.left;
                const y = rect.top - containerRect.top;
                const w = rect.width;
                const h = rect.height;

                if (w < 2 || h < 2) continue;

                if (activeTool === 'highlight') {
                    newHighlights.push({
                        id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`,
                        normX: x / cssW,
                        normY: (y + 1) / cssH,
                        normW: w / cssW,
                        normH: (h + 1) / cssH,
                        color: store.highlightColor || '#ffeb3b',
                    });
                } else if (activeTool === 'underline' || activeTool === 'strikethrough') {
                    if (fc) {
                        const dynamicThickness = Math.max(1.5, h * 0.08);
                        const lineY = activeTool === 'underline'
                            ? y + h + (dynamicThickness / 2)
                            : y + h / 2 + (dynamicThickness / 2);

                        const line = new fabric.Line(
                            [x, lineY, x + w, lineY],
                            {
                                stroke: store.strokeColor || '#000000',
                                strokeWidth: dynamicThickness,
                                opacity: store.opacity,
                                selectable: true,
                                customData: { type: activeTool },
                            }
                        );
                        fc.add(line);
                    }
                }
            }

            if (activeTool === 'highlight' && newHighlights.length > 0) {
                setPageHighlights(prev => ({
                    ...prev,
                    [pageNum]: [...(prev[pageNum] || []), ...newHighlights],
                }));
            }

            if (fc && (activeTool === 'underline' || activeTool === 'strikethrough')) {
                fc.renderAll();
            }

            selection.removeAllRanges();
            return;
        }

        // ── CONDITION B: Freehand Fallback (No Text Selected) ──
        if (isDrawing) {
            const endX = e.clientX - containerRect.left;
            const { startX, startY } = hlDrawRef.current;
            const rawWidth = Math.abs(endX - startX);
            
            if (rawWidth < 3) return; // Too small, just a click

            pushHistory(pageNum);
            const fc = fabricCanvasRefs.current[pageNum];
            
            const finalX = Math.min(startX, endX);
            const finalY = startY - 10;
            const finalW = rawWidth;
            const finalH = 20;

            if (activeTool === 'highlight') {
                const newHL = {
                    id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    normX: finalX / cssW,
                    normY: finalY / cssH,
                    normW: finalW / cssW,
                    normH: finalH / cssH,
                    color: store.highlightColor || '#ffeb3b',
                };
                setPageHighlights(prev => ({
                    ...prev,
                    [pageNum]: [...(prev[pageNum] || []), newHL],
                }));
            } else if (activeTool === 'underline' || activeTool === 'strikethrough') {
                if (fc) {
                    const lineY = activeTool === 'underline' ? startY + 5 : startY;
                    const line = new fabric.Line(
                        [finalX, lineY, finalX + finalW, lineY],
                        {
                            stroke: store.strokeColor || '#000000',
                            strokeWidth: store.strokeWidth || 2, // Fixed thickness for freehand
                            opacity: store.opacity,
                            selectable: true,
                            customData: { type: activeTool },
                        }
                    );
                    fc.add(line);
                    fc.renderAll();
                }
            }
            
            // Re-render highlight canvas immediately to clear the live preview!
            // The useEffect on pageHighlights will handle the actual redraw, but we should clear the preview box.
            const hlCanvas = highlightCanvasRef.current;
            if (hlCanvas) {
                const dpr = window.devicePixelRatio || 1;
                const ctx = hlCanvas.getContext('2d');
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                const highlights = (pageHighlights || {})[pageNum] || [];
                highlights.forEach(hl => {
                    const hx = hl.normX * cssW;
                    const hy = hl.normY * cssH;
                    const hw = hl.normW * cssW;
                    const hh = hl.normH * cssH;
                    ctx.fillStyle = hl.color || '#ffeb3b';
                    ctx.fillRect(hx, hy, hw, hh);
                });
            }
        }
    }, [pageNum, store, canvasSize, setPageHighlights, pushHistory, fabricCanvasRefs, pageHighlights]);

    // Handle right-click delete on the highlight canvas
    const handleHighlightCanvasContextMenu = useCallback((e) => {
        if (store.activeTool !== 'highlight') return;
        e.preventDefault();
        
        const rect = highlightCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cssW = canvasSize.width;
        const cssH = canvasSize.height;
        if (cssW === 0 || cssH === 0) return;

        const highlights = (pageHighlights || {})[pageNum] || [];
        const hitIdx = highlights.findIndex(hl => {
            const hx = hl.normX * cssW;
            const hy = hl.normY * cssH;
            const hw = hl.normW * cssW;
            const hh = hl.normH * cssH;
            return x >= hx && x <= hx + hw && y >= hy && y <= hy + hh;
        });

        if (hitIdx !== -1) {
            pushHistory(pageNum);
            setPageHighlights(prev => {
                const updated = [...(prev[pageNum] || [])];
                updated.splice(hitIdx, 1);
                return { ...prev, [pageNum]: updated };
            });
        }
    }, [store.activeTool, pageNum, pageHighlights, pushHistory, setPageHighlights, canvasSize]);

    // Determine if a text-selection drag tool is active
    const isDragTool = ['highlight', 'underline', 'strikethrough'].includes(store.activeTool);

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

    // ── Build preview content based on tool ──
    const previewContent = React.useMemo(() => {
        const tool = store.activeTool;
        const activeTools = ['stamp', 'signature', 'date', 'stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate'];
        if (!activeTools.includes(tool)) return null;

        const color = store.strokeColor || '#333';
        const size = store.fontSize || 16;
        let content = null;
        let transform = 'translate(-50%, -50%)'; // default centered

        switch (tool) {
            case 'stampCheckmark':
                content = <div style={{ color, fontSize: size * 2.5, fontWeight: 'bold' }}>✓</div>;
                break;
            case 'stampCross':
                content = <div style={{ color, fontSize: size * 2.5, fontWeight: 'bold' }}>✕</div>;
                break;
            case 'stampCircle':
                content = <div style={{ border: `${store.strokeWidth || 3}px solid ${color}`, borderRadius: '50%', width: size * 2, height: size * 2 }}></div>;
                break;
            case 'stampOk':
                content = (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: size * 2.4, height: size * 2.4 }}>
                        <div style={{ position: 'absolute', border: `${store.strokeWidth || 3}px solid ${color}`, borderRadius: '50%', width: '100%', height: '100%' }}></div>
                        <div style={{ color, fontSize: size * 1.1, fontWeight: 'bold' }}>OK</div>
                    </div>
                );
                break;
            case 'date':
                transform = 'translate(0, 0)'; // Top-left alignment for date
                content = <div style={{ color: '#333', fontSize: 14, fontFamily: 'Helvetica' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>;
                break;
            case 'stampUserDate': {
                const baseScale = (size / 16) * 0.75;
                content = (
                    <div style={{ 
                        border: `3px solid ${color}`, borderRadius: '50%', 
                        width: 96, height: 96, 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color, fontWeight: 'bold', fontFamily: 'Arial',
                        transform: `scale(${baseScale})`,
                        transformOrigin: 'center center'
                    }}>
                        <div style={{ borderBottom: `2px solid ${color}`, width: '100%', textAlign: 'center', fontSize: 12 }}>ROD ENG</div>
                        <div style={{ borderBottom: `2px solid ${color}`, width: '100%', textAlign: 'center', fontSize: 10 }}>{userName?.split(' ')[0]?.toUpperCase() || 'USER'}</div>
                        <div style={{ width: '100%', textAlign: 'center', fontSize: 11 }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                    </div>
                );
                break;
            }
            case 'stamp':
                if (stampData?.stamp_image) {
                    content = <img src={`data:image/png;base64,${stampData.stamp_image}`} alt="stamp" style={{ transform: 'scale(0.5)', opacity: 0.8 }} />;
                }
                break;
            case 'signature':
                if (stampData?.signature_image) {
                    content = <img src={`data:image/png;base64,${stampData.signature_image}`} alt="signature" style={{ transform: 'scale(0.5)', opacity: 0.8 }} />;
                }
                break;
            default:
                break;
        }

        if (!content) return null;

        return (
            <div
                ref={previewRef}
                style={{
                    position: 'absolute',
                    display: 'none',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    opacity: 0.6,
                    transform,
                }}
            >
                {content}
            </div>
        );
    }, [store.activeTool, store.strokeColor, store.fontSize, store.strokeWidth, stampData, userName]);

    return (
        <div
            ref={containerRef}
            className="pdf-ws-canvas-container"
            style={{ position: 'relative', margin: '0 auto' }}
            onContextMenu={(e) => { if (isDragTool) e.preventDefault(); }}
            onMouseMove={handleContainerMouseMove}
            onMouseLeave={handleContainerMouseLeave}
        >
            {previewContent}

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
