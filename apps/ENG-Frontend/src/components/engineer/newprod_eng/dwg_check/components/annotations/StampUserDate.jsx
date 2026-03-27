import React from 'react';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function StampUserDate({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, userName, date, department, color } = annotation;
    const strokeColor = color || '#e74c3c'; // Default to red if undefined

    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize } = useResizable(annotation, onUpdate);

    const pathId = annotation.id; // Unique ID for paths

    return (
        <div
            className={`annotation-item ${isSelected ? 'selected' : ''}`}
            style={{
                left: x,
                top: y,
                width,
                height,
                position: 'absolute',
                cursor: isSelected ? 'move' : 'pointer',
                zIndex: isSelected ? 100 : 10,
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(e);
                handleDrag(e); // Re-added handleDrag
            }}
        >
            <svg viewBox="0 0 100 100" width="100%" height="100%">
                <defs>
                    {/* Bottom Curve: Left to Right Smile */}
                    <path id={`curveBottom_${pathId}`} d="M 12,74 A 43,43 0 0,0 88,74" fill="none" />
                </defs>

                {/* Outer Circle */}
                <circle cx="50" cy="50" r="48" fill="white" stroke={strokeColor} strokeWidth="3" />

                {/* Horizontal Dividers */}
                <line x1="4" y1="36" x2="96" y2="36" stroke={strokeColor} strokeWidth="2" />
                <line x1="4" y1="64" x2="96" y2="64" stroke={strokeColor} strokeWidth="2" />

                {/* Text 1: Department (Top Straight) */}
                <text x="50" y="30" textAnchor="middle" fill={strokeColor} fontSize="15" fontWeight="bold" fontFamily="Arial, Helvetica, sans-serif">
                    {department || 'DEPT'}
                </text>

                {/* Text 2: Date (Middle Straight) */}
                <text x="50" y="56" textAnchor="middle" fill={strokeColor} fontSize="13" fontWeight="bold" fontFamily="Arial, Helvetica, sans-serif">
                    {date}
                </text>

                {/* Text 3: Name (Bottom Curved) */}
                <text
                    fill={strokeColor}
                    fontSize="13"
                    fontWeight="bold"
                    fontFamily="Arial, Helvetica, sans-serif"
                    dy="-2"
                >
                    <textPath href={`#curveBottom_${pathId}`} startOffset="50%" textAnchor="middle" alignmentBaseline="auto">
                        {userName}
                    </textPath>
                </text>
            </svg>

            {/* Drag Handle (Invisible, just for movement behavior) */}
            {isSelected && <div className="drag-handle" />}
            {isSelected && (
                <div className="resize-handle" onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResize(e);
                }} />
            )}
        </div>
    );
}
