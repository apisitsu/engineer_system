import React, { useState, useEffect, useRef } from 'react';
import { usePdfEditorStore } from '../../../../../../stores/usePdfEditorStore';
import { useTheme } from '../../../../../../theme';

const PAPER_SIZES = {
    'A4': { widthMm: 210, heightMm: 297 },
    'A3': { widthMm: 297, heightMm: 420 },
    'A2': { widthMm: 420, heightMm: 594 },
    'A1': { widthMm: 594, heightMm: 841 },
    'A0': { widthMm: 841, heightMm: 1189 },
};

export default function PhysicalRuler({ pdfDoc, zoom }) {
    const store = usePdfEditorStore();
    const { theme } = useTheme();
    const rulerRef = useRef(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [pixelsPerMm, setPixelsPerMm] = useState(3.7795); // default 96dpi

    // ── Calculate pixels per mm based on PDF size, zoom, and paper size ──
    useEffect(() => {
        if (!pdfDoc || !store.physicalRulerVisible || !store.paperSize) return;

        const getCalibration = async () => {
            try {
                // Get the first page's viewport at scale 1 to find the PDF's internal point size
                const page = await pdfDoc.getPage(1);
                const viewport = page.getViewport({ scale: 1 });
                
                // The physical paper size chosen by the user
                const paperSize = PAPER_SIZES[store.paperSize] || PAPER_SIZES['A4'];
                
                // pdf width in points (at scale 1)
                const pdfWidthPts = viewport.width;
                
                // physical width in mm
                const physicalWidthMm = paperSize.widthMm;
                
                // Pts per mm in the PDF document
                const ptsPerMm = pdfWidthPts / physicalWidthMm;
                
                // When rendered, the page is scaled by `zoom` (e.g. 1.0, 1.5)
                // So 1 mm on physical paper = ptsPerMm * zoom pixels on screen
                setPixelsPerMm(ptsPerMm * zoom);
            } catch (err) {
                console.error("Failed to calibrate ruler:", err);
            }
        };

        getCalibration();
    }, [pdfDoc, zoom, store.paperSize, store.physicalRulerVisible]);

    // ── Dragging Logic ──
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({
            x: e.clientX - store.physicalRulerPosition.x,
            y: e.clientY - store.physicalRulerPosition.y
        });
        e.stopPropagation();
        e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        store.setPhysicalRulerPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    // ── Rotation Logic ──
    const handleWheel = (e) => {
        if (e.shiftKey || e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 5 : -5;
            let newAngle = store.physicalRulerAngle + delta;
            if (newAngle >= 360) newAngle -= 360;
            if (newAngle < 0) newAngle += 360;
            store.setPhysicalRulerAngle(newAngle);
        }
    };

    if (!store.physicalRulerVisible) return null;

    // Build ruler ticks. Let's make it 300mm (30cm) long.
    const lengthMm = 300;
    const ticks = [];
    for (let i = 0; i <= lengthMm; i++) {
        let height = 10;
        let showLabel = false;
        
        if (i % 10 === 0) {
            height = 25; // cm mark
            showLabel = true;
        } else if (i % 5 === 0) {
            height = 18; // 5mm mark
        }

        ticks.push(
            <div key={i} style={{
                position: 'absolute',
                left: i * pixelsPerMm,
                bottom: 0,
                width: 1,
                height: height,
                backgroundColor: 'rgba(0,0,0,0.8)',
            }}>
                {showLabel && (
                    <span style={{
                        position: 'absolute',
                        top: -16,
                        left: -5,
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: 'rgba(0,0,0,0.8)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}>
                        {i / 10}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            ref={rulerRef}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            style={{
                position: 'absolute',
                left: store.physicalRulerPosition.x,
                top: store.physicalRulerPosition.y,
                width: lengthMm * pixelsPerMm,
                height: 40,
                backgroundColor: 'rgba(255, 223, 107, 0.75)', // translucent yellow like a plastic ruler
                border: '1px solid rgba(0,0,0,0.3)',
                borderRadius: 4,
                backdropFilter: 'blur(2px)',
                cursor: isDragging ? 'grabbing' : 'grab',
                transform: `rotate(${store.physicalRulerAngle}deg)`,
                transformOrigin: '0 0', // rotate around top-left
                zIndex: 9999,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'flex-end',
            }}
        >
            <div style={{
                position: 'absolute',
                top: 2,
                left: 10,
                fontSize: 10,
                color: 'rgba(0,0,0,0.6)',
                pointerEvents: 'none',
                userSelect: 'none',
                fontWeight: 600,
            }}>
                PHYSICAL RULER - Shift+Scroll to Rotate
            </div>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {ticks}
            </div>
        </div>
    );
}
