import { useCallback, useRef } from 'react';

export default function useDraggable(annotation, onUpdate) {
    const startRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const origX = annotation.x;
        const origY = annotation.y;

        const handleMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            onUpdate({ x: origX + dx, y: origY + dy });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [annotation.x, annotation.y, onUpdate]);

    return { handleMouseDown };
}
