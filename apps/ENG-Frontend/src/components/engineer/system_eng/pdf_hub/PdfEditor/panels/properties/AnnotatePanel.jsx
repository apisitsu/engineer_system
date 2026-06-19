import React from 'react';
import { Space, ColorPicker, Slider } from 'antd';
import { useTheme } from '../../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../../stores/usePdfEditorStore';
import { SectionTitle, COLOR_PRESETS } from './SharedProperties';

export default function AnnotatePanel() {
    const { theme } = useTheme();
    const store = usePdfEditorStore();
    const currentSettings = store.toolSettings[store.activeTool] || store.toolSettings.default;

    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-header">
                <h4 style={{ color: theme.colors.textPrimary }}>Annotation Properties</h4>
            </div>
            <div className="pdf-ws-right-body kb-vscroll">
                {(!store.selectedObjectId && ['select', 'pan'].includes(store.activeTool)) ? (
                    <div style={{ padding: '24px 16px', color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
                        Select an annotation on the canvas to edit its properties, or select an annotation tool to set its default style.
                    </div>
                ) : (
                    <>
                        <div className="pdf-ws-prop-section">
                            <SectionTitle>Highlight Color</SectionTitle>
                            <Space wrap>
                                {['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0'].map(c => (
                                    <div
                                        key={c}
                                        onClick={() => store.setHighlightColor(c)}
                                        style={{
                                            width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                                            background: c,
                                            border: currentSettings.highlightColor === c
                                                ? `2px solid ${theme.colors.textPrimary}`
                                                : '2px solid transparent',
                                            boxShadow: currentSettings.highlightColor === c ? '0 0 0 2px #fff inset' : 'none'
                                        }}
                                    />
                                ))}
                            </Space>
                        </div>

                        <div className="pdf-ws-prop-section">
                            <SectionTitle>Stroke Color</SectionTitle>
                            <ColorPicker
                                value={currentSettings.strokeColor}
                                onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                                size="small"
                                presets={COLOR_PRESETS}
                            />
                        </div>

                        <div className="pdf-ws-prop-section">
                            <SectionTitle>Opacity</SectionTitle>
                            <Slider
                                min={0.1} max={1} step={0.05}
                                value={currentSettings.opacity}
                                onChange={store.setOpacity}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
