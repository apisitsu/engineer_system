import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { useTheme } from '../../../../../theme';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';
import { useAuthStore } from '../../../../../stores/authStore';

/**
 * EditorCanvas — Dual-Layer rendering engine.
 *
 *   Layer 1: <canvas> rendered by PDF.js (read-only pixel buffer)
 *   Layer 2: Fabric.js interactive canvas (transparent overlay)
 *
 * Props:
 *   pdfDoc          — pdfjs-dist document for rendering
 *   pageNum         — 1-indexed page number for this specific canvas
 *   zoom            — float zoom level
 *   pageAnnotations — { [pageNum]: fabricJSON }
 *   fabricCanvasRefs— ref object to store Fabric.Canvas instances by pageNum
 *   pushHistory     — callback to snapshot before mutations
 *   onPageRendered  — callback after PDF page renders (sends pageSize)
 */
const EditorCanvas = ({
    pageNum,
    pdfDoc,
    zoom,
    pageAnnotations,
    fabricCanvasRefs,
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
    const { userName, userDepartment } = useAuthStore();

    // ── Constants ──
    const RENDER_SCALE = 1.5; // Super-sample for sharpness

    // ══════════════════════════════════════════════════════════════════
    // Initialize Fabric.js Canvas (once)
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!fabricElRef.current || fabricCanvasRefs.current[pageNum]) return;

        const canvas = new fabric.Canvas(fabricElRef.current, {
            selection: true,
            preserveObjectStacking: true,
            enableRetinaScaling: false,
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

                await page.render({ canvasContext: ctx, viewport }).promise;

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
        return () => { cancelled = true; };
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

                case 'highlight':
                    tempObj = new fabric.Rect({
                        ...commonProps,
                        top: startY - 10,
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
            if (['addText', 'sticky', 'stamp', 'signature', 'date', 'stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate'].includes(tool)) {
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
                case 'maskReplace': {
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
                case 'highlight': {
                    const wHL = Math.abs(pointer.x - startX);
                    tempObj.set({
                        width: wHL,
                        left: Math.min(startX, pointer.x),
                        // top remains locked to startY - 10 for a straight line
                    });
                    break;
                }

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
            pushHistory(pageNum);
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
                    const sticky = new fabric.Textbox('Note...', {
                        left: pointer.x,
                        top: pointer.y,
                        width: 150,
                        fontSize: 14,
                        fontFamily: store.fontFamily || 'Helvetica',
                        fill: '#333333',
                        backgroundColor: '#fff3cd',
                        borderColor: '#ffc107',
                        editingBorderColor: '#ffc107',
                        padding: 8,
                        editable: true,
                        customData: { type: 'sticky' },
                    });
                    fc.add(sticky);
                    fc.setActiveObject(sticky);
                    sticky.enterEditing();
                    sticky.selectAll();
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

                case 'stampCheckmark': {
                    const checkText = new fabric.FabricText('✓', {
                        left: pointer.x,
                        top: pointer.y,
                        fontSize: 40,
                        fill: store.strokeColor || '#27ae60',
                        fontWeight: 'bold',
                        originX: 'center',
                        originY: 'center',
                        customData: { type: 'stampCheckmark' },
                    });
                    fc.add(checkText);
                    fc.setActiveObject(checkText);
                    break;
                }

                case 'stampCross': {
                    const crossText = new fabric.FabricText('✕', {
                        left: pointer.x,
                        top: pointer.y,
                        fontSize: 40,
                        fill: store.strokeColor || '#e74c3c',
                        fontWeight: 'bold',
                        originX: 'center',
                        originY: 'center',
                        customData: { type: 'stampCross' },
                    });
                    fc.add(crossText);
                    fc.setActiveObject(crossText);
                    break;
                }

                case 'stampCircle': {
                    const circleShape = new fabric.Circle({
                        left: pointer.x,
                        top: pointer.y,
                        radius: 15,
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
                        radius: 18,
                        fill: 'transparent',
                        stroke: store.strokeColor || '#3498db',
                        strokeWidth: store.strokeWidth || 3,
                        originX: 'center',
                        originY: 'center',
                    });
                    const okText = new fabric.FabricText('OK', {
                        fontSize: 16,
                        fontWeight: 'bold',
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
                        radius: 48, fill: '#ffffff', stroke: color, strokeWidth: 3,
                        originX: 'center', originY: 'center',
                        left: 0, top: 0, objectCaching: false
                    });
                    const line1 = new fabric.Line([-46, -14, 46, -14], { stroke: color, strokeWidth: 2, objectCaching: false });
                    const line2 = new fabric.Line([-46, 14, 46, 14], { stroke: color, strokeWidth: 2, objectCaching: false });

                    // Use scaleX to create a condensed font look similar to the physical stamp
                    const fontProps = {
                        fontWeight: 'bold', fill: color, fontFamily: 'Arial',
                        originX: 'center', originY: 'center',
                        scaleX: 0.75, objectCaching: false
                    };

                    const deptText = new fabric.FabricText(dept, {
                        ...fontProps,
                        fontSize: 16, top: -27, left: 0
                    });
                    
                    const dateTextObj = new fabric.FabricText(dateVal, {
                        ...fontProps,
                        fontSize: 16, top: 0, left: 0
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
                            fontSize: 14,
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
                        scaleX: 0.75, // Stamp scale relative to canvas
                        scaleY: 0.75,
                        objectCaching: false,
                        customData: { type: 'stampUserDate' },
                    });
                    fc.add(userDateGroup);
                    fc.setActiveObject(userDateGroup);
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
