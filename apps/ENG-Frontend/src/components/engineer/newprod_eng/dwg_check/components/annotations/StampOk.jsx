import React from 'react';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function StampOk({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, color } = annotation;
    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize } = useResizable(annotation, onUpdate);

    return (
        <div
            className={`annotation-item ${isSelected ? 'selected' : ''}`}
            style={{ left: x, top: y, width, height, color }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(e);
                handleDrag(e);
            }}
        >
            <svg viewBox="0 0 30 30" width="100%" height="100%" preserveAspectRatio="none">
                <circle
                    cx="15" cy="15" r="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ pointerEvents: 'none' }}
                />
                <text
                    x="15" y="15" dy=".35em"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="bold"
                    fill="currentColor"
                    fontFamily="Arial, sans-serif"
                    style={{ pointerEvents: 'none' }}
                >
                    OK
                </text>
            </svg>
            {isSelected && (
                <div className="resize-handle se" onMouseDown={handleResize} />
            )}
        </div>
    );
}
