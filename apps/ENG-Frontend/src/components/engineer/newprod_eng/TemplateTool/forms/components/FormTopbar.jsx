import React from 'react';
import { Select, Button, Tag, Tooltip } from 'antd';
import { 
    PlusOutlined, 
    CheckCircleOutlined, 
    ArrowLeftOutlined, 
    PrinterOutlined,
    AlignLeftOutlined,
    AlignCenterOutlined,
    AlignRightOutlined
} from '@ant-design/icons';

/**
 * FormTopbar — Shared sticky topbar for all Template Tool form editors.
 *
 * Props:
 *   title          — form title string (e.g. "Process Flow Diagram")
 *   status         — 'In Progress' | 'Approved'
 *   isApproved     — boolean
 *   zoom           — current zoom string value
 *   onZoomChange   — (value: string) => void
 *   onBack         — () => void (optional, shows back button if provided)
 *   onAddRow       — () => void (optional, shows Add Row button if provided)
 *   onApprove      — () => void (optional, shows Approve button if provided)
 *   onPrint        — () => void
 *   zoomOptions    — array of { value, label } (optional, defaults to standard set)
 *   extraButtons   — ReactNode for additional buttons (e.g., PFMEA "Evaluate RPN")
 *   cssPrefix      — CSS class prefix (e.g., 'pfd', 'cp') for topbar styling
 */
const ZOOM_DEFAULTS = [
    { value: '0.25', label: '25%' },
    { value: '0.30', label: '30%' },
    { value: '0.40', label: '40%' },
    { value: '0.50', label: '50%' },
    { value: '0.60', label: '60%' },
    { value: '0.75', label: '75%' },
    { value: '0.90', label: '90%' },
    { value: '1', label: '100%' },
    { value: '1.10', label: '110%' },
    { value: '1.25', label: '125%' },
    { value: '1.50', label: '150%' },
    { value: '1.75', label: '175%' },
    { value: '2', label: '200%' },
    { value: '2.50', label: '250%' },
    { value: '3', label: '300%' },
];

export default function FormTopbar({
    title,
    status,
    isApproved,
    zoom,
    onZoomChange,
    onBack,
    onAddRow,
    onApprove,
    onPrint,
    zoomOptions = ZOOM_DEFAULTS,
    extraButtons = null,
    cssPrefix = 'pfd',
}) {
    return (
        <div className={`${cssPrefix}-topbar`}>
            {/* Left: Back + Title + Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {onBack && (
                    <Button
                        icon={<ArrowLeftOutlined />}
                        type="text"
                        style={{ color: '#fff' }}
                        onClick={onBack}
                    />
                )}
                <span className={`${cssPrefix}-topbar-title`}>{title}</span>
                <Tag color={isApproved ? 'green' : 'blue'}>{status}</Tag>
            </div>

            {/* Middle: Rich Text Format Toolbar */}
            {!isApproved && (
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                    <Button type="text" size="small" style={{ color: '#fff' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false, null); }}><b style={{fontFamily:'serif'}}>B</b></Button>
                    <Button type="text" size="small" style={{ color: '#fff' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false, null); }}><i style={{fontFamily:'serif'}}>I</i></Button>
                    <Button type="text" size="small" style={{ color: '#fff' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false, null); }}><u style={{fontFamily:'serif'}}>U</u></Button>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />
                    <Button type="text" size="small" style={{ color: '#fff' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyLeft', false, null); }}><AlignLeftOutlined /></Button>
                    <Button type="text" size="small" style={{ color: '#fff' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyCenter', false, null); }}><AlignCenterOutlined /></Button>
                    <Button type="text" size="small" style={{ color: '#fff' }} onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyRight', false, null); }}><AlignRightOutlined /></Button>
                </div>
            )}

            {/* Right: Zoom + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Zoom:</span>
                <Select
                    value={zoom}
                    onChange={onZoomChange}
                    style={{ width: 80 }}
                    size="small"
                    options={zoomOptions}
                />
                {extraButtons}
                {!isApproved && onAddRow && (
                    <Button icon={<PlusOutlined />} type="primary" size="small" onClick={onAddRow}>
                        Add Row
                    </Button>
                )}
                {!isApproved && onApprove && (
                    <Button
                        icon={<CheckCircleOutlined />}
                        size="small"
                        style={{ background: '#faad14', color: '#fff', border: 'none' }}
                        onClick={onApprove}
                    >
                        Approve
                    </Button>
                )}
                <Button
                    icon={<PrinterOutlined />}
                    size="small"
                    style={{ background: '#52c41a', color: '#fff', border: 'none' }}
                    onClick={onPrint || (() => window.print())}
                >
                    Export PDF
                </Button>
            </div>
        </div>
    );
}
