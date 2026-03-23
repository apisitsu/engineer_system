import React from 'react';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function ShapeEllipse({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, color, thickness = 1 } = annotation;
    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize } = useResizable(annotation, onUpdate);

    return (
        <div
            className={`annotation-item ${isSelected ? 'selected' : ''}`}
            style={{
                left: x,
                top: y,
                width,
                height,
                pointerEvents: 'auto',
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(e);
                handleDrag(e);
            }}
        >
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                <ellipse
                    cx={width / 2}
                    cy={height / 2}
                    rx={Math.max(0, width / 2 - thickness / 2)}
                    ry={Math.max(0, height / 2 - thickness / 2)}
                    fill="none"
                    stroke={color || '#e74c3c'}
                    strokeWidth={thickness}
                    style={{ pointerEvents: 'stroke', cursor: 'grab' }}
                />
            </svg>
            {isSelected && (
                <div className="resize-handle se" onMouseDown={handleResize} />
            )}
        </div>
    );
}
