import { useEffect } from 'react';
import * as fabric from 'fabric';

/**
 * useFabricTools — Handles mouse events for drawing shapes and objects on the Fabric canvas.
 */
export default function useFabricTools({
    pageNum,
    store,
    pushHistory,
    userName,
    stampData,
    fabricCanvasRefs
}) {
    useEffect(() => {
        const fc = fabricCanvasRefs.current[pageNum];
        if (!fc) return;

        let isDrawing = false;
        let startX = 0;
        let startY = 0;
        let maxDist = 0;
        let tempObj = null;

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

                    let formattedName = name;
                    const nameParts = name.trim().split(/\s+/);
                    if (nameParts.length > 1) {
                        formattedName = `${nameParts[1].charAt(0).toUpperCase()}.${nameParts[0].toUpperCase()}`;
                    } else {
                        formattedName = name.toUpperCase();
                    }

                    const d = new Date();
                    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                    const dateVal = `${d.getDate().toString().padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

                    const color = '#e74c3c'; // Force red color as requested

                    const bgCircle = new fabric.Circle({
                        radius: 48, fill: 'transparent', stroke: color, strokeWidth: 3,
                        originX: 'center', originY: 'center',
                        left: 0, top: 0, objectCaching: false
                    });
                    const line1 = new fabric.Line([-46, -14, 46, -14], { stroke: color, strokeWidth: 2, objectCaching: false });
                    const line2 = new fabric.Line([-46, 14, 46, 14], { stroke: color, strokeWidth: 2, objectCaching: false });

                    const baseScale = store.fontSize / 16;
                    const fontProps = {
                        fontWeight: 'bold', fill: color, fontFamily: 'Arial',
                        originX: 'center', originY: 'center',
                        objectCaching: false
                    };

                    const deptText = new fabric.FabricText(dept, {
                        ...fontProps,
                        fontSize: 16, top: -24, left: 0
                    });

                    const dateTextObj = new fabric.FabricText(dateVal, {
                        ...fontProps,
                        fontSize: 14, top: 5, left: 0
                    });

                    const nameChars = formattedName.split('');
                    const maxSweep = 110;
                    const charAngle = Math.min(13, maxSweep / (nameChars.length - 1 || 1));
                    const actualSweep = charAngle * (nameChars.length - 1);
                    const startA = 90 + (actualSweep / 2);
                    const nameRadius = 38;

                    const nameObjects = nameChars.map((char, i) => {
                        const a = startA - (i * charAngle);
                        const rad = a * (Math.PI / 180);
                        return new fabric.FabricText(char, {
                            ...fontProps,
                            fontSize: 12,
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
                        scaleX: baseScale,
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
                        const imgInstance = new fabric.FabricImage(imgEl, {
                            left: pointer.x,
                            top: pointer.y,
                            originX: 'center',
                            originY: 'center',
                            scaleX: 0.5,
                            scaleY: 0.5,
                            customData: { type: tool }
                        });
                        fc.add(imgInstance);
                        fc.setActiveObject(imgInstance);
                        fc.renderAll();
                    };
                    break;
                }
            }
        };

        const createObject = (pointer) => {
            const tool = store.activeTool;
            startX = pointer.x;
            startY = pointer.y;
            maxDist = 0;

            const commonProps = {
                left: startX,
                top: startY,
                originX: 'left',
                originY: 'top',
                strokeUniform: true,
                objectCaching: false,
                evented: false,
                selectable: false,
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

                case 'addText': {
                    const itext = new fabric.Textbox('Type here', {
                        left: startX,
                        top: startY,
                        width: 150,
                        fontSize: store.fontSize || 16,
                        fontFamily: store.fontFamily || 'Helvetica',
                        fill: store.strokeColor || '#000000',
                        customData: { type: 'text', createdAt: Date.now() },
                    });
                    fc.add(itext);
                    fc.setActiveObject(itext);
                    store.setActiveTool('select');
                    return;
                }

                case 'sticky': {
                    const stickyTxt = new fabric.Textbox('Sticky Note', {
                        left: startX,
                        top: startY,
                        width: 150,
                        fontSize: 14,
                        fill: '#856404',
                        backgroundColor: '#fff3cd',
                        padding: 10,
                        customData: { type: 'sticky', createdAt: Date.now() },
                    });
                    fc.add(stickyTxt);
                    fc.setActiveObject(stickyTxt);
                    store.setActiveTool('select');
                    return;
                }

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
                        evented: false,
                        selectable: false,
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
            if (['highlight', 'underline', 'strikethrough'].includes(tool)) return;

            if (tool === 'eraser') {
                if (opt.target) {
                    pushHistory(pageNum);
                    fc.remove(opt.target);
                    fc.discardActiveObject();
                    fc.renderAll();
                }
                return;
            }

            if (opt.target && (opt.target.type === 'textbox' || opt.target.type === 'i-text' || opt.target.type === 'FabricText') && (tool === 'addText' || tool === 'sticky')) {
                return;
            }

            if (['stamp', 'signature', 'date', 'stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate'].includes(tool)) {
                const pointer = opt.scenePoint || opt.pointer;
                if (pointer) handleOneClickTool(pointer, tool);
                return;
            }

            isDrawing = true;
            maxDist = 0;
            pushHistory(pageNum);
            const pointer = opt.scenePoint || opt.pointer;
            if (pointer) createObject(pointer);
        };

        const onMouseMove = (opt) => {
            if (!isDrawing || !tempObj) return;
            const pointer = opt.scenePoint || opt.pointer;
            if (!pointer) return;

            const tool = store.activeTool;

            const dx = Math.abs(pointer.x - startX);
            const dy = Math.abs(pointer.y - startY);
            if (dx > maxDist) maxDist = dx;
            if (dy > maxDist) maxDist = dy;

            switch (tool) {
                case 'rect':
                case 'maskReplace': {
                    tempObj.set({
                        width: dx,
                        height: dy,
                        left: Math.min(startX, pointer.x),
                        top: Math.min(startY, pointer.y),
                    });
                    break;
                }
                case 'circle':
                    tempObj.set({
                        rx: dx / 2,
                        ry: dy / 2,
                        left: Math.min(startX, pointer.x),
                        top: Math.min(startY, pointer.y),
                    });
                    break;

                case 'underline':
                case 'strikethrough':
                case 'line':
                case 'arrow':
                case 'ruler':
                    tempObj.set({ x1: startX, y1: startY, x2: pointer.x, y2: pointer.y });
                    break;

                default:
                    break;
            }

            tempObj.setCoords();
            tempObj.dirty = true;
            fc.renderAll();
        };

        const onMouseUp = (opt) => {
            if (!isDrawing) return;
            isDrawing = false;

            const tool = store.activeTool;

            if (tempObj) {
                let sizeChanged = false;
                const isClickOnly = maxDist <= 5;

                if (isClickOnly) {
                    if (tool === 'rect' || tool === 'maskReplace') {
                        tempObj.set({ width: 100, height: 50 });
                        sizeChanged = true;
                    } else if (tool === 'circle') {
                        tempObj.set({ rx: 30, ry: 30 });
                        sizeChanged = true;
                    } else if (tool === 'line' || tool === 'arrow' || tool === 'ruler') {
                        tempObj.set({ x1: startX, y1: startY, x2: startX + 100, y2: startY + 100 });
                        sizeChanged = true;
                    }
                }

                tempObj.set({
                    selectable: true,
                    evented: true,
                });

                if (sizeChanged) {
                    tempObj.setCoords();
                    tempObj.dirty = true;
                }
            }

            let finalObj = tempObj;

            if (tool === 'arrow' && tempObj) {
                const x1 = tempObj.x1, y1 = tempObj.y1;
                const x2 = tempObj.x2, y2 = tempObj.y2;
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLen = store.fontSize || 16;

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

                const group = new fabric.Group([tempObj, arrowHead], {
                    customData: { type: 'arrow' },
                    selectable: true,
                    evented: true,
                });
                fc.remove(tempObj);
                fc.add(group);
                finalObj = group;
            }

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
                    fill: '#2196f3',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    originX: 'center',
                    originY: 'center',
                    customData: { type: 'rulerLabel' },
                });

                const group = new fabric.Group([tempObj, label], {
                    customData: { type: 'ruler' },
                    selectable: true,
                    evented: true,
                });
                fc.remove(tempObj);
                fc.add(group);
                finalObj = group;
            }

            if (finalObj && tool === 'maskReplace' && finalObj === tempObj) {
                finalObj.set({
                    stroke: store.strokeColor,
                    strokeWidth: store.strokeWidth,
                    fill: '#ffffff',
                });
            }

            if (finalObj && tool !== 'select' && tool !== 'pan') {
                fc.setActiveObject(finalObj);
            }

            tempObj = null;
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
    }, [store.activeTool, store.strokeColor, store.fillColor, store.strokeWidth, store.fontSize, store.opacity, pageNum, store.rulerScale, store.rulerUnit, store.fontFamily, pushHistory, stampData, userName, fabricCanvasRefs]);
}
