import React from 'react';
import { Button, Tooltip, Select, Divider } from 'antd';
import {
    HighlightOutlined, UnderlineOutlined, StrikethroughOutlined,
    MessageOutlined, BorderOutlined, RadiusSettingOutlined,
    ArrowRightOutlined, LineOutlined, EditOutlined,
    ColumnWidthOutlined, FontSizeOutlined, BlockOutlined,
    FormOutlined, SignatureOutlined, SafetyCertificateOutlined,
    CalendarOutlined, MergeCellsOutlined, FileImageOutlined,
    SelectOutlined, DragOutlined, ColumnHeightOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../stores/usePdfEditorStore';

/**
 * ModeToolbar — Context-sensitive tool strip that changes per activeMode.
 *
 * Rendered between the mode switcher and the canvas.
 */
const ModeToolbar = () => {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    const ToolBtn = ({ tool, icon, label, danger }) => {
        const isActive = store.activeTool === tool;
        return (
            <Tooltip title={label} placement="bottom">
                <Button
                    size="small"
                    icon={icon}
                    danger={danger}
                    className={isActive ? 'pdf-ws-tool-active' : ''}
                    onClick={() => store.setActiveTool(isActive ? 'select' : tool)}
                    style={{
                        borderRadius: 7,
                        ...(isActive ? {
                            background: `${theme.colors.primary}15`,
                            borderColor: theme.colors.primary,
                            color: theme.colors.primary,
                        } : {}),
                    }}
                />
            </Tooltip>
        );
    };

    const ToolDivider = () => <div className="pdf-ws-toolbar-divider" />;

    // ── Common Selection Tools ──
    const SelectionTools = () => (
        <div className="pdf-ws-toolbar-group">
            <ToolBtn tool="select" icon={<SelectOutlined />} label="Select (V)" />
            <ToolBtn tool="pan" icon={<DragOutlined />} label="Pan / Hand Tool" />
        </div>
    );

    // ══════════════════════════════════════════════════════════════════
    // Mode-specific toolbars
    // ══════════════════════════════════════════════════════════════════

    switch (store.activeMode) {
        case 'view':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <SelectionTools />
                </div>
            );

        case 'annotate':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <SelectionTools />
                    <ToolDivider />
                    <div className="pdf-ws-toolbar-group">
                        <ToolBtn tool="highlight" icon={<HighlightOutlined />} label="Highlight" />
                        <ToolBtn tool="underline" icon={<UnderlineOutlined />} label="Underline" />
                        <ToolBtn tool="strikethrough" icon={<StrikethroughOutlined />} label="Strikethrough" />
                        <ToolBtn tool="sticky" icon={<MessageOutlined />} label="Sticky Note" />
                    </div>
                </div>
            );

        case 'shapes':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <SelectionTools />
                    <ToolDivider />
                    <div className="pdf-ws-toolbar-group">
                        <ToolBtn tool="rect" icon={<BorderOutlined />} label="Rectangle" />
                        <ToolBtn tool="circle" icon={<RadiusSettingOutlined />} label="Circle / Ellipse" />
                        <ToolBtn tool="arrow" icon={<ArrowRightOutlined />} label="Arrow" />
                        <ToolBtn tool="line" icon={<LineOutlined />} label="Line" />
                        <ToolBtn tool="freehand" icon={<EditOutlined />} label="Freehand Draw" />
                    </div>
                    <ToolDivider />
                    <div className="pdf-ws-toolbar-group">
                        <ToolBtn tool="ruler" icon={<ColumnWidthOutlined />} label="Measurement Ruler" />
                    </div>
                </div>
            );

        case 'edit':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <SelectionTools />
                    <ToolDivider />
                    <div className="pdf-ws-toolbar-group">
                        <ToolBtn tool="addText" icon={<FontSizeOutlined />} label="Add Text" />
                        <ToolBtn tool="maskReplace" icon={<BlockOutlined />} label="Mask & Replace Text" />
                    </div>
                </div>
            );

        case 'sign':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <SelectionTools />
                    <ToolDivider />
                    <div className="pdf-ws-toolbar-group">
                        <ToolBtn tool="formFill" icon={<FormOutlined />} label="Fill Form Fields" />
                        <ToolBtn tool="signature" icon={<EditOutlined />} label="Add Signature" />
                        <ToolBtn tool="stamp" icon={<SafetyCertificateOutlined />} label="Add Stamp / Approve" />
                        <ToolBtn tool="date" icon={<CalendarOutlined />} label="Add Date" />
                    </div>
                </div>
            );

        case 'merge':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <div className="pdf-ws-toolbar-group">
                        <MergeCellsOutlined style={{ fontSize: 16, color: theme.colors.primary, marginRight: 8 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>
                            Merge PDFs
                        </span>
                        <span style={{ fontSize: 11, color: theme.colors.textSecondary, marginLeft: 8 }}>
                            Add files in the left panel, drag to reorder, then merge
                        </span>
                    </div>
                </div>
            );

        case 'export':
            return (
                <div className="pdf-ws-toolbar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <div className="pdf-ws-toolbar-group">
                        <FileImageOutlined style={{ fontSize: 16, color: theme.colors.primary, marginRight: 8 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>
                            Export to Images
                        </span>
                        <span style={{ fontSize: 11, color: theme.colors.textSecondary, marginLeft: 8 }}>
                            Select pages in the left panel, configure options on the right
                        </span>
                    </div>
                </div>
            );

        default:
            return null;
    }
};

export default ModeToolbar;
