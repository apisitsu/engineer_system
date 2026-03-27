import { useCallback, useState } from 'react';

export default function useResizable(annotation, onUpdate) {
    const [isResizing, setIsResizing] = useState(false);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const origW = annotation.width;
        const origH = annotation.height;

        const handleMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            const newW = Math.max(20, origW + dx);
            const newH = Math.max(20, origH + dy);
            onUpdate({ width: newW, height: newH });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [annotation.width, annotation.height, onUpdate]);

    return { handleMouseDown, isResizing };
}
