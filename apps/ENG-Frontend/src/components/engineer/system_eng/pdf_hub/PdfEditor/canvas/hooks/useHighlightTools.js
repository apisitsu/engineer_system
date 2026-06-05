import { useCallback } from 'react';
import * as fabric from 'fabric';

/**
 * useHighlightTools — Handles mouse events and drawing for text highlight, underline, and strikethrough.
 */
export default function useHighlightTools({
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
}) {
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
    }, [store.activeTool, textLayerRef, hlDrawRef]);

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
    }, [pageHighlights, pageNum, store.highlightColor, store.activeTool, store.strokeColor, store.strokeWidth, canvasSize, hlDrawRef, highlightCanvasRef]);

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
                    // Shift Y up slightly (by 15% of height) to center visually over text body
                    // and slightly adjust height to wrap nicely.
                    newHighlights.push({
                        id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`,
                        normX: x / cssW,
                        normY: (y - (h * 0.2)) / cssH,
                        normW: w / cssW,
                        normH: (h * 1.05) / cssH,
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
    }, [pageNum, store, canvasSize, setPageHighlights, pushHistory, fabricCanvasRefs, pageHighlights, hlDrawRef, highlightCanvasRef, textLayerRef]);

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
    }, [store.activeTool, pageNum, pageHighlights, pushHistory, setPageHighlights, canvasSize, highlightCanvasRef]);

    return {
        handleHybridMouseDown,
        handleHybridMouseMove,
        handleHybridMouseUp,
        handleHighlightCanvasContextMenu,
    };
}
