import React, { useState, useEffect, useRef } from 'react';
import { usePdf } from '../context/PdfContext';

export default function PropertyPanel({ annotation, pageSize }) {
    const { dispatch } = usePdf();
    const panelRef = useRef(null);
    const [panelPos, setPanelPos] = useState({ left: 0, top: 0 });

    useEffect(() => {
        // Calculate position relative to the page
        const panelWidth = 240; // Approximate width including padding/shadow
        let left = annotation.x + (annotation.width || 0) + 15;
        let top = annotation.y;

        // If it goes off the right edge, flip to the left side
        if (pageSize && (left + panelWidth > pageSize.width)) {
            left = annotation.x - panelWidth - 15;
        }

        // Keep inside bounds
        left = Math.max(0, left);
        top = Math.max(0, top);

        // Keep vertical inside bounds (optional, but good for bottom of page)
        // if (pageSize && top + 300 > pageSize.height) top = pageSize.height - 300;

        setPanelPos({ left, top });
    }, [annotation, pageSize]);

    useClickOutside(panelRef, () => dispatch({ type: 'DESELECT_ANNOTATION' }));

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                dispatch({ type: 'DESELECT_ANNOTATION' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch]);

    const handleDelete = () => {
        dispatch({ type: 'DELETE_ANNOTATION', payload: annotation.id });
    };

    const handleUpdate = (changes) => {
        dispatch({ type: 'UPDATE_ANNOTATION', payload: { id: annotation.id, changes } });
    };

    const renderColorPicker = (label, value, key) => (
        <div className="property-row">
            <label>{label}</label>
            <input
                type="color"
                value={value || '#ffeb3b'}
                onChange={(e) => handleUpdate({ [key]: e.target.value })}
            />
        </div>
    );

    const renderHighlightProps = () => (
        <>
            <div className="property-row">
                <label>Color</label>
                <input
                    type="color"
                    value={rgbaToHex(annotation.color) || '#ffeb3b'}
                    onChange={(e) => handleUpdate({ color: hexToRgba(e.target.value, 0.4) })}
                />
            </div>
        </>
    );

    const renderTextBoxProps = () => (
        <>
            <div className="format-btns">
                <button
                    className={`format-btn ${annotation.bold ? 'active' : ''}`}
                    onClick={() => handleUpdate({ bold: !annotation.bold })}
                    title="Bold"
                >
                    <b>B</b>
                </button>
                <button
                    className={`format-btn ${annotation.italic ? 'active' : ''}`}
                    onClick={() => handleUpdate({ italic: !annotation.italic })}
                    title="Italic"
                >
                    <i>I</i>
                </button>
                <button
                    className={`format-btn ${annotation.underline ? 'active' : ''}`}
                    onClick={() => handleUpdate({ underline: !annotation.underline })}
                    title="Underline"
                >
                    <u>U</u>
                </button>
            </div>
            <div className="property-row">
                <label>Size</label>
                <input
                    type="number"
                    value={annotation.fontSize || 14}
                    min={8}
                    max={72}
                    onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value, 10) })}
                />
            </div>
            <div className="property-row">
                <label>Color</label>
                <input
                    type="color"
                    value={annotation.fontColor || '#333333'}
                    onChange={(e) => handleUpdate({ fontColor: e.target.value })}
                />
            </div>
            <div className="property-row">
                <label>Fill</label>
                <input
                    type="checkbox"
                    checked={annotation.fill !== false} // Default to true
                    onChange={(e) => handleUpdate({ fill: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                />
            </div>
            <div className="property-row">
                <label>Align H</label>
                <div className="format-btns">
                    <button
                        className={`format-btn ${annotation.textAlign === 'left' ? 'active' : ''}`}
                        onClick={() => handleUpdate({ textAlign: 'left' })}
                        title="Left"
                    >
                        L
                    </button>
                    <button
                        className={`format-btn ${annotation.textAlign === 'center' ? 'active' : ''}`}
                        onClick={() => handleUpdate({ textAlign: 'center' })}
                        title="Center"
                    >
                        C
                    </button>
                    <button
                        className={`format-btn ${annotation.textAlign === 'right' ? 'active' : ''}`}
                        onClick={() => handleUpdate({ textAlign: 'right' })}
                        title="Right"
                    >
                        R
                    </button>
                </div>
            </div>
            <div className="property-row">
                <label>Align V</label>
                <div className="format-btns">
                    <button
                        className={`format-btn ${annotation.verticalAlign === 'top' ? 'active' : ''}`}
                        onClick={() => handleUpdate({ verticalAlign: 'top' })}
                        title="Top"
                    >
                        T
                    </button>
                    <button
                        className={`format-btn ${annotation.verticalAlign === 'middle' ? 'active' : ''}`}
                        onClick={() => handleUpdate({ verticalAlign: 'middle' })}
                        title="Middle"
                    >
                        M
                    </button>
                    <button
                        className={`format-btn ${annotation.verticalAlign === 'bottom' ? 'active' : ''}`}
                        onClick={() => handleUpdate({ verticalAlign: 'bottom' })}
                        title="Bottom"
                    >
                        B
                    </button>
                </div>
            </div>
            <div className="property-row">
                <label>Font</label>
                <select
                    value={annotation.fontFamily || 'Arial'}
                    onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                </select>
            </div>
        </>
    );

    const renderStampProps = () => (
        <>
            {renderColorPicker('Color', annotation.color, 'color')}
            <div className="property-row">
                <label>Size</label>
                <input
                    type="number"
                    value={annotation.width || 40}
                    min={20}
                    max={200}
                    onChange={(e) => {
                        const s = parseInt(e.target.value, 10);
                        handleUpdate({ width: s, height: s });
                    }}
                />
            </div>
        </>
    );

    const renderUserDateProps = () => (
        <>
            {renderColorPicker('Color', annotation.color, 'color')}
            <div className="property-row">
                <label>Size</label>
                <input
                    type="number"
                    value={annotation.width || 80}
                    min={40}
                    max={300}
                    onChange={(e) => {
                        const s = parseInt(e.target.value, 10);
                        handleUpdate({ width: s, height: s });
                    }}
                />
            </div>
            <div className="property-row">
                <label>Department</label>
                <input
                    type="text"
                    value={annotation.department || ''}
                    onChange={(e) => handleUpdate({ department: e.target.value })}
                />
            </div>
        </>
    );

    const renderArrowProps = () => (
        <>
            {renderColorPicker('Color', annotation.color, 'color')}
            <div className="property-row">
                <label>Thickness</label>
                <input
                    type="number"
                    value={annotation.thickness || 1}
                    min={1}
                    max={20}
                    onChange={(e) => handleUpdate({ thickness: parseInt(e.target.value, 10) })}
                />
            </div>

            <div className="property-row">
                <label>Start Head</label>
                <select
                    value={annotation.headStart || 'none'}
                    onChange={(e) => handleUpdate({ headStart: e.target.value })}
                >
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                    <option value="circle">Circle</option>
                </select>
            </div>
            <div className="property-row">
                <label>End Head</label>
                <select
                    value={annotation.headEnd || 'arrow'}
                    onChange={(e) => handleUpdate({ headEnd: e.target.value })}
                >
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                    <option value="circle">Circle</option>
                </select>
            </div>
        </>
    );

    const renderShapeProps = () => (
        <>
            {renderColorPicker('Color', annotation.color, 'color')}
            <div className="property-row">
                <label>Thickness</label>
                <input
                    type="number"
                    value={annotation.thickness || 1}
                    min={1}
                    max={20}
                    onChange={(e) => handleUpdate({ thickness: parseInt(e.target.value, 10) })}
                />
            </div>
        </>
    );

    const renderProps = () => {
        switch (annotation.type) {
            case 'highlight-rect':
            case 'highlight-ellipse':
                return renderHighlightProps();
            case 'text-box':
                return renderTextBoxProps();
            case 'stamp-check':
            case 'stamp-cross':
            case 'stamp-circle':
            case 'stamp-ok':
                return renderStampProps();
            case 'stamp-userdate':
                return renderUserDateProps();
            case 'arrow':
                return renderArrowProps();
            case 'shape-rect':
            case 'shape-ellipse':
                return renderShapeProps();
            default:
                return null;
        }
    };

    return (
        <div
            ref={panelRef}
            className="property-panel"
            style={{
                position: 'absolute', // Override CSS fixed
                left: panelPos.left,
                top: panelPos.top,
                right: 'auto', // Reset right from previous fixed style
                zIndex: 100
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>{getTypeLabel(annotation.type)}</h4>
                <button
                    onClick={() => dispatch({ type: 'DESELECT_ANNOTATION' })}
                    style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '0 4px', color: '#666' }}
                    title="Close"
                >
                    ✕
                </button>
            </div>
            {renderProps()}
            <button className="delete-btn" onClick={handleDelete}>
                🗑 Delete
            </button>
        </div>
    );
}

// Add click outside listener
function useClickOutside(ref, callback) {
    useEffect(() => {
        function handleClickOutside(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                callback();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref, callback]);
}

function getTypeLabel(type) {
    switch (type) {
        case 'highlight-rect': return 'Rectangle Highlight';
        case 'highlight-ellipse': return 'Ellipse Highlight';
        case 'text-box': return 'Text Box';
        case 'stamp-check': return 'Checkmark Stamp';
        case 'stamp-cross': return 'Cross Stamp';
        case 'stamp-circle': return 'Circle Stamp';
        case 'stamp-ok': return 'OK Stamp';
        case 'stamp-userdate': return 'User/Date Stamp';
        case 'arrow': return 'Arrow';
        case 'shape-rect': return 'Rectangle Shape';
        case 'shape-ellipse': return 'Ellipse Shape';
        default: return 'Properties';
    }
}

function rgbaToHex(rgba) {
    if (!rgba) return '#ffeb3b';
    const match = rgba.match(/\d+/g);
    if (!match || match.length < 3) return rgba.startsWith('#') ? rgba : '#ffeb3b';
    const r = parseInt(match[0]).toString(16).padStart(2, '0');
    const g = parseInt(match[1]).toString(16).padStart(2, '0');
    const b = parseInt(match[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function hexToRgba(hex, alpha = 0.4) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
