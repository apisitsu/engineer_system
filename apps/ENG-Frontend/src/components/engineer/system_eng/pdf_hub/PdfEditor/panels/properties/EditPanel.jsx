import React from 'react';
import { Select, InputNumber, ColorPicker } from 'antd';
import { useTheme } from '../../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../../stores/usePdfEditorStore';
import { SectionTitle, PropRow, COLOR_PRESETS } from './SharedProperties';

export default function EditPanel() {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-header">
                <h4 style={{ color: theme.colors.textPrimary }}>Text Properties</h4>
            </div>
            <div className="pdf-ws-right-body kb-vscroll">
                <div className="pdf-ws-prop-section">
                    <SectionTitle>Font</SectionTitle>
                    <PropRow label="Family">
                        <Select
                            value={store.fontFamily}
                            onChange={store.setFontFamily}
                            size="small" style={{ width: 120 }}
                            options={[
                                { value: 'Helvetica', label: 'Helvetica' },
                                { value: 'Times New Roman', label: 'Times' },
                                { value: 'Courier New', label: 'Courier' },
                                { value: 'Arial', label: 'Arial' },
                                { value: 'Georgia', label: 'Georgia' },
                            ]}
                        />
                    </PropRow>
                    <PropRow label="Size">
                        <InputNumber
                            min={6} max={72} value={store.fontSize}
                            onChange={store.setFontSize}
                            size="small" style={{ width: 60 }}
                        />
                    </PropRow>
                    <PropRow label="Color">
                        <ColorPicker
                            value={store.strokeColor}
                            onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                            size="small"
                            presets={COLOR_PRESETS}
                        />
                    </PropRow>
                </div>
            </div>
        </div>
    );
}
