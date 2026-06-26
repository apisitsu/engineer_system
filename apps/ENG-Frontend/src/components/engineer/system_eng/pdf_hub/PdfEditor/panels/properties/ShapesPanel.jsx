import React, { useState, useEffect } from 'react';
import { ColorPicker, InputNumber, Divider, Select, Slider, Switch, Input } from 'antd';
import { useTheme } from '../../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../../stores/usePdfEditorStore';
import { SectionTitle, PropRow, COLOR_PRESETS } from './SharedProperties';

export default function ShapesPanel({ fabricCanvasRefs, currentPage }) {
    const { theme } = useTheme();
    const store = usePdfEditorStore();
    const currentSettings = store.toolSettings[store.activeTool] || store.toolSettings.default;

    const isTextSelected = store.selectedObjectProps?.type === 'i-text' || store.selectedObjectProps?.type === 'textbox' || store.selectedObjectProps?.type === 'text';
    const isTextMode = store.activeTool === 'addText' || isTextSelected;

    const [textContent, setTextContent] = useState('');

    useEffect(() => {
        if (isTextSelected && store.selectedObjectProps?.text !== undefined) {
            setTextContent(store.selectedObjectProps.text);
        }
    }, [isTextSelected, store.selectedObjectProps?.text, store.selectedObjectId]);

    const handleTextChange = (e) => {
        const val = e.target.value;
        setTextContent(val);
        store.updateSelectedTextContent(val, fabricCanvasRefs, currentPage);
    };

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
                                    background: store.currentDwgRole === 'drawer' ? '#3498db' : 'transparent',
                                    color: store.currentDwgRole === 'drawer' ? '#fff' : '#3498db',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                                }}
                                onClick={() => { store.setDwgRoleColor('drawer', '#3498db'); store.setFillColor('transparent'); }}
                            >
                                Drawer
                            </button>
                            <button
                                style={{
                                    flex: 1, padding: '6px 0', border: '1px solid #e74c3c', borderRadius: 4,
                                    background: store.currentDwgRole === 'checker' ? '#e74c3c' : 'transparent',
                                    color: store.currentDwgRole === 'checker' ? '#fff' : '#e74c3c',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                                }}
                                onClick={() => { store.setDwgRoleColor('checker', '#e74c3c'); store.setFillColor('transparent'); }}
                            >
                                Checker
                            </button>
                            <button
                                style={{
                                    flex: 1, padding: '6px 0', border: '1px solid #000000', borderRadius: 4,
                                    background: store.currentDwgRole === 'approver' ? '#000000' : 'transparent',
                                    color: store.currentDwgRole === 'approver' ? '#fff' : '#000000',
                                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                                }}
                                onClick={() => { store.setDwgRoleColor('approver', '#000000'); store.setFillColor('transparent'); }}
                            >
                                Approver
                            </button>
                        </div>
                    </div>
                )}

                {(!store.selectedObjectId && ['select', 'pan'].includes(store.activeTool)) ? (
                    <div style={{ padding: '24px 16px', color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 }}>
                        Select an object on the canvas to edit its properties, or select a drawing tool to set its default style.
                    </div>
                ) : (
                    <>
                        {isTextMode ? (
                            <div className="pdf-ws-prop-section">
                                <SectionTitle>Text Properties</SectionTitle>
                                {isTextSelected && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, marginBottom: 4, color: theme.colors.textSecondary }}>Edit Text Content</div>
                                        <Input.TextArea 
                                            value={textContent}
                                            onChange={handleTextChange}
                                            autoSize={{ minRows: 2, maxRows: 6 }}
                                        />
                                    </div>
                                )}
                                <PropRow label="Text Color">
                                    <ColorPicker
                                        value={currentSettings.strokeColor === 'transparent' ? null : currentSettings.strokeColor}
                                        onChangeComplete={(color) => store.setStrokeColor(color ? color.toHexString() : 'transparent')}
                                        size="small"
                                        allowClear
                                        presets={COLOR_PRESETS}
                                    />
                                </PropRow>
                                <PropRow label="Font Size">
                                    <InputNumber
                                        min={8} max={120} value={currentSettings.fontSize}
                                        onChange={store.setFontSize}
                                        size="small" style={{ width: 60 }}
                                    />
                                </PropRow>
                                <PropRow label="Font Family">
                                    <Select
                                        value={currentSettings.fontFamily || 'Helvetica'}
                                        onChange={store.setFontFamily}
                                        size="small" style={{ width: 100 }}
                                        options={[
                                            { value: 'Helvetica', label: 'Helvetica' },
                                            { value: 'Arial', label: 'Arial' },
                                            { value: 'Times New Roman', label: 'Times' },
                                            { value: 'Courier', label: 'Courier' },
                                        ]}
                                    />
                                </PropRow>
                            </div>
                        ) : (
                            <>
                                <div className="pdf-ws-prop-section">
                                    <SectionTitle>Stroke</SectionTitle>
                                    <PropRow label="Color">
                                        <ColorPicker
                                            value={currentSettings.strokeColor === 'transparent' ? null : currentSettings.strokeColor}
                                            onChangeComplete={(color) => store.setStrokeColor(color ? color.toHexString() : 'transparent')}
                                            size="small"
                                            allowClear
                                            presets={COLOR_PRESETS}
                                        />
                                    </PropRow>
                                    <PropRow label="Width">
                                        <InputNumber
                                            min={1} max={20} value={currentSettings.strokeWidth}
                                            onChange={store.setStrokeWidth}
                                            size="small" style={{ width: 60 }}
                                        />
                                    </PropRow>
                                    <PropRow label="Symbol Size">
                                        <InputNumber
                                            min={8} max={72} value={currentSettings.fontSize}
                                            onChange={store.setFontSize}
                                            size="small" style={{ width: 60 }}
                                        />
                                    </PropRow>
                                </div>

                                <div className="pdf-ws-prop-section">
                                    <SectionTitle>Fill</SectionTitle>
                                    <PropRow label="Color">
                                        <ColorPicker
                                            value={currentSettings.fillColor === 'transparent' ? null : currentSettings.fillColor}
                                            onChangeComplete={(color) => store.setFillColor(color ? color.toHexString() : 'transparent')}
                                            size="small"
                                            allowClear
                                            presets={COLOR_PRESETS}
                                        />
                                    </PropRow>
                                </div>
                            </>
                        )}

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

                <Divider style={{ margin: '12px 0' }} />

                <div className="pdf-ws-prop-section">
                    <SectionTitle>📏 Ruler Settings</SectionTitle>
                    <PropRow label="Scale">
                        <InputNumber
                            min={0.1} max={100} step={0.1}
                            value={store.rulerScale}
                            onChange={store.setRulerScale}
                            size="small" style={{ width: 110 }}
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
                    <Divider style={{ margin: '8px 0', borderColor: 'transparent' }} />
                    <SectionTitle>Physical Ruler (Overlay)</SectionTitle>
                    <PropRow label="Show Overlay">
                        <Switch
                            size="small"
                            checked={store.physicalRulerVisible}
                            onChange={store.setPhysicalRulerVisible}
                        />
                    </PropRow>
                    <PropRow label="Paper Size">
                        <Select
                            value={store.paperSize}
                            onChange={store.setPaperSize}
                            size="small"
                            style={{ width: 90 }}
                            options={[
                                { value: 'A4', label: 'A4' },
                                { value: 'A3', label: 'A3' },
                                { value: 'A2', label: 'A2' },
                                { value: 'A1', label: 'A1' },
                                { value: 'A0', label: 'A0' },
                            ]}
                        />
                    </PropRow>
                </div>
            </div>
        </div>
    );
}
