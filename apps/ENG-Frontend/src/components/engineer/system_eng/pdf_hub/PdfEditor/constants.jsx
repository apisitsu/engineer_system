import React from 'react';
import {
    EyeOutlined, HighlightOutlined, BorderOutlined,
    EditOutlined, FormOutlined, MergeCellsOutlined,
    FileImageOutlined, BgColorsOutlined
} from '@ant-design/icons';

export const ZOOM_OPTIONS = [
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.0, label: '100%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 2.0, label: '200%' },
    { value: 3.0, label: '300%' },
];

export const MODE_OPTIONS = [
    { value: 'view',     icon: <EyeOutlined />,         label: 'View' },
    { value: 'annotate', icon: <HighlightOutlined />,   label: 'Annotate' },
    { value: 'shapes',   icon: <BorderOutlined />,      label: 'Shapes' },
    { value: 'edit',     icon: <EditOutlined />,        label: 'Edit' },
    { value: 'sign',     icon: <FormOutlined />,        label: 'Fill & Sign' },
    { value: 'watermark',icon: <BgColorsOutlined />,    label: 'Watermark' },
    { value: 'merge',    icon: <MergeCellsOutlined />,  label: 'Merge' },
    { value: 'export',   icon: <FileImageOutlined />,   label: 'Export' },
];
