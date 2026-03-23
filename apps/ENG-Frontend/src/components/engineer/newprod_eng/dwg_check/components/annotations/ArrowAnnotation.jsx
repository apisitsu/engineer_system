import React from 'react';

// ลบจุดซ้ำซ้อนที่อยู่ในแนวเดียวกัน (collinear) ออก
// เพื่อไม่ให้ points สะสมเยอะเกินไปเมื่อลากซ้ำๆ
function cleanupPoints(pts) {
    if (pts.length <= 2) return pts;
    const result = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = result[result.length - 1];
        const curr = pts[i];
        const next = pts[i + 1];

        // ข้ามจุดที่ซ้อนทับกับจุดก่อนหน้า (zero-length segment)
        if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) continue;

        // ข้ามจุดที่อยู่ในแนวเดียวกันระหว่าง prev → curr → next (collinear)
        const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
        const cross = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(cross) < 0.5) continue;

        result.push(curr);
    }
    // เช็คจุดสุดท้ายไม่ซ้อนกับจุดก่อนหน้า
    const last = pts[pts.length - 1];
    const prevLast = result[result.length - 1];
    if (Math.abs(last.x - prevLast.x) >= 0.5 || Math.abs(last.y - prevLast.y) >= 0.5) {
        result.push(last);
    }
    // ต้องมีอย่างน้อย 2 จุด
    if (result.length < 2) return pts;
    return result;
}

export default function ArrowAnnotation({ annotation, isSelected, onSelect, onUpdate }) {
    const { color = '#a4b0be', thickness = 3, headStart = 'circle', headEnd = 'arrow' } = annotation;

    // 1. จำลองเส้นตั้งต้นให้มี 4 จุด (3 ท่อน)
    let points = annotation.points;
    if (!points || points.length < 2) {
        const sx = annotation.x || 100;
        const sy = annotation.y || 100;
        const w = annotation.width || 200;
        const h = annotation.height || 100;
        points = [
            { x: sx, y: sy },
            { x: sx + w / 2, y: sy },
            { x: sx + w / 2, y: sy + h },
            { x: sx + w, y: sy + h }
        ];
    }

    // 2. ฟังก์ชันวาดเส้นพร้อมมุมโค้งมน (Rounded Corners)
    const createRoundedPath = (pts, radius = 15) => {
        if (pts.length < 2) return '';
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            const next = pts[i + 1];

            const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

            const r = Math.min(radius, len1 / 2, len2 / 2);
            if (r === 0 || len1 === 0 || len2 === 0) {
                d += ` L ${curr.x} ${curr.y}`;
                continue;
            }

            const p1x = curr.x - (dx1 / len1) * r, p1y = curr.y - (dy1 / len1) * r;
            const p2x = curr.x + (dx2 / len2) * r, p2y = curr.y + (dy2 / len2) * r;
            d += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
        }
        d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
        return d;
    };

    const pathD = createRoundedPath(points);

    // ========================================================================
    // 3. ลาก "แคปซูล" (ขยับเส้นทั้งท่อน)
    //    - ถ้าลาก segment แรก/สุดท้าย → จุดปลายคงที่, สร้าง segment ใหม่เชื่อม
    //    - ถ้าลาก segment กลาง → ขยับ 2 จุดของ segment นั้น (ปกติ)
    //    - ทำ cleanup จุด collinear ทุกครั้ง
    // ========================================================================
    const handleSegmentDrag = (index) => (e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const initialPoints = points.map(p => ({ ...p }));
        const p1 = initialPoints[index], p2 = initialPoints[index + 1];
        const isHorizontal = Math.abs(p1.y - p2.y) < Math.abs(p1.x - p2.x);

        const isFirstSegment = index === 0;
        const isLastSegment = index === initialPoints.length - 2;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newPoints;

            if (isFirstSegment && isLastSegment) {
                // กรณีมีแค่ 2 จุด (1 segment) → ทั้งหัวทั้งท้ายต้องคงที่, สร้าง 2 segment ใหม่
                const startPt = { ...initialPoints[0] };
                const endPt = { ...initialPoints[1] };
                if (isHorizontal) {
                    newPoints = [
                        startPt,
                        { x: startPt.x, y: startPt.y + dy },
                        { x: endPt.x, y: endPt.y + dy },
                        endPt
                    ];
                } else {
                    newPoints = [
                        startPt,
                        { x: startPt.x + dx, y: startPt.y },
                        { x: endPt.x + dx, y: endPt.y },
                        endPt
                    ];
                }
            } else if (isFirstSegment) {
                // จุดปลายหัว (P0) คงที่ → สร้าง segment เชื่อมจาก P0 ไปยัง segment ที่ถูกขยับ
                const fixedStart = { ...initialPoints[0] };
                if (isHorizontal) {
                    newPoints = [
                        fixedStart,
                        { x: fixedStart.x, y: fixedStart.y + dy },
                        { x: initialPoints[1].x, y: initialPoints[1].y + dy },
                        ...initialPoints.slice(2).map(p => ({ ...p }))
                    ];
                } else {
                    newPoints = [
                        fixedStart,
                        { x: fixedStart.x + dx, y: fixedStart.y },
                        { x: initialPoints[1].x + dx, y: initialPoints[1].y },
                        ...initialPoints.slice(2).map(p => ({ ...p }))
                    ];
                }
            } else if (isLastSegment) {
                // จุดปลายท้าย (Pn) คงที่ → สร้าง segment เชื่อมจาก segment ที่ถูกขยับไปยัง Pn
                const lastIdx = initialPoints.length - 1;
                const fixedEnd = { ...initialPoints[lastIdx] };
                if (isHorizontal) {
                    newPoints = [
                        ...initialPoints.slice(0, lastIdx - 1).map(p => ({ ...p })),
                        { x: initialPoints[lastIdx - 1].x, y: initialPoints[lastIdx - 1].y + dy },
                        { x: fixedEnd.x, y: fixedEnd.y + dy },
                        fixedEnd
                    ];
                } else {
                    newPoints = [
                        ...initialPoints.slice(0, lastIdx - 1).map(p => ({ ...p })),
                        { x: initialPoints[lastIdx - 1].x + dx, y: initialPoints[lastIdx - 1].y },
                        { x: fixedEnd.x + dx, y: fixedEnd.y },
                        fixedEnd
                    ];
                }
            } else {
                // Segment กลาง → ขยับ 2 จุดตามปกติ
                newPoints = initialPoints.map(p => ({ ...p }));
                if (isHorizontal) {
                    newPoints[index].y += dy;
                    newPoints[index + 1].y += dy;
                } else {
                    newPoints[index].x += dx;
                    newPoints[index + 1].x += dx;
                }
            }

            // ล้างจุดซ้ำซ้อน/collinear
            onUpdate({ points: cleanupPoints(newPoints) });
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // ========================================================================
    // 4. ลากจุดปลาย "หัว/ท้าย" (ยืดหดโดยรักษามุมฉาก)
    // ========================================================================
    const handleEndpointDrag = (isStart) => (e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const initialPoints = points.map(p => ({ ...p }));
        const index = isStart ? 0 : initialPoints.length - 1;
        const neighborIndex = isStart ? 1 : initialPoints.length - 2;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX, dy = moveEvent.clientY - startY;
            const newPoints = initialPoints.map(p => ({ ...p }));

            newPoints[index].x += dx;
            newPoints[index].y += dy;

            // ดึงจุดถัดไปให้ตั้งฉากตามมาด้วย
            const origCurr = initialPoints[index];
            const origNeighbor = initialPoints[neighborIndex];
            const wasHorizontal = Math.abs(origCurr.y - origNeighbor.y) < Math.abs(origCurr.x - origNeighbor.x);

            if (wasHorizontal) {
                newPoints[neighborIndex].y = newPoints[index].y;
            } else {
                newPoints[neighborIndex].x = newPoints[index].x;
            }
            onUpdate({ points: cleanupPoints(newPoints) });
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // ========================================================================
    // 5. ลากย้ายทั้งเส้น
    // ========================================================================
    const handleWholeDrag = (e) => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const initialPoints = points.map(p => ({ ...p }));

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            const newPoints = initialPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
            onUpdate({ points: newPoints, _isWholeDrag: true });
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // ========================================================================
    // 6. คำนวณมุมหัวลูกศร
    // ========================================================================
    if (points.length < 2) return null;

    const firstPt = points[0], secondPt = points[1];
    const lastPt = points[points.length - 1], prevPt = points[points.length - 2];
    const startAngle = Math.atan2(secondPt.y - firstPt.y, secondPt.x - firstPt.x);
    const endAngle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x);

    const renderHead = (type, px, py, angleRad, isStart) => {
        if (type === 'none') return null;
        const size = thickness * 4 + 6;
        if (type === 'circle') return <circle cx={px} cy={py} r={thickness * 2.5} fill="white" stroke={color} strokeWidth={thickness} />;
        if (type === 'arrow') {
            const dir = isStart ? angleRad + Math.PI : angleRad;
            const p1x = px - size * Math.cos(dir - Math.PI / 6), p1y = py - size * Math.sin(dir - Math.PI / 6);
            const p2x = px - size * Math.cos(dir + Math.PI / 6), p2y = py - size * Math.sin(dir + Math.PI / 6);
            return <polygon points={`${px},${py} ${p1x},${p1y} ${p2x},${p2y}`} fill={color} />;
        }
        return null;
    };

    return (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: isSelected ? 100 : 10 }}>
            <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                {/* Hitbox โปร่งใสสำหรับกดเลือกเส้น + ลากย้ายทั้งเส้น */}
                <path
                    d={pathD}
                    stroke="transparent"
                    strokeWidth={20}
                    fill="none"
                    style={{ pointerEvents: 'stroke', cursor: isSelected ? 'move' : 'pointer' }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelect(e);
                        if (isSelected) {
                            handleWholeDrag(e);
                        }
                    }}
                />

                {/* เส้นจริง */}
                <path d={pathD} stroke={color} strokeWidth={thickness} fill="none" style={{ pointerEvents: 'none' }} />

                {renderHead(headStart, firstPt.x, firstPt.y, startAngle, true)}
                {renderHead(headEnd, lastPt.x, lastPt.y, endAngle, false)}

                {/* แสดงจุดลากต่างๆ เมื่อเส้นถูกเลือก (Selected) */}
                {isSelected && (
                    <>
                        {/* จุดกลมหัว-ท้าย */}
                        <circle cx={firstPt.x} cy={firstPt.y} r={6} fill="white" stroke="#6c5ce7" strokeWidth={2} style={{ pointerEvents: 'auto', cursor: 'move' }} onMouseDown={handleEndpointDrag(true)} />
                        <circle cx={lastPt.x} cy={lastPt.y} r={6} fill="white" stroke="#6c5ce7" strokeWidth={2} style={{ pointerEvents: 'auto', cursor: 'move' }} onMouseDown={handleEndpointDrag(false)} />

                        {/* จุดมุม (Corner Handles) สำหรับจุดภายใน */}
                        {points.map((pt, i) => {
                            if (i === 0 || i === points.length - 1) return null; // ข้ามจุดหัว/ท้าย
                            return (
                                <circle
                                    key={`corner-${i}`}
                                    cx={pt.x} cy={pt.y} r={4}
                                    fill="#a4b0be" stroke="white" strokeWidth={1.5}
                                    style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
                                />
                            );
                        })}

                        {/* แคปซูลกลางเส้น (Segment Handles) */}
                        {points.map((pt, i) => {
                            if (i === points.length - 1) return null;
                            const nextPt = points[i + 1];
                            const segLen = Math.sqrt(Math.pow(nextPt.x - pt.x, 2) + Math.pow(nextPt.y - pt.y, 2));
                            // ซ่อน handle ถ้า segment สั้นเกินไป
                            if (segLen < 20) return null;

                            const midX = (pt.x + nextPt.x) / 2, midY = (pt.y + nextPt.y) / 2;
                            const isHorizontal = Math.abs(pt.y - nextPt.y) < Math.abs(pt.x - nextPt.x);

                            return (
                                <rect
                                    key={`cap-${i}`}
                                    x={midX - (isHorizontal ? 12 : 4)} y={midY - (isHorizontal ? 4 : 12)}
                                    width={isHorizontal ? 24 : 8} height={isHorizontal ? 8 : 24} rx={4}
                                    fill="white" stroke="#a4b0be" strokeWidth={1.5}
                                    style={{ cursor: isHorizontal ? 'row-resize' : 'col-resize', pointerEvents: 'auto' }}
                                    onMouseDown={handleSegmentDrag(i)}
                                />
                            );
                        })}
                    </>
                )}
            </svg>
        </div>
    );
}
