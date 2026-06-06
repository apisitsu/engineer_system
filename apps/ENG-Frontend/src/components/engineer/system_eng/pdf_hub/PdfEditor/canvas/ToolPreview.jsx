import React, { forwardRef, useMemo } from 'react';
import { useAuthStore } from '../../../../../../stores/authStore';

const ToolPreview = forwardRef(({ tool, color, size, strokeWidth, stampData }, ref) => {
    const { userName } = useAuthStore();

    const previewContent = useMemo(() => {
        let content = null;
        let transform = 'translate(-50%, -50%)'; // default centered

        switch (tool) {
            case 'stampCheckmark':
                content = <div style={{ color, fontSize: size * 2.5, fontWeight: 'bold' }}>✓</div>;
                break;
            case 'stampCross':
                content = <div style={{ color, fontSize: size * 2.5, fontWeight: 'bold' }}>✕</div>;
                break;
            case 'stampCircle':
                content = <div style={{ border: `${strokeWidth || 3}px solid ${color}`, borderRadius: '50%', width: size * 2, height: size * 2 }}></div>;
                break;
            case 'stampOk':
                content = (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: size * 2.4, height: size * 2.4 }}>
                        <div style={{ position: 'absolute', border: `${strokeWidth || 3}px solid ${color}`, borderRadius: '50%', width: '100%', height: '100%' }}></div>
                        <div style={{ color, fontSize: size * 1.1, fontWeight: 'bold' }}>OK</div>
                    </div>
                );
                break;
            case 'date':
                transform = 'translate(0, 0)'; // Top-left alignment for date
                content = <div style={{ color: '#333', fontSize: 14, fontFamily: 'Helvetica' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>;
                break;
            case 'stampUserDate': {
                const stampColor = '#e74c3c';
                const d = new Date();
                const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                const dateVal = `${d.getDate().toString().padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
                const nameStr = `K. ${userName?.split(' ')[0]?.toUpperCase() || 'USER'}`;

                content = (
                    <svg width="96" height="96" viewBox="-48 -48 96 96" xmlns="http://www.w3.org/2000/svg" style={{ transform: `scale(${size / 16})` }}>
                        <circle cx="0" cy="0" r="46.5" fill="none" stroke={stampColor} strokeWidth="3" />
                        <line x1="-46" y1="-14" x2="46" y2="-14" stroke={stampColor} strokeWidth="2" />
                        <line x1="-46" y1="14" x2="46" y2="14" stroke={stampColor} strokeWidth="2" />
                        <text x="0" y="-24" fill={stampColor} fontSize="16" fontWeight="bold" fontFamily="Arial" textAnchor="middle">ROD ENG</text>
                        <text x="0" y="5" fill={stampColor} fontSize="14" fontWeight="bold" fontFamily="Arial" textAnchor="middle">{dateVal}</text>
                        <path id="nameCurve" d="M -34,0 A 34,34 0 0,0 34,0" fill="none" stroke="none" />
                        <text fill={stampColor} fontSize="12" fontWeight="bold" fontFamily="Arial">
                            <textPath href="#nameCurve" startOffset="50%" textAnchor="middle">{nameStr}</textPath>
                        </text>
                    </svg>
                );
                break;
            }
            case 'stamp':
                if (stampData?.stamp_image) {
                    content = <img src={`data:image/png;base64,${stampData.stamp_image}`} alt="stamp" style={{ transform: 'scale(0.5)', opacity: 0.8 }} />;
                }
                break;
            case 'signature':
                if (stampData?.signature_image) {
                    content = <img src={`data:image/png;base64,${stampData.signature_image}`} alt="signature" style={{ transform: 'scale(0.5)', opacity: 0.8 }} />;
                }
                break;
            default:
                break;
        }

        if (!content) return null;

        return (
            <div
                ref={ref}
                style={{
                    position: 'absolute',
                    display: 'none',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    opacity: 0.6,
                    transform,
                }}
            >
                {content}
            </div>
        );
    }, [tool, color, size, strokeWidth, stampData, userName, ref]);

    return previewContent;
});

export default ToolPreview;
