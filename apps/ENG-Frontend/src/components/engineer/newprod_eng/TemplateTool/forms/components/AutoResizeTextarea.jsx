import React, { useRef, useEffect, useCallback } from 'react';

/**
 * AutoResizeTextarea — A controlled <textarea> that auto-expands to fit content.
 *
 * Replaces contentEditable divs to permanently fix cursor-jumping bugs.
 * React manages cursor position natively with controlled textarea.
 *
 * Props:
 *   value      — current text value
 *   onChange    — (newValue: string) => void
 *   disabled   — read-only mode
 *   className  — CSS class for styling
 *   style      — inline styles
 *   minHeight  — minimum height in px (default: 22)
 */
const AutoResizeTextarea = React.memo(({ value, onChange, disabled, className, style, minHeight = 22 }) => {
    const ref = useRef(null);

    // Auto-resize height to fit content
    const adjustHeight = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
    }, [minHeight]);

    // Adjust on value change (e.g., initial load)
    useEffect(() => {
        adjustHeight();
    }, [value, adjustHeight]);

    // Also adjust on window resize (in case column widths change)
    useEffect(() => {
        window.addEventListener('resize', adjustHeight);
        return () => window.removeEventListener('resize', adjustHeight);
    }, [adjustHeight]);

    const handleChange = (e) => {
        onChange?.(e.target.value);
    };

    return (
        <textarea
            ref={ref}
            value={value || ''}
            onChange={handleChange}
            disabled={disabled}
            className={className}
            rows={1}
            style={{
                resize: 'none',
                overflow: 'hidden',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
                padding: '2px 4px',
                textAlign: 'center',
                minHeight: `${minHeight}px`,
                lineHeight: '1.4',
                ...style,
            }}
        />
    );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default AutoResizeTextarea;
