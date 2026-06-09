import { 
    EditOutlined, BorderOutlined, FontSizeOutlined,
    HighlightOutlined, LineOutlined, PushpinOutlined,
    FormatPainterOutlined, CloseCircleOutlined, PicCenterOutlined
} from '@ant-design/icons';
import React from 'react';

export const MODE_OPTIONS = [
    { value: 'select', icon: <EditOutlined />, tooltip: 'Select (V)' },
    { value: 'highlight', icon: <HighlightOutlined />, tooltip: 'Highlight (H)' },
    { value: 'rect', icon: <BorderOutlined />, tooltip: 'Rectangle (R)' },
    { value: 'circle', icon: <svg width="1em" height="1em" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /></svg>, tooltip: 'Circle (C)' },
    { value: 'text', icon: <FontSizeOutlined />, tooltip: 'Text (T)' },
    { value: 'freehand', icon: <EditOutlined />, tooltip: 'Freehand Draw (F)' },
    { value: 'line', icon: <LineOutlined />, tooltip: 'Line (L)' },
    { value: 'image', icon: <PicCenterOutlined />, tooltip: 'Image (I)' },
    { value: 'watermark', icon: <FormatPainterOutlined />, tooltip: 'Watermark' },
    { value: 'stamp', icon: <PushpinOutlined />, tooltip: 'Sign & Stamp' },
    { value: 'censor', icon: <CloseCircleOutlined />, tooltip: 'Redact/Censor' }
];
