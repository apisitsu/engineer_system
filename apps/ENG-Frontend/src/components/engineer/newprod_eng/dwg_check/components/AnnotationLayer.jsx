import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePdf } from '../context/PdfContext';
import HighlightRect from './annotations/HighlightRect';
import HighlightEllipse from './annotations/HighlightEllipse';
import TextBox from './annotations/TextBox';
import StampCheckmark from './annotations/StampCheckmark';
import StampCross from './annotations/StampCross';
import StampUserDate from './annotations/StampUserDate';
import ArrowAnnotation from './annotations/ArrowAnnotation';
import StampCircle from './annotations/StampCircle';
import StampOk from './annotations/StampOk';
import ShapeRect from './annotations/ShapeRect';
import ShapeEllipse from './annotations/ShapeEllipse';
import PropertyPanel from './PropertyPanel';
import { useAuthStore } from '../../../../../stores/authStore';

function formatUserName(fullName) {
    if (!fullName) return 'Reviewer';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName;
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${lastName.charAt(0).toUpperCase()}. ${firstName.toUpperCase()}`;
}

export default function AnnotationLayer({ pageSize, pageIndex }) {
    const { state, dispatch } = usePdf();
    const { userName: rawAuthName } = useAuthStore();
    const authUserName = formatUserName(rawAuthName);
    const { activeTool, annotations, currentPage, selectedAnnotationIds, isPanelOpen, zoom } = state; // Destructure zoom
    const layerRef = useRef(null);
    const [drawStart, setDrawStart] = useState(null);
    const [drawCurrent, setDrawCurrent] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Use pageIndex if provided (continuous mode), otherwise fallback to currentPage (single mode)
    const targetPage = pageIndex !== undefined ? pageIndex : currentPage;
    const pageAnnotations = annotations.filter(a => a.pageIndex === targetPage);

    // Check if the selected annotation belongs to THIS page
    const selectedAnnotation = state.selectedAnnotationIds?.length === 1 ? annotations.find(a => a.id === state.selectedAnnotationIds[0]) : null;
    const isSelectionOnThisPage = selectedAnnotation && selectedAnnotation.pageIndex === targetPage;

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if user is typing in an input or textarea
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedAnnotationIds.length > 0) {
                dispatch({ type: 'DELETE_MULTIPLE_ANNOTATIONS', payload: state.selectedAnnotationIds });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.selectedAnnotationIds, dispatch]);

    const getToolClass = () => {
        if (!activeTool) return '';
        if (activeTool.startsWith('highlight') || activeTool === 'arrow' || activeTool.startsWith('shape')) return 'drawing';
        if (activeTool.startsWith('stamp')) return 'stamp-mode';
        if (activeTool === 'text-box') return 'text-mode';
        return '';
    };

    const getRelativePos = useCallback((e) => {
        const rect = layerRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }, []);

    const handleMouseDown = useCallback((e) => {
        if (!activeTool) return;

        const pos = getRelativePos(e);
        // Normalize coordinates to 1.0 scale for storage
        const pdfX = pos.x / zoom;
        const pdfY = pos.y / zoom;

        if (!activeTool) {
            // Start multi-selection box
            setDrawStart(pos);
            setDrawCurrent(pos);
            setIsDrawing(true); // Using isDrawing state for selection box as well
            return;
        }

        // Stamp tools: place immediately
        if (activeTool.startsWith('stamp')) {
            const stampDefaults = getStampDefaults(state, activeTool, authUserName);
            dispatch({
                type: 'ADD_ANNOTATION',
                payload: {
                    ...stampDefaults,
                    pageIndex: targetPage,
                    x: pdfX - (stampDefaults.width / 2),
                    y: pdfY - (stampDefaults.height / 2),
                }
            });
            return;
        }

        // Text box: place on click
        if (activeTool === 'text-box') {
            const fontSize = state.defaultFontSize || 14;
            const height = fontSize * 1.5;

            dispatch({
                type: 'ADD_ANNOTATION',
                payload: {
                    type: 'text-box',
                    pageIndex: targetPage,
                    x: pdfX,
                    y: pdfY,
                    width: 150,
                    height: height,
                    text: '',
                    fontSize: fontSize,
                    fontFamily: 'Arial',
                    fontColor: state.stampColor || '#333333',
                    bold: false,
                    italic: false,
                    underline: false,
                    textAlign: 'left',
                    verticalAlign: 'top',
                },
            });
            return;
        }

        // Highlight / Arrow / Shape: start drawing
        if (activeTool.startsWith('highlight') || activeTool === 'arrow' || activeTool.startsWith('shape')) {
            setDrawStart(pos);
            setDrawCurrent(pos);
            setIsDrawing(true);
        }
    }, [activeTool, targetPage, dispatch, getRelativePos, state, zoom]);

    const [cursorPos, setCursorPos] = useState(null);

    const handleMouseMove = useCallback((e) => {
        const pos = getRelativePos(e);
        setCursorPos(pos);

        if (isDrawing) {
            setDrawCurrent(pos);
        }
    }, [isDrawing, getRelativePos]);

    const handleMouseUp = useCallback((e) => {
        if (!isDrawing || !drawStart || !drawCurrent) return;

        const screenX = Math.min(drawStart.x, drawCurrent.x);
        const screenY = Math.min(drawStart.y, drawCurrent.y);
        const screenWidth = Math.abs(drawCurrent.x - drawStart.x);
        const screenHeight = Math.abs(drawCurrent.y - drawStart.y);

        if (!activeTool) {
            // Handle multi-selection end
            if (screenWidth > 5 && screenHeight > 5) {
                // Find all annotations inside this screen box
                const selectedIds = pageAnnotations.filter(ann => {
                    const annLeft = ann.x * zoom;
                    const annTop = ann.y * zoom;
                    const annRight = annLeft + ann.width * zoom;
                    const annBottom = annTop + ann.height * zoom;

                    const selLeft = screenX;
                    const selTop = screenY;
                    const selRight = screenX + screenWidth;
                    const selBottom = screenY + screenHeight;

                    // Check for overlap (AABB collision)
                    return (
                        annLeft < selRight &&
                        annRight > selLeft &&
                        annTop < selBottom &&
                        annBottom > selTop
                    );
                }).map(a => a.id);

                if (selectedIds.length > 0) {
                    dispatch({ type: 'SELECT_MULTIPLE_ANNOTATIONS', payload: selectedIds });
                } else if (!e.shiftKey && !e.ctrlKey) {
                    dispatch({ type: 'DESELECT_ANNOTATION' });
                }
            } else if (!e.shiftKey && !e.ctrlKey) {
                // If it was just a click and no tool, deselect
                // (Only deselect if we clicked on the background, handleLayerClick handles this, but we can double check)
                dispatch({ type: 'DESELECT_ANNOTATION' });
            }
        } else if (screenWidth > 2 || screenHeight > 2) {
            // Handle drawing tools
            if (activeTool === 'arrow') {
                const sx = drawStart.x / zoom, sy = drawStart.y / zoom;
                const ex = drawCurrent.x / zoom, ey = drawCurrent.y / zoom;
                const dx = ex - sx;
                const dy = ey - sy;

                let arrowPoints;
                if (Math.abs(dx) > Math.abs(dy)) {
                    // แนวนอน (ลากซ้าย/ขวามากกว่าบน/ล่าง)
                    const midX = sx + dx / 2;
                    arrowPoints = [
                        { x: sx, y: sy },
                        { x: midX, y: sy },
                        { x: midX, y: ey },
                        { x: ex, y: ey }
                    ];
                } else {
                    // แนวตั้ง (ลากบน/ล่างมากกว่าซ้าย/ขวา)
                    const midY = sy + dy / 2;
                    arrowPoints = [
                        { x: sx, y: sy },
                        { x: sx, y: midY },
                        { x: ex, y: midY },
                        { x: ex, y: ey }
                    ];
                }

                dispatch({
                    type: 'ADD_ANNOTATION',
                    payload: {
                        type: 'arrow',
                        pageIndex: targetPage,
                        x: Math.min(sx, ex),
                        y: Math.min(sy, ey),
                        width: Math.abs(ex - sx),
                        height: Math.abs(ey - sy),
                        points: arrowPoints,
                        color: state.stampColor || '#e74c3c',
                        thickness: state.defaultLineThickness || 3,
                        headStart: 'none',
                        headEnd: 'arrow',
                    },
                });
            } else if (activeTool.startsWith('shape')) {
                dispatch({
                    type: 'ADD_ANNOTATION',
                    payload: {
                        type: activeTool,
                        pageIndex: targetPage,
                        x: screenX / zoom,
                        y: screenY / zoom,
                        width: screenWidth / zoom,
                        height: screenHeight / zoom,
                        color: state.stampColor || '#e74c3c',
                        thickness: state.defaultLineThickness || 1,
                    },
                });
            } else {
                const type = activeTool === 'highlight-rect' ? 'highlight-rect' : 'highlight-ellipse';
                dispatch({
                    type: 'ADD_ANNOTATION',
                    payload: {
                        type,
                        pageIndex: targetPage,
                        x: screenX / zoom,
                        y: screenY / zoom,
                        width: screenWidth / zoom,
                        height: screenHeight / zoom,
                        color: 'rgba(255, 235, 59, 0.4)',
                    },
                });
            }
        }

        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
    }, [isDrawing, drawStart, drawCurrent, activeTool, targetPage, dispatch, zoom, pageAnnotations]);

    const handleLayerClick = useCallback((e) => {
        if (e.target === layerRef.current) {
            if ((state.selectedAnnotationIds && state.selectedAnnotationIds.length > 0) || isPanelOpen) {
                // If we didn't drag a box (handled by MouseUp), this click will clear the selection.
                // MouseUp already clears it if it was a tiny click. 
                // We'll leave it to handleMouseUp for consistency, but if we need it here:
                // dispatch({ type: 'DESELECT_ANNOTATION' });
            }
        }
    }, [state.selectedAnnotationIds, isPanelOpen, dispatch]);

    // Drawing preview rect (Screen Pixels)
    const previewRect = isDrawing && drawStart && drawCurrent ? {
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        width: Math.abs(drawCurrent.x - drawStart.x),
        height: Math.abs(drawCurrent.y - drawStart.y),
    } : null;

    // Stamp Ghost Preview
    const renderGhostStamp = (authUserName) => {
        if (!cursorPos || !activeTool || !activeTool.startsWith('stamp')) return null;

        // Get defaults (at 1.0 scale)
        const defaults = getStampDefaults(state, activeTool, authUserName);
        // Scale for preview
        const width = defaults.width * zoom;
        const height = defaults.height * zoom;
        const x = cursorPos.x - (width / 2);
        const y = cursorPos.y - (height / 2);

        const style = {
            position: 'absolute',
            left: x,
            top: y,
            width: width,
            height: height,
            opacity: 0.4,
            pointerEvents: 'none',
            zIndex: 1000,
        };

        if (activeTool === 'stamp-check') {
            return (
                <div style={style} className="stamp-checkmark">
                    <svg viewBox="0 0 30 30" width="100%" height="100%">
                        <text
                            x="15"
                            y="15"
                            dy=".35em"
                            textAnchor="middle"
                            fontSize="25"
                            fill={defaults.color}
                            fontFamily="Arial, sans-serif"
                        >
                            ✓
                        </text>
                    </svg>
                </div>
            );
        }
        if (activeTool === 'stamp-cross' || activeTool === 'stamp-cross-red') {
            return (
                <div style={style} className="stamp-cross">
                    <svg viewBox="0 0 30 30" width="100%" height="100%">
                        <text
                            x="15"
                            y="15"
                            dy=".35em"
                            textAnchor="middle"
                            fontSize="25"
                            fill={defaults.color}
                            fontFamily="Arial, sans-serif"
                        >
                            ✕
                        </text>
                    </svg>
                </div>
            );
        }
        if (activeTool === 'stamp-circle') {
            return (
                <div style={style} className="stamp-circle">
                    <svg viewBox="0 0 30 30" width="100%" height="100%">
                        <circle cx="15" cy="15" r="13" fill="none" stroke={defaults.color} strokeWidth="2" />
                    </svg>
                </div>
            );
        }
        if (activeTool === 'stamp-ok') {
            return (
                <div style={style} className="stamp-ok">
                    <svg viewBox="0 0 30 30" width="100%" height="100%">
                        <circle cx="15" cy="15" r="13" fill="none" stroke={defaults.color} strokeWidth="2" />
                        <text
                            x="15"
                            y="15"
                            dy=".35em"
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="bold"
                            fill={defaults.color}
                            fontFamily="Arial, sans-serif"
                        >
                            OK
                        </text>
                    </svg>
                </div>
            );
        }
        if (activeTool === 'stamp-userdate') {
            return (
                <div style={style}>
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                        <defs>
                            <path id="ghostBottom" d="M 6,50 A 44,44 0 0,0 94,50" fill="none" />
                        </defs>
                        <circle cx="50" cy="50" r="48" fill="white" stroke={defaults.color} strokeWidth="3" opacity="0.8" />
                        <line x1="6" y1="32" x2="94" y2="32" stroke={defaults.color} strokeWidth="2" />
                        <line x1="6" y1="68" x2="94" y2="68" stroke={defaults.color} strokeWidth="2" />

                        <text x="50" y="24" textAnchor="middle" fill={defaults.color} fontSize="14" fontWeight="bold" fontFamily="Arial">
                            {defaults.department || 'DEPT'}
                        </text>
                        <text x="50" y="55" textAnchor="middle" fill={defaults.color} fontSize="13" fontWeight="bold" fontFamily="Arial">
                            {defaults.date}
                        </text>
                        <text fill={defaults.color} fontSize="11" fontWeight="bold" fontFamily="Arial">
                            <textPath href="#ghostBottom" startOffset="50%" textAnchor="middle" alignmentBaseline="auto">
                                {defaults.userName}
                            </textPath>
                        </text>
                    </svg>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <div
                ref={layerRef}
                className={`annotation-layer ${getToolClass()}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setCursorPos(null)}
            >
                {/* Render all annotations for this page */}
                {pageAnnotations.map(ann => renderAnnotation(ann, state, dispatch, zoom))}

                {/* Drawing preview / Selection Box */}
                {previewRect && (
                    <div
                        className={`annotation-item ${!activeTool ? 'selection-box' : activeTool}`}
                        style={{
                            left: previewRect.x,
                            top: previewRect.y,
                            width: previewRect.width,
                            height: previewRect.height,
                            pointerEvents: 'none',
                            ...(activeTool === 'highlight-ellipse' ? { borderRadius: '50%', background: 'rgba(255, 235, 59, 0.4)' } : {}),
                            ...(activeTool === 'shape-rect' ? { border: `${state.defaultLineThickness || 1}px solid ${state.stampColor || '#e74c3c'}`, background: 'transparent' } : {}),
                            ...(activeTool === 'shape-ellipse' ? { borderRadius: '50%', border: `${state.defaultLineThickness || 1}px solid ${state.stampColor || '#e74c3c'}`, background: 'transparent' } : {}),
                            ...(!activeTool ? { border: '1px dashed #3498db', background: 'rgba(52, 152, 219, 0.1)' } : {})
                        }}
                    />
                )}

                {/* Ghost Stamp Preview */}
                {renderGhostStamp(authUserName)}

                {/* Gear Icon for Selected Annotation (On-Demand Panel) */}
                {/* Only show Gear icon if precisely ONE annotation is selected. Multi-select shouldn't open property panel. */}
                {state.selectedAnnotationIds?.length === 1 && state.annotations.find(a => a.id === state.selectedAnnotationIds[0])?.pageIndex === targetPage && !isPanelOpen && (
                    <button
                        className="gear-btn"
                        style={{
                            position: 'absolute',
                            // Scale position for display
                            left: (state.annotations.find(a => a.id === state.selectedAnnotationIds[0]).x * zoom) + (state.annotations.find(a => a.id === state.selectedAnnotationIds[0]).width * zoom) + 5,
                            top: (state.annotations.find(a => a.id === state.selectedAnnotationIds[0]).y * zoom),
                            zIndex: 200,
                            pointerEvents: 'auto',
                            padding: '4px',
                            cursor: 'pointer',
                            background: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            dispatch({ type: 'TOGGLE_PANEL', payload: true });
                        }}
                        title="Edit Settings"
                    >
                        ⚙️
                    </button>
                )}
            </div>

            {/* Property panel for selected annotation - ONLY if panel is open and exactly one is selected */}
            {state.selectedAnnotationIds?.length === 1 && state.annotations.find(a => a.id === state.selectedAnnotationIds[0])?.pageIndex === targetPage && isPanelOpen && (
                <PropertyPanel annotation={state.annotations.find(a => a.id === state.selectedAnnotationIds[0])} pageSize={pageSize} />
            )}
        </>
    );
}

function getStampDefaults(state, tool, authUserName) {
    const size = state.defaultStampSize || 30;
    // Return dimensions at 1.0 scale
    switch (tool) {
        case 'stamp-check':
            return { type: 'stamp-check', width: size, height: size, color: state.stampColor };
        case 'stamp-cross':
            return { type: 'stamp-cross', width: size, height: size, color: state.stampColor };
        case 'stamp-cross-red':
            return { type: 'stamp-cross', width: size, height: size, color: state.stampColor };
        case 'stamp-circle':
            return { type: 'stamp-circle', width: size, height: size, color: state.stampColor };
        case 'stamp-ok':
            return { type: 'stamp-ok', width: size, height: size, color: state.stampColor };
        case 'stamp-userdate':
            // Ensure User Date stamp scales relatively or stays large
            // Usually userdate stamp is bigger. Let's say 2.5x standard stamp size or fixed default ratio?
            // If user sets stamp size to 50, this should be bigger.
            // Original was 80 vs 30 (approx 2.66x).
            // Let's use a multiplier.
            const userDateSize = Math.round(size * 2.66);
            return {
                type: 'stamp-userdate',
                width: userDateSize,
                height: userDateSize,
                department: state.defaultDepartment || 'ROD ENG',
                userName: authUserName || 'Reviewer',
                date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(),
            };
        default:
            return {};
    }
}

function renderAnnotation(ann, state, dispatch, zoom) {
    const isSelected = state.selectedAnnotationIds?.includes(ann.id);

    const scaledAnn = {
        ...ann,
        x: ann.x * zoom,
        y: ann.y * zoom,
        width: ann.width * zoom,
        height: ann.height * zoom,
        fontSize: (ann.fontSize || 14) * zoom,
        thickness: (ann.thickness || 1) * zoom,
        zoom: zoom,
        // Scale points array สำหรับ arrow annotation
        ...(ann.points ? { points: ann.points.map(p => ({ x: p.x * zoom, y: p.y * zoom })) } : {}),
    };

    // Helper to unscale changes before updating state
    const handleUpdate = (changes) => {
        const unscaledChanges = {};
        if (changes.x !== undefined) unscaledChanges.x = changes.x / zoom;
        if (changes.y !== undefined) unscaledChanges.y = changes.y / zoom;
        if (changes.width !== undefined) unscaledChanges.width = changes.width / zoom;
        if (changes.height !== undefined) unscaledChanges.height = changes.height / zoom;
        // Unscale points array สำหรับ arrow annotation
        if (changes.points) {
            unscaledChanges.points = changes.points.map(p => ({ x: p.x / zoom, y: p.y / zoom }));
            // อัพเดต bounding box (x, y, width, height) จาก points ใหม่
            const xs = unscaledChanges.points.map(p => p.x);
            const ys = unscaledChanges.points.map(p => p.y);
            unscaledChanges.x = Math.min(...xs);
            unscaledChanges.y = Math.min(...ys);
            unscaledChanges.width = Math.max(...xs) - unscaledChanges.x;
            unscaledChanges.height = Math.max(...ys) - unscaledChanges.y;
        }

        // Detect if this is a "whole drag" (move) operation for arrows
        const isWholeDrag = changes._isWholeDrag;
        // Clean the flag before dispatching
        if (isWholeDrag) delete changes._isWholeDrag;

        // If multiple items are selected and we are dragging one of them
        const isMoveDrag = (unscaledChanges.x !== undefined || unscaledChanges.y !== undefined) && (unscaledChanges.width === undefined || isWholeDrag);
        if (isSelected && state.selectedAnnotationIds.length > 1 && isMoveDrag) {
            const dx = unscaledChanges.x !== undefined ? unscaledChanges.x - ann.x : 0;
            const dy = unscaledChanges.y !== undefined ? unscaledChanges.y - ann.y : 0;

            const updates = state.selectedAnnotationIds.map(id => {
                const targetAnn = state.annotations.find(a => a.id === id);
                if (!targetAnn) return null;
                const targetChanges = {
                    x: targetAnn.x + dx,
                    y: targetAnn.y + dy,
                };
                // ถ้า target เป็น arrow ที่มี points → shift points ตามด้วย
                if (targetAnn.points) {
                    targetChanges.points = targetAnn.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    const xs = targetChanges.points.map(p => p.x);
                    const ys = targetChanges.points.map(p => p.y);
                    targetChanges.width = Math.max(...xs) - targetChanges.x;
                    targetChanges.height = Math.max(...ys) - targetChanges.y;
                }
                return { id, changes: targetChanges };
            }).filter(Boolean);

            dispatch({
                type: 'UPDATE_MULTIPLE_ANNOTATIONS',
                payload: updates
            });
        } else {
            // Single update
            dispatch({
                type: 'UPDATE_ANNOTATION',
                payload: {
                    id: ann.id,
                    changes: { ...changes, ...unscaledChanges }
                }
            });
        }
    };

    const commonProps = {
        // key: ann.id,
        annotation: scaledAnn, // Pass scaled version to component
        isSelected,
        onSelect: (e) => dispatch({ type: 'SELECT_ANNOTATION', payload: { id: ann.id, multi: e && (e.shiftKey || e.ctrlKey) } }),
        onUpdate: handleUpdate,
    };

    const key = ann.id;

    switch (ann.type) {
        case 'highlight-rect':
            return <HighlightRect key={key} {...commonProps} />;
        case 'highlight-ellipse':
            return <HighlightEllipse key={key} {...commonProps} />;
        case 'text-box':
            return <TextBox key={key} {...commonProps} />;
        case 'stamp-check':
            return <StampCheckmark key={key} {...commonProps} />;
        case 'stamp-cross':
            return <StampCross key={key} {...commonProps} />;
        case 'stamp-userdate':
            return <StampUserDate key={key} {...commonProps} />;
        case 'stamp-circle':
            return <StampCircle key={key} {...commonProps} />;
        case 'stamp-ok':
            return <StampOk key={key} {...commonProps} />;
        case 'arrow':
            return <ArrowAnnotation key={key} {...commonProps} />;
        case 'shape-rect':
            return <ShapeRect key={key} {...commonProps} />;
        case 'shape-ellipse':
            return <ShapeEllipse key={key} {...commonProps} />;
        default:
            return null;
    }
}
