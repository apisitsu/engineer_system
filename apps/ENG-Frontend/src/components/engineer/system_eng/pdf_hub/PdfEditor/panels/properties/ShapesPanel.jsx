import React from 'react';
import { ColorPicker, InputNumber, Divider, Select, Slider } from 'antd';
import { useTheme } from '../../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../../stores/usePdfEditorStore';
import { SectionTitle, PropRow, COLOR_PRESETS } from './SharedProperties';

export default function ShapesPanel() {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-header">
                <h4 style={{ color: theme.colors.textPrimary }}>
                    {store.activeMode === 'dwgCheck' ? 'DWG Check Properties' : 'Shape Properties'}
                </h4>
            </div>
            <div className="pdf-ws-right-body kb-vscroll">
                {store.activeMode === 'dwgCheck' && (
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Role Preset</SectionTitle>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                style={{
                                    flex: 1, padding: '6px 0', border: '1px solid #3498db', borderRadius: 4,
                                    background: store.strokeColor === '#3498db' ? '#3498db' : 'transparent',
                                    color: store.strokeColor === '#3498db' ? '#fff' : '#3498db',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                                }}
                                onClick={() => { store.setStrokeColor('#3498db'); store.setFillColor('transparent'); }}
                            >
                                Drawer
                            </button>
                            <button
                                style={{
                                    flex: 1, padding: '6px 0', border: '1px solid #e74c3c', borderRadius: 4,
                                    background: store.strokeColor === '#e74c3c' ? '#e74c3c' : 'transparent',
                                    color: store.strokeColor === '#e74c3c' ? '#fff' : '#e74c3c',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                                }}
                                onClick={() => { store.setStrokeColor('#e74c3c'); store.setFillColor('transparent'); }}
                            >
                                Checker
                            </button>
                            <button
                                style={{
                                    flex: 1, padding: '6px 0', border: '1px solid #000000', borderRadius: 4,
                                    background: store.strokeColor === '#000000' ? '#000000' : 'transparent',
                                    color: store.strokeColor === '#000000' ? '#fff' : '#000000',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                                }}
                                onClick={() => { store.setStrokeColor('#000000'); store.setFillColor('transparent'); }}
                            >
                                Approver
                            </button>
                        </div>
                    </div>
                )}
                <div className="pdf-ws-prop-section">
                    <SectionTitle>Stroke</SectionTitle>
                    <PropRow label="Color">
                        <ColorPicker
                            value={store.strokeColor}
                            onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                            size="small"
                            presets={COLOR_PRESETS}
                        />
                    </PropRow>
                    <PropRow label="Width">
                        <InputNumber
                            min={1} max={20} value={store.strokeWidth}
                            onChange={store.setStrokeWidth}
                            size="small" style={{ width: 60 }}
                        />
                    </PropRow>
                    <PropRow label="Symbol Size">
                        <InputNumber
                            min={8} max={72} value={store.fontSize}
                            onChange={store.setFontSize}
                            size="small" style={{ width: 60 }}
                        />
                    </PropRow>
                </div>

                <div className="pdf-ws-prop-section">
                    <SectionTitle>Fill</SectionTitle>
                    <PropRow label="Color">
                        <ColorPicker
                            value={store.fillColor === 'transparent' ? '#ffffff00' : store.fillColor}
                            onChangeComplete={(color) => store.setFillColor(color.toHexString())}
                            size="small"
                            allowClear
                            presets={COLOR_PRESETS}
                        />
                    </PropRow>
                </div>

                <div className="pdf-ws-prop-section">
                    <SectionTitle>Opacity</SectionTitle>
                    <Slider
                        min={0.1} max={1} step={0.05}
                        value={store.opacity}
                        onChange={store.setOpacity}
                    />
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div className="pdf-ws-prop-section">
                    <SectionTitle>📏 Ruler Settings</SectionTitle>
                    <PropRow label="Scale">
                        <InputNumber
                            min={0.1} max={100} step={0.1}
                            value={store.rulerScale}
                            onChange={store.setRulerScale}
                            size="small" style={{ width: 70 }}
                            addonAfter="px/mm"
                        />
                    </PropRow>
                    <PropRow label="Unit">
                        <Select
                            value={store.rulerUnit}
                            onChange={store.setRulerUnit}
                            size="small"
                            style={{ width: 70 }}
                            options={[
                                { value: 'mm', label: 'mm' },
                                { value: 'cm', label: 'cm' },
                                { value: 'in', label: 'in' },
                            ]}
                        />
                    </PropRow>
                </div>
            </div>
        </div>
    );
}
