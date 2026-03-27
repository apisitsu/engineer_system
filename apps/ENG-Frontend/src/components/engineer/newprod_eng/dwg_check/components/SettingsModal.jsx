import React, { useEffect } from 'react';
import { usePdf } from '../context/PdfContext';
import { useAuthStore } from '../../../../../stores/authStore';

function formatUserName(fullName) {
    if (!fullName) return 'Reviewer';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName;
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${lastName.charAt(0).toUpperCase()}.${firstName.toUpperCase()}`;
}

export default function SettingsModal() {
    const { state, dispatch } = usePdf();
    const { userName: authUserName } = useAuthStore();
    const { isSettingsOpen, defaultFontSize, defaultStampSize, defaultLineThickness, defaultUserName, defaultDepartment } = state;



    if (!isSettingsOpen) return null;

    const handleClose = () => {
        dispatch({ type: 'TOGGLE_SETTINGS', payload: false });
    };

    const inputStyle = {
        width: '100%',
        padding: '8px',
        border: '1px solid var(--border-color, #ccc)',
        borderRadius: '4px',
        fontSize: '13px',
        boxSizing: 'border-box',
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '5px',
        fontWeight: 'bold',
        fontSize: '12px',
        color: '#555',
    };

    const rowStyle = {
        marginBottom: '14px',
    };

    const sectionTitle = (text) => (
        <div style={{
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            color: '#999',
            borderBottom: '1px solid #eee',
            paddingBottom: '4px',
            marginBottom: '12px',
            marginTop: '8px',
            letterSpacing: '0.5px',
        }}>
            {text}
        </div>
    );

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }} onClick={handleClose}>
            <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '10px',
                width: '340px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>⚙️ Default Settings</h3>

                {/* ── Text ── */}
                {sectionTitle('Text')}

                <div style={rowStyle}>
                    <label style={labelStyle}>Default Text Size (px)</label>
                    <input
                        type="number"
                        min="6"
                        max="72"
                        value={defaultFontSize}
                        onChange={(e) => dispatch({ type: 'SET_DEFAULT_FONT_SIZE', payload: parseInt(e.target.value, 10) || 8 })}
                        style={inputStyle}
                    />
                </div>

                {/* ── Stamps ── */}
                {sectionTitle('Stamps')}

                <div style={rowStyle}>
                    <label style={labelStyle}>Default Stamp Size (px)</label>
                    <input
                        type="number"
                        min="10"
                        max="200"
                        value={defaultStampSize}
                        onChange={(e) => dispatch({ type: 'SET_DEFAULT_STAMP_SIZE', payload: parseInt(e.target.value, 10) || 20 })}
                        style={inputStyle}
                    />
                </div>

                {/* ── Lines & Shapes ── */}
                {sectionTitle('Lines & Shapes')}

                <div style={rowStyle}>
                    <label style={labelStyle}>Default Line Thickness (px)</label>
                    <input
                        type="number"
                        min="1"
                        max="20"
                        value={defaultLineThickness}
                        onChange={(e) => dispatch({ type: 'SET_DEFAULT_LINE_THICKNESS', payload: parseInt(e.target.value, 10) || 1 })}
                        style={inputStyle}
                    />
                </div>

                <div style={{ ...rowStyle, marginBottom: '4px' }}>
                    <label style={{ ...labelStyle, color: '#999', fontWeight: 'normal', fontStyle: 'italic' }}>
                        Shape color follows the selected Role color (Drawer / Checker / Approver)
                    </label>
                </div>

                {/* ── User / Date Stamp ── */}
                {sectionTitle('User / Date Stamp')}

                <div style={rowStyle}>
                    <label style={labelStyle}>Name (Auto-filled from Account)</label>
                    <div style={{ ...inputStyle, background: '#f5f5f5', color: '#666', border: '1px solid #ddd' }}>
                        {authUserName ? formatUserName(authUserName) : 'Reviewer'}
                    </div>
                </div>

                <div style={{ ...rowStyle, marginBottom: '20px' }}>
                    <label style={labelStyle}>Default Department</label>
                    <input
                        type="text"
                        value={defaultDepartment}
                        onChange={(e) => dispatch({ type: 'SET_DEFAULT_DEPARTMENT', payload: e.target.value })}
                        style={inputStyle}
                        placeholder="ROD ENG"
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '8px 20px',
                            background: 'var(--accent-blue, #3498db)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 'bold',
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
