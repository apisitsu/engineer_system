import React, { useRef, useEffect } from 'react';
import useDraggable from '../../hooks/useDraggable';
import useResizable from '../../hooks/useResizable';

export default function TextBox({ annotation, isSelected, onSelect, onUpdate }) {
    const { x, y, width, height, text, fontSize, fontFamily, fontColor, bold, italic, underline, textAlign = 'left', verticalAlign = 'top' } = annotation;
    const contentRef = useRef(null);
    const handleRef = useRef(null); // Ref for the drag handle

    const { handleMouseDown: handleDrag } = useDraggable(annotation, onUpdate);
    const { handleMouseDown: handleResize } = useResizable(annotation, onUpdate);

    useEffect(() => {
        // Focus handle if selected but not editing text (optional, but good for delete)
        if (isSelected && !text && contentRef.current) {
            contentRef.current.focus();
        }
    }, [isSelected, text]);

    const handleInput = (e) => {
        onUpdate({ text: e.target.value });
    };

    const flexJustify = textAlign === 'center' ? 'center' : (textAlign === 'right' ? 'flex-end' : 'flex-start');
    const flexAlign = verticalAlign === 'middle' ? 'center' : (verticalAlign === 'bottom' ? 'flex-end' : 'flex-start');

    const style = {
        fontSize: `${fontSize || 12}px`,
        fontFamily: fontFamily || 'Arial',
        color: fontColor || '#333',
        fontWeight: bold ? 'bold' : 'normal',
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: underline ? 'underline' : 'none',
        textAlign: textAlign,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: flexAlign, // Vertical alignment in flex column
        width: '100%',
        height: '100%',
    };

    return (
        <div
            className={`annotation-item text-box-annotation ${isSelected ? 'selected' : ''}`}
            style={{
                left: x,
                top: y,
                width: width,
                minHeight: height,
                background: (annotation.fill === false) ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
                border: (annotation.fill === false) ? '1px dashed #ccc' : '1px solid #ccc',
                display: 'flex',
                alignItems: 'stretch', // Ensure content fills width
            }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget || !isSelected) {
                    e.stopPropagation();
                    onSelect(e);
                    // If focusing the box itself (via border), prevent default to allow key events on container if needed
                    // But we want to allow editing eventually.
                    if (!isSelected) handleDrag(e);
                }
            }}
        >
            {isSelected ? (
                <>
                    <div
                        ref={handleRef}
                        className="drag-handle"
                        tabIndex={-1} // Make focusable
                        style={{
                            position: 'absolute',
                            top: -16,
                            left: 0,
                            right: 0,
                            height: 16,
                            background: '#3498db',
                            borderTopLeftRadius: 3,
                            borderTopRightRadius: 3,
                            cursor: 'move',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            outline: 'none' // Remove focus outline
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            // We don't prevent default here so it can receive focus
                            handleDrag(e);
                            if (handleRef.current) handleRef.current.focus(); // Explicitly focus for Delete key
                        }}
                    >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
                            <path d="M11 18h2v-4h4v-2h-4V8h4V6h-4V2h-2v4H7v2h4v4H7v2h4v4z" />
                        </svg>
                    </div>
                    <textarea
                        ref={contentRef}
                        className="text-content-edit"
                        value={text}
                        style={{
                            ...style,
                            resize: 'none',
                            overflow: 'hidden',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            padding: 5,
                            margin: 0,
                            // Reset flex for textarea interaction but keep alignment visually if possible
                            // Textarea doesn't support vertical-align: middle easily without padding hacks.
                            // However, we can use padding to simulate it or just let flex parent handle it?
                            // No, textarea is a replaced element.
                            // For true vertical align in textarea, we need a wrapper or use padding-top.
                            // Simplified approach: Textarea fills the box. Vertical align only works if textarea is smaller?
                            // No, typically you want the text INSIDE to align.
                            // For simplicity: We'll assume top alignment for editing, but View Mode respects specific alignment.
                            // OR: We try to use paddingTop.
                        }}
                        onChange={handleInput}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </>
            ) : (
                <div className="text-content" style={{
                    ...style,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    // Override justifyContent/alignItems for text content behavior
                    justifyContent: flexAlign, // Vertical
                    alignItems: flexJustify, // Horizontal (for flex column) implies cross-axis? No.
                    // Let's use standard text-align for Horizontal
                    textAlign: textAlign,
                    // For Vertical in a div:
                }}>
                    <span style={{ width: '100%' }}>{text || 'Double click to edit'}</span>
                </div>
            )}
            {isSelected && (
                <div className="resize-handle" onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResize(e);
                }} />
            )}
        </div>
    );
}
