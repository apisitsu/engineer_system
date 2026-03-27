import React from 'react';
import { usePdf } from '../../context/PdfContext';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function HighlightRect({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, color } = annotation;

    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize, isResizing } = useResizable(annotation, onUpdate);

    return (
        <div
            className={`annotation-item highlight-rect ${isSelected ? 'selected' : ''}`}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
                background: color || 'rgba(255, 235, 59, 0.4)',
                mixBlendMode: 'multiply',
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(e);
                handleDrag(e);
            }}
        >
            {isSelected && (
                <div className="resize-handle" onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResize(e);
                }} />
            )}
        </div>
    );
}
