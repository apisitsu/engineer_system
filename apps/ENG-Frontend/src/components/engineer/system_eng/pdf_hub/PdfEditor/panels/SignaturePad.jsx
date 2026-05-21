import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Modal, Segmented, Button, Input, Select, Space, ColorPicker, message } from 'antd';
import { EditOutlined, FontSizeOutlined, UploadOutlined, ClearOutlined, CheckOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';

const FONT_OPTIONS = [
    { value: 'Dancing Script', label: 'Dancing Script' },
    { value: 'Great Vibes', label: 'Great Vibes' },
    { value: 'Pacifico', label: 'Pacifico' },
    { value: 'Caveat', label: 'Caveat' },
    { value: 'Sacramento', label: 'Sacramento' },
    { value: 'Satisfy', label: 'Satisfy' },
];

/**
 * SignaturePad — Modal for creating a signature via Draw, Type, or Upload.
 *
 * Returns a data-URL image of the signature via onComplete callback.
 */
const SignaturePad = ({ open, onClose, onComplete }) => {
    const { theme } = useTheme();
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    const [mode, setMode] = useState('draw');      // draw | type | upload
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Draw settings
    const [penColor, setPenColor] = useState('#1a1a2e');
    const [penWidth, setPenWidth] = useState(2.5);

    // Type settings
    const [typedName, setTypedName] = useState('');
    const [signatureFont, setSignatureFont] = useState('Dancing Script');

    // Upload settings
    const [uploadedImage, setUploadedImage] = useState(null);

    // ── Load Google Font for typing mode ──
    useEffect(() => {
        if (mode === 'type' && signatureFont) {
            const link = document.createElement('link');
            link.href = `https://fonts.googleapis.com/css2?family=${signatureFont.replace(/ /g, '+')}&display=swap`;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
    }, [mode, signatureFont]);

    // ── Canvas Initialization ──
    useEffect(() => {
        if (!open || mode !== 'draw') return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;

        ctxRef.current = ctx;
    }, [open, mode, penColor, penWidth]);

    // ── Drawing handlers ──
    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = useCallback((e) => {
        e.preventDefault();
        const ctx = ctxRef.current;
        if (!ctx) return;
        setIsDrawing(true);
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }, []);

    const draw = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const ctx = ctxRef.current;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setHasDrawn(true);
    }, [isDrawing]);

    const endDraw = useCallback(() => {
        setIsDrawing(false);
    }, []);

    // ── Clear canvas ──
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
        }
    };

    // ── Get signature from current mode ──
    const getSignatureDataUrl = () => {
        switch (mode) {
            case 'draw': {
                if (!hasDrawn) {
                    message.warning('Please draw your signature first.');
                    return null;
                }
                const canvas = canvasRef.current;
                // Trim empty space
                return trimCanvas(canvas);
            }
            case 'type': {
                if (!typedName.trim()) {
                    message.warning('Please type your name.');
                    return null;
                }
                return renderTypedSignature(typedName, signatureFont, penColor);
            }
            case 'upload': {
                if (!uploadedImage) {
                    message.warning('Please upload an image.');
                    return null;
                }
                return uploadedImage;
            }
            default:
                return null;
        }
    };

    const handleConfirm = () => {
        const dataUrl = getSignatureDataUrl();
        if (dataUrl) {
            onComplete(dataUrl);
            handleClose();
        }
    };

    const handleClose = () => {
        setHasDrawn(false);
        setTypedName('');
        setUploadedImage(null);
        onClose();
    };

    // ── File upload ──
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            message.error('Please upload an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setUploadedImage(reader.result);
        reader.readAsDataURL(file);
    };

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            title={null}
            footer={null}
            width={560}
            centered
            destroyOnClose
            styles={{
                body: { padding: 0 },
                mask: { backdropFilter: 'blur(4px)' },
            }}
        >
            <div style={{ padding: '24px 24px 16px' }}>
                {/* Header */}
                <h3 style={{
                    margin: '0 0 16px', fontSize: 18, fontWeight: 700,
                    color: theme.colors.textPrimary,
                }}>
                    Create Signature
                </h3>

                {/* Mode Switcher */}
                <Segmented
                    block
                    value={mode}
                    onChange={(val) => { setMode(val); setHasDrawn(false); }}
                    options={[
                        { value: 'draw', label: <span><EditOutlined /> Draw</span> },
                        { value: 'type', label: <span><FontSizeOutlined /> Type</span> },
                        { value: 'upload', label: <span><UploadOutlined /> Upload</span> },
                    ]}
                    style={{ marginBottom: 16 }}
                />

                {/* ── Draw Mode ── */}
                {mode === 'draw' && (
                    <div>
                        <div style={{
                            position: 'relative',
                            background: '#fff',
                            border: `2px dashed ${theme.colors.border}`,
                            borderRadius: 12,
                            overflow: 'hidden',
                            marginBottom: 12,
                        }}>
                            <canvas
                                ref={canvasRef}
                                style={{
                                    width: '100%', height: 180,
                                    cursor: 'crosshair', display: 'block',
                                    touchAction: 'none',
                                }}
                                onMouseDown={startDraw}
                                onMouseMove={draw}
                                onMouseUp={endDraw}
                                onMouseLeave={endDraw}
                                onTouchStart={startDraw}
                                onTouchMove={draw}
                                onTouchEnd={endDraw}
                            />
                            {/* Baseline guide */}
                            <div style={{
                                position: 'absolute', bottom: '30%',
                                left: 24, right: 24, height: 1,
                                borderBottom: '1px dashed #ccc', pointerEvents: 'none',
                            }} />
                            {!hasDrawn && (
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    color: '#bbb', fontSize: 14, pointerEvents: 'none',
                                }}>
                                    Sign here...
                                </div>
                            )}
                        </div>
                        <Space size={8}>
                            <ColorPicker
                                value={penColor}
                                onChange={(_, hex) => setPenColor(hex)}
                                size="small"
                                presets={[{ label: 'Ink', colors: ['#1a1a2e', '#0066cc', '#cc0000', '#006600'] }]}
                            />
                            <Button size="small" icon={<ClearOutlined />} onClick={clearCanvas}>
                                Clear
                            </Button>
                        </Space>
                    </div>
                )}

                {/* ── Type Mode ── */}
                {mode === 'type' && (
                    <div>
                        <div style={{
                            background: '#fff', padding: '32px 24px',
                            border: `2px dashed ${theme.colors.border}`,
                            borderRadius: 12, textAlign: 'center',
                            marginBottom: 12, minHeight: 180,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <div style={{
                                fontFamily: `'${signatureFont}', cursive`,
                                fontSize: 42,
                                color: penColor,
                                whiteSpace: 'nowrap',
                                opacity: typedName ? 1 : 0.25,
                            }}>
                                {typedName || 'Your Name'}
                            </div>
                        </div>
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                            <Input
                                placeholder="Type your name..."
                                value={typedName}
                                onChange={(e) => setTypedName(e.target.value)}
                                size="large"
                                style={{ borderRadius: 10 }}
                            />
                            <Space>
                                <Select
                                    value={signatureFont}
                                    onChange={setSignatureFont}
                                    options={FONT_OPTIONS}
                                    style={{ width: 180 }}
                                    size="small"
                                />
                                <ColorPicker
                                    value={penColor}
                                    onChange={(_, hex) => setPenColor(hex)}
                                    size="small"
                                    presets={[{ label: 'Ink', colors: ['#1a1a2e', '#0066cc', '#cc0000', '#006600'] }]}
                                />
                            </Space>
                        </Space>
                    </div>
                )}

                {/* ── Upload Mode ── */}
                {mode === 'upload' && (
                    <div>
                        <div style={{
                            background: '#fff', padding: 24,
                            border: `2px dashed ${theme.colors.border}`,
                            borderRadius: 12, textAlign: 'center',
                            marginBottom: 12, minHeight: 180,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexDirection: 'column', gap: 12,
                        }}>
                            {uploadedImage ? (
                                <img
                                    src={uploadedImage}
                                    alt="Signature"
                                    style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ color: '#bbb' }}>
                                    <UploadOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                                    Upload a PNG or JPG of your signature
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="sig-upload-input"
                        />
                        <Button
                            icon={<UploadOutlined />}
                            onClick={() => document.getElementById('sig-upload-input').click()}
                            block
                            style={{ borderRadius: 10 }}
                        >
                            {uploadedImage ? 'Change Image' : 'Choose File'}
                        </Button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: '12px 24px 20px',
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                borderTop: `1px solid ${theme.colors.border}`,
            }}>
                <Button onClick={handleClose} style={{ borderRadius: 8 }}>
                    Cancel
                </Button>
                <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleConfirm}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                >
                    Use This Signature
                </Button>
            </div>
        </Modal>
    );
};

// ══════════════════════════════════════════════════════════════════════
// Helper: Trim transparent pixels from canvas
// ══════════════════════════════════════════════════════════════════════
function trimCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imgData;
    let top = height, bottom = 0, left = width, right = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 10) {
                if (y < top) top = y;
                if (y > bottom) bottom = y;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
    }

    if (bottom <= top || right <= left) return canvas.toDataURL('image/png');

    const pad = 10;
    top = Math.max(0, top - pad);
    left = Math.max(0, left - pad);
    bottom = Math.min(height - 1, bottom + pad);
    right = Math.min(width - 1, right + pad);

    const trimW = right - left + 1;
    const trimH = bottom - top + 1;

    const trimmed = document.createElement('canvas');
    trimmed.width = trimW;
    trimmed.height = trimH;
    const tCtx = trimmed.getContext('2d');
    tCtx.drawImage(canvas, left, top, trimW, trimH, 0, 0, trimW, trimH);

    return trimmed.toDataURL('image/png');
}

// ══════════════════════════════════════════════════════════════════════
// Helper: Render typed text to canvas and return data URL
// ══════════════════════════════════════════════════════════════════════
function renderTypedSignature(text, fontFamily, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 56;

    ctx.font = `${fontSize}px '${fontFamily}', cursive`;
    const metrics = ctx.measureText(text);
    const width = metrics.width + 40;
    const height = fontSize * 1.6;

    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    ctx.font = `${fontSize}px '${fontFamily}', cursive`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 20, height / 2);

    return canvas.toDataURL('image/png');
}

export default SignaturePad;
