import React from 'react';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function HighlightEllipse({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, color } = annotation;

    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize } = useResizable(annotation, onUpdate);

    return (
        <div
            className={`annotation-item highlight-ellipse ${isSelected ? 'selected' : ''}`}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
                borderRadius: '50%',
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
