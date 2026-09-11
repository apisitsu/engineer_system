import React from 'react';
import {
    FileUnknownOutlined,
    SwapOutlined,
    ScissorOutlined,
    ExperimentOutlined,
    HighlightOutlined,
    ToolOutlined,
    PlusCircleOutlined,
    MinusCircleOutlined,
    EditOutlined,
    SafetyCertificateOutlined,
    CloseCircleOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';

// Map icon name strings → actual React elements
export const ICON_MAP = {
    FileUnknownOutlined: <FileUnknownOutlined />,
    SwapOutlined: <SwapOutlined />,
    ScissorOutlined: <ScissorOutlined />,
    ExperimentOutlined: <ExperimentOutlined />,
    HighlightOutlined: <HighlightOutlined />,
    ToolOutlined: <ToolOutlined />,
    PlusCircleOutlined: <PlusCircleOutlined />,
    MinusCircleOutlined: <MinusCircleOutlined />,
    EditOutlined: <EditOutlined />,
    SafetyCertificateOutlined: <SafetyCertificateOutlined />,
    CloseCircleOutlined: <CloseCircleOutlined />,
    ThunderboltOutlined: <ThunderboltOutlined />,
};

export const getTemplateIcon = (name, defaultIcon = <ThunderboltOutlined />) => {
    return ICON_MAP[name] || defaultIcon;
};
