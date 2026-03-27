import React from 'react';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function StampCheckmark({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, color } = annotation;

    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize } = useResizable(annotation, onUpdate);

    const size = Math.min(width, height);

    return (
        <div
            className={`annotation-item stamp-checkmark ${isSelected ? 'selected' : ''}`}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(e);
                handleDrag(e);
            }}
        >
            <svg viewBox="0 0 30 30" width={width} height={height}>
                <text
                    x="15"
                    y="15"
                    dy=".35em"
                    textAnchor="middle"
                    fontSize="25"
                    fill={color || '#27ae60'}
                    fontFamily="Arial, sans-serif"
                    fontWeight="bold"
                >
                    ✓
                </text>
            </svg>
            {isSelected && (
                <div className="resize-handle" onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResize(e);
                }} />
            )}
        </div>
    );
}
