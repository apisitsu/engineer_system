import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../../../../theme';
import { mmToPoints } from './useSignStamp';

/**
 * PdfCanvas — Renders PDF pages via pdfjs-dist Canvas API and overlays
 * draggable stamp/signature elements as absolutely-positioned images.
 */
const PdfCanvas = ({
    pdfDoc,
    currentPage,
    zoom,
    placements,
    activeStampType,
    selectedPlacementId,
    stampData,
    onCanvasClick,
    onPlacementDragEnd,
    onPlacementSelect,
    onPlacementRemove,
}) => {
    const { theme } = useTheme();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
    const [dragState, setDragState] = useState(null); // { id, startX, startY, offsetX, offsetY }

    // ── Render PDF page onto canvas ──
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;

        let cancelled = false;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(currentPage);
                const viewport = page.getViewport({ scale: zoom * 1.5 }); // Higher render for sharpness

                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Set display size (CSS)
                const displayWidth = viewport.width / 1.5;
                const displayHeight = viewport.height / 1.5;
                canvas.style.width = `${displayWidth}px`;
                canvas.style.height = `${displayHeight}px`;

                if (!cancelled) {
                    setCanvasSize({ width: displayWidth, height: displayHeight });

                    // Store the actual PDF page size in points
                    const baseViewport = page.getViewport({ scale: 1.0 });
                    setPageSize({ width: baseViewport.width, height: baseViewport.height });
                }

                await page.render({ canvasContext: ctx, viewport }).promise;
            } catch (err) {
                if (!cancelled) console.error('Page render error:', err);
            }
        };

        renderPage();
        return () => { cancelled = true; };
    }, [pdfDoc, currentPage, zoom]);

    // ── Compute stamp display size in CSS pixels ──
    const getStampDisplaySize = useCallback((widthMm, heightMm) => {
        if (!pageSize.width || !canvasSize.width) return { w: 60, h: 60 };

        const widthPt = mmToPoints(widthMm);
        const heightPt = mmToPoints(heightMm);

        // Scale from PDF points to CSS pixels
        const scale = canvasSize.width / pageSize.width;
        return {
            w: widthPt * scale,
            h: heightPt * scale,
        };
    }, [pageSize, canvasSize]);

    // ── Handle canvas click (to place a new stamp) ──
    const handleCanvasClick = (e) => {
        if (!activeStampType || dragState) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        onCanvasClick(x, y, canvasSize.width, canvasSize.height);
    };

    // ── Drag handling ──
    const handleMouseDown = (e, placementId) => {
        e.stopPropagation();
        onPlacementSelect(placementId);

        const rect = containerRef.current.getBoundingClientRect();
        const placement = placements.find(p => p.id === placementId);
        if (!placement) return;

        setDragState({
            id: placementId,
            startX: e.clientX,
            startY: e.clientY,
            origX: placement.screenX,
            origY: placement.screenY,
        });
    };

    const handleMouseMove = useCallback((e) => {
        if (!dragState) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        // Update visually during drag via DOM manipulation for performance
        const el = document.getElementById(`placement-${dragState.id}`);
        if (el) {
            el.style.left = `${dragState.origX + dx}px`;
            el.style.top = `${dragState.origY + dy}px`;
        }
    }, [dragState]);

    const handleMouseUp = useCallback((e) => {
        if (!dragState) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        const newX = dragState.origX + dx;
        const newY = dragState.origY + dy;

        onPlacementDragEnd(dragState.id, newX, newY);
        setDragState(null);
    }, [dragState, onPlacementDragEnd]);

    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState, handleMouseMove, handleMouseUp]);

    // ── Get the image source for a placement ──
    const getImageSrc = (type) => {
        if (!stampData) return null;
        if (type === 'stamp' && stampData.stamp_image) {
            return `data:image/png;base64,${stampData.stamp_image}`;
        }
        if (type === 'signature' && stampData.signature_image) {
            return `data:image/png;base64,${stampData.signature_image}`;
        }
        return null;
    };

    // ── Filter placements for the current page ──
    const currentPlacements = placements.filter(p => p.pageNum === currentPage);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                display: 'inline-block',
                cursor: activeStampType ? 'crosshair' : 'default',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: theme.shadows.md,
                background: '#fff',
            }}
            onClick={handleCanvasClick}
        >
            {/* PDF Canvas */}
            <canvas
                ref={canvasRef}
                style={{ display: 'block' }}
            />

            {/* Stamp/Signature Overlays */}
            {currentPlacements.map(placement => {
                const imgSrc = getImageSrc(placement.type);
                if (!imgSrc) return null;

                const displaySize = getStampDisplaySize(placement.widthMm, placement.heightMm);
                const isSelected = selectedPlacementId === placement.id;

                return (
                    <div
                        key={placement.id}
                        id={`placement-${placement.id}`}
                        onMouseDown={(e) => handleMouseDown(e, placement.id)}
                        style={{
                            position: 'absolute',
                            left: placement.screenX,
                            top: placement.screenY,
                            width: displaySize.w,
                            height: displaySize.h,
                            cursor: 'move',
                            userSelect: 'none',
                            border: isSelected ? `2px dashed ${theme.colors.primary}` : '2px solid transparent',
                            borderRadius: 4,
                            boxShadow: isSelected ? `0 0 0 3px ${theme.colors.primary}33` : 'none',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                            zIndex: isSelected ? 10 : 1,
                        }}
                    >
                        <img
                            src={imgSrc}
                            alt={placement.type}
                            draggable={false}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                pointerEvents: 'none',
                                opacity: 0.85,
                            }}
                        />
                        {/* Delete button */}
                        {isSelected && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlacementRemove(placement.id);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: -10,
                                    right: -10,
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: theme.colors.error || '#ff4d4f',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                }}
                            >
                                ×
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PdfCanvas;
