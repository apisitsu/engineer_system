import React from 'react';
import { Space, ColorPicker, Slider } from 'antd';
import { useTheme } from '../../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../../stores/usePdfEditorStore';
import { SectionTitle, COLOR_PRESETS } from './SharedProperties';

export default function AnnotatePanel() {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-header">
                <h4 style={{ color: theme.colors.textPrimary }}>Annotation Properties</h4>
            </div>
            <div className="pdf-ws-right-body kb-vscroll">
                <div className="pdf-ws-prop-section">
                    <SectionTitle>Highlight Color</SectionTitle>
                    <Space wrap>
                        {['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0'].map(c => (
                            <div
                                key={c}
                                onClick={() => store.setHighlightColor(c)}
                                style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: c, cursor: 'pointer',
                                    border: store.highlightColor === c
                                        ? `3px solid ${theme.colors.primary}`
                                        : '2px solid #e0e0e0',
                                    transition: 'all 0.15s',
                                }}
                            />
                        ))}
                    </Space>
                </div>

                <div className="pdf-ws-prop-section">
                    <SectionTitle>Stroke Color</SectionTitle>
                    <ColorPicker
                        value={store.strokeColor}
                        onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                        size="small"
                        presets={COLOR_PRESETS}
                    />
                </div>

                <div className="pdf-ws-prop-section">
                    <SectionTitle>Opacity</SectionTitle>
                    <Slider
                        min={0.1} max={1} step={0.05}
                        value={store.opacity}
                        onChange={store.setOpacity}
                    />
                </div>
            </div>
        </div>
    );
}
