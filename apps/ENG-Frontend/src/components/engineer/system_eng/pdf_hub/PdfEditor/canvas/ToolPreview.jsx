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
                const baseScale = (size / 16) * 0.75;
                content = (
                    <div style={{ 
                        border: `3px solid ${color}`, borderRadius: '50%', 
                        width: 96, height: 96, 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color, fontWeight: 'bold', fontFamily: 'Arial',
                        transform: `scale(${baseScale})`,
                        transformOrigin: 'center center'
                    }}>
                        <div style={{ borderBottom: `2px solid ${color}`, width: '100%', textAlign: 'center', fontSize: 12 }}>ROD ENG</div>
                        <div style={{ borderBottom: `2px solid ${color}`, width: '100%', textAlign: 'center', fontSize: 10 }}>{userName?.split(' ')[0]?.toUpperCase() || 'USER'}</div>
                        <div style={{ width: '100%', textAlign: 'center', fontSize: 11 }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                    </div>
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
